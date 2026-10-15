-- feat: the portal as its own showcase card.
--
-- marcportal.com is itself a Tier-4-grade build with a self-documenting
-- /meta page; the gallery is the obvious place to say so. The card embeds
-- the site inside itself (frame-src and frame-ancestors both allow 'self'),
-- pointed at /meta via iframe_path — a page with no iframes of its own, so
-- the recursion stops at depth one. The open-build link lands on /meta too.
--
-- showcased_at is a fixed stamp (late July 2026, the reskin era) so the
-- card sits mid-gallery rather than claiming the featured strip.
--
-- Idempotent: INSERT OR IGNORE on fixed ids.

INSERT OR IGNORE INTO sessions (
  id, email, intake_json, status,
  created_at, updated_at, deleted_at,
  status_history, showcased_at,
  showcase_title, showcase_tagline,
  showcase_title_en, showcase_tagline_en, tier
) VALUES (
  'Pt4mQ8rC2nX6',
  'marc.jeanson92@gmail.com',
  NULL,
  'shipped',
  1785000000,
  1785000000,
  NULL,
  NULL,
  1785000000,
  'marc.portal',
  'Ce site-ci. Chaque morceau se documente tout seul ; la page /meta, c''est le code qui se raconte.',
  'marc.portal',
  'This very site. Every piece documents itself; /meta is the code telling its own story.',
  4
);

INSERT OR IGNORE INTO session_advancements (
  id, session_id, date, author,
  label, body, build_url, commit_sha, iframe_path,
  flags_json, created_at, updated_at
) VALUES (
  'Pt1bW5kN9rJ4',
  'Pt4mQ8rC2nX6',
  1785000000,
  'marc.jeanson92@gmail.com',
  'Live build',
  'Intake guidé, paiements Stripe, suivi de session, galerie, courriels transactionnels, le tout sur Cloudflare Pages avec D1. Les fiches feature.json vivent à côté du code ; /meta les assemble à chaque build. La carte que tu regardes est rendue par le site qu''elle décrit.',
  'https://marcportal.com',
  NULL,
  '/meta',
  '{"allowedForPublic":true,"showAsCurrentBuild":true}',
  1785000000,
  1785000000
);
