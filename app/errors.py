"""API errors carry a short code that the screens translate (for example errFull)."""
from __future__ import annotations


class ApiError(Exception):
    def __init__(self, status: int, code: str, **extra):
        super().__init__(code)
        self.status, self.code, self.extra = status, code, extra
