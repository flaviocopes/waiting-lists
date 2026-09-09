PRAGMA foreign_keys = ON;

CREATE TABLE waiting_lists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  allowed_origins TEXT NOT NULL DEFAULT '*',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE subscribers (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (list_id) REFERENCES waiting_lists(id) ON DELETE CASCADE,
  UNIQUE (list_id, email)
);

CREATE INDEX subscribers_list_created_idx
  ON subscribers (list_id, created_at DESC, id DESC);

CREATE TABLE admin_sessions (
  token_hash TEXT PRIMARY KEY,
  csrf_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX admin_sessions_expiry_idx ON admin_sessions (expires_at);

INSERT INTO waiting_lists (id, name, slug, allowed_origins)
VALUES ('e7f1fca0-40cc-4c0b-9fc0-4dc21bb0b532', 'waitinglists.dev', 'waitinglists-dev', '*');
