-- Pricing v2 — five-tier ladder + decoupled payment model.
--
-- Public pricing moves from Tier 0/1/2/3 (Tier 3 quoted) to a five-tier
-- ladder: Tier 0 free · Tier 1 $750 · Tier 2 $1800 · Tier 3 $3600 (fixed) ·
-- Tier 4 quoted ("from $7500"). The old Tier 3 was the *quoted* tier; that
-- role now belongs to Tier 4. So the old tier3_amount_cents column (the
-- admin's quoted figure) is renamed to tier4_amount_cents, and any session
-- already classified tier=3 is bumped to tier=4.
--
-- Payments move to a decoupled model: kind ∈ (build, scoping, custodian),
-- with tier + installment_index/installment_of carried as their own columns
-- instead of fused into the kind string (the old tier2-deposit / tier2-final
-- / custodian-sub enum could not express Tier 3's two split modes).
--
-- SAFE REBUILD: confirmed no live (real-money) payments exist — only
-- disposable test-mode rows. The payments table is dropped and recreated so
-- the kind CHECK constraint can change (SQLite cannot ALTER a CHECK in place).

-- 1. Renumber existing sessions: the old quoted Tier 3 becomes the new Tier 4.
UPDATE sessions SET tier = 4 WHERE tier = 3;

-- 2. The admin-quoted amount now belongs to Tier 4.
ALTER TABLE sessions RENAME COLUMN tier3_amount_cents TO tier4_amount_cents;

-- 3. Tier 3 is fixed-price ($3600), but the admin picks the installment split
--    per project: '50-50' (2 legs) or '40-40-20' (3 legs). NULL = not chosen
--    yet — checkout.ts defaults to '50-50'.
ALTER TABLE sessions ADD COLUMN tier3_split TEXT
  CHECK (tier3_split IS NULL OR tier3_split IN ('50-50', '40-40-20'));

-- 4. Rebuild payments with the decoupled model. webhook_events and
--    admin_alerts (also created under 0014) are untouched — nothing
--    references payments, so the drop is self-contained.
DROP TABLE IF EXISTS payments;
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  -- Decoupled: kind says WHAT this payment is; tier + installment_* say
  -- WHICH leg of a build it covers.
  kind TEXT NOT NULL CHECK (kind IN ('build', 'scoping', 'custodian')),
  -- build only: 1-4. NULL for scoping / custodian.
  tier INTEGER CHECK (tier IS NULL OR tier IN (1, 2, 3, 4)),
  -- build only: 1-based leg index and total leg count. Tier 1 is 1/1; a
  -- 50/50 is 1/2 + 2/2; a 40/40/20 is 1/3 + 2/3 + 3/3. NULL otherwise.
  installment_index INTEGER,
  installment_of INTEGER,
  -- custodian only: which annual plan. NULL for build / scoping.
  custodian_plan TEXT CHECK (custodian_plan IS NULL OR custodian_plan IN ('watch', 'care')),
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'cad',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'refunded', 'failed', 'canceled')),
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  stripe_subscription_id TEXT,
  stripe_invoice_id TEXT,
  stripe_customer_id TEXT,
  created_at INTEGER NOT NULL,
  paid_at INTEGER,
  refunded_at INTEGER,
  refunded_amount_cents INTEGER NOT NULL DEFAULT 0,
  failure_reason TEXT,
  metadata_json TEXT
);

CREATE INDEX payments_session_idx ON payments(session_id, created_at);
CREATE INDEX payments_status_idx ON payments(status);
-- Idempotency lookups for webhook arrivals (see webhook.ts). UNIQUE because
-- Stripe never reuses a checkout-session or invoice id.
CREATE UNIQUE INDEX payments_stripe_checkout_idx
  ON payments(stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;
CREATE UNIQUE INDEX payments_stripe_invoice_idx
  ON payments(stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL;
