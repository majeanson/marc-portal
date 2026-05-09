-- Server-side intake drafts. The pre-magic-link flow currently stashes the
-- in-progress intake in localStorage; if the visitor opens the magic link in a
-- different browser they sign in to an empty /me. This table lets the server
-- carry the draft across devices, keyed by lowercased email.
--
-- One draft per email — UPSERT semantics. Drafts older than 30 days are
-- considered abandoned and may be swept by an admin task.

CREATE TABLE intake_drafts (
  email TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX intake_drafts_updated_idx ON intake_drafts(updated_at);
