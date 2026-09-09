PRAGMA foreign_keys = ON;

CREATE TABLE global_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  admin_email TEXT NOT NULL COLLATE NOCASE,
  notify_on_join INTEGER NOT NULL DEFAULT 1 CHECK (notify_on_join IN (0, 1)),
  admin_username TEXT NOT NULL COLLATE NOCASE,
  admin_password_hash TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO global_settings (
  id, admin_email, notify_on_join, admin_username, admin_password_hash
) VALUES (
  1, 'admin@example.com', 1, 'admin', NULL
);
