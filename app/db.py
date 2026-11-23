"""Database connections and schema migrations."""
from __future__ import annotations

from pathlib import Path

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

MIGRATIONS = Path(__file__).parent / "migrations"
_pool: ConnectionPool | None = None


def open_pool(url: str, max_size: int = 10) -> ConnectionPool:
    global _pool
    if _pool is not None:
        _pool.close()
    _pool = ConnectionPool(
        url, min_size=1, max_size=max_size, open=True,
        # autocommit: every write in the app runs inside an explicit conn.transaction() block
        kwargs={"row_factory": dict_row, "autocommit": True, "options": "-c timezone=Europe/Luxembourg"})
    return _pool


def pool() -> ConnectionPool:
    if _pool is None:
        raise RuntimeError("Database pool not opened")
    return _pool


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


def migrate(url: str) -> list[str]:
    """Apply any SQL files in app/migrations that have not run yet, in name order."""
    applied: list[str] = []
    with psycopg.connect(url, autocommit=True) as conn:
        conn.execute("SELECT pg_advisory_lock(727001)")  # one migrator at a time
        try:
            conn.execute("""CREATE TABLE IF NOT EXISTS schema_migrations (
                              name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())""")
            done = {r[0] for r in conn.execute("SELECT name FROM schema_migrations")}
            for path in sorted(MIGRATIONS.glob("*.sql")):
                if path.name in done:
                    continue
                with conn.transaction():
                    conn.execute(path.read_text(encoding="utf-8"))
                    conn.execute("INSERT INTO schema_migrations (name) VALUES (%s)", (path.name,))
                applied.append(path.name)
        finally:
            conn.execute("SELECT pg_advisory_unlock(727001)")
    return applied
