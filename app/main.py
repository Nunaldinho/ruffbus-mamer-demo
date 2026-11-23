"""The web application: API, pages, security headers and the nightly data-retention job.

Run locally:  uvicorn app.main:app --reload
"""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import time, timedelta
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from psycopg_pool import PoolTimeout

from . import api_public, api_staff, clock, db, privacy, seed
from .booking import BookingError
from .config import settings
from .errors import ApiError

log = logging.getLogger("ruffbus")
STATIC = Path(__file__).parent / "static"
UNSAFE = {"POST", "PUT", "PATCH", "DELETE"}
MAX_BODY = 64 * 1024
NIGHTLY_AT = time(3, 0)  # Luxembourg time

CSP = ("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; "
       "font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")
SECURITY_HEADERS = {
    "Content-Security-Policy": CSP,           # no third-party scripts, fonts or trackers
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "Permissions-Policy": "geolocation=(), camera=(), microphone=(), payment=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "X-Frame-Options": "DENY",
}


def _nightly() -> dict:
    with db.pool().connection() as conn:
        result = privacy.run_retention(conn, clock.now())
        if settings.seed_demo_data and settings.demo_daily_reset:
            result["demo_reloaded"] = seed.refresh_demo(conn) is not None
        return result


async def _nightly_loop() -> None:
    """Every night: anonymise old bookings, delete expired data and, for a public demo, reload it."""
    while True:
        now = clock.now()
        nxt = clock.at(now.date(), NIGHTLY_AT)
        if nxt <= now:
            nxt = clock.at(now.date() + timedelta(days=1), NIGHTLY_AT)
        await asyncio.sleep((nxt - now).total_seconds())
        try:
            result = await asyncio.to_thread(_nightly)
            log.info("nightly job: %s", result)
        except Exception:  # keep the loop alive; the next run will catch up
            log.exception("nightly job failed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    settings.check()
    applied = db.migrate(settings.database_url)
    if applied:
        log.info("applied migrations: %s", ", ".join(applied))
    db.open_pool(settings.database_url)
    if settings.seed_demo_data:
        # A free host may sleep through the night: the first start of a new day reloads the demo too.
        with db.pool().connection() as conn:
            loaded = seed.refresh_demo(conn)
            if loaded:
                log.info("loaded demo accounts and sample rides: %s", loaded)
    task = asyncio.create_task(_nightly_loop())
    try:
        yield
    finally:
        task.cancel()
        db.close_pool()


app = FastAPI(
    title="Ruffbus Mamer booking (prototype)",
    version="0.1.0",
    lifespan=lifespan,
    docs_url=None, redoc_url=None,  # the interactive docs load scripts from a CDN; keep the CSP strict
    openapi_url="/api/openapi.json" if settings.demo_mode else None,
)


def _refuse(request: Request) -> JSONResponse | None:
    if not (request.url.path.startswith("/api/") and request.method in UNSAFE):
        return None
    # CSRF: browsers cannot add a custom header to a cross-site request without CORS (not enabled).
    if request.headers.get("x-ruffbus") != "1":
        return JSONResponse({"error": "csrf"}, status_code=403)
    length = request.headers.get("content-length")
    if length is None and "transfer-encoding" in request.headers:
        return JSONResponse({"error": "lengthRequired"}, status_code=411)
    if length and (not length.isdigit() or int(length) > MAX_BODY):
        return JSONResponse({"error": "tooLarge"}, status_code=413)
    return None


@app.middleware("http")
async def guard(request: Request, call_next):
    path = request.url.path
    response = _refuse(request) or await call_next(request)
    for k, v in SECURITY_HEADERS.items():
        response.headers.setdefault(k, v)
    if settings.cookie_secure:
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000")
    if path.startswith("/api/"):
        response.headers.setdefault("Cache-Control", "no-store")  # responses can contain personal data
    return response


@app.exception_handler(ApiError)
async def _api_error(request: Request, exc: ApiError):
    return JSONResponse({"error": exc.code, **exc.extra}, status_code=exc.status)


@app.exception_handler(BookingError)
async def _booking_error(request: Request, exc: BookingError):
    return JSONResponse({"error": exc.code, **exc.extra}, status_code=exc.status)


@app.exception_handler(RequestValidationError)
async def _validation_error(request: Request, exc: RequestValidationError):
    fields = sorted({".".join(str(p) for p in e["loc"][1:]) for e in exc.errors()})
    return JSONResponse({"error": "invalid", "fields": fields}, status_code=422)


@app.exception_handler(PoolTimeout)
async def _db_down(request: Request, exc: PoolTimeout):
    return JSONResponse({"error": "unavailable"}, status_code=503)


app.include_router(api_public.router)
app.include_router(api_staff.router)
app.mount("/static", StaticFiles(directory=STATIC), name="static")


def _page(name: str) -> FileResponse:
    return FileResponse(STATIC / name, headers={"Cache-Control": "no-cache"})


@app.get("/", include_in_schema=False)
def resident_page():
    return _page("index.html")


@app.get("/privacy", include_in_schema=False)
def privacy_page():
    return _page("index.html")  # the booking page opens on its privacy notice


@app.get("/staff", include_in_schema=False)
def staff_page():
    return _page("staff.html")


@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    return FileResponse(STATIC / "favicon.svg", media_type="image/svg+xml")


@app.get("/robots.txt", include_in_schema=False)
def robots():
    return PlainTextResponse("User-agent: *\nDisallow: /\n")


@app.get("/healthz", include_in_schema=False)
def health():
    with db.pool().connection() as conn:
        conn.execute("SELECT 1")
    return {"ok": True, "demo": settings.demo_mode}
