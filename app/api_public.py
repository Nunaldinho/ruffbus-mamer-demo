"""Endpoints used by residents (the public booking page)."""
from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse

from . import auth, booking, clock, privacy, rules
from .auth import ResidentSession, current_resident, get_conn
from .booking import Passenger
from .config import settings
from .errors import ApiError
from .schemas import AvailabilityIn, BookingIn, CodeRequest, CodeVerify, TripIn

router = APIRouter(prefix="/api")


@router.get("/config")
def config():
    now = clock.now()
    return {
        "demo": settings.demo_mode,
        "now": now.isoformat(),
        "today": now.date().isoformat(),
        "days": [{"date": d.isoformat(), "holiday": rules.is_holiday(d)} for d in rules.window(now)],
        "localities": list(rules.LOCALITIES),
        "destinations": [{"id": k, "commune": c, "name": n} for k, (c, n) in rules.DESTINATIONS.items()],
        "needs": list(rules.NEEDS),
        "rules": {"lead_min": rules.LEAD_MIN, "window_days": rules.WINDOW_DAYS, "seats": rules.SEATS,
                  "days_max": rules.DAYS_MAX, "approach_min": rules.APPROACH_MIN,
                  "dwell_min": rules.DWELL_MIN},
        "retention_days": settings.retention_days,
        "sms_retention_days": settings.sms_retention_days,
        "audit_retention_days": settings.audit_retention_days,
        "demo_daily_reset": settings.demo_mode and settings.seed_demo_data and settings.demo_daily_reset,
    }


@router.post("/availability")
def availability(body: AvailabilityIn, conn=Depends(get_conn)):
    with conn.cursor() as cur:
        return booking.availability(cur, body, clock.now())


@router.post("/bookings/preview")
def preview(body: TripIn, conn=Depends(get_conn)):
    """Exactly what a booking would get right now: rides that fit, rides that don't."""
    now = clock.now()
    errors = rules.validate_trip(body, now, for_booking=False)
    if errors:
        return {"ok": False, "errors": errors}
    p = Passenger("web", "fr", None, None, body.pickup, body.dropoff, body.adults, body.children,
                  list(body.needs))
    out = booking.book(conn, p, rules.legs_for(body), dry_run=True)
    return {"ok": True, "rides": len(out.booked), "failed": [booking._leg_json(l) for l in out.failed],
            "ride_minutes": rules.ride_minutes(body.pickup, body.dropoff)}


# --- login with an SMS code ---------------------------------------------------------------------
@router.post("/auth/code")
def send_code(body: CodeRequest, request: Request, conn=Depends(get_conn)):
    return auth.request_code(conn, body.phone, body.lang, auth.client_ip(request))


@router.post("/auth/verify")
def verify(body: CodeVerify, response: Response, conn=Depends(get_conn)):
    token, me = auth.verify_code(conn, body.phone, body.code)
    auth.login_resident(response, token)
    return {"phone": me["phone"]}


@router.post("/auth/logout")
def logout(request: Request, response: Response, conn=Depends(get_conn)):
    auth.end_session(conn, request, response, auth.RESIDENT_COOKIE)
    return {"ok": True}


@router.get("/session")
def session(request: Request, conn=Depends(get_conn)):
    """Who is signed in, without an error when nobody is (keeps the browser console clean)."""
    try:
        who = current_resident(request, conn)
    except ApiError:
        return {"resident": None}
    return {"resident": me(who, conn)}


@router.get("/me")
def me(who: ResidentSession = Depends(current_resident), conn=Depends(get_conn)):
    row = conn.execute("""SELECT passenger_name FROM booking WHERE resident_id = %s AND passenger_name IS NOT NULL
                           ORDER BY created_at DESC LIMIT 1""", (who.id,)).fetchone()
    return {"phone": who.phone, "name": row["passenger_name"] if row else ""}


# --- booking --------------------------------------------------------------------------------------
@router.post("/bookings", status_code=201)
def create_booking(body: BookingIn, who: ResidentSession = Depends(current_resident), conn=Depends(get_conn)):
    now = clock.now()
    errors = rules.validate_trip(body, now, for_booking=True)
    if not body.name.strip():
        errors.setdefault("me", "errName")
    if errors:
        raise ApiError(422, "invalid", errors=errors)
    p = Passenger("web", body.lang, body.name.strip(), who.phone, body.pickup, body.dropoff, body.adults,
                  body.children, list(dict.fromkeys(body.needs)), body.sms_updates, body.resident_declared,
                  resident_id=who.id)
    out = booking.book(conn, p, rules.legs_for(body), accept_partial=body.accept_partial)
    return {"ref": out.ref, "rides": out.booked, "failed": [booking._leg_json(l) for l in out.failed]}


def _my_ride(row) -> dict:
    local = row["pickup_at"].astimezone(clock.TZ)
    a = rules.place_label(row["pickup_locality"], row["pickup_street"], row["pickup_dest"])
    b = rules.place_label(row["dropoff_locality"], row["dropoff_street"], row["dropoff_dest"])
    frm, to = (a, b) if row["kind"] == "out" else (b, a)
    return {"id": row["id"], "ref": row["ref"], "kind": row["kind"], "date": local.date().isoformat(),
            "time": rules.hhmm(local), "from": frm, "to": to, "status": row["status"],
            "adults": row["adults"], "children": row["children"], "past": row["pickup_at"] <= clock.now()}


@router.get("/me/rides")
def my_rides(who: ResidentSession = Depends(current_resident), conn=Depends(get_conn)):
    since = clock.now() - timedelta(days=14)
    rows = conn.execute("""SELECT r.id, r.kind, r.pickup_at, r.status, b.ref, b.adults, b.children,
                                  b.pickup_locality, b.pickup_street, b.pickup_dest,
                                  b.dropoff_locality, b.dropoff_street, b.dropoff_dest
                             FROM ride r JOIN booking b ON b.id = r.booking_id
                            WHERE b.resident_id = %s AND r.pickup_at > %s
                            ORDER BY r.pickup_at""", (who.id, since)).fetchall()
    return {"rides": [_my_ride(r) for r in rows]}


@router.post("/me/rides/{ride_id}/cancel")
def cancel_my_ride(ride_id: int, who: ResidentSession = Depends(current_resident), conn=Depends(get_conn)):
    booking.cancel_own(conn, who.id, ride_id, clock.now())
    return {"ok": True}


# --- your data ------------------------------------------------------------------------------------
@router.get("/me/export")
def export_my_data(who: ResidentSession = Depends(current_resident), conn=Depends(get_conn)):
    with conn.transaction(), conn.cursor() as cur:
        data = privacy.export(cur, who.id)
        from .audit import Actor, log
        log(cur, Actor("resident", who.id), "privacy.exported", "resident", who.id)
    return JSONResponse(data, headers={
        "Content-Disposition": 'attachment; filename="ruffbus-mamer-my-data.json"'})


@router.delete("/me")
def erase_my_data(request: Request, response: Response, who: ResidentSession = Depends(current_resident),
                  conn=Depends(get_conn)):
    result = privacy.erase(conn, who.id, clock.now())
    response.delete_cookie(auth.RESIDENT_COOKIE, path="/")
    return result
