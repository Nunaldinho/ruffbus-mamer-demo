"""Hashing helpers: passwords (scrypt), session tokens, login codes."""
from __future__ import annotations

import base64
import hashlib
import hmac
import secrets

from .config import settings

_N, _R, _P = 2 ** 14, 8, 1


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=_N, r=_R, p=_P, dklen=32)
    return "scrypt${}${}${}${}${}".format(
        _N, _R, _P, base64.b64encode(salt).decode(), base64.b64encode(digest).decode())


def verify_password(password: str, stored: str) -> bool:
    try:
        _, n, r, p, salt_b64, digest_b64 = stored.split("$")
        digest = hashlib.scrypt(password.encode(), salt=base64.b64decode(salt_b64),
                                n=int(n), r=int(r), p=int(p), dklen=32)
        return hmac.compare_digest(digest, base64.b64decode(digest_b64))
    except (ValueError, TypeError):
        return False


def new_token() -> str:
    return secrets.token_urlsafe(32)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def keyed_hash(*parts: str) -> str:
    """HMAC with the server secret: a login code or IP address cannot be read back from it."""
    msg = "\x1f".join(parts).encode()
    return hmac.new(settings.secret_key.encode(), msg, hashlib.sha256).hexdigest()


def new_code() -> str:
    return f"{secrets.randbelow(10 ** 6):06d}"


def hmac_equal(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode(), b.encode())
