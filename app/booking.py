"""Bookings, bus assignment and fleet operations.

Overbooking is prevented by the database (constraint no_double_booking in 001_init.sql):
this module picks the least-used free bus and simply tries to insert the ride. If another
booking took that bus a moment earlier, PostgreSQL refuses the insert and we try the next bus.
"""
from __future__ import annotations

import secrets
from dataclasses import dataclass, field
from datetime import date, datetime

import psycopg
from psycopg import errors

from . import audit, clock, rules, sms
from .audit import Actor
from .rules import Leg
from .schemas import EndpointIn

ACTIVE = ["requested", "confirmed"]
REF_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
TRANSITIONS = {"requested": {"confirmed", "declined", "cancelled"}, "confirmed": {"cancelled"}}


class BookingError(Exception):
    def __init__(self, code: str, status: int = 409, **extra):
        super().__init__(code)
        self.code, self.status, self.extra = code, status, extra


class _Undo(Exception):
    """Raised inside a transaction to roll it back."""


@dataclass
class Passenger:
    channel: str                       # "web" or "phone"
    lang: str
    name: str | None
    phone: str | None
    pickup: EndpointIn
    dropoff: EndpointIn
    adults: int
    children: int
    needs: list[str] = field(default_factory=list)
    sms_updates: bool = True
    resident_declared: bool = False
    resident_id: int | None = None
    staff_id: int | None = None


@dataclass
class Outcome:
    booking_id: int | None
    ref: str | None
    booked: list[dict]
    failed: list[Leg]


# --- finding a bus -----------------------------------------------------------------------------
def free_buses(cur, start: datetime, end: datetime) -> list[int]:
    """Buses free for the whole period, least-used that day first."""
    day_start, day_end = clock.day_bounds(start.astimezone(clock.TZ).date())
    cur.execute(
        """SELECT b.id
             FROM bus b
            WHERE b.active
              AND NOT EXISTS (SELECT 1 FROM bus_unavailability u
                               WHERE u.bus_id = b.id AND u.period && tstzrange(%(s)s, %(e)s))
              AND NOT EXISTS (SELECT 1 FROM ride r
                               WHERE r.bus_id = b.id AND r.status = ANY(%(active)s)
                                 AND r.slot && tstzrange(%(s)s, %(e)s))
            ORDER BY (SELECT coalesce(sum(extract(epoch FROM upper(r.slot) - lower(r.slot))), 0)
                        FROM ride r
                       WHERE r.bus_id = b.id AND r.status = ANY(%(active)s)
                         AND r.slot && tstzrange(%(ds)s, %(de)s)), b.id""",
        {"s": start, "e": end, "ds": day_start, "de": day_end, "active": ACTIVE})
    return [r["id"] for r in cur.fetchall()]


def _put_on_bus(cur, bus_id: int, sql: str, params: tuple) -> bool:
    """Run an INSERT/UPDATE that places a ride on a bus. False if the bus turned out to be taken."""
    conn = cur.connection
    try:
        with conn.transaction():  # savepoint: a refusal only undoes this one attempt
            # Waits if someone is taking this bus out of service right now.
            cur.execute("SELECT 1 FROM bus WHERE id = %s FOR SHARE", (bus_id,))
            cur.execute(sql, params)
        return True
    except errors.ExclusionViolation:
        return False
    except errors.CheckViolation as e:
        if e.diag.constraint_name == "bus_in_service":
            return False
        raise


def _assign_leg(cur, booking_id: int, leg: Leg, status: str) -> tuple[int, int] | None:
    for bus in free_buses(cur, leg.start, leg.end):
        ok = _put_on_bus(cur, bus, """
            INSERT INTO ride (booking_id, kind, pickup_at, ride_minutes, slot, bus_id, status)
            VALUES (%s, %s, %s, %s, tstzrange(%s, %s), %s, %s)""",
            (booking_id, leg.kind, leg.pickup_at, leg.ride_minutes, leg.start, leg.end, bus, status))
        if ok:
            cur.execute("SELECT currval('ride_id_seq') AS id")
            return cur.fetchone()["id"], bus
    return None


