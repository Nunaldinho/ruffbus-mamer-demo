"""Bookings against the database: the overbooking guard, concurrency, fleet operations."""
import threading
from datetime import date, timedelta

import psycopg
import pytest
from psycopg import errors
from psycopg.rows import dict_row

from app import booking, clock, rules
from app.audit import Actor
from app.booking import BookingError, Passenger

from .conftest import MONDAY, TEST_URL, make_staff, trip_in

STAFF = Actor("staff", None, "test")


def passenger(t, **kw):
    return Passenger(kw.get("channel", "web"), "en", kw.get("name", "Test Person"), kw.get("phone", "+352621000001"),
                     t.pickup, t.dropoff, t.adults, t.children, list(t.needs), True, t.resident_declared,
                     resident_id=kw.get("resident_id"))


def book(conn, accept_partial=True, dry_run=False, status="requested", **kw):
    t = trip_in(**kw)
    legs, skipped = rules.legs_for(t, clock.now())
    return booking.book(conn, passenger(t), legs, skipped, accept_partial=accept_partial, dry_run=dry_run, status=status)


def test_database_refuses_two_rides_on_one_bus_at_the_same_time(conn):
    out = book(conn)
    ride = conn.execute("SELECT * FROM ride WHERE booking_id = %s", (out.booking_id,)).fetchone()
    with pytest.raises(errors.ExclusionViolation):
        conn.execute("""INSERT INTO ride (booking_id, kind, pickup_at, ride_minutes, slot, bus_id, status)
                        VALUES (%s, 'out', %s, 14, %s, %s, 'requested')""",
                     (out.booking_id, ride["pickup_at"], ride["slot"], ride["bus_id"]))
    # a cancelled ride frees the bus
    conn.execute("UPDATE ride SET status = 'cancelled' WHERE id = %s", (ride["id"],))
    conn.execute("""INSERT INTO ride (booking_id, kind, pickup_at, ride_minutes, slot, bus_id, status)
                    VALUES (%s, 'out', %s, 14, %s, %s, 'requested')""",
                 (out.booking_id, ride["pickup_at"], ride["slot"], ride["bus_id"]))


def test_three_buses_take_three_bookings_and_the_fourth_is_turned_away(conn):
    buses = {book(conn).booked[0]["bus"] for _ in range(3)}
    assert buses == {1, 2, 3}
    with pytest.raises(BookingError) as e:
        book(conn)
    assert e.value.code == "errFull"
    assert conn.execute("SELECT count(*) AS n FROM turned_away").fetchone()["n"] == 1
    assert conn.execute("SELECT count(*) AS n FROM booking").fetchone()["n"] == 3


def test_concurrent_bookings_never_overbook():
    """Ten people press "Request ride" for the same slot at the same moment: exactly three get a bus."""
    results, barrier = [], threading.Barrier(10)

    def worker():
        with psycopg.connect(TEST_URL, autocommit=True, row_factory=dict_row) as c:
            barrier.wait()
            try:
                results.append(book(c).booked[0]["bus"])
            except BookingError as e:
                results.append(e.code)

    threads = [threading.Thread(target=worker) for _ in range(10)]
    for th in threads:
        th.start()
    for th in threads:
        th.join()
    assert sorted(r for r in results if isinstance(r, int)) == [1, 2, 3]
    assert results.count("errFull") == 7


def test_least_used_bus_is_chosen_first(conn):
    book(conn, time="09:00")
    book(conn, time="09:00")              # buses 1 and 2 busy at 9:00
    out = book(conn, time="11:00")
    assert out.booked[0]["bus"] == 3      # bus 3 has done nothing yet today


def test_preview_is_exact_and_saves_nothing(conn):
    for _ in range(3):
        book(conn, time="10:00")
    preview = book(conn, dry_run=True, time="10:00", return_time="12:00")
    assert len(preview.booked) == 1 and len(preview.failed) == 1
    assert conn.execute("SELECT count(*) AS n FROM booking").fetchone()["n"] == 3
    assert conn.execute("SELECT count(*) AS n FROM turned_away").fetchone()["n"] == 0


def test_partial_booking_needs_consent(conn):
    for _ in range(3):
        book(conn, time="12:00")
    with pytest.raises(BookingError) as e:
        book(conn, accept_partial=False, time="10:00", return_time="12:00")
    assert e.value.code == "partial"
    assert conn.execute("SELECT count(*) AS n FROM booking").fetchone()["n"] == 3      # nothing kept
    out = book(conn, accept_partial=True, time="10:00", return_time="12:00")
    assert len(out.booked) == 1 and out.failed[0].kind == "return"


def test_weekly_repeat_books_every_day(conn):
    out = book(conn, time="14:45", repeat_weekdays=[1, 2, 3, 4, 5], repeat_weeks=2)
    assert len(out.booked) == 10
    assert conn.execute("SELECT count(DISTINCT pickup_at::date) AS n FROM ride").fetchone()["n"] == 10


def test_status_changes(conn):
    out = book(conn)
    ride_id = out.booked[0]["ride_id"]
    booking.set_status(conn, ride_id, "confirmed", STAFF)
    with pytest.raises(BookingError) as e:
        booking.set_status(conn, ride_id, "confirmed", STAFF)
    assert e.value.code == "badTransition"
    sms = conn.execute("SELECT body FROM sms_outbox").fetchall()
    assert len(sms) == 1 and "confirmed" in sms[0]["body"]


def test_out_of_service_moves_rides_and_blocks_the_bus(conn):
    out = book(conn)
    bus, ride_id = out.booked[0]["bus"], out.booked[0]["ride_id"]
    assert booking.out_of_service(conn, bus, date(2026, 11, 23), STAFF) == 1
    assert conn.execute("SELECT bus_id FROM ride WHERE id = %s", (ride_id,)).fetchone()["bus_id"] is None
    with pytest.raises(BookingError) as e:
        booking.set_status(conn, ride_id, "confirmed", STAFF)
    assert e.value.code == "needsBus"
    with pytest.raises(BookingError) as e:                       # the trigger refuses the broken bus
        booking.move(conn, ride_id, bus, STAFF)
    assert e.value.code == "busBusy"
    assert booking.auto_assign(conn, date(2026, 11, 23), STAFF) == {"assigned": 1, "waiting": 0}
    assert conn.execute("SELECT bus_id FROM ride WHERE id = %s", (ride_id,)).fetchone()["bus_id"] != bus
    # one bus is left for 10:00; the bus that is out of service is never used
    assert book(conn).booked[0]["bus"] != bus
    with pytest.raises(BookingError):
        book(conn)
    booking.back_in_service(conn, bus, date(2026, 11, 23), STAFF)
    assert book(conn).booked[0]["bus"] == bus


def test_availability_counts_free_buses(conn):
    book(conn, time="10:00")
    with conn.cursor() as cur:
        av = booking.availability(cur, trip_in(time=None), clock.now())
    slots = {s["time"]: s["free"] for s in av["slots"]}
    assert slots["10:00"] == 2 and slots["14:00"] == 3
    assert av["ride_minutes"] == 14
