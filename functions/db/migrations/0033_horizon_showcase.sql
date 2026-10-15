-- feat: Horizon showcase (Québec retirement planner, retraite.marcportal.com).
--
-- Same shape as 0030. Tier 3: a full product with cited government
-- parameters and a weekly source-liveness check, but single-purpose.
--
-- showcased_at is unixepoch()-100 so Babillard (0032) sorts above it on the
-- home strip while Horizon keeps the second featured slot.
--
-- Iframe stays blank until the horizon repo allows marcportal.com in its
-- frame-ancestors; OG image + link work meanwhile.
--
-- Idempotent: INSERT OR IGNORE skips if the fixed ids already exist.

INSERT OR IGNORE INTO sessions (
  id, email, intake_json, status,
  created_at, updated_at, deleted_at,
  status_history, showcased_at,
  showcase_title, showcase_tagline,
  showcase_title_en, showcase_tagline_en, tier
) VALUES (
  'Hz6tM3pR8wQ1',
  'marc.jeanson92@gmail.com',
  NULL,
  'shipped',
  unixepoch(),
  unixepoch(),
  NULL,
  NULL,
  unixepoch() - 100,
  'Horizon',
  'À quel âge tu peux prendre ta retraite ? Calculé sur les paramètres officiels du Québec et du Canada, et tes données restent sur ton appareil.',
  'Horizon',
  'When can you retire? Worked out from the official Québec and Canada parameters, and your data never leaves your device.',
  3
);

INSERT OR IGNORE INTO session_advancements (
  id, session_id, date, author,
  label, body, build_url, commit_sha, iframe_path,
  flags_json, created_at, updated_at
) VALUES (
  'Hr2kX9bN4sL7',
  'Hz6tM3pR8wQ1',
  unixepoch(),
  'marc.jeanson92@gmail.com',
  'Live build',
  'RRQ, PSV, SRG, RREGOP, REER, CELI : chaque montant vient des paramètres officiels et cite sa source, pis une vérification hebdomadaire s''assure que les sources tiennent encore. Aucun compte : tout se calcule dans ton navigateur. Clique « Charger l''exemple » pour voir un couple fictif rempli d''avance.',
  'https://retraite.marcportal.com',
  NULL,
  NULL,
  '{"allowedForPublic":true,"showAsCurrentBuild":true}',
  unixepoch(),
  unixepoch()
);
