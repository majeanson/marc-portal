-- feat: dads showcase (private clubhouse, dads.marcportal.com).
--
-- Same shape as 0030, with one deliberate difference in what the embed can
-- ever show: the app is private (invite word, member photos), so the live
-- iframe only ever frames the invite-door screen. That's the point; the body
-- copy says so. Showcasing the door was an explicit decision (2026-10-15)
-- over a no-embed card or leaving it out.
--
-- showcased_at is unixepoch()-300: on the gallery but off the home strip
-- (newest 3 = 0032/0033/0034).
--
-- Idempotent: INSERT OR IGNORE skips if the fixed ids already exist.

INSERT OR IGNORE INTO sessions (
  id, email, intake_json, status,
  created_at, updated_at, deleted_at,
  status_history, showcased_at,
  showcase_title, showcase_tagline,
  showcase_title_en, showcase_tagline_en, tier
) VALUES (
  'Da8pL4vS6mJ2',
  'marc.jeanson92@gmail.com',
  NULL,
  'shipped',
  unixepoch(),
  unixepoch(),
  NULL,
  NULL,
  unixepoch() - 300,
  'dads',
  'Un salon privé pour une gang de pères qui se connaissent déjà : jaser franchement, s''organiser, pis s''asseoir à une table de Jaffre.',
  'dads',
  'A private clubhouse for a few dads who already know each other: honest talk, plans, and a Jaffre table to sit at.',
  3
);

INSERT OR IGNORE INTO session_advancements (
  id, session_id, date, author,
  label, body, build_url, commit_sha, iframe_path,
  flags_json, created_at, updated_at
) VALUES (
  'Dn3rK7xB9wF5',
  'Da8pL4vS6mJ2',
  unixepoch(),
  'marc.jeanson92@gmail.com',
  'Live build',
  'Clavardage en direct, appels voix et vidéo, photos, question du jour, présences pour les soirées de gars, et une table de Jaffre intégrée. Tout vit derrière un mot d''invitation ; ce que la carte montre ici, c''est la porte, pis c''est voulu de même.',
  'https://dads.marcportal.com',
  NULL,
  NULL,
  '{"allowedForPublic":true,"showAsCurrentBuild":true}',
  unixepoch(),
  unixepoch()
);
