-- feat: Dungeon Depths showcase + bilingual showcase copy.
--
-- Two parts:
--   1. Add EN columns for the public gallery card. The original showcase copy
--      (0010) was single-language; the home/projects card is FR-first but the
--      /en gallery should read its own copy, not the FR string. The card shows
--      title + tagline, so only those two get an _en twin. The longer build
--      note (advancement body) lives on the shared advancements timeline and
--      stays single-language, like the Jaffre/Retrodio showcases.
--   2. Seed the Dungeon Depths showcase (an Expo/RN game exported to web and
--      hosted on Cloudflare Workers). Same shape as 0012: a 'shipped' session
--      plus one showAsCurrentBuild advancement carrying the live build_url.
--
-- Idempotent: ALTERs run once (wrangler tracks by filename); INSERT OR IGNORE
-- skips if the fixed ids already exist.

ALTER TABLE sessions ADD COLUMN showcase_title_en TEXT;
ALTER TABLE sessions ADD COLUMN showcase_tagline_en TEXT;

INSERT OR IGNORE INTO sessions (
  id, email, intake_json, status,
  created_at, updated_at, deleted_at,
  status_history, showcased_at,
  showcase_title, showcase_tagline,
  showcase_title_en, showcase_tagline_en, tier
) VALUES (
  'Dd7gK3nP9xL2',
  'marc.jeanson92@gmail.com',
  NULL,
  'shipped',
  unixepoch(),
  unixepoch(),
  NULL,
  NULL,
  unixepoch(),
  'Dungeon Depths',
  'Un roguelike de donjon sur grille. Pensé pour le téléphone, jouable au complet dans le navigateur.',
  'Dungeon Depths',
  'A grid-based dungeon roguelike. Built for the phone, fully playable in the browser.',
  2
);

INSERT OR IGNORE INTO session_advancements (
  id, session_id, date, author,
  label, body, build_url, commit_sha, iframe_path,
  flags_json, created_at, updated_at
) VALUES (
  'Db5mHc8yRw4T',
  'Dd7gK3nP9xL2',
  unixepoch(),
  'marc.jeanson92@gmail.com',
  'Live build',
  'Roguelike au tour par tour : trois classes, butin généré, boss à tous les cinq étages, mort permanente. Bâti en React Native pour iOS, exporté tel quel pour le web. Jouable au clavier comme à la souris; ouvre-le en plein écran pour l''essayer.',
  'https://dungeondepths.marc-jeanson.workers.dev',
  NULL,
  NULL,
  '{"allowedForPublic":true,"showAsCurrentBuild":true}',
  unixepoch(),
  unixepoch()
);
