"""Endpoints for the call centre and the commune (staff dashboard).

Roles: dispatcher (call centre) and admin see personal data; viewer (for example the commune's
mobility officer) only sees anonymous figures.
"""
from __future__ import annotations

import csv
import io
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.responses import StreamingResponse

from . import audit, auth, booking, clock, privacy, rules, sms, stats
from .auth import StaffSession, current_staff, get_conn, require
from .booking import Passenger
from .config import settings
from .errors import ApiError
from .schemas import BusChange, DayRequest, StaffBookingIn, StaffLogin, StatusChange

router = APIRouter(prefix="/api/staff")
OPS = ("admin", "dispatcher")


@router.post("/login")
def login(body: StaffLogin, response: Response, conn=Depends(get_conn)):
    s = auth.staff_login(conn, body.username, body.password, response)
    return {"username": s.username, "name": s.name, "role": s.role}


@router.post("/logout")
def logout(request: Request, response: Response, conn=Depends(get_conn)):
    auth.end_session(conn, request, response, auth.STAFF_COOKIE)
    return {"ok": True}


@router.get("/session")
def session(request: Request, conn=Depends(get_conn)):
    try:
        s = auth.current_staff(request, conn)
    except ApiError:
        return {"staff": None}
    return {"staff": {"username": s.username, "name": s.name, "role": s.role}}


@router.get("/me")
def me(staff: StaffSession = Depends(current_staff)):
    return {"username": staff.username, "name": staff.name, "role": staff.role}


@router.get("/demo-accounts")
def demo_accounts():
    if not settings.demo_mode:
        raise ApiError(404, "notFound")
    from .seed import DEMO_STAFF
    return {"accounts": [{"username": u, "password": p, "role": r} for u, _, r, p in DEMO_STAFF]}


# --- the day ------------------------------------------------------------------------------------------
def _ride_rows(cur, day: date) -> list[dict]:
    cur.execute("""SELECT r.id, r.kind, r.pickup_at, r.ride_minutes, lower(r.slot) AS s, upper(r.slot) AS e,
                          r.bus_id, r.status, b.ref, b.channel, b.passenger_name, b.phone, b.adults, b.children,
                          b.needs, b.pickup_locality, b.pickup_street, b.pickup_dest,
                          b.dropoff_locality, b.dropoff_street, b.dropoff_dest
                     FROM ride r JOIN booking b ON b.id = r.booking_id
                    WHERE r.pickup_at >= %s AND r.pickup_at < %s
                    ORDER BY r.pickup_at, r.id""", clock.day_bounds(day))
    return cur.fetchall()


def _ride_json(row: dict, day: date, personal: bool) -> dict:
    midnight = clock.day_bounds(day)[0]
    local = row["pickup_at"].astimezone(clock.TZ)
    a_label = rules.place_label(row["pickup_locality"], row["pickup_street"], row["pickup_dest"])
    b_label = rules.place_label(row["dropoff_locality"], row["dropoff_street"], row["dropoff_dest"])
    a_area = row["pickup_locality"] or rules.DESTINATIONS.get(row["pickup_dest"], ("?",))[0]
    b_area = row["dropoff_locality"] or rules.DESTINATIONS.get(row["dropoff_dest"], ("?",))[0]
    if row["kind"] == "return":
        a_label, b_label, a_area, b_area = b_label, a_label, b_area, a_area
    out = {
        "id": row["id"], "kind": row["kind"], "time": rules.hhmm(local), "ride_minutes": row["ride_minutes"],
        "start_min": round((row["s"] - midnight).total_seconds() / 60),
        "end_min": round((row["e"] - midnight).total_seconds() / 60),
        "bus": row["bus_id"], "status": row["status"], "channel": row["channel"],
        "passengers": row["adults"] + row["children"], "from_area": a_area, "to_area": b_area,
    }
    if personal:
        out.update(ref=row["ref"], name=row["passenger_name"], phone=row["phone"], from_=a_label, to=b_label,
                   adults=row["adults"], children=row["children"], needs=row["needs"])
    return out


@router.get("/day")
def day_view(day: date = Query(alias="date"), staff: StaffSession = Depends(current_staff),
             conn=Depends(get_conn)):
    with conn.cursor() as cur:
        st = stats.day_stats(cur, day)
        rides = [_ride_json(r, day, staff.sees_personal_data) for r in _ride_rows(cur, day)]
    for r in rides:  # "from" is a Python keyword
        if "from_" in r:
            r["from"] = r.pop("from_")
    return {"stats": st, "rides": rides, "personal": staff.sees_personal_data}


@router.get("/week")
def week_view(start: date | None = None, days: int = Query(8, ge=1, le=31),
              staff: StaffSession = Depends(current_staff), conn=Depends(get_conn)):
    with conn.cursor() as cur:
        return stats.week_stats(cur, start or clock.today(), days)


