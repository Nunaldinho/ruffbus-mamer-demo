-- The app's own small state, such as the day the demo data was last loaded.
CREATE TABLE app_state (
    key        text PRIMARY KEY,
    value      text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);
