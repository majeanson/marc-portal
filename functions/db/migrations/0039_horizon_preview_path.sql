-- fix: point the Horizon embed at its portfolio preview route.
--
-- The horizon repo shipped /resultats?apercu as a purpose-built portfolio
-- preview (filled sample dossier, no first-visit dialog) and asked the
-- gallery to embed that instead of the bare front door. iframe_path is the
-- designed lever: the card iframe AND the "ouvrir le build" link both use
-- buildUrl + iframe_path, so outbound clicks land on the same preview and
-- can navigate from there.
--
-- Idempotent: fixed-id UPDATE; re-applying is a no-op.

UPDATE session_advancements
SET
  iframe_path = '/resultats?apercu',
  updated_at = unixepoch()
WHERE id = 'Hr2kX9bN4sL7';
