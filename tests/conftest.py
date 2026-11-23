"""Test setup: a separate PostgreSQL database, a frozen clock and an HTTP client.

Run:  TEST_DATABASE_URL=postgresql://ruffbus:ruffbus@localhost:5432/ruffbus_test pytest
The test database is wiped and rebuilt. Never point it at real data.
"""
from __future__ import annotations

import os
from datetime import datetime

import psycopg
import pytest
from psycopg.rows import dict_row

TEST_URL = os.environ.get("TEST_DATABASE_URL", "postgresql://ruffbus:ruffbus@localhost:5432/ruffbus_test")
if not TEST_URL.rstrip("/").endswith("_test"):
    raise RuntimeError("TEST_DATABASE_URL must name a database ending in _test: the tests wipe it.")
os.environ["DATABASE_URL"] = TEST_URL
os.environ["DEMO_MODE"] = "true"
os.environ["SEED_DEMO_DATA"] = "false"
os.environ["SECRET_KEY"] = "test-secret-key-that-is-long-enough-123"

from app import clock, db, security  # noqa: E402  (after the environment is set)
from app.schemas import EndpointIn, TripIn  # noqa: E402

MONDAY = datetime(2026, 11, 23, 8, 0, tzinfo=clock.TZ)   # not a holiday; bookings 23–30 Nov
DATA_TABLES = ("ride, booking, bus_unavailability, session, otp_challenge, resident, turned_away, "
               "sms_outbox, audit_log, staff_user")


@pytest.fixture(scope="session", autouse=True)
def schema():
    with psycopg.connect(TEST_URL, autocommit=True) as conn:
        conn.execute("DROP SCHEMA public CASCADE")
        conn.execute("CREATE SCHEMA public")
    db.migrate(TEST_URL)
    db.open_pool(TEST_URL, max_size=20)
    yield
    db.close_pool()


@pytest.fixture(autouse=True)
def clean(schema):
    with psycopg.connect(TEST_URL, autocommit=True) as conn:
        conn.execute(f"TRUNCATE {DATA_TABLES} RESTART IDENTITY CASCADE")
    clock.freeze(MONDAY)
    yield
    clock.freeze(None)


@pytest.fixture
def conn():
    with psycopg.connect(TEST_URL, autocommit=True, row_factory=dict_row,
                         options="-c timezone=Europe/Luxembourg") as c:
        yield c


@pytest.fixture
def client():
    from fastapi.testclient import TestClient
    from app.main import app
    with TestClient(app, headers={"X-Ruffbus": "1"}) as c:
        yield c


def make_staff(conn, username: str, role: str, password: str = "correct horse battery") -> int:
    return conn.execute("""INSERT INTO staff_user (username, display_name, password_hash, role)
                           VALUES (%s, %s, %s, %s) RETURNING id""",
                        (username, username.title(), security.hash_password(password), role)).fetchone()["id"]


def staff_client(client, conn, role: str):
    make_staff(conn, role, role)
    r = client.post("/api/staff/login", json={"username": role, "password": "correct horse battery"})
    assert r.status_code == 200, r.text
    return client


def resident_login(client, phone: str = "621 123 456") -> str:
    r = client.post("/api/auth/code", json={"phone": phone, "lang": "en"})
    assert r.status_code == 200, r.text
    code = r.json()["demo_code"]
    r = client.post("/api/auth/verify", json={"phone": phone, "code": code})
    assert r.status_code == 200, r.text
    return r.json()["phone"]


def trip(**kw) -> dict:
    """A valid booking body: Holzem to Belle Etoile on Monday 23 November."""
    body = {"pickup": {"mode": "commune", "locality": "Holzem", "street": "7A route de Capellen"},
            "dropoff": {"mode": "dest", "dest": "ber-be"}, "date": "2026-11-23", "time": "10:00",
            "adults": 1, "children": 0, "resident_declared": True}
    body.update(kw)
    return body


def trip_in(**kw) -> TripIn:
    return TripIn(**trip(**kw))


def home() -> EndpointIn:
    return EndpointIn(mode="commune", locality="Holzem", street="7A route de Capellen")
