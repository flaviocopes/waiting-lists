ALTER TABLE subscribers ADD COLUMN status TEXT NOT NULL DEFAULT 'confirmed';
ALTER TABLE subscribers ADD COLUMN consent_at TEXT;
ALTER TABLE subscribers ADD COLUMN consent_version TEXT;
ALTER TABLE subscribers ADD COLUMN confirmation_token_hash TEXT;
ALTER TABLE subscribers ADD COLUMN confirmation_expires_at INTEGER;
ALTER TABLE subscribers ADD COLUMN confirmed_at TEXT;

UPDATE subscribers
SET consent_at = created_at,
    consent_version = 'legacy-v1',
    confirmed_at = created_at
WHERE status = 'confirmed';

CREATE UNIQUE INDEX subscribers_confirmation_token_idx
  ON subscribers (confirmation_token_hash)
  WHERE confirmation_token_hash IS NOT NULL;

CREATE INDEX subscribers_pending_expiry_idx
  ON subscribers (confirmation_expires_at)
  WHERE status = 'pending';

CREATE INDEX subscribers_list_status_created_idx
  ON subscribers (list_id, status, created_at DESC, id DESC);
