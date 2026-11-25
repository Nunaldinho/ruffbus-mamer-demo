"""The HTTP API: login codes, roles, data protection and the security guards."""
from datetime import timedelta

from app import booking, clock, privacy, rules
from app.booking import Passenger

from .conftest import MONDAY, make_staff, resident_login, staff_client, trip, trip_in


# --- guards -------------------------------------------------------------------------------------
def test_state_changes_need_the_csrf_header(client):
    r = client.post("/api/auth/code", json={"phone": "621123456"}, headers={"X-Ruffbus": ""})
    assert r.status_code == 403 and r.json()["error"] == "csrf"


def test_security_headers(client):
    r = client.get("/")
    assert "default-src 'self'" in r.headers["content-security-policy"]
    assert r.headers["x-frame-options"] == "DENY"
    assert client.get("/api/config").headers["cache-control"] == "no-store"


def test_unknown_fields_are_rejected(client):
    r = client.post("/api/bookings/preview", json={**trip(), "price": 0})
    assert r.status_code == 422 and r.json()["error"] == "invalid"


# --- residents: one-time codes ---------------------------------------------------------------------
def test_login_code_is_stored_hashed_and_masked(client, conn):
    r = client.post("/api/auth/code", json={"phone": "621 123 456", "lang": "fr"})
    code = r.json()["demo_code"]
    row = conn.execute("SELECT code_hash, ip_hash FROM otp_challenge").fetchone()
    assert code not in row["code_hash"] and len(row["ip_hash"]) == 64
    body = conn.execute("SELECT body FROM sms_outbox").fetchone()["body"]
    assert code not in body and "••••••" in body


def test_wrong_codes_are_counted_and_the_code_dies_after_five(client):
    client.post("/api/auth/code", json={"phone": "621123456"})
    for left in (4, 3, 2, 1):
        r = client.post("/api/auth/verify", json={"phone": "621123456", "code": "000000"})
        assert r.status_code == 422 and r.json()["attempts_left"] == left
    assert client.post("/api/auth/verify", json={"phone": "621123456", "code": "000000"}).json()["error"] == "errCodeExpired"


def test_codes_are_rate_limited_per_number(client):
    for _ in range(3):
        assert client.post("/api/auth/code", json={"phone": "621123456"}).status_code == 200
    r = client.post("/api/auth/code", json={"phone": "621123456"})
    assert r.status_code == 429 and r.json()["error"] == "errTooMany"


def test_expired_code_is_refused(client):
    code = client.post("/api/auth/code", json={"phone": "621123456"}).json()["demo_code"]
    clock.freeze(MONDAY + timedelta(minutes=11))
    r = client.post("/api/auth/verify", json={"phone": "621123456", "code": code})
    assert r.json()["error"] == "errCodeExpired"


# --- residents: booking and own rides ----------------------------------------------------------------
def test_booking_needs_a_verified_number(client):
    assert client.post("/api/bookings", json={**trip(), "name": "A"}).status_code == 401


def test_resident_books_sees_and_cancels(client):
    resident_login(client)
    r = client.post("/api/bookings", json={**trip(return_time="12:00"), "name": "Nuno", "lang": "en"})
    assert r.status_code == 201, r.text
    assert len(r.json()["rides"]) == 2 and r.json()["ref"].startswith("RB-")
    rides = client.get("/api/me/rides").json()["rides"]
    assert [x["kind"] for x in rides] == ["out", "return"]
    assert rides[0]["from"] == "7A route de Capellen, Holzem" and rides[0]["to"] == "Belle Etoile, Bertrange"
    assert client.post(f"/api/me/rides/{rides[0]['id']}/cancel").status_code == 200
    assert client.get("/api/me/rides").json()["rides"][0]["status"] == "cancelled"


