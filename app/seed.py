"""Demo data: three staff accounts and a realistic fortnight of rides.

Names, phone numbers (+352 600 000 xxx, not a mobile range) and house numbers are invented.
Used only when SEED_DEMO_DATA is on and the database is empty, or by `python -m app.cli reset-demo`.
"""
from __future__ import annotations

import random
from datetime import date, datetime, time, timedelta

from . import booking, clock, rules, security
from .audit import Actor
from .booking import BookingError, Passenger
from .config import settings
from .schemas import EndpointIn, TripIn

DEMO_STAFF = [
    # username, display name, role, password
    ("dispatch", "Centrale (démo)", "dispatcher", "ruffbus-dispatch"),
    ("commune", "Service mobilité (démo)", "viewer", "ruffbus-commune"),
    ("admin", "Administrateur (démo)", "admin", "ruffbus-admin"),
]
DEMO_RESIDENT_PHONE = "+352600000000"
DEMO_RESIDENT_NAME = "Alex Demo"

NAMES = ["Marie Hoffmann", "Jos Schmit", "Ana Ferreira", "Lucien Muller", "Claudine Wagner", "Paulo Santos",
         "Fernande Thill", "Nicolas Reding", "Sofia Costa", "Henri Kieffer", "Léa Becker", "Mia Klein",
         "Romain Faber", "Isabel Martins", "Gaston Hansen", "Nathalie Steichen", "Marco Rossi", "Elise Kremer",
         "João Pereira", "Monique Theis", "Carlo Lentz", "Yvette Marx", "Tom Wirtz", "Rita Gomes"]
STREETS = {
    "Mamer": ["rue de la Gare", "route d'Arlon", "rue du Baumbusch", "rue de Kehlen", "rue des Prés",
              "rue Lydie Schmit", "rue Gaaschtbierg", "place de l'Indépendance"],
    "Capellen": ["route d'Arlon", "rue de la Forêt", "rue des Champs", "rue de Mamer"],
    "Holzem": ["route de Capellen", "rue de Garnich", "rue de Mamer", "rue Principale"],
}
LOCALITY_W = {"Mamer": 0.6, "Capellen": 0.25, "Holzem": 0.15}
DEST_W = {"ber-be": 4, "lux-chl": 3, "str-med": 2, "koe-cac": 2, "ste-hop": 1.5, "ber-cipa": 1, "keh-med": 1,
          "str-the": 1, "ber-con": 1, "ste-pis": 0.5, "ber-adm": 0.3, "dip-adm": 0.3, "gar-adm": 0.3,
          "keh-adm": 0.3, "koe-adm": 0.3, "koe-za": 0.3, "kop-adm": 0.3, "ste-adm": 0.3, "ste-but": 0.3,
          "str-adm": 0.3}
HOUR_W = {9: 3, 10: 4, 11: 3, 12: 1.5, 13: 1.5, 14: 3, 15: 3, 16: 2, 17: 1}
SEED = Actor("system", None, "seed")


def _pick(rng: random.Random, weights: dict):
    return rng.choices(list(weights), weights=list(weights.values()))[0]


def _home(rng: random.Random, locality: str | None = None) -> EndpointIn:
    loc = locality or _pick(rng, LOCALITY_W)
    return EndpointIn(mode="commune", locality=loc, street=f"{rng.randint(1, 80)}, {rng.choice(STREETS[loc])}")


