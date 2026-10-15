-- feat: Babillard showcase (calm household planner, babillard.marcportal.com).
--
-- Same shape as 0030: a 'shipped' session plus one showAsCurrentBuild
-- advancement carrying the live build_url. Tier 4 because it's a standing
-- product with real households in production, not a one-shot build.
--
-- showcased_at offsets (0032..0035 apply in the same deploy): the home strip
-- shows the newest 3 by showcase date, so the stagger decides who's featured.
-- Babillard gets the top slot (no offset).
--
-- The live iframe stays blank until the babillard repo ships its
-- frame-ancestors change allowing marcportal.com; the card's generated OG
-- image and the open-build link work either way.
--
-- Idempotent: INSERT OR IGNORE skips if the fixed ids already exist.

INSERT OR IGNORE INTO sessions (
  id, email, intake_json, status,
  created_at, updated_at, deleted_at,
  status_history, showcased_at,
  showcase_title, showcase_tagline,
  showcase_title_en, showcase_tagline_en, tier
) VALUES (
  'Bb4qW8nT2xK6',
  'marc.jeanson92@gmail.com',
  NULL,
  'shipped',
  unixepoch(),
  unixepoch(),
  NULL,
  NULL,
  unixepoch(),
  'Babillard',
  'Le souper, l''agenda, l''épicerie pis les routines des enfants sur une tablette au mur, sans points ni notifications.',
  'Babillard',
  'Supper, the calendar, groceries and the kids'' routines on a wall tablet, with no points and no notifications.',
  4
);

INSERT OR IGNORE INTO session_advancements (
  id, session_id, date, author,
  label, body, build_url, commit_sha, iframe_path,
  flags_json, created_at, updated_at
) VALUES (
  'Ba7cJ2mY5rV9',
  'Bb4qW8nT2xK6',
  unixepoch(),
  'marc.jeanson92@gmail.com',
  'Live build',
  'Agenda partagé, listes, rotation des corvées, planif des soupers, routines en images pour les enfants, recettes de la maison. Temps réel entre les appareils pis sauvegarde chaque nuit ; des vraies familles s''en servent à tous les jours. Calme par design : rien qui clignote, rien qui te relance.',
  'https://babillard.marcportal.com',
  NULL,
  NULL,
  '{"allowedForPublic":true,"showAsCurrentBuild":true}',
  unixepoch(),
  unixepoch()
);