def test_resident_books_the_same_trip_on_several_days(client):
    resident_login(client)
    r = client.post("/api/bookings", json={**trip(more_dates=["2026-11-27", "2026-11-25"]), "name": "Nuno"})
    assert r.status_code == 201, r.text
    assert [x["date"] for x in r.json()["rides"]] == ["2026-11-23", "2026-11-25", "2026-11-27"]
    r = client.post("/api/bookings", json={**trip(more_dates=["2026-11-24", "2026-11-25", "2026-11-26"]),
                                           "name": "Nuno"})
    assert r.status_code == 422 and r.json()["errors"] == {"when": "errMaxDays"}


def test_residents_cannot_touch_each_others_rides(client):
    resident_login(client, "621 111 111")
    ride_id = client.post("/api/bookings", json={**trip(), "name": "First"}).json()["rides"][0]["ride_id"]
    client.post("/api/auth/logout")
    resident_login(client, "621 222 222")
    assert client.get("/api/me/rides").json()["rides"] == []
    assert client.post(f"/api/me/rides/{ride_id}/cancel").status_code == 404


def test_server_checks_the_rules_again(client):
    resident_login(client)
    r = client.post("/api/bookings", json={**trip(resident_declared=False), "name": "X"})
    assert r.status_code == 422 and r.json()["errors"] == {"me": "errRes"}


# --- staff and roles ----------------------------------------------------------------------------------
def test_staff_account_locks_after_five_failures(client, conn):
    make_staff(conn, "dispatch", "dispatcher")
    for _ in range(5):
        assert client.post("/api/staff/login", json={"username": "dispatch", "password": "nope"}).status_code == 401
    r = client.post("/api/staff/login", json={"username": "dispatch", "password": "correct horse battery"})
    assert r.status_code == 429 and r.json()["error"] == "errLocked"


def _some_rides(conn):
    t = trip_in(time="10:00")
    p = Passenger("web", "en", "Maria Example", "+352621999999", t.pickup, t.dropoff, 1, 0, ["wheel"], True, True)
    return booking.book(conn, p, rules.legs_for(t))


def test_viewer_sees_no_personal_data_and_cannot_act(client, conn):
    out = _some_rides(conn)
    staff_client(client, conn, "viewer")
    day = client.get("/api/staff/day", params={"date": "2026-11-23"}).json()
    assert day["personal"] is False
    ride = day["rides"][0]
    for key in ("name", "phone", "from", "to", "ref", "needs", "adults"):
        assert key not in ride
    assert ride["from_area"] == "Holzem" and ride["to_area"] == "Bertrange"
    assert "Maria" not in str(day) and "621999999" not in str(day)
    rid = out.booked[0]["ride_id"]
    assert client.post(f"/api/staff/rides/{rid}/status", json={"status": "confirmed"}).status_code == 403
    assert client.get("/api/staff/day.csv", params={"date": "2026-11-23"}).status_code == 403
    assert client.get("/api/staff/audit").status_code == 403


def test_dispatcher_confirms_and_takes_phone_bookings(client, conn):
    out = _some_rides(conn)
    staff_client(client, conn, "dispatcher")
    rid = out.booked[0]["ride_id"]
    assert client.post(f"/api/staff/rides/{rid}/status", json={"status": "confirmed"}).status_code == 200
    r = client.post("/api/staff/bookings", json={**trip(time="11:00"), "name": "Caller", "phone": "691 555 444"})
    assert r.status_code == 201, r.text
    day = client.get("/api/staff/day", params={"date": "2026-11-23"}).json()
    assert {x["status"] for x in day["rides"]} == {"confirmed"}
    assert {x["channel"] for x in day["rides"]} == {"web", "phone"}
    csv = client.get("/api/staff/day.csv", params={"date": "2026-11-23"}).text
    assert "Maria Example" in csv and "Caller" in csv
    assert client.get("/api/staff/audit").status_code == 403          # admin only