def _insert_booking(cur, p: Passenger) -> tuple[int, str]:
    for _ in range(10):
        ref = "RB-" + "".join(secrets.choice(REF_CHARS) for _ in range(5))
        try:
            with cur.connection.transaction():
                cur.execute(
                    """INSERT INTO booking (ref, channel, lang, resident_id, created_by_staff, passenger_name, phone,
                                            pickup_street, dropoff_street, needs, pickup_locality, pickup_dest,
                                            dropoff_locality, dropoff_dest, adults, children, sms_updates,
                                            resident_declared)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
                    (ref, p.channel, p.lang, p.resident_id, p.staff_id, p.name, p.phone,
                     p.pickup.street if p.pickup.mode == "commune" else None,
                     p.dropoff.street if p.dropoff.mode == "commune" else None,
                     list(p.needs),
                     p.pickup.locality if p.pickup.mode == "commune" else None,
                     p.pickup.dest if p.pickup.mode == "dest" else None,
                     p.dropoff.locality if p.dropoff.mode == "commune" else None,
                     p.dropoff.dest if p.dropoff.mode == "dest" else None,
                     p.adults, p.children, p.sms_updates, p.resident_declared))
                return cur.fetchone()["id"], ref
        except errors.UniqueViolation:
            continue
    raise RuntimeError("could not create a booking reference")


def _log_turned_away(conn, p: Passenger, legs: list[Leg]) -> None:
    if not legs:
        return
    with conn.transaction(), conn.cursor() as cur:
        for leg in legs:
            a, b = (p.pickup, p.dropoff) if leg.kind == "out" else (p.dropoff, p.pickup)
            cur.execute("""INSERT INTO turned_away (wanted_at, from_area, to_area, passengers, channel)
                           VALUES (%s, %s, %s, %s, %s)""",
                        (leg.pickup_at, rules.area(a), rules.area(b), p.adults + p.children, p.channel))


def book(conn: psycopg.Connection, p: Passenger, legs: list[Leg], *,
         status: str = "requested", accept_partial: bool = True, dry_run: bool = False,
         actor: Actor | None = None) -> Outcome:
    """Create a booking and put each ride on a free bus, all in one transaction.

    dry_run: do everything, then roll back. Used for the preview, so it is exact.
    """
    for attempt in range(3):
        try:
            with conn.transaction(force_rollback=dry_run), conn.cursor() as cur:
                booking_id, ref = _insert_booking(cur, p)
                booked, failed = [], []
                for leg in sorted(legs, key=lambda x: x.start):  # same order everywhere avoids deadlocks
                    got = _assign_leg(cur, booking_id, leg, status)
                    if got:
                        booked.append({"ride_id": got[0], "bus": got[1], "date": leg.day.isoformat(),
                                       "time": rules.hhmm(leg.pickup_at), "kind": leg.kind})
                    else:
                        failed.append(leg)
                if not dry_run:
                    if not booked:
                        raise _Undo("full")
                    if failed and not accept_partial:
                        raise _Undo("partial")
                    audit.log(cur, actor or Actor("resident", p.resident_id), "booking.created", "booking",
                              booking_id, channel=p.channel, rides=len(booked), not_booked=len(failed))
            break
        except errors.DeadlockDetected:
            if attempt == 2:
                raise
        except _Undo as signal:
            if str(signal) == "full":
                _log_turned_away(conn, p, failed)
                raise BookingError("errFull", failed=[_leg_json(l) for l in failed])
            raise BookingError("partial", failed=[_leg_json(l) for l in failed],
                               rides=len(booked))
    if not dry_run:
        _log_turned_away(conn, p, failed)
    return Outcome(None if dry_run else booking_id, None if dry_run else ref, booked, failed)


def _leg_json(leg: Leg) -> dict:
    return {"date": leg.day.isoformat(), "time": rules.hhmm(leg.pickup_at), "kind": leg.kind}


# --- availability shown in the booking form ------------------------------------------------------
def availability(cur, trip, now: datetime) -> dict:
    """For each pickup time: buses free on the busiest chosen day, and on how many chosen days a bus is free."""
    kind = getattr(trip, "kind", "out")
    a, b = (trip.pickup, trip.dropoff) if kind == "out" else (trip.dropoff, trip.pickup)
    minutes = rules.ride_minutes(a, b)
    days = rules.trip_days(trip)
    if not days or (kind == "return" and not trip.time):
        return {"ride_minutes": minutes, "slots": []}
    after = rules.parse_hhmm(trip.time) if kind == "return" else None
    bookable = {d: set(rules.bookable_times(d, now, after)) for d in days}

    lo, _ = clock.day_bounds(min(days))
    _, hi = clock.day_bounds(max(days))
    cur.execute("SELECT id FROM bus WHERE active ORDER BY id")
    buses = [r["id"] for r in cur.fetchall()]
    cur.execute("""SELECT bus_id, lower(slot) AS s, upper(slot) AS e FROM ride
                    WHERE bus_id IS NOT NULL AND status = ANY(%s) AND slot && tstzrange(%s, %s)""",
                (ACTIVE, lo, hi))
    busy: dict[int, list] = {x: [] for x in buses}
    for r in cur.fetchall():
        busy.setdefault(r["bus_id"], []).append((r["s"], r["e"]))
    cur.execute("""SELECT bus_id, lower(period) AS s, upper(period) AS e FROM bus_unavailability
                    WHERE period && tstzrange(%s, %s)""", (lo, hi))
    for r in cur.fetchall():
        busy.setdefault(r["bus_id"], []).append((r["s"], r["e"]))

    def free_count(start: datetime, end: datetime) -> int:
        return sum(1 for x in buses if not any(s < end and start < e for s, e in busy[x]))

    slots = []
    for t in rules.pickup_times():
        if any(t not in bookable[d] for d in days):
            continue                      # a time is offered only if it can be booked on every chosen day
        counts = [free_count(*rules.busy_window(clock.at(d, t), minutes)) for d in days]
        slots.append({"time": rules.hhmm(t), "free": min(counts),
                      "days_ok": sum(1 for c in counts if c > 0), "days": len(days)})
    return {"ride_minutes": minutes, "slots": slots}


# --- ride operations -----------------------------------------------------------------------------
def _ride_for_update(cur, ride_id: int) -> dict:
    cur.execute("""SELECT r.*, b.ref, b.phone, b.lang, b.sms_updates, b.resident_id, b.pickup_locality,
                          b.pickup_street, b.pickup_dest, b.dropoff_locality, b.dropoff_street, b.dropoff_dest
                     FROM ride r JOIN booking b ON b.id = r.booking_id
                    WHERE r.id = %s FOR UPDATE OF r""", (ride_id,))
    row = cur.fetchone()
    if not row:
        raise BookingError("notFound", 404)
    return row


def _notify(cur, row: dict, purpose: str) -> None:
    if not (row["sms_updates"] and row["phone"]):
        return
    if row["kind"] == "out":
        place = rules.place_label(row["pickup_locality"], row["pickup_street"], row["pickup_dest"])
    else:
        place = rules.place_label(row["dropoff_locality"], row["dropoff_street"], row["dropoff_dest"])
    local = row["pickup_at"].astimezone(clock.TZ)
    sms.send(cur, row["phone"], purpose, row["lang"], day=sms.fmt_day(local), time=rules.hhmm(local),
             ref=row["ref"], place=place)


def set_status(conn, ride_id: int, status: str, actor: Actor, notify: bool = True) -> None:
    with conn.transaction(), conn.cursor() as cur:
        row = _ride_for_update(cur, ride_id)
        if status not in TRANSITIONS.get(row["status"], set()):
            raise BookingError("badTransition", current=row["status"])
        if status == "confirmed" and row["bus_id"] is None:
            raise BookingError("needsBus")
        cur.execute("UPDATE ride SET status = %s, updated_at = now() WHERE id = %s", (status, ride_id))
        audit.log(cur, actor, f"ride.{status}", "ride", ride_id, previous=row["status"])
        if notify:
            _notify(cur, row, status)


def cancel_own(conn, resident_id: int, ride_id: int, now: datetime) -> None:
    with conn.transaction(), conn.cursor() as cur:
        row = _ride_for_update(cur, ride_id)
        if row["resident_id"] != resident_id:
            raise BookingError("notFound", 404)
        if row["status"] not in ACTIVE:
            raise BookingError("badTransition", current=row["status"])
        if row["pickup_at"] <= now:
            raise BookingError("tooLate")
        cur.execute("UPDATE ride SET status = 'cancelled', updated_at = now() WHERE id = %s", (ride_id,))
        audit.log(cur, Actor("resident", resident_id), "ride.cancelled", "ride", ride_id)


def move(conn, ride_id: int, bus_id: int, actor: Actor) -> None:
    with conn.transaction(), conn.cursor() as cur:
        row = _ride_for_update(cur, ride_id)
        if row["status"] not in ACTIVE:
            raise BookingError("badTransition", current=row["status"])
        cur.execute("SELECT 1 FROM bus WHERE id = %s AND active", (bus_id,))
        if not cur.fetchone():
            raise BookingError("notFound", 404)
        if not _put_on_bus(cur, bus_id, "UPDATE ride SET bus_id = %s, updated_at = now() WHERE id = %s",
                           (bus_id, ride_id)):
            raise BookingError("busBusy")
        audit.log(cur, actor, "ride.moved", "ride", ride_id, from_bus=row["bus_id"], to_bus=bus_id)


def out_of_service(conn, bus_id: int, day: date, actor: Actor, reason: str | None = None) -> int:
    """Take a bus out of service for a whole day. Its rides move to 'needs a bus'."""
    start, end = clock.day_bounds(day)
    with conn.transaction(), conn.cursor() as cur:
        cur.execute("SELECT id FROM bus WHERE id = %s FOR UPDATE", (bus_id,))  # blocks new bookings on it
        if not cur.fetchone():
            raise BookingError("notFound", 404)
        cur.execute("""UPDATE ride SET bus_id = NULL, updated_at = now()
                        WHERE bus_id = %s AND status = ANY(%s) AND slot && tstzrange(%s, %s)""",
                    (bus_id, ACTIVE, start, end))
        moved = cur.rowcount
        try:
            with conn.transaction():
                cur.execute("""INSERT INTO bus_unavailability (bus_id, period, reason, created_by)
                               VALUES (%s, tstzrange(%s, %s), %s, %s)""",
                            (bus_id, start, end, reason, actor.id if actor.type == "staff" else None))
        except errors.ExclusionViolation:
            raise BookingError("alreadyOut")
        audit.log(cur, actor, "bus.out_of_service", "bus", bus_id, day=day.isoformat(), rides_unassigned=moved)
    return moved


def back_in_service(conn, bus_id: int, day: date, actor: Actor) -> None:
    start, end = clock.day_bounds(day)
    with conn.transaction(), conn.cursor() as cur:
        cur.execute("DELETE FROM bus_unavailability WHERE bus_id = %s AND period && tstzrange(%s, %s)",
                    (bus_id, start, end))
        audit.log(cur, actor, "bus.in_service", "bus", bus_id, day=day.isoformat())


def auto_assign(conn, day: date, actor: Actor) -> dict:
    """Put rides that need a bus on any bus that is free, earliest first."""
    start, end = clock.day_bounds(day)
    assigned = waiting = 0
    with conn.transaction(), conn.cursor() as cur:
        cur.execute("""SELECT id, lower(slot) AS s, upper(slot) AS e FROM ride
                        WHERE bus_id IS NULL AND status = ANY(%s) AND slot && tstzrange(%s, %s)
                        ORDER BY lower(slot) FOR UPDATE""", (ACTIVE, start, end))
        for r in cur.fetchall():
            for bus in free_buses(cur, r["s"], r["e"]):
                if _put_on_bus(cur, bus, "UPDATE ride SET bus_id = %s, updated_at = now() WHERE id = %s",
                               (bus, r["id"])):
                    assigned += 1
                    break
            else:
                waiting += 1
        audit.log(cur, actor, "rides.auto_assigned", "day", None, day=day.isoformat(),
                  assigned=assigned, still_waiting=waiting)
    return {"assigned": assigned, "waiting": waiting}
