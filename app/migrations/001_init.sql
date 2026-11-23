-- Ruffbus Mamer booking prototype: initial schema (PostgreSQL 14+).
-- Personal data columns are marked; the retention job and erasure requests clear them.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Staff of the call centre and the commune.
CREATE TABLE staff_user (
  id            bigserial PRIMARY KEY,
  username      text NOT NULL UNIQUE,
  display_name  text NOT NULL,
  password_hash text NOT NULL,                       -- scrypt, never the password
  role          text NOT NULL CHECK (role IN ('admin', 'dispatcher', 'viewer')),
  active        boolean NOT NULL DEFAULT true,
  failed_logins smallint NOT NULL DEFAULT 0,
  locked_until  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- The fleet.
CREATE TABLE bus (
  id     smallint PRIMARY KEY,
  label  text NOT NULL,
  seats  smallint NOT NULL DEFAULT 8 CHECK (seats BETWEEN 1 AND 20),
  active boolean NOT NULL DEFAULT true
);
INSERT INTO bus (id, label, seats) VALUES (1, 'Bus 1', 8), (2, 'Bus 2', 8), (3, 'Bus 3', 8);

-- A bus taken out of service (repair, charging). Periods of one bus may not overlap.
CREATE TABLE bus_unavailability (
  id         bigserial PRIMARY KEY,
  bus_id     smallint NOT NULL REFERENCES bus (id),
  period     tstzrange NOT NULL CHECK (NOT isempty(period)),
  reason     text,
  created_by bigint REFERENCES staff_user (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT one_outage_at_a_time EXCLUDE USING gist (bus_id WITH =, period WITH &&)
);

-- A phone number verified with a one-time SMS code. This is the resident's "account".
CREATE TABLE resident (
  id           bigserial PRIMARY KEY,
  phone        text NOT NULL UNIQUE,                 -- personal data
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

-- One-time login codes. Only a keyed hash of the code is stored.
CREATE TABLE otp_challenge (
  id         bigserial PRIMARY KEY,
  phone      text NOT NULL,                          -- personal data, deleted after 1 day
  code_hash  text NOT NULL,
  ip_hash    text,                                   -- keyed hash, for rate limiting only
  attempts   smallint NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX otp_phone_idx ON otp_challenge (phone, created_at);
CREATE INDEX otp_ip_idx ON otp_challenge (ip_hash, created_at);

-- Login sessions for residents and staff. Only a hash of the cookie token is stored.
CREATE TABLE session (
  token_hash  text PRIMARY KEY,
  resident_id bigint REFERENCES resident (id) ON DELETE CASCADE,
  staff_id    bigint REFERENCES staff_user (id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK ((resident_id IS NULL) <> (staff_id IS NULL))
);

-- One request from a passenger. It can cover several rides (return trip, weekly repeats).
CREATE TABLE booking (
  id                bigserial PRIMARY KEY,
  ref               text NOT NULL UNIQUE,
  channel           text NOT NULL CHECK (channel IN ('web', 'phone')),
  lang              text NOT NULL DEFAULT 'fr' CHECK (lang IN ('fr', 'de', 'en', 'pt')),
  resident_id       bigint REFERENCES resident (id) ON DELETE SET NULL,
  created_by_staff  bigint REFERENCES staff_user (id) ON DELETE SET NULL,
  -- personal data: cleared by the retention job and on erasure requests
  passenger_name    text,
  phone             text,
  pickup_street     text,
  dropoff_street    text,
  needs             text[] NOT NULL DEFAULT '{}',    -- may reveal health (wheelchair): treated as sensitive
  -- kept for statistics after anonymisation (village or destination, no street)
  pickup_locality   text,
  pickup_dest       text,
  dropoff_locality  text,
  dropoff_dest      text,
  adults            smallint NOT NULL,
  children          smallint NOT NULL,
  sms_updates       boolean NOT NULL DEFAULT true,
  resident_declared boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  anonymised_at     timestamptz,
  CHECK (adults >= 0 AND children >= 0 AND adults + children BETWEEN 1 AND 8),
  CHECK (children = 0 OR adults >= 1),
  CHECK ((pickup_locality IS NULL) <> (pickup_dest IS NULL)),
  CHECK ((dropoff_locality IS NULL) <> (dropoff_dest IS NULL))
);
CREATE INDEX booking_resident_idx ON booking (resident_id);

-- One trip of the minibus. "slot" is the whole time the bus is busy with it:
-- driving to the passenger, the ride itself and setting down.
CREATE TABLE ride (
  id           bigserial PRIMARY KEY,
  booking_id   bigint NOT NULL REFERENCES booking (id) ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN ('out', 'return')),
  pickup_at    timestamptz NOT NULL,
  ride_minutes smallint NOT NULL CHECK (ride_minutes > 0),
  slot         tstzrange NOT NULL,
  bus_id       smallint REFERENCES bus (id),
  status       text NOT NULL DEFAULT 'requested'
               CHECK (status IN ('requested', 'confirmed', 'declined', 'cancelled')),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (pickup_at <@ slot),
  -- The overbooking guard. The database itself refuses two active rides on the same bus
  -- at overlapping times, however many people book at the same second.
  CONSTRAINT no_double_booking EXCLUDE USING gist (bus_id WITH =, slot WITH &&)
    WHERE (status IN ('requested', 'confirmed') AND bus_id IS NOT NULL)
);
CREATE INDEX ride_slot_idx ON ride USING gist (slot);
CREATE INDEX ride_booking_idx ON ride (booking_id);

-- Second guard: a ride cannot be put on a bus while that bus is out of service.
CREATE FUNCTION ride_bus_in_service() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.bus_id IS NOT NULL AND NEW.status IN ('requested', 'confirmed') AND EXISTS (
       SELECT 1 FROM bus_unavailability u
        WHERE u.bus_id = NEW.bus_id AND u.period && NEW.slot) THEN
    RAISE EXCEPTION 'bus % is out of service at that time', NEW.bus_id
      USING ERRCODE = 'check_violation', CONSTRAINT = 'bus_in_service';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER ride_bus_in_service BEFORE INSERT OR UPDATE OF bus_id, slot, status ON ride
  FOR EACH ROW EXECUTE FUNCTION ride_bus_in_service();

-- Requests the fleet could not take because every bus was busy. No personal data.
CREATE TABLE turned_away (
  id         bigserial PRIMARY KEY,
  wanted_at  timestamptz NOT NULL,
  from_area  text NOT NULL,
  to_area    text NOT NULL,
  passengers smallint NOT NULL,
  channel    text NOT NULL,
  logged_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX turned_away_idx ON turned_away (wanted_at);

-- Text messages handed to the SMS gateway. Login codes are stored masked. Deleted after 7 days.
CREATE TABLE sms_outbox (
  id         bigserial PRIMARY KEY,
  phone      text NOT NULL,                          -- personal data
  body       text NOT NULL,
  purpose    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Who did what. Staff are named; residents only by their pseudonymous id.
CREATE TABLE audit_log (
  id         bigserial PRIMARY KEY,
  at         timestamptz NOT NULL DEFAULT now(),
  actor_type text NOT NULL CHECK (actor_type IN ('staff', 'resident', 'system')),
  actor_id   bigint,
  actor_name text,
  action     text NOT NULL,
  entity     text,
  entity_id  bigint,
  detail     jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX audit_at_idx ON audit_log (at);
