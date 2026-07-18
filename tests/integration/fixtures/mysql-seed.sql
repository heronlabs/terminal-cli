CREATE TABLE users (
  id    INT AUTO_INCREMENT PRIMARY KEY,
  name  VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE
);

INSERT INTO users (name, email) VALUES
  ('Ada Lovelace',    'ada@example.com'),
  ('Alan Turing',     'alan@example.com'),
  ('Grace Hopper',    'grace@example.com');
