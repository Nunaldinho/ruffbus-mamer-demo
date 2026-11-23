"""The current time in Luxembourg. Tests can freeze it."""
from __future__ import annotations

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Europe/Luxembourg")
_frozen: datetime | None = None


def now() -> datetime:
    return _frozen if _frozen is not None else datetime.now(TZ)


def today() -> date:
    return now().date()


def freeze(moment: datetime | None) -> None:
    global _frozen
    _frozen = moment.astimezone(TZ) if moment is not None else None


def at(day: date, hhmm: time) -> datetime:
    """A local wall-clock time on a given day, as an aware datetime."""
    return datetime.combine(day, hhmm, tzinfo=TZ)


def day_bounds(day: date) -> tuple[datetime, datetime]:
    return at(day, time(0)), at(day + timedelta(days=1), time(0))
