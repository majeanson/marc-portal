-- feat: point the Jaffre showcase at the v2 rehaul.
--
-- The showcase seeded in 0012 embedded https://jaffre.vercel.app, the first
-- Jaffre codebase. That app is retired: the game was rebuilt from scratch
-- (github.com/majeanson/jaffre-v2 — pure tested engine, one Durable Object
-- per room on Cloudflare, bots, Elo ladder, bit-identical replays) and now
-- deploys to https://jaffre.marcportal.com. Note the subdomain is still a
-- different origin than marcportal.com, so the AUDIT P1.9 iframe-sandbox
-- rationale holds.
--
-- UPDATE-in-place rather than a second advancement: the Vercel build is
-- replaced, not a milestone on the same build. A second timeline entry would
-- keep presenting the retired app as history worth clicking into.
--
-- Also fills the EN gallery copy (columns added in 0030) — the Jaffre row
-- predates them and was FR-only.
--
-- Idempotent: plain UPDATEs against fixed ids; re-applying is a no-op.

UPDATE sessions
SET
  showcase_title_en = 'Jaffre',
  showcase_tagline_en = 'Four players, two teams, one game. Real-time tricks, in the browser.',
  updated_at = unixepoch()
WHERE id = 'Yf3pK7xL2nQ4';

UPDATE session_advancements
SET
  body = 'Refonte complète depuis zéro : moteur de règles pur testé à 100 %, un Durable Object par table sur Cloudflare, bots qui reprennent un siège quand quelqu''un décroche, classement Elo, reprise de partie identique au bit près. La partie embarquée se charge sans compte ; pour jouer pour vrai, ouvre-la dans un nouvel onglet.',
  build_url = 'https://jaffre.marcportal.com',
  date = unixepoch(),
  updated_at = unixepoch()
WHERE id = 'Hk4pNc2xZv9R';
