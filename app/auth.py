"""Logins: one-time SMS codes for residents, passwords for staff, and the session cookies."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from fastapi import Depends, Request, Response

from . import audit, clock, rules, security, sms
from .audit import Actor
from .config import settings
from .db import pool
from .errors import ApiError

RESIDENT_COOKIE = "rb_resident"
STAFF_COOKIE = "rb_staff"
RESIDENT_TTL = timedelta(days=30)
STAFF_TTL = timedelta(hours=12)
CODE_TTL = timedelta(minutes=10)
MAX_CODE_ATTEMPTS = 5
MAX_CODES_PER_PHONE = 3        # per 15 minutes
MAX_CODES_PER_IP = 20          # per hour
MAX_STAFF_FAILURES = 5
STAFF_LOCK = timedelta(minutes=15)


def get_conn():
    with pool().connection() as conn:
        yield conn


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "?"


# --- sessions ---------------------------------------------------------------------------------
def _new_session(cur, *, resident_id: int | None = None, staff_id: int | None = None,
                 ttl: timedelta) -> str:
    token = security.new_token()
    cur.execute("INSERT INTO session (token_hash, resident_id, staff_id, expires_at) VALUES (%s, %s, %s, %s)",
                (security.token_hash(token), resident_id, staff_id, clock.now() + ttl))
    return token


def _set_cookie(response: Response, name: str, token: str, ttl: timedelta, samesite: str) -> None:
    response.set_cookie(name, token, max_age=int(ttl.total_seconds()), httponly=True,
                        secure=settings.cookie_secure, samesite=samesite, path="/")


def end_session(conn, request: Request, response: Response, cookie: str) -> None:
    token = request.cookies.get(cookie)
    if token:
        conn.execute("DELETE FROM session WHERE token_hash = %s", (security.token_hash(token),))
    response.delete_cookie(cookie, path="/")


# --- residents: SMS code ---------------------------------------------------------------------------
def request_code(conn, raw_phone: str, lang: str, ip: str) -> dict:
    phone = rules.normalise_phone(raw_phone)
    if not phone:
        raise ApiError(422, "errPhone")
    now = clock.now()
    ip_hash = security.keyed_hash("ip", ip)
    with conn.transaction(), conn.cursor() as cur:
        cur.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (phone,))  # serialise per number
        cur.execute("SELECT count(*) AS n FROM otp_challenge WHERE phone = %s AND created_at > %s",
                    (phone, now - timedelta(minutes=15)))
        if cur.fetchone()["n"] >= MAX_CODES_PER_PHONE:
            raise ApiError(429, "errTooMany")
        cur.execute("SELECT count(*) AS n FROM otp_challenge WHERE ip_hash = %s AND created_at > %s",
                    (ip_hash, now - timedelta(hours=1)))
        if cur.fetchone()["n"] >= MAX_CODES_PER_IP:
            raise ApiError(429, "errTooMany")
        code = security.new_code()
        cur.execute("""INSERT INTO otp_challenge (phone, code_hash, ip_hash, expires_at, created_at)
                       VALUES (%s, %s, %s, %s, %s)""",
                    (phone, security.keyed_hash("otp", phone, code), ip_hash, now + CODE_TTL, now))
        sms.send(cur, phone, "code", lang, secret=code)
    out = {"phone": phone, "expires_in": int(CODE_TTL.total_seconds())}
    if settings.demo_mode:
        out["demo_code"] = code  # demo only: there is no real SMS gateway
    return out


def verify_code(conn, raw_phone: str, code: str) -> tuple[str, dict]:
    phone = rules.normalise_phone(raw_phone)
    if not phone or not code.isdigit():
        raise ApiError(422, "errCode")
    now = clock.now()
    error: ApiError | None = None
    with conn.transaction(), conn.cursor() as cur:
        cur.execute("""SELECT id, code_hash, attempts FROM otp_challenge
                        WHERE phone = %s AND used_at IS NULL AND expires_at > %s
                        ORDER BY created_at DESC LIMIT 1 FOR UPDATE""", (phone, now))
        ch = cur.fetchone()
        if not ch or ch["attempts"] >= MAX_CODE_ATTEMPTS:
            error = ApiError(422, "errCodeExpired")
        elif not security.hmac_equal(ch["code_hash"], security.keyed_hash("otp", phone, code)):
            cur.execute("UPDATE otp_challenge SET attempts = attempts + 1 WHERE id = %s", (ch["id"],))
            left = MAX_CODE_ATTEMPTS - ch["attempts"] - 1
            error = ApiError(422, "errCode" if left else "errCodeExpired", attempts_left=left)
        else:
            cur.execute("UPDATE otp_challenge SET used_at = %s WHERE id = %s", (now, ch["id"]))
            cur.execute("""INSERT INTO resident (phone, created_at, last_seen_at) VALUES (%s, %s, %s)
                           ON CONFLICT (phone) DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at
                           RETURNING id""", (phone, now, now))
            rid = cur.fetchone()["id"]
            token = _new_session(cur, resident_id=rid, ttl=RESIDENT_TTL)
            audit.log(cur, Actor("resident", rid), "resident.login", "resident", rid)
    if error:  # raised after commit, so the failed attempt is counted
        raise error
    return token, {"id": rid, "phone": phone}


def login_resident(response: Response, token: str) -> None:
    _set_cookie(response, RESIDENT_COOKIE, token, RESIDENT_TTL, "lax")


@dataclass
class ResidentSession:
    id: int
    phone: str


def current_resident(request: Request, conn=Depends(get_conn)) -> ResidentSession:
    token = request.cookies.get(RESIDENT_COOKIE)
    if not token:
        raise ApiError(401, "login")
    row = conn.execute("""SELECT r.id, r.phone FROM session s JOIN resident r ON r.id = s.resident_id
                           WHERE s.token_hash = %s AND s.expires_at > %s""",
                       (security.token_hash(token), clock.now())).fetchone()
    if not row:
        raise ApiError(401, "login")
    return ResidentSession(row["id"], row["phone"])


# --- staff: password ---------------------------------------------------------------------------------
@dataclass
class StaffSession:
    id: int
    username: str
    name: str
    role: str

    @property
    def actor(self) -> Actor:
        return Actor("staff", self.id, self.username)

    @property
    def sees_personal_data(self) -> bool:
        return self.role in ("admin", "dispatcher")


def staff_login(conn, username: str, password: str, response: Response) -> StaffSession:
    now = clock.now()
    with conn.transaction(), conn.cursor() as cur:
        cur.execute("SELECT * FROM staff_user WHERE username = %s AND active FOR UPDATE", (username,))
        u = cur.fetchone()
        if u and u["locked_until"] and u["locked_until"] > now:
            raise ApiError(429, "errLocked")
        failed = not u or not security.verify_password(password, u["password_hash"])
        if failed:
            if u:
                fails = u["failed_logins"] + 1
                locked = fails >= MAX_STAFF_FAILURES
                cur.execute("UPDATE staff_user SET failed_logins = %s, locked_until = %s WHERE id = %s",
                            (0 if locked else fails, now + STAFF_LOCK if locked else None, u["id"]))
                audit.log(cur, Actor("staff", u["id"], u["username"]), "staff.login_failed", "staff", u["id"])
        else:
            cur.execute("UPDATE staff_user SET failed_logins = 0, locked_until = NULL WHERE id = %s", (u["id"],))
            token = _new_session(cur, staff_id=u["id"], ttl=STAFF_TTL)
            audit.log(cur, Actor("staff", u["id"], u["username"]), "staff.login", "staff", u["id"])
    if failed:  # raised after commit, so the failure is counted
        raise ApiError(401, "errLogin")
    _set_cookie(response, STAFF_COOKIE, token, STAFF_TTL, "strict")
    return StaffSession(u["id"], u["username"], u["display_name"], u["role"])


def current_staff(request: Request, conn=Depends(get_conn)) -> StaffSession:
    token = request.cookies.get(STAFF_COOKIE)
    if not token:
        raise ApiError(401, "login")
    row = conn.execute("""SELECT u.id, u.username, u.display_name, u.role
                            FROM session s JOIN staff_user u ON u.id = s.staff_id
                           WHERE s.token_hash = %s AND s.expires_at > %s AND u.active""",
                       (security.token_hash(token), clock.now())).fetchone()
    if not row:
        raise ApiError(401, "login")
    return StaffSession(row["id"], row["username"], row["display_name"], row["role"])


def require(*roles: str):
    def check(staff: StaffSession = Depends(current_staff)) -> StaffSession:
        if staff.role not in roles:
            raise ApiError(403, "forbidden")
        return staff
    return check