def _random_trip(rng: random.Random, day: date) -> tuple[TripIn, int]:
    start = _home(rng)
    if rng.random() < 0.62:
        end = EndpointIn(mode="dest", dest=_pick(rng, DEST_W))
    else:
        end = _home(rng)
        if end.locality == start.locality and end.street == start.street:
            end = _home(rng, "Mamer" if start.locality != "Mamer" else "Capellen")
    hour = _pick(rng, HOUR_W)
    t = time(hour, rng.choice([0, 15, 30, 45]))
    ret = None
    if end.mode == "dest" and rng.random() < 0.6:
        back = clock.at(day, t) + timedelta(minutes=rng.choice([90, 105, 120, 150, 180]))
        if back.time() <= rules.LAST_PICKUP and back.date() == day:
            ret = rules.hhmm(back)
    adults = rng.choices([1, 2, 3], weights=[80, 15, 5])[0]
    children = rng.choice([1, 2]) if rng.random() < 0.1 else 0
    needs = []
    if rng.random() < 0.07:
        needs.append("wheel")
    if children and rng.random() < 0.5:
        needs.append("stroller")
    if children and rng.random() < 0.4:
        needs.append("seat")
    if rng.random() < 0.1:
        needs.append("bags")
    trip = TripIn(pickup=start, dropoff=end, date=day, time=rules.hhmm(t), return_time=ret,
                  adults=adults, children=children, needs=needs, resident_declared=True)
    return trip, rng.randrange(len(NAMES))


def _passenger(trip: TripIn, channel: str, name: str, phone: str, *, lang: str = "fr",
               resident_id: int | None = None, staff_id: int | None = None) -> Passenger:
    return Passenger(channel, lang, name, phone, trip.pickup, trip.dropoff, trip.adults, trip.children,
                     list(trip.needs), True, trip.resident_declared, resident_id=resident_id, staff_id=staff_id)


def _book(conn, trip: TripIn, p: Passenger, status: str) -> booking.Outcome | None:
    try:
        return booking.book(conn, p, rules.legs_for(trip), status=status, accept_partial=True, actor=SEED)
    except BookingError:
        return None  # every bus busy: logged as turned away, like a real refusal


DEMO_LOCK = 727002  # advisory lock: only one process loads demo data at a time


def refresh_demo(conn, *, force: bool = False, now: datetime | None = None) -> dict | None:
    """Load demo data if the database is empty, if forced, or, with DEMO_DAILY_RESET, once a day.

    A daily reset wipes everything visitors entered and moves the sample fortnight forward.
    Returns what was loaded, or None when nothing had to be done.
    """
    now = now or clock.now()
    today = now.date().isoformat()
    conn.execute("SELECT pg_advisory_lock(%s)", (DEMO_LOCK,))
    try:
        empty = not conn.execute("SELECT count(*) AS n FROM staff_user").fetchone()["n"]
        row = conn.execute("SELECT value FROM app_state WHERE key = 'demo_loaded_on'").fetchone()
        stale = settings.demo_daily_reset and (row is None or row["value"] != today)
        if not (force or empty or stale):
            return None
        if not empty:
            reset(conn)
        counts = seed(conn, now)
        conn.execute("""INSERT INTO app_state (key, value) VALUES ('demo_loaded_on', %s)
                        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()""", (today,))
        return counts
    finally:
        conn.execute("SELECT pg_advisory_unlock(%s)", (DEMO_LOCK,))


def reset(conn) -> None:
    """Delete all data (not the fleet or the schema). Demo use only."""
    with conn.transaction():
        conn.execute("""TRUNCATE ride, booking, bus_unavailability, session, otp_challenge, resident,
                                  turned_away, sms_outbox, audit_log, staff_user RESTART IDENTITY CASCADE""")


