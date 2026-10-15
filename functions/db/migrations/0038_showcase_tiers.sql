-- fix: re-tier three showcase cards (Marc's call, 2026-10-15).
--
-- The gallery doubles as the living tier reference, so the chips should
-- reflect what each build would really cost: Dungeon Depths and Truck notes
-- read as Tier 1 scope, Ashwake's 3D engine and test weight read as Tier 3.
-- Tiers were seeded/admin-set earlier; this aligns all three in one place.
--
-- Truck notes only exists in the production DB (created through the app),
-- so that UPDATE matches 0 rows elsewhere. Idempotent fixed-id UPDATEs.

UPDATE sessions SET tier = 1, updated_at = unixepoch() WHERE id = 'Dd7gK3nP9xL2';
UPDATE sessions SET tier = 1, updated_at = unixepoch() WHERE id = 'ciA6ZRbzpDJlyX6t';
UPDATE sessions SET tier = 3, updated_at = unixepoch() WHERE id = 'Aw9rF5jD3nM8';
