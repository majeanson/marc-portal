/**
 * Track A — Dev handoff.
 *
 * A new dev taking over Marc's existing instance: same domain, same data,
 * same Stripe account — only the operator changes. Differs from Track C
 * (template buyer): A rotates existing credentials, C generates fresh ones
 * on a clean slate.
 *
 * Step ids are stable. Track B steps reference these via `dependsOn`.
 */

import type { Track } from './types'

export const trackA: Track = {
  id: 'A',
  eyebrow: {
    fr: 'dev · handoff',
    en: 'dev · handoff',
  },
  title: {
    fr: 'Reprise du portail',
    en: 'Dev handoff',
  },
  sub: {
    fr: 'Tu prends les commandes d’une instance déjà en production. L’infra existe, les visiteurs existent — tu rotates, tu ne crées pas.',
    en: 'You’re taking over a live instance. Infra exists, visitors exist — you rotate, you don’t create.',
  },
  steps: [
    {
      id: 'A-01',
      num: '1',
      title: { fr: 'Obtenir les accès', en: 'Get access' },
      time: '5 min',
      summary: {
        fr: 'Invitations GitHub, Cloudflare, Resend, Stripe, Sentry.',
        en: 'GitHub, Cloudflare, Resend, Stripe, Sentry invites.',
      },
      why: {
        fr: 'Sans accès aux 5 services, tu peux lire le code mais tu ne peux rien rotater. Demande les invitations AVANT de commencer.',
        en: 'Without access to all 5 services, you can read code but can’t rotate anything. Request invites BEFORE starting.',
      },
      how: {
        fr: [
          'GitHub : collaborator sur le repo (Admin si tu vas releaser)',
          'Cloudflare : Member sur le compte Pages (rôle Administrator pour Pages + D1 + R2)',
          'Resend : team invite avec rôle Admin',
          'Stripe : team invite avec rôle Administrator',
          'Sentry : org invite avec rôle Manager',
        ],
        en: [
          'GitHub: collaborator on the repo (Admin if you’ll release)',
          'Cloudflare: Member on the Pages account (Administrator role for Pages + D1 + R2)',
          'Resend: team invite with Admin role',
          'Stripe: team invite with Administrator role',
          'Sentry: org invite with Manager role',
        ],
      },
      gotcha: {
        fr: [
          'Stripe : un seul humain peut être propriétaire — l’invitation team ne te rend pas owner. Au cutover final, transfert de propriété via Settings → Team and Security.',
          'Cloudflare 2FA est OBLIGATOIRE pour rejoindre une org — sans ça, l’invitation reste pending.',
        ],
        en: [
          'Stripe: only one human can be Owner — a team invite doesn’t make you owner. At final cutover, transfer ownership via Settings → Team and Security.',
          'Cloudflare 2FA is REQUIRED to join an org — without it, the invite stays pending.',
        ],
      },
      verify: {
        fr: 'Tu peux ouvrir le dashboard Pages, voir le projet marc-portal, et lister les D1 databases.',
        en: 'You can open the Pages dashboard, see the marc-portal project, and list D1 databases.',
      },
    },
    {
      id: 'A-02',
      num: '2',
      title: { fr: 'Setup local', en: 'Local setup' },
      time: '10 min',
      summary: {
        fr: 'Clone, bun install, .dev.vars rempli avec des clés de DEV (pas prod).',
        en: 'Clone, bun install, .dev.vars filled with DEV keys (not prod).',
      },
      why: {
        fr: 'Tu veux pouvoir itérer sans toucher prod. Les clés Stripe test mode + une Resend dev key permettent de tout tester localement.',
        en: 'You want to iterate without touching prod. Stripe test-mode keys + a Resend dev key let you test everything locally.',
      },
      how: {
        fr: [
          '`git clone https://github.com/majeanson/marc-portal.git`',
          '`cd marc-portal && bun install`',
          '`cp .dev.vars.example .dev.vars`',
          'Génère SESSION_SECRET local : `openssl rand -hex 32`',
          'Remplis RESEND_API_KEY (dev, séparé du prod), STRIPE_SECRET_KEY (sk_test_*)',
        ],
        en: [
          '`git clone https://github.com/majeanson/marc-portal.git`',
          '`cd marc-portal && bun install`',
          '`cp .dev.vars.example .dev.vars`',
          'Generate local SESSION_SECRET: `openssl rand -hex 32`',
          'Fill RESEND_API_KEY (dev, separate from prod), STRIPE_SECRET_KEY (sk_test_*)',
        ],
      },
      gotcha: {
        fr: [
          'Bun, pas npm — le bug @emnapi est documenté dans la mémoire du projet.',
          '.dev.vars est dans .gitignore — ne le commit JAMAIS.',
          'Sur Windows, `openssl` n’est pas natif — utilise Git Bash ou WSL.',
        ],
        en: [
          'Bun, not npm — the @emnapi bug is documented in project memory.',
          '.dev.vars is in .gitignore — NEVER commit it.',
          'On Windows, `openssl` isn’t native — use Git Bash or WSL.',
        ],
      },
      verify: {
        fr: '`bun run typecheck` passe. `bun run dev` démarre sans erreur de binding.',
        en: '`bun run typecheck` passes. `bun run dev` starts without binding errors.',
      },
    },
    {
      id: 'A-03',
      num: '3',
      title: { fr: 'Run local', en: 'Run locally' },
      time: '2 min',
      summary: {
        fr: 'bun run dev → localhost:8788 → connexion via lien magique en console.',
        en: 'bun run dev → localhost:8788 → magic-link sign-in via console.',
      },
      why: {
        fr: 'Confirme que ton local atteint D1 (via wrangler) et que les fonctions sont servies. Premier signal de vie.',
        en: 'Confirms your local reaches D1 (via wrangler) and Functions are served. First sign of life.',
      },
      how: {
        fr: [
          '`bun run dev` (lance wrangler pages dev)',
          'Ouvre http://localhost:8788',
          '/login → entre ton email → lien magique imprimé en console (Resend dev key)',
          'Clique le lien (ou copie depuis la console)',
        ],
        en: [
          '`bun run dev` (runs wrangler pages dev)',
          'Open http://localhost:8788',
          '/login → enter your email → magic link printed in console (Resend dev key)',
          'Click the link (or copy from console)',
        ],
      },
      gotcha: {
        fr: [
          'En local, D1 utilise la version distante (--remote) sauf si tu spécifies --local. Vérifie quel store tu touches.',
          'Si Stripe webhook tests sont nécessaires : `stripe listen --forward-to localhost:8788/api/payments/webhook`',
        ],
        en: [
          'Locally, D1 hits the remote store (--remote) unless you pass --local. Verify which store you’re touching.',
          'If Stripe webhook tests needed: `stripe listen --forward-to localhost:8788/api/payments/webhook`',
        ],
      },
      verify: {
        fr: 'Tu te connectes en local, tu vois /me, tu peux ouvrir /admin.',
        en: 'You sign in locally, you see /me, you can open /admin.',
      },
    },
    {
      id: 'A-04',
      num: '4',
      title: { fr: 'Modèle de données', en: 'Data model walkthrough' },
      time: '30 min',
      summary: {
        fr: 'Lis chaque migration D1 dans l’ordre. Comprends sessions, messages, payments, vouches, user_prefs.',
        en: 'Read each D1 migration in order. Understand sessions, messages, payments, vouches, user_prefs.',
      },
      why: {
        fr: 'Le schéma raconte l’histoire de l’app mieux que le code. Lire les migrations dans l’ordre montre les choix successifs.',
        en: 'The schema tells the app’s story better than the code. Reading migrations in order shows the successive choices.',
      },
      how: {
        fr: [
          '`ls functions/db/migrations/` — lis dans l’ordre numérique',
          'Tables-clés : sessions, messages, magic_link_tokens, payments, vouches, user_prefs, audit_log',
          'Note les CHECK constraints — elles encodent l’état autorisé (draft, triage, active, shipped, …)',
          '`npx wrangler d1 execute marc-portal-db --remote --command "SELECT name FROM sqlite_master WHERE type=\'table\'"`',
        ],
        en: [
          '`ls functions/db/migrations/` — read in numeric order',
          'Key tables: sessions, messages, magic_link_tokens, payments, vouches, user_prefs, audit_log',
          'Note CHECK constraints — they encode allowed state (draft, triage, active, shipped, …)',
          '`npx wrangler d1 execute marc-portal-db --remote --command "SELECT name FROM sqlite_master WHERE type=\'table\'"`',
        ],
      },
      gotcha: {
        fr: [
          'D1 verrouille par filename — ne JAMAIS renommer une migration déjà appliquée, sinon db:migrate:prod ré-essaie de la rejouer.',
          'PowerShell + wrangler --command a des soucis de quoting (voir mémoire). Utilise --file=./tmp.sql.',
          'Pas de foreign keys strictes — l’intégrité est applicative.',
        ],
        en: [
          'D1 locks by filename — NEVER rename an already-applied migration, or db:migrate:prod tries to replay it.',
          'PowerShell + wrangler --command has quoting issues (see memory). Use --file=./tmp.sql.',
          'No strict foreign keys — integrity is enforced in the app layer.',
        ],
      },
      verify: {
        fr: 'Tu peux lister toutes les tables et expliquer le rôle de sessions et messages sans relire le code.',
        en: 'You can list every table and explain the role of sessions and messages without re-reading the code.',
      },
    },
    {
      id: 'A-05',
      num: '5',
      title: { fr: 'Lis les cartes', en: 'Read the maps' },
      time: '1 hr',
      summary: {
        fr: 'CLAUDE.md, README.md, RUNBOOK.md, ECOSYSTEM.md, feature.json clés.',
        en: 'CLAUDE.md, README.md, RUNBOOK.md, ECOSYSTEM.md, key feature.json files.',
      },
      why: {
        fr: 'Le code te dit le « quoi ». Les docs te disent le « pourquoi » — les contraintes Loi 25, le modèle solo, les décisions architecturales gravées dans le marbre.',
        en: 'Code tells you the “what.” Docs tell you the “why” — Loi 25 constraints, solo model, architectural decisions set in stone.',
      },
      how: {
        fr: [
          'Lis CLAUDE.md (parent et portal) — voix du projet',
          'README.md — démarrage rapide + topologie',
          'RUNBOOK.md — incidents et procédures',
          'ECOSYSTEM.md — versions actuelles',
          'docs/loi-25-pia.md + loi-25-pia-stripe.md — conformité',
          'Quelques feat-*/feature.json (auth, payments, custodian)',
        ],
        en: [
          'Read CLAUDE.md (parent + portal) — project voice',
          'README.md — quickstart + topology',
          'RUNBOOK.md — incidents and procedures',
          'ECOSYSTEM.md — current versions',
          'docs/loi-25-pia.md + loi-25-pia-stripe.md — compliance',
          'A few feat-*/feature.json (auth, payments, custodian)',
        ],
      },
      gotcha: {
        fr: [
          'Certains feature.json sont frozen mais désactualisés — vérifie la date de freeze.',
          'Les decisions[] dans feature.json sont la source de vérité sur les compromis.',
        ],
        en: [
          'Some feature.json are frozen but stale — check the freeze date.',
          'decisions[] in feature.json is the source of truth on tradeoffs.',
        ],
      },
      verify: {
        fr: 'Tu peux expliquer en 30 sec : 1) pourquoi solo, 2) pourquoi Cloudflare, 3) pourquoi async.',
        en: 'You can explain in 30 sec: 1) why solo, 2) why Cloudflare, 3) why async.',
      },
    },
    {
      id: 'A-06',
      num: '6',
      title: { fr: 'PR de répétition', en: 'First PR rehearsal' },
      time: '30 min',
      summary: {
        fr: 'Petit changement trivial → PR → preview deploy → merge → vérifie prod.',
        en: 'Trivial change → PR → preview deploy → merge → verify prod.',
      },
      why: {
        fr: 'Tu apprends le cycle de release en risquant peu. Si ça casse, c’est sur un changement de copy, pas sur une logique de paiement.',
        en: 'You learn the release cycle while risking little. If it breaks, it’s on a copy tweak, not payment logic.',
      },
      how: {
        fr: [
          '`git checkout -b devhandoff/copy-tweak`',
          'Changement minimal (un mot dans la home, par ex.)',
          'Commit, push, ouvre PR',
          'Vérifie le preview deploy de Cloudflare Pages (URL dans le check)',
          'Merge → vérifie prod (1–3 min de propagation)',
        ],
        en: [
          '`git checkout -b devhandoff/copy-tweak`',
          'Minimal change (one word on the home, e.g.)',
          'Commit, push, open PR',
          'Verify the Cloudflare Pages preview deploy (URL in the check)',
          'Merge → verify prod (1–3 min propagation)',
        ],
      },
      gotcha: {
        fr: [
          'Si tu touches src/i18n.ts, refait `bun run typecheck` — la typeof FR garantit la parité FR/EN.',
          'CI échoue si fix-lockfile.mjs n’est pas à jour — bug @emnapi documenté.',
        ],
        en: [
          'If you touch src/i18n.ts, re-run `bun run typecheck` — the typeof FR guarantees FR/EN parity.',
          'CI fails if fix-lockfile.mjs is stale — documented @emnapi bug.',
        ],
      },
      verify: {
        fr: 'Le changement est visible sur prod, aucune erreur Sentry depuis le merge.',
        en: 'The change shows on prod, no Sentry errors since the merge.',
      },
    },
    {
      id: 'A-07',
      num: '7',
      title: { fr: 'Rotation des secrets', en: 'Rotate secrets' },
      time: '15 min',
      summary: {
        fr: 'wrangler secret put pour SESSION_SECRET, RESEND_API_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.',
        en: 'wrangler secret put for SESSION_SECRET, RESEND_API_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.',
      },
      why: {
        fr: 'À la rotation, les secrets de Marc cessent de fonctionner et les tiens prennent le relais. Une rotation incomplète = mode dégradé silencieux.',
        en: 'On rotation, Marc’s secrets stop working and yours take over. An incomplete rotation = silent degraded mode.',
      },
      how: {
        fr: [
          '`npx wrangler secret put SESSION_SECRET` (nouveau hex 32) — invalide toutes les sessions actives',
          '`npx wrangler secret put RESEND_API_KEY` (généré dans ton Resend)',
          '`npx wrangler secret put STRIPE_SECRET_KEY` (sk_live_* de TON compte Stripe)',
          '`npx wrangler secret put STRIPE_WEBHOOK_SECRET` (whsec_* du webhook live)',
          '`npx wrangler secret put DIGEST_TOKEN` (random pour cron)',
          'Marc révoque ses anciennes clés Resend + Stripe',
        ],
        en: [
          '`npx wrangler secret put SESSION_SECRET` (new 32 hex) — invalidates all active sessions',
          '`npx wrangler secret put RESEND_API_KEY` (generated in your Resend)',
          '`npx wrangler secret put STRIPE_SECRET_KEY` (sk_live_* from YOUR Stripe)',
          '`npx wrangler secret put STRIPE_WEBHOOK_SECRET` (whsec_* from the live webhook)',
          '`npx wrangler secret put DIGEST_TOKEN` (random for cron)',
          'Marc revokes his old Resend + Stripe keys',
        ],
      },
      gotcha: {
        fr: [
          'Tourner SESSION_SECRET déconnecte TOUS les utilisateurs — communique le timing aux clients actifs.',
          'Si tu changes Stripe sans changer le webhook signing secret, les paiements live ne mettent plus rien à jour.',
          'Ne supprime pas les anciens secrets — wrangler secret delete d’abord, puis put.',
        ],
        en: [
          'Rotating SESSION_SECRET signs out EVERY user — communicate timing to active clients.',
          'If you change Stripe without changing the webhook signing secret, live payments stop updating anything.',
          'Don’t blow away old secrets — wrangler secret delete first, then put.',
        ],
      },
      verify: {
        fr: '`npx wrangler secret list` montre les 5 secrets. Test : connexion + paiement test fonctionnent.',
        en: '`npx wrangler secret list` shows the 5 secrets. Test: sign-in + test payment both work.',
      },
    },
    {
      id: 'A-08',
      num: '8',
      title: { fr: 'Swap du domaine Resend', en: 'Sender domain swap' },
      time: '10 min',
      summary: {
        fr: 'Ajouter ton domaine dans Resend, drop les 4 DNS, update RESEND_FROM dans email.ts.',
        en: 'Add your domain in Resend, drop the 4 DNS records, update RESEND_FROM in email.ts.',
      },
      why: {
        fr: 'Si tu n’as pas TON domaine vérifié, tu envoies depuis le domaine de Marc — soit ses sends rebondissent, soit ils sont signés sous son identité. Cassé légalement et techniquement.',
        en: 'Without YOUR domain verified, you send from Marc’s — either his bounces fire or sends are signed under his identity. Broken legally and technically.',
      },
      how: {
        fr: [
          'resend.com → Domains → Add → ton-domaine.com',
          'Cloudflare DNS → ajouter les 4 records (DKIM TXT, MX send, SPF TXT, DMARC TXT)',
          'Attendre Verified (2–10 min)',
          'Update `RESEND_FROM` dans functions/_lib/email.ts → "<Toi> <noreply@ton-domaine.com>"',
          'Commit + push + redeploy',
        ],
        en: [
          'resend.com → Domains → Add → your-domain.com',
          'Cloudflare DNS → add the 4 records (DKIM TXT, MX send, SPF TXT, DMARC TXT)',
          'Wait for Verified (2–10 min)',
          'Update `RESEND_FROM` in functions/_lib/email.ts → "<You> <noreply@your-domain.com>"',
          'Commit + push + redeploy',
        ],
      },
      gotcha: {
        fr: [
          'Tant que ton domaine n’est pas vérifié, chaque send échoue avec 403. Le code logue mais l’UI dit « envoyé ».',
          'Reverse strategy : pendant la transition, garde le RESEND_FROM de Marc et alterne au cutover unique.',
          'Si tu changes RESEND_FROM avant que le DNS soit propagé, tu casses prod silencieusement.',
        ],
        en: [
          'Until your domain is verified, every send fails 403. Code logs it but UI says “sent.”',
          'Reverse strategy: during transition, keep Marc’s RESEND_FROM and switch at a single cutover.',
          'Changing RESEND_FROM before DNS propagates silently breaks prod.',
        ],
      },
      verify: {
        fr: 'Soumets un intake test depuis prod, vérifie l’arrivée du courriel signé par ton domaine.',
        en: 'Submit a test intake from prod, verify the email arrives signed by your domain.',
      },
    },
    {
      id: 'A-09',
      num: '9',
      title: { fr: 'Identité opérateur', en: 'Operator identity swap' },
      time: '5 min',
      summary: {
        fr: 'ADMIN_EMAILS, références marc@marcportal.com dans Privacy/PIA, signatures de courriels.',
        en: 'ADMIN_EMAILS, marc@marcportal.com references in Privacy/PIA, email signatures.',
      },
      why: {
        fr: 'Quand un visiteur écrit à l’adresse listée sur /confidentialite, c’est toi qui dois recevoir le courriel. Sinon, tu n’es pas le DPO de fait — tu es négligent.',
        en: 'When a visitor writes to the address on /privacy, it has to reach you. Otherwise you’re not the de-facto DPO — you’re negligent.',
      },
      how: {
        fr: [
          'CF Pages → Environment variables → ADMIN_EMAILS = ton@email.com',
          '`grep -rin "marc@marcportal" src/` — remplace par ton adresse',
          'src/pages/Privacy.tsx + Pia.tsx — change le nom du DPO',
          'functions/_lib/email.ts — signature « — Marc, depuis Montréal » à adapter',
        ],
        en: [
          'CF Pages → Environment variables → ADMIN_EMAILS = your@email.com',
          '`grep -rin "marc@marcportal" src/` — replace with your address',
          'src/pages/Privacy.tsx + Pia.tsx — change the DPO name',
          'functions/_lib/email.ts — signature “— Marc, from Montréal” to adapt',
        ],
      },
      gotcha: {
        fr: [
          'ADMIN_EMAILS accepte plusieurs adresses séparées par virgule — utile en transition, dangereux à long terme.',
          'Les courriels visiteur signés « — Marc » qui partent sous ton nom sont gênants. Adapte la signature.',
          'Les PIA / Privacy mentionnent le DPO — vérifier la conformité légale après swap.',
        ],
        en: [
          'ADMIN_EMAILS accepts comma-separated addresses — useful during transition, dangerous long-term.',
          'Visitor emails signed “— Marc” going out under your name are awkward. Adapt the signature.',
          'PIA / Privacy mention the DPO — verify legal compliance after the swap.',
        ],
      },
      verify: {
        fr: 'Tu reçois le courriel admin la prochaine fois qu’un visiteur écrit dans une session.',
        en: 'You receive the admin notification next time a visitor posts in a session.',
      },
    },
    {
      id: 'A-10',
      num: '10',
      title: { fr: 'Monitoring branché', en: 'Monitoring wired' },
      time: '15 min',
      summary: {
        fr: 'Alertes Sentry à ton email, cron du digest quotidien, vérifier admin alerts.',
        en: 'Sentry alerts to your email, daily digest cron, verify admin alerts.',
      },
      why: {
        fr: 'Sans monitoring, une erreur prod, un visiteur ghosté, ou un webhook Stripe cassé peuvent passer inaperçus pendant des jours.',
        en: 'Without monitoring, a prod error, a ghosted visitor, or a broken Stripe webhook can pass unnoticed for days.',
      },
      how: {
        fr: [
          'Sentry → Settings → Notifications → ton email',
          'Sentry → Issues → Alert rules — au moins une « new issue → email »',
          'cron-job.org (gratuit) → POST quotidien à /api/admin/digest avec header X-Digest-Token: <DIGEST_TOKEN>',
          'Vérifier /admin (admin_alerts) — la page liste les soft-failures (Resend down, etc.)',
        ],
        en: [
          'Sentry → Settings → Notifications → your email',
          'Sentry → Issues → Alert rules — at least one “new issue → email”',
          'cron-job.org (free) → daily POST to /api/admin/digest with header X-Digest-Token: <DIGEST_TOKEN>',
          'Verify /admin (admin_alerts) — page lists soft-failures (Resend down, etc.)',
        ],
      },
      gotcha: {
        fr: [
          'Sans DIGEST_TOKEN configuré côté env, l’endpoint /api/admin/digest est inatteignable — le cron retournera 401.',
          'Sentry tier gratuit (5k events/mois) suffit en solo mais peut sauter pendant un incident bruyant.',
          'Le digest dépend de l’absence de loop infini — vérifie qu’il ne s’auto-déclenche pas dans une seed test.',
        ],
        en: [
          'Without DIGEST_TOKEN set in env, /api/admin/digest is unreachable — cron returns 401.',
          'Sentry free tier (5k events/month) is enough solo but can blow during a noisy incident.',
          'The digest depends on no infinite loop — verify it doesn’t self-trigger from a test seed.',
        ],
      },
      verify: {
        fr: 'Force une erreur en prod, vérifie le courriel Sentry sous 5 min. Cron du digest a tourné une fois.',
        en: 'Force a prod error, verify the Sentry email arrives within 5 min. Digest cron has run once.',
      },
      link: {
        href: { fr: '/admin', en: '/en/admin' },
        label: { fr: 'Ouvrir Console', en: 'Open Console' },
      },
    },
  ],
}
