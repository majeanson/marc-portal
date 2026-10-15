-- feat: Ashwake showcase (3D hex tile game, ashwake.marcportal.com).
--
-- Same shape as 0030. Tier 2, like Dungeon Depths: a finished playable game.
-- It's the rebuild of Ashwake 1 (tiles) on a new Three.js engine.
--
-- showcased_at is unixepoch()-200: third featured slot on the home strip,
-- under Babillard (0032) and Horizon (0033).
--
-- Iframe stays blank until the ashwake repo allows marcportal.com in its
-- frame-ancestors (its verify-deploy script asserts the old header, so that
-- change touches two files over there); OG image + link work meanwhile.
--
-- Idempotent: INSERT OR IGNORE skips if the fixed ids already exist.

INSERT OR IGNORE INTO sessions (
  id, email, intake_json, status,
  created_at, updated_at, deleted_at,
  status_history, showcased_at,
  showcase_title, showcase_tagline,
  showcase_title_en, showcase_tagline_en, tier
) VALUES (
  'Aw9rF5jD3nM8',
  'marc.jeanson92@gmail.com',
  NULL,
  'shipped',
  unixepoch(),
  unixepoch(),
  NULL,
  NULL,
  unixepoch() - 200,
  'Ashwake',
  'Pose des tuiles, fais-les mûrir, récolte, pis pousse plus loin avant que la lumière manque. Un jeu 3D pensé pour le téléphone.',
  'Ashwake',
  'Place tiles, ripen them, harvest, and push on before the light runs out. A 3D board game built for the phone.',
  2
);

INSERT OR IGNORE INTO session_advancements (
  id, session_id, date, author,
  label, body, build_url, commit_sha, iframe_path,
  flags_json, created_at, updated_at
) VALUES (
  'As3vB7qK6tP2',
  'Aw9rF5jD3nM8',
  unixepoch(),
  'marc.jeanson92@gmail.com',
  'Live build',
  'Refonte d''Ashwake premier du nom (tiles) : mêmes règles, nouveau moteur 3D en Three.js, environ 1500 tests sur le cœur de jeu. Pensé pour le téléphone en portrait ; dans la carte ici il va se sentir à l''étroit, ouvre-le en plein écran pour l''essayer comme il faut.',
  'https://ashwake.marcportal.com',
  NULL,
  NULL,
  '{"allowedForPublic":true,"showAsCurrentBuild":true}',
  unixepoch(),
  unixepoch()
);