def seed(conn, now: datetime | None = None) -> dict:
    now = now or clock.now()
    today = now.date()
    with conn.transaction(), conn.cursor() as cur:
        for username, display, role, password in DEMO_STAFF:
            cur.execute("""INSERT INTO staff_user (username, display_name, password_hash, role)
                           VALUES (%s, %s, %s, %s)""", (username, display, security.hash_password(password), role))
        cur.execute("SELECT id FROM staff_user WHERE username = 'dispatch'")
        dispatcher_id = cur.fetchone()["id"]
        cur.execute("INSERT INTO resident (phone, created_at, last_seen_at) VALUES (%s, %s, %s) RETURNING id",
                    (DEMO_RESIDENT_PHONE, now - timedelta(days=20), now - timedelta(days=1)))
        resident_id = cur.fetchone()["id"]
    dispatcher = Actor("staff", dispatcher_id, "dispatch")

    def service_day(d: date) -> date:
        while rules.is_holiday(d):
            d += timedelta(days=1)
        return d

    # The demo resident's own rides (booked first, so they always find a bus).
    home = EndpointIn(mode="commune", locality="Mamer", street="12, rue de la Gare")
    mine = [
        (service_day(today - timedelta(days=2)), "10:00", "12:30", "ber-be", "confirmed"),
        (service_day(today + timedelta(days=1)), "09:30", "13:00", "lux-chl", "confirmed"),
        (service_day(today + timedelta(days=3)), "14:00", None, "str-med", "requested"),
    ]
    for d, t, r, dest, status in mine:
        trip = TripIn(pickup=home, dropoff=EndpointIn(mode="dest", dest=dest), date=d, time=t, return_time=r,
                      adults=1, resident_declared=True)
        _book(conn, trip, _passenger(trip, "web", DEMO_RESIDENT_NAME, DEMO_RESIDENT_PHONE, lang="en",
                                     resident_id=resident_id), status)

    counts = {"bookings": 0, "turned_away_requests": 0}
    to_confirm: list[int] = []
    for offset in range(-2, 8):
        day = today + timedelta(days=offset)
        if rules.is_holiday(day):
            continue
        rng = random.Random(f"ruffbus-{day.isoformat()}")
        wd = day.isoweekday()
        n = rng.randint(17, 23) if wd <= 5 else rng.randint(11, 15) if wd == 6 else rng.randint(5, 8)
        for _ in range(n):
            trip, who = _random_trip(rng, day)
            phone_call = rng.random() < 0.4
            p = _passenger(trip, "phone" if phone_call else "web", NAMES[who], f"+352600000{100 + who:03d}",
                           lang=rng.choices(["fr", "de", "en", "pt"], weights=[45, 30, 10, 15])[0],
                           staff_id=dispatcher_id if phone_call else None)
            out = _book(conn, trip, p, "confirmed" if phone_call else "requested")
            if out is None:
                counts["turned_away_requests"] += 1
                continue
            counts["bookings"] += 1
            if not phone_call:
                first = min(clock.at(day, rules.parse_hhmm(r["time"])) for r in out.booked)
                if first < now + timedelta(hours=2) or rng.random() < 0.5:
                    to_confirm.extend(r["ride_id"] for r in out.booked)

    # The call centre has already confirmed most web requests; the rest wait in its queue.
    with conn.transaction(), conn.cursor() as cur:
        cur.execute("""UPDATE ride SET status = 'confirmed' WHERE id = ANY(%s) AND pickup_at < %s""",
                    (to_confirm, now))
    cur_rows = conn.execute("SELECT id FROM ride WHERE id = ANY(%s) AND status = 'requested' ORDER BY pickup_at",
                            (to_confirm,)).fetchall()
    for r in cur_rows:
        booking.set_status(conn, r["id"], "confirmed", dispatcher, notify=True)

    # A few cancellations, as in real life.
    with conn.transaction(), conn.cursor() as cur:
        cur.execute("""UPDATE ride SET status = 'cancelled'
                        WHERE id IN (SELECT id FROM ride WHERE status = 'confirmed' ORDER BY md5(id::text) LIMIT 6)""")

    # Bookings were made some hours or days before the ride, never in the future.
    conn.execute("""UPDATE booking b
                       SET created_at = least(%s, (SELECT min(r.pickup_at) FROM ride r WHERE r.booking_id = b.id)
                                                  - make_interval(hours => 2 + (b.id::int * 37) %% 70))""", (now,))

    # Old bookings, past the retention period, so the anonymisation can be shown.
    for i, back in enumerate((100, 99, 97, 96, 95, 94)):
        day = service_day(today - timedelta(days=back))
        rng = random.Random(f"old-{i}")
        trip, who = _random_trip(rng, day)
        out = _book(conn, trip, _passenger(trip, "web", NAMES[who], f"+352600000{100 + who:03d}"), "confirmed")
        if out:
            conn.execute("UPDATE booking SET created_at = %s WHERE id = %s",
                         (clock.at(day, time(8, 0)) - timedelta(days=2), out.booking_id))
    return counts
