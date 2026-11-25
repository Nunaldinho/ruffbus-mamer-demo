# Ruffbus Mamer: online booking prototype

A volunteer, non-profit prototype of online booking for the Ruffbus Gemeng Mamer, the commune's free on-demand electric minibus service (three minibuses, eight seats each, operated by Emile Weber). Built by a Holzem resident to show the Commune de Mamer what online booking could look like. It is not an official service. Two aims: help more residents discover and use the Ruffbus, and let people who can't phone (deaf, hard of hearing, speech difficulties) book on their own, in writing.

Live demo (fictitious data, reset daily): https://ruffbus-mamer-demo.onrender.com (staff screen at `/staff`).

## Stack

- Python 3.12 and FastAPI (sync endpoints), psycopg 3 connection pool, PostgreSQL 16 with `btree_gist`.
- Front end: plain HTML, CSS and JavaScript in `app/static/`, no build step. All user-facing text is in `app/static/i18n.js` in French, German, English and Portuguese: change all four together.
- Packaged as one Docker image. Render deploys the `main` branch automatically from `render.yaml`.

## Commands

- Tests (40; they wipe the target database; the clock is frozen at Monday 23 November 2026, 08:00):
  `TEST_DATABASE_URL=postgresql://ruffbus:ruffbus@localhost:5432/ruffbus_test pytest`
- Run locally: `docker compose up --build`, then http://localhost:8000 and http://localhost:8000/staff
- Tasks: `python -m app.cli migrate | create-staff NAME --role ROLE | retention | reset-demo`

## Where things are

- `app/rules.py`: every service rule. Values marked `ASSUMPTION` are not yet confirmed with the commune or operator. Current rules: book at least 1 hour ahead (from the Mamer flyer), at most 7 days ahead, the same trip on up to 3 days per request (`DAYS_MAX`), pick-ups 09:00–17:45, no service on Luxembourg public holidays, 8 seats, children under 13 accompanied.
- `app/booking.py`: bookings, bus assignment, availability counts, fleet operations.
- `app/api_public.py` (residents) and `app/api_staff.py` (staff), `app/auth.py` and `app/security.py` (login codes, sessions, roles).
- `app/privacy.py`: data export, erasure, nightly retention job (03:00).
- `app/migrations/`: SQL schema, applied in file order.
- `docs/`: architecture, GDPR and deployment notes.

## Rules for changes

- The database is the referee: the `no_double_booking` exclusion constraint and the `bus_in_service` trigger must keep holding. Book by trying the insert and handling the refusal; never check first and write later.
- The server checks everything again; never rely on the browser. `schemas.py` refuses unknown fields, so front-end payloads must match the schemas exactly.
- Schema changes go in a new numbered migration file. Don't change applied migrations, except comments.
- Keep the roles intact: admin, dispatcher, viewer. The viewer (the commune) must never receive names, phone numbers or addresses.
- Keep the GDPR features working: export, erasure, retention durations, audit log with residents recorded only by number.
- Security: state-changing `/api` calls need the `X-Ruffbus: 1` header; keep the strict Content-Security-Policy; load no third-party scripts or fonts.
- Every behaviour change gets a test, and the full suite must pass.
- Keep the code plain and readable: the owner has to explain it to the commune in a meeting.

## Known gaps

No licence file yet (the commune was offered a free licence of its choice, for example the EUPL). SMS are simulated. Staff accounts are created from the command line only, without two-factor authentication. No Luxembourgish version. Accessibility and security have not been independently audited. The demo runs on Render's free plan: it sleeps when idle and its free database expires about 30 days after creation.
