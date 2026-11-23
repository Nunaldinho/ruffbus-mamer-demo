"""Data-protection features: access (export), erasure and the retention job."""
from __future__ import annotations

from datetime import datetime, timedelta

from . import audit, rules
from .audit import Actor
from .booking import ACTIVE
from .config import settings

ANONYMISE = """UPDATE booking
                  SET passenger_name = NULL, phone = NULL, pickup_street = NULL, dropoff_street = NULL,
                      needs = '{}', resident_id = NULL, anonymised_at = %(now)s
                WHERE anonymised_at IS NULL AND """


def _iso(v):
    return v.isoformat() if hasattr(v, "isoformat") else v


def export(cur, resident_id: int) -> dict:
    """Everything stored about a resident (GDPR right of access, art. 15)."""
    cur.execute("SELECT id, phone, created_at, last_seen_at FROM resident WHERE id = %s", (resident_id,))
    me = cur.fetchone()
    cur.execute("""SELECT id, ref, channel, lang, passenger_name, phone, pickup_locality, pickup_street,
                          pickup_dest, dropoff_locality, dropoff_street, dropoff_dest, adults, children,
                          needs, sms_updates, resident_declared, created_at
                     FROM booking WHERE (resident_id = %s OR phone = %s) AND anonymised_at IS NULL
                    ORDER BY created_at""", (resident_id, me["phone"]))
    bookings = cur.fetchall()
    for b in bookings:
        cur.execute("""SELECT kind, pickup_at, ride_minutes, status, bus_id FROM ride
                        WHERE booking_id = %s ORDER BY pickup_at""", (b["id"],))
        b["rides"] = [{k: _iso(v) for k, v in r.items()} for r in cur.fetchall()]
        b["pickup"] = rules.place_label(b["pickup_locality"], b["pickup_street"], b["pickup_dest"])
        b["dropoff"] = rules.place_label(b["dropoff_locality"], b["dropoff_street"], b["dropoff_dest"])
    cur.execute("""SELECT at, action, entity, entity_id FROM audit_log
                    WHERE actor_type = 'resident' AND actor_id = %s ORDER BY at""", (resident_id,))
    actions = cur.fetchall()
    return {
        "service": "Ruffbus Mamer (prototype)",
        "generated_at": datetime.now().astimezone().isoformat(),
        "account": {k: _iso(v) for k, v in me.items()},
        "bookings": [{k: _iso(v) for k, v in b.items() if k != "id"} for b in bookings],
        "your_actions": [{k: _iso(v) for k, v in a.items()} for a in actions],
        "retention": f"Personal details are anonymised {settings.retention_days} days after your last ride.",
    }


def erase(conn, resident_id: int, now: datetime) -> dict:
    """Delete a resident's personal data (GDPR right to erasure, art. 17).

    Future rides are cancelled, because the bus cannot pick up someone it knows nothing about.
    Anonymous counts (village, time, number of passengers) stay for the usage statistics.
    """
    with conn.transaction(), conn.cursor() as cur:
        cur.execute("SELECT phone FROM resident WHERE id = %s FOR UPDATE", (resident_id,))
        row = cur.fetchone()
        if not row:
            return {"rides_cancelled": 0, "bookings_anonymised": 0}
        phone = row["phone"]
        cur.execute("""UPDATE ride SET status = 'cancelled', updated_at = now()
                        WHERE status = ANY(%s) AND pickup_at > %s
                          AND booking_id IN (SELECT id FROM booking WHERE resident_id = %s OR phone = %s)""",
                    (ACTIVE, now, resident_id, phone))
        cancelled = cur.rowcount
        cur.execute(ANONYMISE + "(resident_id = %(rid)s OR phone = %(phone)s)",
                    {"now": now, "rid": resident_id, "phone": phone})
        anonymised = cur.rowcount
        cur.execute("DELETE FROM otp_challenge WHERE phone = %s", (phone,))
        cur.execute("DELETE FROM sms_outbox WHERE phone = %s", (phone,))
        cur.execute("DELETE FROM resident WHERE id = %s", (resident_id,))  # sessions go with it
        audit.log(cur, Actor("resident", resident_id), "privacy.erased", "resident", resident_id,
                  rides_cancelled=cancelled, bookings_anonymised=anonymised)
    return {"rides_cancelled": cancelled, "bookings_anonymised": anonymised}


def run_retention(conn, now: datetime, actor: Actor | None = None) -> dict:
    """Anonymise and delete personal data that is no longer needed (storage limitation, art. 5)."""
    cutoff = now - timedelta(days=settings.retention_days)
    out = {}
    with conn.transaction(), conn.cursor() as cur:
        cur.execute(ANONYMISE + """NOT EXISTS (SELECT 1 FROM ride r
                                                WHERE r.booking_id = booking.id AND upper(r.slot) > %(cutoff)s)""",
                    {"now": now, "cutoff": cutoff})
        out["bookings_anonymised"] = cur.rowcount
        cur.execute("""DELETE FROM resident r WHERE r.last_seen_at < %s
                         AND NOT EXISTS (SELECT 1 FROM booking b WHERE b.resident_id = r.id)""", (cutoff,))
        out["accounts_deleted"] = cur.rowcount
        cur.execute("DELETE FROM session WHERE expires_at < %s", (now,))
        out["sessions_deleted"] = cur.rowcount
        cur.execute("DELETE FROM otp_challenge WHERE created_at < %s", (now - timedelta(days=1),))
        out["login_codes_deleted"] = cur.rowcount
        cur.execute("DELETE FROM sms_outbox WHERE created_at < %s",
                    (now - timedelta(days=settings.sms_retention_days),))
        out["messages_deleted"] = cur.rowcount
        cur.execute("DELETE FROM audit_log WHERE at < %s",
                    (now - timedelta(days=settings.audit_retention_days),))
        out["audit_entries_deleted"] = cur.rowcount
        audit.log(cur, actor or Actor.system(), "privacy.retention_run", None, None, **out)
    return out


def overview(cur, now: datetime) -> dict:
    cutoff = now - timedelta(days=settings.retention_days)
    cur.execute("""SELECT
        (SELECT count(*) FROM resident) AS accounts,
        (SELECT count(*) FROM booking WHERE anonymised_at IS NULL) AS bookings_with_personal_data,
        (SELECT count(*) FROM booking WHERE anonymised_at IS NOT NULL) AS bookings_anonymised,
        (SELECT count(*) FROM booking b WHERE b.anonymised_at IS NULL AND NOT EXISTS
            (SELECT 1 FROM ride r WHERE r.booking_id = b.id AND upper(r.slot) > %s)) AS due_for_anonymisation,
        (SELECT min(created_at) FROM booking WHERE anonymised_at IS NULL) AS oldest_personal_data,
        (SELECT count(*) FROM booking WHERE anonymised_at IS NULL AND cardinality(needs) > 0) AS bookings_with_needs,
        (SELECT count(*) FROM sms_outbox) AS messages_kept,
        (SELECT count(*) FROM audit_log) AS audit_entries""", (cutoff,))
    row = cur.fetchone()
    row["oldest_personal_data"] = _iso(row["oldest_personal_data"])
    row.update(retention_days=settings.retention_days, audit_retention_days=settings.audit_retention_days,
               sms_retention_days=settings.sms_retention_days)
    return row
