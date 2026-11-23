"""Request bodies. Pydantic checks types and sizes; app/rules.py checks the service rules."""
from __future__ import annotations

from datetime import date as Date
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

HHMM = r"^([01]\d|2[0-3]):[0-5]\d$"
Locality = Literal["Mamer", "Capellen", "Holzem"]
Need = Literal["seat", "stroller", "wheel", "bags"]
Lang = Literal["fr", "de", "en", "pt"]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class EndpointIn(Strict):
    mode: Literal["commune", "dest"]
    locality: Optional[Locality] = None
    street: Optional[str] = Field(default=None, max_length=120)
    dest: Optional[str] = Field(default=None, max_length=20)


class TripIn(Strict):
    pickup: EndpointIn
    dropoff: EndpointIn
    date: Optional[Date] = None
    time: Optional[str] = Field(default=None, pattern=HHMM)
    return_time: Optional[str] = Field(default=None, pattern=HHMM)
    repeat_weekdays: list[int] = Field(default_factory=list, max_length=7)  # ISO: 1 = Monday … 7 = Sunday
    repeat_weeks: int = Field(default=1, ge=1, le=4)
    adults: int = Field(default=1, ge=0, le=8)
    children: int = Field(default=0, ge=0, le=8)
    needs: list[Need] = Field(default_factory=list, max_length=4)
    resident_declared: bool = False


class AvailabilityIn(TripIn):
    kind: Literal["out", "return"] = "out"


class BookingIn(TripIn):
    name: str = Field(default="", max_length=80)
    sms_updates: bool = True
    accept_partial: bool = False
    lang: Lang = "fr"


class StaffBookingIn(BookingIn):
    phone: str = Field(default="", max_length=24)


class CodeRequest(Strict):
    phone: str = Field(max_length=24)
    lang: Lang = "fr"


class CodeVerify(Strict):
    phone: str = Field(max_length=24)
    code: str = Field(max_length=6)


class StaffLogin(Strict):
    username: str = Field(max_length=60)
    password: str = Field(max_length=200)


class StatusChange(Strict):
    status: Literal["confirmed", "declined", "cancelled"]


class BusChange(Strict):
    bus_id: int = Field(ge=1, le=99)


class DayRequest(Strict):
    date: Date
