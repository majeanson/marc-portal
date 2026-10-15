-- fix: point the Retrodio embed at its new public demo.
--
-- The odio repo shipped /apercu (odio-2026-056): the real clip player over
-- canned takes — stamps, cut masking, version switching — with no auth and
-- no network calls that can fail anonymously. Until now the card's iframe
-- only ever showed the app's login redirect. Same lever as Horizon's
-- /resultats?apercu (0039): iframe_path rides both the embed and the
-- open-build link.
--
-- Idempotent: fixed-id UPDATE; re-applying is a no-op.

UPDATE session_advancements
SET
  iframe_path = '/apercu',
  updated_at = unixepoch()
WHERE id = 'Pq8rTm5yLw3J';
