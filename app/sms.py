"""Text messages.

The prototype "sends" messages by printing them to the server log and keeping them in sms_outbox
for 7 days. In production, replace ConsoleProvider with the operator's existing SMS gateway.
"""
from __future__ import annotations

import logging
from datetime import date, datetime

from .config import settings

log = logging.getLogger("ruffbus.sms")

TEXTS = {
    "code": {
        "fr": "Ruffbus Mamer : votre code est {code}. Il expire dans 10 minutes.",
        "de": "Ruffbus Mamer: Ihr Code lautet {code}. Er läuft in 10 Minuten ab.",
        "en": "Ruffbus Mamer: your code is {code}. It expires in 10 minutes.",
        "pt": "Ruffbus Mamer: o seu código é {code}. Expira em 10 minutos.",
    },
    "confirmed": {
        "fr": "Ruffbus Mamer : course confirmée le {day} à {time} ({ref}). Départ : {place}.",
        "de": "Ruffbus Mamer: Fahrt bestätigt am {day} um {time} ({ref}). Abholung: {place}.",
        "en": "Ruffbus Mamer: ride confirmed on {day} at {time} ({ref}). Pick-up: {place}.",
        "pt": "Ruffbus Mamer: viagem confirmada em {day} às {time} ({ref}). Partida: {place}.",
    },
    "declined": {
        "fr": "Ruffbus Mamer : nous ne pouvons pas assurer votre course du {day} à {time} ({ref}). Appelez le 2810 831.",
        "de": "Ruffbus Mamer: Ihre Fahrt am {day} um {time} ({ref}) ist leider nicht möglich. Rufen Sie 2810 831 an.",
        "en": "Ruffbus Mamer: we can't run your ride on {day} at {time} ({ref}). Call 2810 831.",
        "pt": "Ruffbus Mamer: não podemos fazer a sua viagem de {day} às {time} ({ref}). Ligue para o 2810 831.",
    },
    "cancelled": {
        "fr": "Ruffbus Mamer : votre course du {day} à {time} ({ref}) est annulée.",
        "de": "Ruffbus Mamer: Ihre Fahrt am {day} um {time} ({ref}) wurde storniert.",
        "en": "Ruffbus Mamer: your ride on {day} at {time} ({ref}) is cancelled.",
        "pt": "Ruffbus Mamer: a sua viagem de {day} às {time} ({ref}) foi cancelada.",
    },
}


def fmt_day(d: date | datetime) -> str:
    return d.strftime("%d/%m")


def mask(phone: str) -> str:
    return phone[:-6] + "•••" + phone[-3:] if len(phone) > 8 else "•••"


def send(cur, phone: str, purpose: str, lang: str, *, secret: str | None = None, **fields) -> str:
    """Queue and send a message. `secret` (a login code) is never stored, only shown in demo mode."""
    template = TEXTS[purpose].get(lang) or TEXTS[purpose]["fr"]
    body = template.format(code=secret or "", **fields)
    stored = template.format(code="••••••", **fields) if secret else body
    cur.execute("INSERT INTO sms_outbox (phone, body, purpose) VALUES (%s, %s, %s)", (phone, stored, purpose))
    if settings.sms_provider == "console":
        shown = body if (settings.demo_mode or not secret) else stored
        log.info("SMS to %s: %s", mask(phone), shown)
    else:  # pragma: no cover - hook for a real gateway
        raise NotImplementedError(f"SMS provider {settings.sms_provider!r} is not configured")
    return body
