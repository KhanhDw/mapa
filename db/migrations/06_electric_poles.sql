-- Run as postgres. Idempotent so it can also initialize a fresh Compose volume.
BEGIN;

CREATE SCHEMA IF NOT EXISTS user_data;

CREATE TABLE IF NOT EXISTS user_data.electric_poles (
  id         BIGSERIAL PRIMARY KEY,
  pole_code  TEXT NOT NULL UNIQUE,
  route      TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'good'
             CHECK (status IN ('good', 'warning', 'error')),
  detail     TEXT,
  geom       geometry(Point, 4326) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_electric_poles_geom
  ON user_data.electric_poles USING gist (geom);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mapa_api') THEN
    GRANT USAGE ON SCHEMA user_data TO mapa_api;
    GRANT SELECT, INSERT, UPDATE, DELETE
      ON user_data.electric_poles TO mapa_api;
    GRANT USAGE, SELECT
      ON SEQUENCE user_data.electric_poles_id_seq TO mapa_api;
  END IF;
END
$$;

COMMIT;
