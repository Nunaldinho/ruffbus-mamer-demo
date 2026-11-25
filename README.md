# Ruffbus Mamer: online booking prototype

A working prototype of online booking for the Ruffbus Gemeng Mamer, the commune's free on-demand minibus (three electric minibuses, eight seats each). Residents request rides on the web in French, German, English or Portuguese. The call centre and the commune follow the whole fleet on one screen.

This is not an official service of the Commune de Mamer or of the operator. It was built by a Holzem resident to show what online booking could look like, and to answer the infrastructure and data-protection questions that come with it.

![Booking page](docs/screenshots/booking.png)
![Call-centre screen](docs/screenshots/staff-day.png)
![The commune's read-only view: same figures, no personal data](docs/screenshots/commune-view.png)

## What it does

**Residents** (`/`)
- Request a ride in five steps: pick-up, drop-off, time, passengers, contact details. The service rules are enforced on the server: book at least 1 hour ahead (as the Mamer flyer says), pick-ups 9:00–17:45, no public holidays, 8 seats, children under 13 with an adult, and outside the commune only the listed destinations, for residents only.
- See for each pick-up time how many minibuses are free, add a return trip, and book the same trip on up to three of the next seven days in one request (for example a crèche pick-up on Monday, Wednesday and Friday).
- Sign in with a one-time code sent by text message: no password. See and cancel their rides. Download or delete their data.

**Call centre** (`/staff`, role *dispatcher*)
- Each bus's day on a timeline; requests to confirm or decline; rides moved between buses.
- A bus taken out of service for a day (repair, charging): its rides move to "Needs a bus" and can be reassigned in one click.
- Phone bookings go into the same fleet as web bookings, so the two can never double-book.
- Use per bus and per hour, demand turned away because every bus was busy, CSV export of the day.

**Commune** (role *viewer*): the same figures without any name, phone number or address.

**Administrator**: everything above, plus the audit log and the data-protection page (what is held, retention rules, clean-up on demand).

## How overbooking is prevented

The database itself refuses a second active ride on the same bus at an overlapping time: an exclusion constraint, `no_double_booking`, in [`app/migrations/001_init.sql`](app/migrations/001_init.sql). The app picks the least-used free bus and inserts the ride. If another booking took that bus a moment earlier, PostgreSQL refuses the insert and the app tries the next bus. A test fires ten bookings for the same slot at the same moment: exactly three succeed, one per bus.

Each ride blocks its bus from 10 minutes before the pick-up (driving to the passenger) until 5 minutes after the estimated arrival (setting down).

## Run it

### With Docker

```sh
cp .env.example .env
docker compose up --build
```

Open <http://localhost:8000> for the booking page and <http://localhost:8000/staff> for the staff screen. The database schema is created on start-up, and an empty database is filled with demo accounts and a fortnight of sample rides.

For a public address with HTTPS, set `DOMAIN`, `COOKIE_SECURE=true`, `FORWARDED_ALLOW_IPS=*` and `APP_BIND=127.0.0.1` in `.env`, then run `docker compose --profile https up -d`. Caddy obtains and renews the certificate.

### As a public demo (GitHub and Render)

Put the code on GitHub, then in Render choose *New > Blueprint* and pick the repository: [`render.yaml`](render.yaml) creates the app and its database in Frankfurt on the free plan, with HTTPS and a daily reset of the demo data. Step-by-step guide: [`docs/DEPLOY.md`](docs/DEPLOY.md).

### Without Docker

Needs Python 3.12 or later and PostgreSQL 14 or later.

```sh
createuser ruffbus --pwprompt          # password: ruffbus, or change DATABASE_URL
createdb ruffbus --owner ruffbus
pip install -r requirements.txt
export DATABASE_URL=postgresql://ruffbus:ruffbus@localhost:5432/ruffbus
uvicorn app.main:app
```

### Demo accounts

| Role | Username | Password | Sees |
|---|---|---|---|
| Call centre | `dispatch` | `ruffbus-dispatch` | Passengers, confirms rides, takes phone bookings |
| Commune (read only) | `commune` | `ruffbus-commune` | Use of the buses, no personal data |
| Administrator | `admin` | `ruffbus-admin` | Everything, plus audit log and data protection |

Residents can sign in with any mobile number: in demo mode the code appears on screen instead of being texted. The number `600 000 000` is a sample resident who already has rides.

To start the demo again from fresh data: `python -m app.cli reset-demo` (with Docker: `docker compose exec app python -m app.cli reset-demo`).

## Tests

```sh
createdb ruffbus_test --owner ruffbus
pip install -r requirements-dev.txt
TEST_DATABASE_URL=postgresql://ruffbus:ruffbus@localhost:5432/ruffbus_test pytest
```

40 tests cover the service rules and public holidays, bookings over several days, the overbooking guard (including ten simultaneous bookings), fleet operations, login codes and their limits, what each role may see and do, data export, erasure and retention, and the daily demo reset. The test database is wiped on every run.

## Configuration

Set in the environment or in `.env` (see [`.env.example`](.env.example)).

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | `postgresql://ruffbus:ruffbus@localhost:5432/ruffbus` | PostgreSQL connection |
| `SECRET_KEY` | `dev-only-not-secret` | Keys the hashes of login codes and IP addresses. The app refuses to run outside demo mode with a weak key |
| `DEMO_MODE` | `true` | Shows login codes on screen and lists the demo accounts |
| `SEED_DEMO_DATA` | `true` | Fills an empty database with demo data |
| `DEMO_DAILY_RESET` | `false` | For a public demo: wipes everything and reloads the demo data once a day |
| `COOKIE_SECURE` | `false` | Set `true` behind HTTPS |
| `RETENTION_DAYS` | `90` | Personal details in bookings are anonymised this many days after the last ride |
| `SMS_RETENTION_DAYS` | `7` | Sent text messages are deleted after this many days |
| `AUDIT_RETENTION_DAYS` | `365` | Audit log entries are deleted after this many days |

## Before a pilot

- Set `DEMO_MODE=false`, a random `SECRET_KEY` and HTTPS (`COOKIE_SECURE=true`).
- Connect the operator's SMS gateway in [`app/sms.py`](app/sms.py). Today messages are written to the server log and shown in the staff screen.
- Create real staff accounts with `python -m app.cli create-staff NAME --role dispatcher` (or `viewer`, `admin`), and remove the demo ones.
- Confirm with the commune the assumptions marked `ASSUMPTION` in [`app/rules.py`](app/rules.py): booking at most 7 days ahead, up to 3 days per request, ride times per zone. The 1-hour notice comes from the Mamer flyer.
- Agree the data-protection set-up with the commune's data protection officer: see [`docs/GDPR.md`](docs/GDPR.md).
- Back up the database every night (`pg_dump`), rotate the server logs, and monitor `/healthz`.

## Project layout

```
app/
  main.py            web app: pages, security headers, nightly retention job
  api_public.py      residents: availability, preview, login code, bookings, my rides, my data
  api_staff.py       staff: day and week views, ride actions, fleet, phone bookings, SMS, audit, privacy
  booking.py         bookings and bus assignment (the overbooking logic)
  rules.py           service rules, holidays, ride times, validation
  auth.py            login codes, staff passwords, sessions, roles
  privacy.py         export, erasure, retention
  stats.py           usage statistics (no personal data needed)
  sms.py             text messages (console provider in the prototype)
  seed.py, cli.py    demo data and admin commands
  migrations/        SQL schema
  static/            pages, styles, scripts and the self-hosted font
docs/
  ARCHITECTURE.md    how it is built and why
  DEPLOY.md          putting a public demo online with GitHub and Render
  GDPR.md            data-protection note for the commune
tests/               pytest suite
```

Font: Atkinson Hyperlegible by the Braille Institute, self-hosted under the SIL Open Font License (`app/static/fonts/OFL.txt`).
