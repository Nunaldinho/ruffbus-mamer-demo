"""Service rules: holidays, phone numbers, ride times and the validation of a request."""
from datetime import date, datetime, timedelta

from app import clock, rules
from app.schemas import EndpointIn

from .conftest import MONDAY, home, trip_in


def test_luxembourg_public_holidays_2026():
    h = rules.holidays(2026)
    assert date(2026, 4, 6) in h      # Easter Monday
    assert date(2026, 5, 1) in h
    assert date(2026, 5, 9) in h      # Europe Day
    assert date(2026, 5, 14) in h     # Ascension
    assert date(2026, 5, 25) in h     # Whit Monday
    assert date(2026, 6, 23) in h     # National Day
    assert date(2026, 12, 26) in h
    assert not rules.is_holiday(date(2026, 11, 23))


def test_phone_numbers_are_normalised():
    assert rules.normalise_phone("621 123 456") == "+352621123456"
    assert rules.normalise_phone("00352 621-123-456") == "+352621123456"
    assert rules.normalise_phone("+33 6 12 34 56 78") == "+33612345678"
    assert rules.normalise_phone("hello") is None
    assert rules.normalise_phone("") is None


def test_ride_minutes_by_zone():
    mamer = EndpointIn(mode="commune", locality="Mamer", street="1 rue de la Gare")
    capellen = EndpointIn(mode="commune", locality="Capellen", street="2 route d'Arlon")
    belle_etoile = EndpointIn(mode="dest", dest="ber-be")
    assert rules.ride_minutes(mamer, mamer) == 5
    assert rules.ride_minutes(mamer, capellen) == 7
    assert rules.ride_minutes(mamer, belle_etoile) == 10
    assert rules.ride_minutes(home(), belle_etoile) == 14      # +4 from Holzem
    assert rules.ride_minutes(belle_etoile, home()) == 14


def test_a_valid_request_has_no_errors():
    assert rules.validate_trip(trip_in(), MONDAY, for_booking=True) == {}


def test_validation_errors():
    now = MONDAY
    assert rules.validate_trip(trip_in(pickup={"mode": "commune", "locality": "Holzem"}), now, for_booking=True)["pickup"] == "errStreet"
    assert rules.validate_trip(trip_in(pickup={"mode": "dest", "dest": "lux-chl"}), now, for_booking=True)["dropoff"] == "errOutside"
    assert rules.validate_trip(trip_in(dropoff={"mode": "dest", "dest": "nowhere"}), now, for_booking=True)["dropoff"] == "errDest"
    assert rules.validate_trip(trip_in(date="2026-12-05"), now, for_booking=True)["when"] == "errWindow"
    assert rules.validate_trip(trip_in(time="08:15"), now, for_booking=True)["when"] == "errTime"
    assert rules.validate_trip(trip_in(time="18:00"), now, for_booking=True)["when"] == "errTime"
    assert rules.validate_trip(trip_in(time="10:00", return_time="10:15"), now, for_booking=True)["when"] == "errRet"
    assert rules.validate_trip(trip_in(adults=0, children=1), now, for_booking=True)["who"] == "errAdult"
    assert rules.validate_trip(trip_in(adults=5, children=4), now, for_booking=True)["who"] == "errSeats"
    assert rules.validate_trip(trip_in(resident_declared=False), now, for_booking=True)["me"] == "errRes"
    # the preview does not need a street or the residence declaration yet
    assert rules.validate_trip(trip_in(pickup={"mode": "commune", "locality": "Holzem"}, resident_declared=False),
                               now, for_booking=False) == {}


def test_minimum_notice():
    almost = MONDAY.replace(hour=9, minute=40)
    assert rules.validate_trip(trip_in(time="10:00"), almost, for_booking=True)["when"] == "errLead"
    assert rules.validate_trip(trip_in(time="10:15"), almost, for_booking=True) == {}


def test_public_holiday_is_refused_and_skipped_in_repeats():
    christmas_week = datetime(2026, 12, 21, 8, 0, tzinfo=clock.TZ)
    single = trip_in(date="2026-12-25", time="10:00")
    assert rules.validate_trip(single, christmas_week, for_booking=True)["when"] == "errHoliday"
    weekly = trip_in(date="2026-12-21", time="10:00", repeat_weekdays=[4, 5], repeat_weeks=2)  # Thursdays, Fridays
    days, skipped = rules.occurrence_dates(weekly, christmas_week)
    assert days == [date(2026, 12, 24), date(2026, 12, 31)]
    assert skipped == [date(2026, 12, 25), date(2027, 1, 1)]
    legs, _ = rules.legs_for(weekly, christmas_week)
    assert len(legs) == 2


def test_busy_window_covers_approach_ride_and_set_down():
    pickup = clock.at(date(2026, 11, 23), rules.parse_hhmm("10:00"))
    start, end = rules.busy_window(pickup, 14)
    assert start == pickup - timedelta(minutes=10)
    assert end == pickup + timedelta(minutes=14 + 5)
