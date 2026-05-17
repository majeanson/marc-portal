-- Payments hardening: partial-refund accounting, webhook event dedupe,
-- admin_alerts fallback channel. Lands after 0015_session_tier3_amount.sql
-- with no data migration needed — defaults cover all existing rows.

-- Partial-refund accounting. Stripe sends amount_refunded on charge.refunded;
-- store it so a $100 refund on a $1500 payment is not indistinguishable from
-- a full refund. Status only flips to 'refunded' when amount_refunded >=
-- amount_cents (handled in webhook.ts).
ALTER TABLE payments ADD COLUMN refunded_amount_cents INTEGER NOT NULL DEFAULT 0;

-- Webhook event dedupe. Stripe retries identical events (same event.id) on
-- 5xx/timeout. Without an explicit dedupe, side effects (admin notifications,
-- visitor prompt emails) re-fire on each retry. INSERT OR IGNORE at the top
-- of the handler short-circuits on the second arrival of the same event_id.
-- Retention pruning piggybacks the daily digest cron.
CREATE TABLE webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  received_at INTEGER NOT NULL
);
CREATE INDEX webhook_events_received_idx ON webhook_events(received_at);

-- Operator alerts that survive transient email failures. The webhook's
-- maybeNotifyAdmin() falls back to writing here when Resend fails — the
-- daily digest cron then includes open alerts in its email summary
-- (functions/api/admin/digest.ts), so a subscription-canceled event during
-- a Resend outage still reaches Marc on the next digest run. Kind is a
-- free-form tag for filtering; body is the same text we would have emailed.
CREATE TABLE admin_alerts (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  resolved_at INTEGER
);
-- Partial index — unresolved alerts are what the admin UI scans every load,
-- so keep that lookup fast even if the historical table grows.
CREATE INDEX admin_alerts_unresolved_idx
  ON admin_alerts(created_at)
  WHERE resolved_at IS NULL;
