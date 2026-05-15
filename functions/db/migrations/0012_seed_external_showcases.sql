-- Seed: two externally-hosted showcased sessions (Jaffre + Retrodio).
--
-- These point at deployed Vercel apps in sibling repos (anthropicJoffre,
-- odio). Each gets one advancement carrying the live build_url so the
-- existing /share/<id> iframe-toggle UI works without changes.
--
-- Idempotent: INSERT OR IGNORE skips if the fixed session id already exists,
-- so re-applying the migration on a populated DB is a no-op.
--
-- IDs are 12-char opaque tokens (URL capability — anyone with the share URL
-- can view the showcase). Email is the primary admin. Status is 'shipped'
-- so the gallery presents them next to other completed work; no is_demo
-- flag — the data stays ambiguous about engagement origin on purpose.

INSERT OR IGNORE INTO sessions (
  id, email, intake_json, status,
  created_at, updated_at, deleted_at,
  status_history, showcased_at,
  showcase_title, showcase_tagline, tier
) VALUES
  (
    'Yf3pK7xL2nQ4',
    'marc.jeanson92@gmail.com',
    NULL,
    'shipped',
    unixepoch(),
    unixepoch(),
    NULL,
    NULL,
    unixepoch(),
    'Jaffre',
    'Quatre joueurs, deux équipes, une partie. Levées en temps réel, dans le navigateur.',
    3
  ),
  (
    'Mv9zR4kB8sH1',
    'marc.jeanson92@gmail.com',
    NULL,
    'shipped',
    unixepoch(),
    unixepoch(),
    NULL,
    NULL,
    unixepoch(),
    'Retrodio',
    'Jam. Cut. Keep. Enregistreur de session pour groupes, dans le navigateur.',
    2
  );

INSERT OR IGNORE INTO session_advancements (
  id, session_id, date, author,
  label, body, build_url, commit_sha, iframe_path,
  flags_json, created_at, updated_at
) VALUES
  (
    'Hk4pNc2xZv9R',
    'Yf3pK7xL2nQ4',
    unixepoch(),
    'marc.jeanson92@gmail.com',
    'Live build',
    'Multijoueur temps-réel : auth, lobby, parties classées, bots IA à trois niveaux pour combler les bancs. La session embarquée se charge sans connexion ; pour jouer, ouvrez dans un nouvel onglet.',
    'https://jaffre.vercel.app',
    NULL,
    NULL,
    '{"allowedForPublic":true,"showAsCurrentBuild":true}',
    unixepoch(),
    unixepoch()
  ),
  (
    'Pq8rTm5yLw3J',
    'Mv9zR4kB8sH1',
    unixepoch(),
    'marc.jeanson92@gmail.com',
    'Live build',
    'PWA Next.js : enregistrez la jam, marquez les moments forts, taillez sur la forme d''onde, versionnez sans rien écraser, gelez le mix final. Stockage Google Drive, rendu FFmpeg côté serveur.',
    'https://retrodio.vercel.app',
    NULL,
    NULL,
    '{"allowedForPublic":true,"showAsCurrentBuild":true}',
    unixepoch(),
    unixepoch()
  );
