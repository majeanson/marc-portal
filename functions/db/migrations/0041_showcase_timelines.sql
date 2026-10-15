-- feat: real milestones on the seeded showcase timelines.
--
-- Each seeded project had exactly one "Live build" advancement, so its
-- /share/:id case-study page read as a single line. These entries backfill
-- the actual history (first version, rebuild, web export, production
-- households) with historic dates, so the timeline tells the story the
-- gallery card promises. Retrodio gets none on purpose: no documented
-- milestones beyond its live build, and an invented one would break the
-- "case studies cannot drift from what really happened" decision in
-- Projects.feature.json.
--
-- All entries are allowedForPublic and NOT showAsCurrentBuild — the pinned
-- live-build entry on each session keeps the card's embed. Dates are fixed
-- unix stamps (historic), so ORDER BY date DESC keeps the live build on top.
--
-- Idempotent: INSERT OR IGNORE on fixed ids.

INSERT OR IGNORE INTO session_advancements (
  id, session_id, date, author, label, body, build_url, commit_sha,
  iframe_path, flags_json, created_at, updated_at
) VALUES
  -- Jaffre: the Vercel first version, then the from-scratch rebuild (0031
  -- repointed the live build at v2 and documents the retirement).
  ('Jf1aV9nK3wP5', 'Yf3pK7xL2nQ4', 1778371200, 'marc.jeanson92@gmail.com',
   'Première mouture',
   'Auth, lobby, parties classées, bots à trois niveaux pour combler les bancs. Hébergée sur Vercel, première base de code.',
   NULL, NULL, NULL, '{"allowedForPublic":true}', 1778371200, 1778371200),
  ('Jf2bR7mX4qT8', 'Yf3pK7xL2nQ4', 1784505600, 'marc.jeanson92@gmail.com',
   'Refonte v2',
   'Reparti de zéro : moteur de règles pur testé à 100 %, un Durable Object par table sur Cloudflare, bots qui reprennent un siège quand quelqu''un décroche, classement Elo, reprise identique au bit près. L''app Vercel est retraitée.',
   NULL, NULL, NULL, '{"allowedForPublic":true}', 1784505600, 1784505600),

  -- Dungeon Depths: native iOS game first, exported to the web in June
  -- (the shims are documented in the d2game repo: Dimensions clamp,
  -- Alert.alert rewrite, drag-scroll tabs, keyboard loop).
  ('Dd1aN6wQ2kF7', 'Dd7gK3nP9xL2', 1776211200, 'marc.jeanson92@gmail.com',
   'Jeu natif d''abord',
   'Bâti en React Native pour iOS : trois classes, butin généré, boss à tous les cinq étages, mort permanente. Pensé pour le pouce.',
   NULL, NULL, NULL, '{"allowedForPublic":true}', 1776211200, 1776211200),
  ('Dd2bT8rM5xJ3', 'Dd7gK3nP9xL2', 1780358400, 'marc.jeanson92@gmail.com',
   'Export web',
   'Exporté tel quel pour le navigateur : cadre téléphone imposé, confirmations réécrites (Alert.alert ne fait rien sur le web), onglets glissables à la souris, boucle complète jouable au clavier.',
   NULL, NULL, NULL, '{"allowedForPublic":true}', 1780358400, 1780358400),

  -- Ashwake: rebuild of tiles (Ashwake 1), engine-first.
  ('Aw1aK4pL9vB2', 'Aw9rF5jD3nM8', 1787875200, 'marc.jeanson92@gmail.com',
   'Reprise de tiles',
   'Ashwake premier du nom vit encore sur tiles.marcportal.com. Mêmes règles, moteur neuf : le cœur de jeu est un paquet pur, testé avant de dessiner quoi que ce soit.',
   NULL, NULL, NULL, '{"allowedForPublic":true}', 1787875200, 1787875200),
  ('Aw2bS6nD3rH8', 'Aw9rF5jD3nM8', 1790294400, 'marc.jeanson92@gmail.com',
   'Moteur 3D',
   'La plaine passe en Three.js : tuiles hexagonales éclairées, pose au doigt, environ 1500 tests sur les règles pis la simulation.',
   NULL, NULL, NULL, '{"allowedForPublic":true}', 1790294400, 1790294400),

  -- Babillard: household prototype first, real families since.
  ('Bb1aM7tW2qX4', 'Bb4qW8nT2xK6', 1780531200, 'marc.jeanson92@gmail.com',
   'Premier prototype mural',
   'Une tablette au mur de la cuisine, un agenda partagé pis des listes. Posé chez nous d''abord : si ça survit pas à notre semaine, ça sort pas.',
   NULL, NULL, NULL, '{"allowedForPublic":true}', 1780531200, 1780531200),
  ('Bb2bF9kR6nL3', 'Bb4qW8nT2xK6', 1789430400, 'marc.jeanson92@gmail.com',
   'Des vraies maisonnées',
   'Routines en images pour les enfants, planif des soupers, rotation des corvées, sauvegarde chaque nuit. Plusieurs familles s''en servent à tous les jours.',
   NULL, NULL, NULL, '{"allowedForPublic":true}', 1789430400, 1789430400),

  -- Horizon: young project, one honest milestone (launch).
  ('Hz1aP3vN8mK6', 'Hz6tM3pR8wQ1', 1791244800, 'marc.jeanson92@gmail.com',
   'Premier jet',
   'À quel âge la retraite a du sens, 60 ou 65 ? RRQ, PSV, SRG, RREGOP, REER, CELI, deux régimes d''impôt. Tout se calcule dans le navigateur, rien ne sort de l''appareil.',
   NULL, NULL, NULL, '{"allowedForPublic":true}', 1791244800, 1791244800);
