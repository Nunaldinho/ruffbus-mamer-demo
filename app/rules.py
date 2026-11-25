"""The service rules of the Ruffbus Gemeng Mamer, enforced on the server.

Sources: the Ruffbus Gemeng Mamer flyer and the operator's page (Voyages Emile Weber).
Values marked ASSUMPTION are not published for Mamer and must be confirmed with the commune.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from functools import lru_cache

from . import clock
from .schemas import EndpointIn, TripIn

# --- service area -------------------------------------------------------------------------
LOCALITIES = ("Mamer", "Capellen", "Holzem")
# Destinations outside the commune (residents only): id -> (commune, place)
DESTINATIONS: dict[str, tuple[str, str]] = {
    "ber-adm": ("Bertrange", "Administration communale"),
    "ber-be": ("Bertrange", "Belle Etoile"),
    "ber-con": ("Bertrange", "Concorde"),
    "ber-cipa": ("Bertrange", "CIPA Bertrange"),
    "dip-adm": ("Dippach", "Administration communale"),
    "gar-adm": ("Garnich", "Administration communale"),
    "keh-adm": ("Kehlen", "Administration communale"),
    "keh-med": ("Kehlen", "Centre médical"),
    "koe-adm": ("Koerich", "Administration communale"),
    "koe-cac": ("Koerich", "Cactus Windhof"),
    "koe-za": ("Koerich", "Zone d'activité Windhof"),
    "kop-adm": ("Kopstal", "Administration communale"),
    "lux-chl": ("Luxembourg", "Centre Hospitalier de Luxembourg"),
    "ste-adm": ("Steinfort", "Administration communale"),
    "ste-but": ("Steinfort", "Epicerie sociale Croix-Rouge Buttek"),
    "ste-hop": ("Steinfort", "Hôpital intercommunal"),
    "ste-pis": ("Steinfort", "Piscine"),
    "str-adm": ("Strassen", "Administration communale"),
    "str-the": ("Strassen", "Les Thermes"),
    "str-med": ("Strassen", "Maison médicale / Pall Center"),
}
NEEDS = ("seat", "stroller", "wheel", "bags")

# --- timing ---------------------------------------------------------------------------------
FIRST_PICKUP = time(9, 0)      # service 9:00–18:00
LAST_PICKUP = time(17, 45)
SLOT_STEP_MIN = 15
LEAD_MIN = 60                  # Mamer flyer: book at least 1 hour before departure
WINDOW_DAYS = 7                # ASSUMPTION: book at most 7 days ahead (as Ruffbus Syrdall)
DAYS_MAX = 3                   # proposal: the same trip on up to 3 of the bookable days
RETURN_GAP_MIN = 30            # ASSUMPTION: a return pick-up at least 30 minutes after the outward one
SEATS = 8
APPROACH_MIN = 10              # ASSUMPTION: minutes for the bus to reach the passenger
DWELL_MIN = 5                  # ASSUMPTION: minutes to board and set down
# ASSUMPTION: driving minutes from Mamer to each destination commune; +4 from Capellen/Holzem
BASE_MINUTES = {"Bertrange": 10, "Dippach": 10, "Garnich": 8, "Kehlen": 10, "Koerich": 10,
                "Kopstal": 15, "Luxembourg": 18, "Steinfort": 12, "Strassen": 12}
SERVICE_START = time(9, 0)
SERVICE_END = time(18, 0)


# --- holidays -------------------------------------------------------------------------------
def easter(year: int) -> date:
    a, b, c = year % 19, year // 100, year % 100
    d, e = b // 4, b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = c // 4, c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = (h + l - 7 * m + 114) % 31 + 1
    return date(year, month, day)


@lru_cache(maxsize=32)
def holidays(year: int) -> frozenset[date]:
    """Luxembourg public holidays (no Ruffbus service)."""
    e = easter(year)
    fixed = [(1, 1), (5, 1), (5, 9), (6, 23), (8, 15), (11, 1), (12, 25), (12, 26)]
    days = {date(year, m, d) for m, d in fixed}
    days |= {e + timedelta(days=1), e + timedelta(days=39), e + timedelta(days=50)}  # Easter Mon, Ascension, Whit Mon
    return frozenset(days)


def is_holiday(day: date) -> bool:
    return day in holidays(day.year)


# --- helpers ----------------------------------------------------------------------------------
def parse_hhmm(value: str) -> time:
    h, m = value.split(":")
    return time(int(h), int(m))


def hhmm(t: time | datetime) -> str:
    return f"{t.hour:02d}:{t.minute:02d}"


def pickup_times() -> list[time]:
    out, minutes = [], FIRST_PICKUP.hour * 60 + FIRST_PICKUP.minute
    last = LAST_PICKUP.hour * 60 + LAST_PICKUP.minute
    while minutes <= last:
        out.append(time(minutes // 60, minutes % 60))
        minutes += SLOT_STEP_MIN
    return out


def bookable_times(day: date, now: datetime, after: time | None = None) -> list[time]:
    """Pickup times on a day that respect the minimum notice (and come after `after`)."""
    earliest = now + timedelta(minutes=LEAD_MIN)
    out = []
    for t in pickup_times():
        at = clock.at(day, t)
        if at < earliest:
            continue
        if after is not None and at < clock.at(day, after) + timedelta(minutes=RETURN_GAP_MIN):
            continue
        out.append(t)
    return out


def window(now: datetime) -> list[date]:
    start = now.date()
    return [start + timedelta(days=i) for i in range(WINDOW_DAYS + 1)]


def area(e: EndpointIn) -> str:
    """Village in the commune, or the commune of an outside destination. Safe to keep for statistics."""
    if e.mode == "commune":
        return e.locality or "?"
    return DESTINATIONS.get(e.dest or "", ("?", ""))[0]


def place_label(locality: str | None, street: str | None, dest: str | None) -> str:
    if dest:
        commune, name = DESTINATIONS.get(dest, ("", dest))
        return f"{name}, {commune}"
    return f"{street}, {locality}" if street else (locality or "")


def ride_minutes(a: EndpointIn, b: EndpointIn) -> int:
    if a.mode == "commune" and b.mode == "commune":
        if not a.locality or not b.locality:
            return 15
        return 5 if a.locality == b.locality else 7
    inside, outside = (a, b) if a.mode == "commune" else (b, a)
    commune = DESTINATIONS.get(outside.dest or "", (None,))[0]
    if commune is None or inside.mode != "commune":
        return 15
    return BASE_MINUTES[commune] + (0 if inside.locality == "Mamer" else 4)


def busy_window(pickup_at: datetime, minutes: int) -> tuple[datetime, datetime]:
    """The time the bus is busy with a ride: reach the passenger, ride, set down."""
    return (pickup_at - timedelta(minutes=APPROACH_MIN),
            pickup_at + timedelta(minutes=minutes + DWELL_MIN))


@dataclass
class Leg:
    day: date
    kind: str              # "out" or "return"
    pickup_at: datetime
    ride_minutes: int
    start: datetime
    end: datetime


def trip_days(trip: TripIn) -> list[date]:
    """The days a booking covers: its first day plus any extra days, in order, each once."""
    if trip.date is None:
        return []
    return sorted({trip.date, *trip.more_dates})


def legs_for(trip: TripIn) -> list[Leg]:
    """One ride per day, two with a return trip. Each ride is later placed on a bus on its own."""
    legs: list[Leg] = []
    if not trip.time:
        return legs
    out_min = ride_minutes(trip.pickup, trip.dropoff)
    back_min = ride_minutes(trip.dropoff, trip.pickup)
    for d in trip_days(trip):
        p = clock.at(d, parse_hhmm(trip.time))
        legs.append(Leg(d, "out", p, out_min, *busy_window(p, out_min)))
        if trip.return_time:
            r = clock.at(d, parse_hhmm(trip.return_time))
            legs.append(Leg(d, "return", r, back_min, *busy_window(r, back_min)))
    return legs


# --- validation -----------------------------------------------------------------------------------
PHONE_RE = re.compile(r"^\+[1-9]\d{7,14}$")


def normalise_phone(raw: str) -> str | None:
    """Return the number in international format (+352…), or None if it cannot be a phone number."""
    s = re.sub(r"[\s\-./()]", "", raw or "")
    if s.startswith("00"):
        s = "+" + s[2:]
    elif not s.startswith("+"):
        s = "+352" + s.lstrip("0")
    return s if PHONE_RE.match(s) else None


def _endpoint_errors(e: EndpointIn, which: str, need_street: bool) -> str | None:
    missing = "errPick" if which == "pickup" else "errDrop"
    if e.mode == "commune":
        if not e.locality:
            return missing
        if need_street and not (e.street or "").strip():
            return "errStreet"
    else:
        if not e.dest:
            return missing
        if e.dest not in DESTINATIONS:
            return "errDest"
    return None


def validate_trip(trip: TripIn, now: datetime, *, for_booking: bool) -> dict[str, str]:
    """Return error codes by form step (pickup, dropoff, when, who, me). Empty dict = valid."""
    errors: dict[str, str] = {}
    for which in ("pickup", "dropoff"):
        err = _endpoint_errors(getattr(trip, which), which, for_booking)
        if err:
            errors[which] = err
    if "pickup" not in errors and "dropoff" not in errors:
        a, b = trip.pickup, trip.dropoff
        if a.mode == "dest" and b.mode == "dest":
            errors["dropoff"] = "errOutside"
        elif place_label(a.locality, a.street, a.dest).lower() == place_label(b.locality, b.street, b.dest).lower():
            errors["dropoff"] = "errSame"

    days, allowed = trip_days(trip), set(window(now))
    if trip.date is None:
        errors["when"] = "errDay"
    elif len(days) > DAYS_MAX:
        errors["when"] = "errMaxDays"
    elif any(d not in allowed for d in days):
        errors["when"] = "errWindow"
    elif any(is_holiday(d) for d in days):
        errors["when"] = "errHoliday"
    elif not trip.time:
        errors["when"] = "errTime"
    elif parse_hhmm(trip.time) not in pickup_times():
        errors["when"] = "errTime"
    elif any(parse_hhmm(trip.time) not in bookable_times(d, now) for d in days):
        errors["when"] = "errLead"
    elif trip.return_time and (
            parse_hhmm(trip.return_time) not in pickup_times()
            or clock.at(trip.date, parse_hhmm(trip.return_time))
            < clock.at(trip.date, parse_hhmm(trip.time)) + timedelta(minutes=RETURN_GAP_MIN)):
        errors["when"] = "errRet"

    if trip.adults + trip.children > SEATS:
        errors["who"] = "errSeats"
    elif trip.adults + trip.children < 1:
        errors["who"] = "errSeats"
    elif trip.children > 0 and trip.adults < 1:
        errors["who"] = "errAdult"

    if for_booking and (trip.pickup.mode == "dest" or trip.dropoff.mode == "dest") and not trip.resident_declared:
        errors["me"] = "errRes"
    return errors
