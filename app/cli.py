"""Command line tasks.

  python -m app.cli migrate                       apply database migrations
  python -m app.cli create-staff NAME --role R    add a staff account (asks for the password)
  python -m app.cli retention                     run the data-retention job now
  python -m app.cli reset-demo                    wipe all data and load the demo data (demo mode only)
"""
from __future__ import annotations

import argparse
import getpass
import sys

import psycopg
from psycopg.rows import dict_row

from . import clock, db, privacy, security, seed
from .config import settings


def _connect():
    return psycopg.connect(settings.database_url, autocommit=True, row_factory=dict_row,
                           options="-c timezone=Europe/Luxembourg")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli", description="Ruffbus Mamer admin tasks")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("migrate")
    p = sub.add_parser("create-staff")
    p.add_argument("username")
    p.add_argument("--role", choices=["admin", "dispatcher", "viewer"], required=True)
    p.add_argument("--name", help="display name (defaults to the username)")
    sub.add_parser("retention")
    sub.add_parser("reset-demo")
    args = parser.parse_args(argv)

    if args.cmd == "migrate":
        applied = db.migrate(settings.database_url)
        print("applied: " + (", ".join(applied) if applied else "nothing, already up to date"))
        return 0

    db.migrate(settings.database_url)
    with _connect() as conn:
        if args.cmd == "create-staff":
            password = getpass.getpass("Password (12+ characters): ")
            if len(password) < 12 or password != getpass.getpass("Repeat: "):
                print("Passwords must match and be at least 12 characters.", file=sys.stderr)
                return 1
            conn.execute("""INSERT INTO staff_user (username, display_name, password_hash, role)
                            VALUES (%s, %s, %s, %s)""",
                         (args.username, args.name or args.username, security.hash_password(password), args.role))
            print(f"created {args.role} {args.username}")
        elif args.cmd == "retention":
            print(privacy.run_retention(conn, clock.now()))
        elif args.cmd == "reset-demo":
            if not settings.demo_mode:
                print("reset-demo only runs with DEMO_MODE=true.", file=sys.stderr)
                return 1
            print(seed.refresh_demo(conn, force=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
