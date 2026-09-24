CREATE TABLE users (
  id    SERIAL PRIMARY KEY,
  name  TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE
);

INSERT INTO users (name, email) VALUES
  ('Ada Lovelace',    'ada@example.com'),
  ('Alan Turing',     'alan@example.com'),
  ('Grace Hopper',    'grace@example.com');
