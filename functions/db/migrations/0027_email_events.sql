-- Email events from Resend (AUDIT P1.2).
--
-- Resend fires webhooks when a recipient's mail server tells it something
-- meaningful about a previously-delivered message: hard bounce, soft bounce,
-- spam complaint, scheduled-delivery delayed, etc. Without ingesting these,
-- we keep sending magic-link / tier / refund emails to addresses the rest of
-- the internet has decided are dead — burning sender reputation along the
-- way.
--
-- This table is the source of truth for "what did Resend tell us about
-- email <address>?" — every event gets a row. A separate query layer
-- (or a small denormalization on user_prefs in a future migration) can
-- compute "is_bouncing" by inspecting the most recent terminal event per
-- address. For now we just record.
--
-- Idempotency: the webhook handler dedupes on Svix's `event_id` via the
-- existing `webhook_events` table (same primitive Stripe uses). The
-- email_events row is only inserted once we've confirmed it's a fresh
-- event.

CREATE TABLE email_events (
  id            TEXT PRIMARY KEY,           -- Resend's event id (svix id)
  to_email      TEXT NOT NULL,              -- the recipient address
  type          TEXT NOT NULL,              -- 'bounced' | 'complained' | 'delivery_delayed' | 'delivered' | 'opened' | …
  -- Sub-type from Resend's payload, e.g. 'bounce.hard' vs 'bounce.soft'.
  -- NULL when the event type has no subdivision.
  subtype       TEXT,
  -- Raw JSON event payload for forensics — we don't try to model every
  -- field at the schema level. ~1 KB per row is fine at this volume.
  payload       TEXT NOT NULL,
  received_at   INTEGER NOT NULL            -- unix seconds when our handler accepted it
);

-- The two most common access patterns: "what happened to <address>" (drives
-- a future is-bouncing check at send time) and "what came in recently"
-- (operator triage).
CREATE INDEX email_events_to_idx       ON email_events (to_email, received_at DESC);
CREATE INDEX email_events_received_idx ON email_events (received_at DESC);
