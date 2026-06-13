-- MySQL/MariaDB seed for the backup/rollup round-trip integration test.
-- Restored via `hcli mysql-rollup` (gunzip | mariadb), so it must be plain SQL
-- the client runs top-to-bottom. Three rows establish the baseline count (3).
CREATE TABLE users (
  id    INT AUTO_INCREMENT PRIMARY KEY,
  name  VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE
);

INSERT INTO users (name, email) VALUES
  ('Ada Lovelace',    'ada@example.com'),
  ('Alan Turing',     'alan@example.com'),
  ('Grace Hopper',    'grace@example.com');
