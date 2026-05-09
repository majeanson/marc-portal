-- feat-message-attachments
-- File attachments for session threads. Backed by R2 (the `MEDIA` binding).
-- Two upload patterns supported:
--   1. Upload first, link to message later — message_id is nullable so the
--      visitor can drop files into the compose area before sending.
--   2. Upload + send in one round-trip — same row, message_id set
--      atomically when the message is created.
-- Cascades on session delete (which cascades from soft-delete? No — soft is
-- via deleted_at, hard delete still cascades cleanly via FK). On message
-- delete, attachment is unlinked but the row + R2 object stay (admin trail).

CREATE TABLE attachments (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  -- nullable: pre-message uploads stage here until linked
  message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
  uploaded_by TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE INDEX attachments_session_idx ON attachments(session_id, created_at);
CREATE INDEX attachments_message_idx ON attachments(message_id);
