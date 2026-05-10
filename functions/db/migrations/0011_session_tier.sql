-- feat-session-tier
-- Identifies sessions by scope/price tier so the public gallery and admin
-- console can sort and badge them. Stored as nullable INTEGER to mirror the
-- public Pricing copy (Tier 0 self-serve, Tier 1 ~$300, Tier 2 ~$1500,
-- Tier 3 ~$3000+). NULL = not tiered yet (admin hasn't classified the
-- session). Tier 2 is the canonical SND price-anchor.

ALTER TABLE sessions ADD COLUMN tier INTEGER;
