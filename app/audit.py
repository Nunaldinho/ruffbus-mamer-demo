"""Audit trail: who did what, without copying personal data into the log."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from psycopg.types.json import Jsonb


@dataclass
class Actor:
    type: str                 # "staff", "resident" or "system"
    id: int | None = None
    name: str | None = None   # staff username only; residents stay pseudonymous

    @staticmethod
    def system() -> "Actor":
        return Actor("system")


def log(cur, actor: Actor, action: str, entity: str | None = None, entity_id: int | None = None,
        **detail: Any) -> None:
    cur.execute(
        """INSERT INTO audit_log (actor_type, actor_id, actor_name, action, entity, entity_id, detail)
           VALUES (%s, %s, %s, %s, %s, %s, %s)""",
        (actor.type, actor.id, actor.name, action, entity, entity_id, Jsonb(detail)))
