-- fix: fill Retrodio's EN gallery copy.
--
-- The row was seeded in 0012, before the _en columns existed (0030). Jaffre
-- got its EN copy in 0031; Retrodio was left behind, so /en/projects falls
-- back to the FR tagline for it. Rewrite, not a word-for-word translation,
-- same as the other cards.
--
-- Idempotent: plain UPDATE against a fixed id; re-applying is a no-op.

UPDATE sessions
SET
  showcase_title_en = 'Retrodio',
  showcase_tagline_en = 'Jam. Cut. Keep. A session recorder for bands, in the browser.',
  updated_at = unixepoch()
WHERE id = 'Mv9zR4kB8sH1';