def test_audit_log_names_staff_but_not_passengers(client, conn):
    out = _some_rides(conn)
    staff_client(client, conn, "admin")
    client.post(f"/api/staff/rides/{out.booked[0]['ride_id']}/status", json={"status": "confirmed"})
    entries = client.get("/api/staff/audit").json()["entries"]
    assert any(e["action"] == "ride.confirmed" and e["actor_name"] == "admin" for e in entries)
    assert "Maria" not in str(entries) and "621999999" not in str(entries)


# --- data protection ----------------------------------------------------------------------------------
def test_export_and_erase(client, conn):
    phone = resident_login(client)
    client.post("/api/bookings", json={**trip(needs=["wheel"]), "name": "Nuno"})
    data = client.get("/api/me/export").json()
    assert data["account"]["phone"] == phone
    assert data["bookings"][0]["passenger_name"] == "Nuno" and data["bookings"][0]["needs"] == ["wheel"]
    r = client.delete("/api/me")
    assert r.json() == {"rides_cancelled": 1, "bookings_anonymised": 1}
    assert client.get("/api/me").status_code == 401
    b = conn.execute("SELECT * FROM booking").fetchone()
    assert b["passenger_name"] is None and b["phone"] is None and b["pickup_street"] is None and b["needs"] == []
    assert b["pickup_locality"] == "Holzem"                     # anonymous statistics stay
    assert conn.execute("SELECT count(*) AS n FROM resident").fetchone()["n"] == 0
    assert conn.execute("SELECT count(*) AS n FROM session").fetchone()["n"] == 0
    assert conn.execute("SELECT count(*) AS n FROM sms_outbox").fetchone()["n"] == 0


def test_retention_anonymises_old_bookings_only(conn):
    _some_rides(conn)                                            # a ride today: keep
    old = trip_in(time="10:00")
    clock.freeze(MONDAY - timedelta(days=100))
    legs = rules.legs_for(old.model_copy(update={"date": clock.today()}))
    p = Passenger("phone", "fr", "Old Booking", "+352621888888", old.pickup, old.dropoff, 1, 0, [], True, True)
    booking.book(conn, p, legs)
    conn.execute("""INSERT INTO otp_challenge (phone, code_hash, expires_at, created_at)
                    VALUES ('+352621888888', 'x', now(), %s)""", (clock.now(),))
    clock.freeze(MONDAY)
    result = privacy.run_retention(conn, clock.now())
    assert result["bookings_anonymised"] == 1 and result["login_codes_deleted"] == 1
    names = {r["passenger_name"] for r in conn.execute("SELECT passenger_name FROM booking")}
    assert names == {"Maria Example", None}


# --- public demo ----------------------------------------------------------------------------------------
def test_demo_reloads_once_a_day_and_wipes_visitors_entries(conn, monkeypatch):
    from app import seed
    from app.config import settings
    monkeypatch.setattr(settings, "demo_daily_reset", True)
    assert seed.refresh_demo(conn)["bookings"] > 0                       # empty database: loaded
    visitor = "SELECT count(*) AS n FROM resident WHERE phone = '+352621000999'"
    conn.execute("INSERT INTO resident (phone) VALUES ('+352621000999')")  # a visitor signs in
    assert seed.refresh_demo(conn) is None                               # same day: nothing happens
    assert conn.execute(visitor).fetchone()["n"] == 1
    clock.freeze(MONDAY + timedelta(days=1))
    assert seed.refresh_demo(conn)                                       # next day: wiped and reloaded
    assert conn.execute(visitor).fetchone()["n"] == 0
    first = conn.execute("SELECT min(pickup_at) AS t FROM ride").fetchone()["t"]
    assert first.date() >= (MONDAY + timedelta(days=1) - timedelta(days=100)).date()


def test_without_daily_reset_existing_data_is_kept(conn):
    from app import seed
    assert seed.refresh_demo(conn)
    clock.freeze(MONDAY + timedelta(days=1))
    assert seed.refresh_demo(conn) is None
