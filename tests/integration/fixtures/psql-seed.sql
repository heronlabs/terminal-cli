-- PostgreSQL seed for the backup/rollup round-trip integration test.
-- Restored via `hcli psql-rollup` (gunzip | psql), so it must be plain SQL the
-- psql client runs top-to-bottom. Three rows establish the baseline count (3).
CREATE TABLE users (
  id    SERIAL PRIMARY KEY,
  name  TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE
);

INSERT INTO users (name, email) VALUES
  ('Ada Lovelace',    'ada@example.com'),
  ('Alan Turing',     'alan@example.com'),
  ('Grace Hopper',    'grace@example.com');
