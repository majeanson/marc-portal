-- feat-session-audit
-- Two columns added to support visitor self-withdrawal and a status timeline
-- on the session page:
--   * deleted_at  — unix seconds. NULL = live row. All read paths filter it.
--   * status_history — JSON array of {from, to, by, at} entries appended on
--     each status transition by PATCH /api/sessions/:id.
-- Both nullable so existing rows are unaffected.

ALTER TABLE sessions ADD COLUMN deleted_at INTEGER;
ALTER TABLE sessions ADD COLUMN status_history TEXT;

CREATE INDEX sessions_deleted_idx ON sessions(deleted_at);
