-- Operator notes — per-session, admin-only free-text scratch pad.
--
-- The session message thread is visitor-facing; the operator can't write
-- "remember to push back on scope tomorrow" or "client is travelling until
-- Wed" there without the visitor seeing it. The daily /admin/today
-- dashboard surfaces sessions and asks "what's the next action" — but
-- the *why* behind that action often lives in Marc's head between sessions.
-- This is the place to write it down so a future-Marc (or a session
-- resumed after a few days off) doesn't have to reconstruct context from
-- the message thread.
--
-- One row per session (session_id is PK). NULL/missing row = no note yet.
-- Cascade-deleted with the session so a /api/me erasure cleans this up
-- alongside everything else for that visitor.

CREATE TABLE operator_notes (
  session_id   TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  -- Free text. Server enforces a 4 KB ceiling on PUT so an accidental
  -- paste-bomb doesn't bloat the row. Not enforced at the schema level
  -- because SQLite's CHECK on length() runs per write — the application
  -- bound is the right place.
  body         TEXT NOT NULL,
  -- Operator email at the time of write. Lets a future co-admin see who
  -- left the note, even though there's only one operator today.
  updated_by   TEXT NOT NULL,
  updated_at   INTEGER NOT NULL
);
