PRAGMA foreign_keys = ON;

CREATE TABLE email_deliveries (
  id TEXT PRIMARY KEY,
  subscriber_id TEXT NOT NULL,
  message_id TEXT UNIQUE,
  status TEXT NOT NULL CHECK (status IN (
    'submitting', 'processing', 'deferred', 'delivered',
    'bounced', 'failed', 'rejected', 'complained'
  )),
  terminal INTEGER NOT NULL DEFAULT 0 CHECK (terminal IN (0, 1)),
  provider TEXT,
  smtp_status_code TEXT,
  detail TEXT,
  event_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (subscriber_id) REFERENCES subscribers(id) ON DELETE CASCADE
);

CREATE INDEX email_deliveries_subscriber_created_idx
  ON email_deliveries (subscriber_id, created_at DESC, id DESC);

CREATE INDEX email_deliveries_status_updated_idx
  ON email_deliveries (status, updated_at DESC);
