-- Stripe payments + custodian-mode subscriptions. One row per money movement
-- so the deposit + final on a Tier 2 are two rows, and each yearly renewal of
-- a custodian sub is its own row. Subscription lifecycle (current/past_due/
-- canceled) is cached on sessions.custodian_status; payments rows are the
-- auditable history. Stripe remains the source of truth — these rows mirror
-- what webhooks tell us.

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL
    CHECK (kind IN ('tier1', 'tier2-deposit', 'tier2-final', 'tier3', 'custodian-sub')),
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'cad',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'refunded', 'failed', 'canceled')),
  -- Stripe identifiers. checkout_session_id is what the webhook arrives with;
  -- payment_intent + charge are populated on completion. subscription_id is
  -- only set for the custodian-sub kind. customer_id is set whenever Stripe
  -- creates one (most flows do).
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  stripe_subscription_id TEXT,
  stripe_invoice_id TEXT,
  stripe_customer_id TEXT,
  created_at INTEGER NOT NULL,
  paid_at INTEGER,
  refunded_at INTEGER,
  failure_reason TEXT,
  -- Free-form JSON for webhook-event details we don't model explicitly.
  -- Kept small (no full event payloads); useful for support spelunking.
  metadata_json TEXT
);

CREATE INDEX payments_session_idx ON payments(session_id, created_at);
CREATE INDEX payments_status_idx ON payments(status);
-- Idempotency lookup: webhooks arrive identified by checkout_session_id; we
-- need an indexed "have I seen this before?" check. UNIQUE because Stripe
-- never reuses a checkout session id, and we never want two payment rows
-- pointing at the same Stripe Checkout.
CREATE UNIQUE INDEX payments_stripe_checkout_idx
  ON payments(stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;
-- Same idempotency story for invoices (each renewal of a sub creates one
-- invoice; we write exactly one payments row per invoice).
CREATE UNIQUE INDEX payments_stripe_invoice_idx
  ON payments(stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL;

-- Custodian-mode cache on the parent session. Updated by subscription
-- webhooks. The Handoff page promises auto-switch to 'tout_a_toi' when a
-- renewal is missed; 'past_due' is the in-between state (Stripe is retrying
-- the charge) where the visitor's keys are not yet released.
ALTER TABLE sessions ADD COLUMN custodian_status TEXT
  CHECK (custodian_status IN ('none', 'active', 'past_due', 'canceled', 'switched_to_tout_a_toi'))
  DEFAULT 'none';
ALTER TABLE sessions ADD COLUMN custodian_subscription_id TEXT;
-- Reverse lookup so a webhook can find the session row from a Stripe sub id
-- in O(log n). Sparse — only sessions with a sub get a value.
CREATE INDEX sessions_custodian_sub_idx ON sessions(custodian_subscription_id)
  WHERE custodian_subscription_id IS NOT NULL;
