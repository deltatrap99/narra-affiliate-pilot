CREATE TABLE portal_owner (
  slot INTEGER PRIMARY KEY CHECK (slot = 1),
  identity TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE portal_accounts (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  email_key TEXT NOT NULL UNIQUE,
  payload TEXT NOT NULL,
  salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at INTEGER NOT NULL,
  reviewed_at INTEGER
);
--> statement-breakpoint
CREATE TABLE portal_sessions (
  token_hash TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('affiliate', 'merchant')),
  account_id TEXT REFERENCES portal_accounts(id),
  identity TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE portal_resets (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES portal_accounts(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'issued', 'used')),
  token_hash TEXT UNIQUE,
  requested_at INTEGER NOT NULL,
  expires_at INTEGER
);
--> statement-breakpoint
CREATE TABLE portal_limits (
  bucket TEXT PRIMARY KEY,
  window INTEGER NOT NULL,
  count INTEGER NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX portal_reset_pending ON portal_resets (account_id) WHERE status = 'pending';
--> statement-breakpoint
CREATE INDEX portal_sessions_expiry ON portal_sessions (expires_at);
