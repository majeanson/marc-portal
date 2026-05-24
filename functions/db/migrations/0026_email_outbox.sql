-- Email send-failure outbox (AUDIT P1.3).
--
-- Resend's free tier is reliable but not infallible — a 5-minute outage drops
-- whatever happened to fire during the window. Magic-link emails are
-- re-requestable so they don't need protection; the load-bearing notices
-- (tier-assigned, refund, installment-cleared) are NOT re-requestable from
-- the visitor side and silently losing them at the boundary of a Resend
-- hiccup is the worst-of-both — the underlying DB mutation succeeded, the
-- visitor never hears about it.
--
-- Shape: every send-site that calls `sendOrEnqueue()` inserts here on
-- Resend failure. The daily digest cron sweeps `sent_at IS NULL` rows,
-- retries via Resend, marks them sent on success or bumps `attempts` + a
-- short backoff on failure. `max_attempts` is enforced in code (default 5)
-- so a permanently-bad row eventually stops retrying instead of looping.
--
-- This table only carries the RENDERED email (subject + html + text + to).
-- The `kind` column is a label for triage ("which template was this?"),
-- not a key into anything — the renderer ran already at the original
-- send-site, so the sweeper can be a pure Resend POST without rebuilding
-- templates.

CREATE TABLE email_outbox (
  id            TEXT PRIMARY KEY,
  to_email      TEXT NOT NULL,
  subject       TEXT NOT NULL,
  html          TEXT NOT NULL,
  text_body     TEXT NOT NULL,
  -- e.g. 'tier-assigned', 'refund-notice', 'installment-cleared'. Surface
  -- in admin queries; not a foreign key.
  kind          TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  attempts      INTEGER NOT NULL DEFAULT 0,
  -- NULL until the first retry attempt fires.
  last_attempt  INTEGER,
  -- Truncated Resend error / network-failure message from the most recent
  -- attempt. Diagnostic aid for the admin checking why a row's stuck.
  last_error    TEXT,
  -- NULL while pending. Set to unix seconds on first successful delivery.
  sent_at       INTEGER
);

-- The sweeper reads `WHERE sent_at IS NULL ORDER BY created_at`. Composite
-- index keyed on sent_at first so the partial-scan stays cheap as the table
-- grows past the digest's batch size.
CREATE INDEX email_outbox_pending_idx
  ON email_outbox (sent_at, created_at);
