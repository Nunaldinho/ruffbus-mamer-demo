"""Usage statistics. Computed from ride times only, so they need no personal data."""
from __future__ import annotations

from datetime import date, datetime, time, timedelta

from . import clock, rules
from .booking import ACTIVE

HOURS = list(range(rules.SERVICE_START.hour, rules.SERVICE_END.hour))  # 9 … 17


def _overlap(s1: datetime, e1: datetime, s2: datetime, e2: datetime) -> float:
    return max(0.0, (min(e1, e2) - max(s1, s2)).total_seconds() / 60)


def day_stats(cur, day: date) -> dict:
    open_, close = clock.at(day, rules.SERVICE_START), clock.at(day, rules.SERVICE_END)
    service_min = (close - open_).total_seconds() / 60
    cur.execute("SELECT id, label FROM bus WHERE active ORDER BY id")
    buses = cur.fetchall()
    cur.execute("""SELECT bus_id, lower(period) AS s, upper(period) AS e FROM bus_unavailability
                    WHERE period && tstzrange(%s, %s)""", (open_, close))
    outages = cur.fetchall()
    cur.execute("""SELECT r.bus_id, lower(r.slot) AS s, upper(r.slot) AS e, r.pickup_at, b.adults + b.children AS pax
                     FROM ride r JOIN booking b ON b.id = r.booking_id
                    WHERE r.status = ANY(%s) AND r.slot && tstzrange(%s, %s)""",
                (ACTIVE, *clock.day_bounds(day)))
    rides = cur.fetchall()
    cur.execute("SELECT count(*) AS n FROM turned_away WHERE wanted_at >= %s AND wanted_at < %s",
                clock.day_bounds(day))
    turned_away = cur.fetchone()["n"]

    def available(bus_id: int, s: datetime, e: datetime) -> float:
        down = sum(_overlap(o["s"], o["e"], s, e) for o in outages if o["bus_id"] == bus_id)
        return max(0.0, (e - s).total_seconds() / 60 - down)

    def busy(bus_id: int | None, s: datetime, e: datetime) -> float:
        return sum(_overlap(r["s"], r["e"], s, e) for r in rides
                   if r["bus_id"] is not None and (bus_id is None or r["bus_id"] == bus_id))

    per_bus = []
    for b in buses:
        cap = available(b["id"], open_, close)
        per_bus.append({"id": b["id"], "label": b["label"], "in_service": cap >= service_min - 1,
                        "use": round(busy(b["id"], open_, close) / cap, 3) if cap else None})
    hourly = []
    for h in HOURS:
        s, e = clock.at(day, time(h)), clock.at(day, time(h + 1))
        cap = sum(available(b["id"], s, e) for b in buses)
        hourly.append({"hour": h, "use": round(busy(None, s, e) / cap, 3) if cap else 0})
    cap_day = sum(available(b["id"], open_, close) for b in buses)
    peak = max(hourly, key=lambda x: x["use"]) if hourly else None
    in_day = [r for r in rides if r["pickup_at"].astimezone(clock.TZ).date() == day]
    return {
        "date": day.isoformat(),
        "holiday": rules.is_holiday(day),
        "rides": len(in_day),
        "passengers": sum(r["pax"] for r in in_day),
        "waiting": sum(1 for r in in_day if r["bus_id"] is None),
        "use": round(busy(None, open_, close) / cap_day, 3) if cap_day else 0,
        "turned_away": turned_away,
        "peak": peak,
        "hourly": hourly,
        "buses": per_bus,
    }


def week_stats(cur, start: date, days: int = 8) -> dict:
    out = [day_stats(cur, start + timedelta(days=i)) for i in range(days)]
    per_bus: dict[int, list[float]] = {}
    labels = {}
    for d in out:
        if d["holiday"]:
            continue
        for b in d["buses"]:
            labels[b["id"]] = b["label"]
            if b["use"] is not None:
                per_bus.setdefault(b["id"], []).append(b["use"])
    return {
        "days": out,
        "buses": [{"id": i, "label": labels[i], "use": round(sum(v) / len(v), 3) if v else None}
                  for i, v in sorted(per_bus.items())],
    }
