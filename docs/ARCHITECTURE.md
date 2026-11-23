# Architecture

A small, conventional web application: one Python service and one PostgreSQL database. Nothing is loaded from third parties, and there is no build step.

```
 Residents' browsers ──┐                    ┌──────────────────────────────┐
                       │   HTTPS (Caddy)    │  FastAPI app (uvicorn)        │
 Call centre / commune ┼──────────────────▶ │  - pages and static files     │──▶ PostgreSQL 16
                       │                    │  - JSON API under /api        │      (bookings, rides,
                       │                    │  - nightly retention job      │       accounts, audit)
                       └────────────────────┴──────────┬───────────────────┘
                                                       └──▶ SMS gateway (simulated in the prototype)
```

## Components

| Part | Choice | Why |
|---|---|---|
| Server | Python 3.12, FastAPI, uvicorn | Small, readable, typed request validation (Pydantic) |
| Database | PostgreSQL 14+ with `btree_gist` | Range types and exclusion constraints make overbooking impossible at the database level |
| Pages | Plain HTML, CSS and JavaScript | No framework or build step; any web developer can maintain it |
| HTTPS | Caddy (optional compose profile) | Automatic certificates |
| Packaging | Docker Compose: `db`, `app`, optional `caddy` | Runs on a commune VM, a small server or a laptop |

## Data model

```
staff_user ─┐
            ├─ session (hash of the cookie token, expiry)
resident ───┘        resident = a verified mobile number
   │
booking ── one request: passenger, addresses, passengers, needs, channel (web or phone)
   │
ride ───── one trip of a minibus: pick-up time, ride minutes, busy period (slot), bus, status
bus, bus_unavailability ── the fleet and days out of service
otp_challenge ── login codes (keyed hash only)
sms_outbox ───── messages handed to the SMS gateway (codes masked)
turned_away ──── requests refused because every bus was busy (no personal data)
audit_log ────── who did what (staff by username, residents by number only)
```

A booking with a return trip and weekly repeats becomes several rides; each ride is placed on a bus independently. Personal columns are grouped in `booking` so that anonymisation clears them in one statement while the village, destination, time and number of passengers stay for statistics.

## The overbooking guard

`ride.slot` is the period during which the bus is busy: from 10 minutes before the pick-up (driving to the passenger) to 5 minutes after the estimated arrival. Two constraints protect it:

1. `no_double_booking`: an exclusion constraint that refuses two active rides (`requested` or `confirmed`) with the same `bus_id` and overlapping `slot`.
2. `ride_bus_in_service`: a trigger that refuses a ride on a bus that is out of service at that time.

Booking runs in one transaction. For each ride the app lists free buses, least-used that day first, and tries to insert the ride on the first one inside a savepoint. If a concurrent booking took that bus, PostgreSQL waits for it, then refuses; the savepoint is rolled back and the next bus is tried. Rides are processed in time order so two bookings never wait on each other in a cycle; a deadlock, should one occur, is retried.

Taking a bus out of service locks the bus row (`FOR UPDATE`), while placing a ride takes a shared lock on it (`FOR SHARE`). A ride therefore can't slip onto a bus at the moment it is being taken out of service.

The booking preview runs the real booking in a transaction that is always rolled back, so what the resident sees ("1 ride won't fit") is exactly what booking would do at that moment.

## Requests

| Area | Endpoints |
|---|---|
| Public | `GET /api/config`, `POST /api/availability`, `POST /api/bookings/preview` |
| Resident login | `POST /api/auth/code`, `POST /api/auth/verify`, `POST /api/auth/logout`, `GET /api/session` |
| Resident | `POST /api/bookings`, `GET /api/me/rides`, `POST /api/me/rides/{id}/cancel`, `GET /api/me/export`, `DELETE /api/me` |
| Staff | `POST /api/staff/login`, `GET /api/staff/day`, `GET /api/staff/week`, `GET /api/staff/day.csv`, `POST /api/staff/rides/{id}/status`, `POST /api/staff/rides/{id}/bus`, `POST /api/staff/buses/{id}/out-of-service`, `POST /api/staff/buses/{id}/in-service`, `POST /api/staff/auto-assign`, `POST /api/staff/bookings` |
| Admin | `GET /api/staff/sms` (also dispatcher), `GET /api/staff/audit`, `GET /api/staff/privacy`, `POST /api/staff/privacy/retention` |

In demo mode the OpenAPI description is at `/api/openapi.json`.

## Security measures

- **Residents** sign in with a 6-digit code sent to their mobile. Codes expire after 10 minutes and allow 5 attempts. At most 3 codes per number per 15 minutes and 20 per network address per hour. Only a keyed hash (HMAC with `SECRET_KEY`) of each code and address is stored.
- **Staff** passwords are hashed with scrypt. Five failed attempts lock the account for 15 minutes.
- **Sessions**: random tokens in `HttpOnly` cookies (`SameSite=Lax` for residents, `Strict` for staff, `Secure` behind HTTPS); the database stores only a SHA-256 hash of each token. Resident sessions last 30 days, staff sessions 12 hours.
- **Cross-site requests**: every state-changing call must carry the header `X-Ruffbus: 1`, which another site cannot add without permission (CORS is not enabled).
- **Headers**: a strict Content-Security-Policy (only this site's own scripts, styles, fonts and images), `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, `Cache-Control: no-store` on API responses.
- **Input**: request bodies are validated (unknown fields refused, lengths capped, 64 KB limit); all SQL uses parameters.
- **Roles** are checked on the server for every request; the commune's read-only role never receives personal data, rather than having it hidden in the page.

## Limits of the prototype

- Text messages are written to the server log and to the staff screen instead of being sent.
- Each booking occupies a whole minibus; sharing a bus between bookings going the same way would be a next step.
- Ride times are estimated per zone, not from a routing service.
- One application process is enough for this load (three buses). Several processes can run against the same database; the nightly retention job is safe to run more than once.
