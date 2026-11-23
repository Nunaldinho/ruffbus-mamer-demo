"""Settings, read from environment variables (see .env.example)."""
from __future__ import annotations

import os


def _bool(name: str, default: bool) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


class Settings:
    def __init__(self) -> None:
        self.database_url = os.environ.get(
            "DATABASE_URL", "postgresql://ruffbus:ruffbus@localhost:5432/ruffbus")
        # Used to key the hashes of login codes and IP addresses. Must be long and secret in production.
        self.secret_key = os.environ.get("SECRET_KEY", "dev-only-not-secret")
        # Demo mode shows login codes on screen instead of only "sending" them, and shows demo accounts.
        self.demo_mode = _bool("DEMO_MODE", True)
        # Set to true behind HTTPS so cookies are only sent over encrypted connections.
        self.cookie_secure = _bool("COOKIE_SECURE", False)
        # Personal data in bookings is anonymised this many days after the last ride.
        self.retention_days = int(os.environ.get("RETENTION_DAYS", "90"))
        self.audit_retention_days = int(os.environ.get("AUDIT_RETENTION_DAYS", "365"))
        self.sms_retention_days = int(os.environ.get("SMS_RETENTION_DAYS", "7"))
        # "console" prints messages to the server log. A real gateway would be added in app/sms.py.
        self.sms_provider = os.environ.get("SMS_PROVIDER", "console")
        # Create demo staff accounts and sample rides when the database is empty.
        self.seed_demo_data = _bool("SEED_DEMO_DATA", True)
        # Public demo: wipe everything and load fresh sample data once a day.
        self.demo_daily_reset = _bool("DEMO_DAILY_RESET", False)

    def check(self) -> None:
        if not self.demo_mode and (self.secret_key.startswith("dev-") or len(self.secret_key) < 32):
            raise RuntimeError("Set SECRET_KEY to a random value of at least 32 characters "
                               "before running with DEMO_MODE=false.")


settings = Settings()
