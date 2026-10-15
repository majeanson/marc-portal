-- fix: un-showcase the stale Babillard engagement row + Truck notes EN copy.
--
-- 0032 seeded the canonical Babillard card (babillard.marcportal.com, FR+EN,
-- shipped). Production also had an admin-showcased engagement session for the
-- same project ('_75Fpp09ZMp2jynl', June 2026): status active, FR-only copy,
-- build_url on a retired versioned workers.dev preview. Two Babillard cards
-- in the gallery is a bug; the engagement row loses its showcase flag, not
-- its data. Re-showcasing it is one click in /admin/showcase if ever wanted.
--
-- Also backfills Truck notes' EN copy, the same backfill Retrodio got in
-- 0036 (the row predates the 0030 _en columns).
--
-- These ids only exist in the production DB (both rows were created through
-- the app, not a seed), so on local/e2e databases both UPDATEs match 0 rows.
-- Idempotent: fixed-id UPDATEs; re-applying is a no-op.

UPDATE sessions
SET
  showcased_at = NULL,
  updated_at = unixepoch()
WHERE id = '_75Fpp09ZMp2jynl';

UPDATE sessions
SET
  showcase_title_en = 'Truck notes',
  showcase_tagline_en = 'Turns a visit at a client''s place into a draft quote or invoice, dictated from the truck.',
  updated_at = unixepoch()
WHERE id = 'ciA6ZRbzpDJlyX6t';
