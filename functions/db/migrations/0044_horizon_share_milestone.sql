-- fix: Horizon card copy caught up with its own embed, plus today's milestone.
--
-- 1. The live-build body still told the visitor to « Clique "Charger
--    l'exemple" » — stale since 0039 pointed the embed at /resultats?apercu,
--    which already shows the pre-filled example. The last sentence now
--    describes what the iframe actually displays.
-- 2. Horizon shipped scenario sharing today (link-carried age + household,
--    pre-rendered OG cards) — a real milestone for the /share timeline, same
--    honest-history rule as 0041. Its date sits a few minutes before the
--    pinned live-build row so ORDER BY date DESC keeps the live build on top.
--
-- Idempotent: fixed-id UPDATE + INSERT OR IGNORE.

UPDATE session_advancements
SET
  body = 'RRQ, PSV, SRG, RREGOP, REER, CELI : chaque montant vient des paramètres officiels et cite sa source, pis une vérification hebdomadaire s''assure que les sources tiennent encore. Aucun compte : tout se calcule dans ton navigateur. L''aperçu ci-dessus montre un couple fictif rempli d''avance ; ouvre le build pour partir de tes vrais chiffres.',
  updated_at = unixepoch()
WHERE id = 'Hr2kX9bN4sL7';

INSERT OR IGNORE INTO session_advancements (
  id, session_id, date, author, label, body, build_url, commit_sha,
  iframe_path, flags_json, created_at, updated_at
) VALUES (
  'Hz2cW5qJ7xT9', 'Hz6tM3pR8wQ1', 1792071000, 'marc.jeanson92@gmail.com',
  'Scénario partageable',
  'Chaque résultat se partage par lien : l''âge pis le foyer voyagent dans l''URL, rien d''autre. Les 214 cartes d''aperçu sont rendues d''avance, fait que le serveur sert juste un fichier, jamais un rendu sous pression.',
  NULL, NULL, NULL, '{"allowedForPublic":true}', 1792071000, 1792071000
);