@router.get("/day.csv")
def day_csv(day: date = Query(alias="date"), staff: StaffSession = Depends(require(*OPS)),
            conn=Depends(get_conn)):
    with conn.transaction(), conn.cursor() as cur:
        rows = [_ride_json(r, day, True) for r in _ride_rows(cur, day)]
        audit.log(cur, staff.actor, "export.csv", "day", None, day=day.isoformat(), rows=len(rows))
    buf = io.StringIO()
    buf.write("﻿")
    w = csv.writer(buf, delimiter=";")
    w.writerow(["time", "bus", "status", "ref", "name", "phone", "from", "to", "adults", "children", "needs",
                "channel"])
    for r in rows:
        w.writerow([r["time"], r["bus"] or "", r["status"], r["ref"], r["name"] or "", r["phone"] or "",
                    r["from_"], r["to"], r["adults"], r["children"], ",".join(r["needs"]), r["channel"]])
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv; charset=utf-8",
                             headers={"Content-Disposition": f'attachment; filename="ruffbus-{day}.csv"'})


# --- actions --------------------------------------------------------------------------------------------
@router.post("/rides/{ride_id}/status")
def ride_status(ride_id: int, body: StatusChange, staff: StaffSession = Depends(require(*OPS)),
                conn=Depends(get_conn)):
    booking.set_status(conn, ride_id, body.status, staff.actor)
    return {"ok": True}


@router.post("/rides/{ride_id}/bus")
def ride_bus(ride_id: int, body: BusChange, staff: StaffSession = Depends(require(*OPS)), conn=Depends(get_conn)):
    booking.move(conn, ride_id, body.bus_id, staff.actor)
    return {"ok": True}


@router.post("/buses/{bus_id}/out-of-service")
def bus_out(bus_id: int, body: DayRequest, staff: StaffSession = Depends(require(*OPS)), conn=Depends(get_conn)):
    return {"rides_unassigned": booking.out_of_service(conn, bus_id, body.date, staff.actor)}


@router.post("/buses/{bus_id}/in-service")
def bus_in(bus_id: int, body: DayRequest, staff: StaffSession = Depends(require(*OPS)), conn=Depends(get_conn)):
    booking.back_in_service(conn, bus_id, body.date, staff.actor)
    return {"ok": True}


@router.post("/auto-assign")
def auto_assign(body: DayRequest, staff: StaffSession = Depends(require(*OPS)), conn=Depends(get_conn)):
    return booking.auto_assign(conn, body.date, staff.actor)


@router.post("/bookings", status_code=201)
def phone_booking(body: StaffBookingIn, staff: StaffSession = Depends(require(*OPS)), conn=Depends(get_conn)):
    """A booking taken by phone: same rules, same fleet, so web and phone can never double-book."""
    now = clock.now()
    errors = rules.validate_trip(body, now, for_booking=True)
    phone = rules.normalise_phone(body.phone)
    if not body.name.strip():
        errors.setdefault("me", "errName")
    elif not phone:
        errors.setdefault("me", "errPhone")
    if errors:
        raise ApiError(422, "invalid", errors=errors)
    legs, skipped = rules.legs_for(body, now)
    p = Passenger("phone", body.lang, body.name.strip(), phone, body.pickup, body.dropoff, body.adults,
                  body.children, list(dict.fromkeys(body.needs)), body.sms_updates, body.resident_declared,
                  staff_id=staff.id)
    out = booking.book(conn, p, legs, skipped, status="confirmed", accept_partial=body.accept_partial,
                       actor=staff.actor)
    return {"ref": out.ref, "rides": out.booked, "failed": [booking._leg_json(l) for l in out.failed],
            "skipped": [d.isoformat() for d in skipped]}


# --- messages, audit, data protection -------------------------------------------------------------------
@router.get("/sms")
def sms_outbox(staff: StaffSession = Depends(require(*OPS)), conn=Depends(get_conn)):
    rows = conn.execute("SELECT id, phone, body, purpose, created_at FROM sms_outbox ORDER BY id DESC LIMIT 60").fetchall()
    return {"messages": [{"id": r["id"], "to": sms.mask(r["phone"]), "body": r["body"], "purpose": r["purpose"],
                          "at": r["created_at"].astimezone(clock.TZ).isoformat()} for r in rows]}


@router.get("/audit")
def audit_log(staff: StaffSession = Depends(require("admin")), conn=Depends(get_conn)):
    rows = conn.execute("""SELECT at, actor_type, actor_id, actor_name, action, entity, entity_id, detail
                             FROM audit_log ORDER BY id DESC LIMIT 200""").fetchall()
    for r in rows:
        r["at"] = r["at"].astimezone(clock.TZ).isoformat()
    return {"entries": rows}


@router.get("/privacy")
def privacy_overview(staff: StaffSession = Depends(require("admin")), conn=Depends(get_conn)):
    with conn.cursor() as cur:
        return privacy.overview(cur, clock.now())


@router.post("/privacy/retention")
def run_retention(staff: StaffSession = Depends(require("admin")), conn=Depends(get_conn)):
    return privacy.run_retention(conn, clock.now(), staff.actor)
