-- Pricing v2 follow-up — record which custodian plan an active subscription
-- is on (watch | care), denormalized onto the session row. Same pattern as
-- custodian_status / custodian_subscription_id: it lets the AdminCustodians
-- page compute an exact MRR (watch x $120 + care x $400, then / 12) instead
-- of a Watch-Care range, without joining the payments table per row.
--
-- Written by the checkout webhook on custodian activation. Reflects the plan
-- at subscribe time; a later plan switch made through the Stripe customer
-- portal is not synced back here.
ALTER TABLE sessions ADD COLUMN custodian_plan TEXT;
