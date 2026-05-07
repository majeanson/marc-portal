-- feat-engagement-runtime initial schema.
-- Three tables: sessions (one per intake submission), messages (thread per
-- session), magic_link_tokens (single-use email-link auth).
-- Timestamps are unix seconds (INTEGER) — smaller, indexable, no TZ ambiguity.

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  intake_json TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'triage', 'active', 'shipped', 'rejected')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX sessions_email_idx ON sessions(email);
CREATE INDEX sessions_status_idx ON sessions(status);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  author TEXT NOT NULL CHECK (author IN ('visitor', 'marc')),
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX messages_session_idx ON messages(session_id, created_at);

CREATE TABLE magic_link_tokens (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL,
  ip TEXT
);

CREATE INDEX magic_link_tokens_email_idx ON magic_link_tokens(email, created_at);
