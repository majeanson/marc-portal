/**
 * Track C — Template buyer journey.
 *
 * A solo dev who acquired the portal as a template (fork, paid license, or
 * future marketplace listing) and is spinning up their own instance. Differs
 * from Track A in posture: A is "take over Marc's running instance"; C is
 * "stand up your own from a clean slate".
 *
 * This track is mirrored to a public-facing page (/template) with a
 * sales-shaped intro. Tone is buyer-facing: warm, honest about the work
 * involved, no salesman fluff. Read aloud — if it sounds like marketing
 * copy, rewrite.
 *
 * Step ids are stable: never renumber.
 */

import type { Track } from './types'

export const trackC: Track = {
  id: 'C',
  eyebrow: {
    fr: 'template · acheteur',
    en: 'template · buyer',
  },
  title: {
    fr: 'Parcours acheteur du template',
    en: 'Template buyer journey',
  },
  sub: {
    fr: 'Tu as forké ou acheté le portail. Voici le chemin réaliste entre « j’ai le code » et « mon premier client paie ».',
    en: 'You forked or bought the portal. Here’s the realistic path from “I have the code” to “my first client pays”.',
  },
  steps: [
    {
      id: 'C-01',
      num: '1',
      title: { fr: 'Acquérir le code', en: 'Acquire the code' },
      time: '5 min',
      summary: {
        fr: 'Fork public, licence commerciale, ou accès privé selon le modèle de distribution.',
        en: 'Public fork, commercial license, or private access depending on the distribution model.',
      },
      why: {
        fr: 'Tu as besoin du code, des migrations D1, des feature.json, et idéalement de la liste des dépendances de runtime.',
        en: 'You need the code, the D1 migrations, the feature.json files, and ideally the runtime dependency list.',
      },
      how: {
        fr: [
          'git clone <repo> mon-portail',
          'cd mon-portail && bun install',
          'Lis CLAUDE.md, ECOSYSTEM.md, RUNBOOK.md',
        ],
        en: [
          'git clone <repo> my-portal',
          'cd my-portal && bun install',
          'Read CLAUDE.md, ECOSYSTEM.md, RUNBOOK.md',
        ],
      },
      gotcha: {
        fr: [
          'Bun > npm pour ce repo — `npm install` fonctionne mais a un bug @emnapi documenté.',
          'Si tu pars d’un fork public, vérifie le LICENSE — certains forks restreignent la revente.',
        ],
        en: [
          'Bun > npm for this repo — `npm install` works but has a documented @emnapi bug.',
          'If forking the public repo, check LICENSE — some forks restrict resale.',
        ],
      },
      verify: {
        fr: '`bun run typecheck` passe sans erreur.',
        en: '`bun run typecheck` passes with no errors.',
      },
    },
    {
      id: 'C-02',
      num: '2',
      title: { fr: 'Provisionner l’infra', en: 'Provision infrastructure' },
      time: '30 min',
      summary: {
        fr: 'Compte Cloudflare, projet Pages, base D1, bucket R2, domaine pointé.',
        en: 'Cloudflare account, Pages project, D1 database, R2 bucket, domain pointed.',
      },
      why: {
        fr: 'Le portail tourne sur Cloudflare Pages + D1 + R2. Tout est gratuit jusqu’à la production, mais demande la création de chaque ressource.',
        en: 'The portal runs on Cloudflare Pages + D1 + R2. Free tier covers production, but every resource must be created.',
      },
      how: {
        fr: [
          'dash.cloudflare.com → créer un compte',
          '`npx wrangler login`',
          '`npx wrangler d1 create mon-portail-db --location enam` (Toronto pour Loi 25)',
          '`npx wrangler r2 bucket create mon-portail-media`',
          'Coller le database_id dans wrangler.toml',
          'Ajouter ton domaine dans Pages → Custom domains',
        ],
        en: [
          'dash.cloudflare.com → create an account',
          '`npx wrangler login`',
          '`npx wrangler d1 create my-portal-db --location enam` (Toronto for Bill 25)',
          '`npx wrangler r2 bucket create my-portal-media`',
          'Paste the database_id into wrangler.toml',
          'Add your domain in Pages → Custom domains',
        ],
      },
      gotcha: {
        fr: [
          'L’emplacement D1 (`enam`) compte pour la conformité résidence — si tu sers le Québec et tu choisis `weur`, ton claim « hébergé au Canada » est faux.',
          'Les variables CF Pages sont gérées par wrangler.toml — le dashboard n’édite que les secrets chiffrés.',
          'Premier déploiement : `npx wrangler pages deploy dist` après build local. Connecter GitHub plus tard.',
        ],
        en: [
          'D1 location (`enam`) matters for residency compliance — if you serve Quebec and pick `weur`, your “hosted in Canada” claim is false.',
          'CF Pages variables are wrangler.toml-managed — the dashboard only edits encrypted secrets.',
          'First deploy: `npx wrangler pages deploy dist` after a local build. Wire GitHub later.',
        ],
      },
      verify: {
        fr: 'Ouvre ton-domaine.com — Cloudflare Pages doit servir la home.',
        en: 'Open your-domain.com — Cloudflare Pages should serve the home page.',
      },
    },
    {
      id: 'C-03',
      num: '3',
      title: { fr: 'Générer les secrets', en: 'Generate fresh secrets' },
      time: '10 min',
      summary: {
        fr: 'SESSION_SECRET, RESEND_API_KEY, STRIPE_*, DIGEST_TOKEN — tous frais, jamais réutilisés.',
        en: 'SESSION_SECRET, RESEND_API_KEY, STRIPE_*, DIGEST_TOKEN — all fresh, never reused.',
      },
      why: {
        fr: 'Un secret partagé entre toi et l’ancien propriétaire = porte arrière. Chaque clé doit être unique à ton instance.',
        en: 'A secret shared with the original owner = backdoor. Every key must be unique to your instance.',
      },
      how: {
        fr: [
          '`openssl rand -hex 32` → SESSION_SECRET',
          '`npx wrangler secret put SESSION_SECRET`',
          '`npx wrangler secret put RESEND_API_KEY`',
          '`npx wrangler secret put STRIPE_SECRET_KEY`',
          '`npx wrangler secret put STRIPE_WEBHOOK_SECRET`',
          'ADMIN_EMAILS dans CF Pages → Settings → Environment variables (plaintext)',
        ],
        en: [
          '`openssl rand -hex 32` → SESSION_SECRET',
          '`npx wrangler secret put SESSION_SECRET`',
          '`npx wrangler secret put RESEND_API_KEY`',
          '`npx wrangler secret put STRIPE_SECRET_KEY`',
          '`npx wrangler secret put STRIPE_WEBHOOK_SECRET`',
          'ADMIN_EMAILS in CF Pages → Settings → Environment variables (plaintext)',
        ],
      },
      gotcha: {
        fr: [
          'PowerShell + wrangler peut avoir des soucis de quoting — utilise --file ou une variable $sql.',
          'ADMIN_EMAILS doit être plaintext, pas un secret — sinon le code peut le lire mais pas le code de build.',
          'Ne committe JAMAIS .dev.vars (déjà dans .gitignore — vérifie).',
        ],
        en: [
          'PowerShell + wrangler can have quoting issues — use --file or a $sql variable.',
          'ADMIN_EMAILS must be plaintext, not a secret — otherwise runtime sees it but build does not.',
          'NEVER commit .dev.vars (already in .gitignore — verify).',
        ],
      },
      verify: {
        fr: '`npx wrangler secret list` montre les 4 secrets ; redeploy ; ouvre /admin et connecte-toi.',
        en: '`npx wrangler secret list` shows the 4 secrets; redeploy; open /admin and sign in.',
      },
    },
    {
      id: 'C-04',
      num: '4',
      title: { fr: 'Vérifier le domaine Resend', en: 'Verify Resend domain' },
      time: '15 min',
      summary: {
        fr: 'Créer compte Resend → ajouter ton domaine → 4 records DNS → attendre verified.',
        en: 'Create Resend account → add your domain → 4 DNS records → wait for verified.',
      },
      why: {
        fr: 'Sans domaine vérifié, chaque send échoue avec 403 et l’UI ne le signale pas. Aucun courriel ne sort jamais.',
        en: 'Without a verified domain, every send fails with 403 and the UI doesn’t surface it. No email ever goes out.',
      },
      how: {
        fr: [
          'resend.com → Domains → Add → ton-domaine.com',
          'Copier les 4 records (DKIM TXT, MX send, SPF TXT, DMARC TXT) dans Cloudflare DNS',
          'Attendre 2–10 min, statut → Verified',
          'Update RESEND_FROM dans functions/_lib/email.ts',
        ],
        en: [
          'resend.com → Domains → Add → your-domain.com',
          'Copy the 4 records (DKIM TXT, MX send, SPF TXT, DMARC TXT) into Cloudflare DNS',
          'Wait 2–10 min, status → Verified',
          'Update RESEND_FROM in functions/_lib/email.ts',
        ],
      },
      gotcha: {
        fr: [
          'Resend utilise le sous-domaine `send` pour le bounce — ne collide PAS avec CF Email Routing sur l’apex.',
          'SPF doit inclure amazonses.com (sous-jacent à Resend) — sinon DMARC fail.',
          'Tier gratuit : 100/jour, 3000/mois. Si tu vises > 3000 sends/mois, prévois le passage payant.',
        ],
        en: [
          'Resend uses the `send` subdomain for bounce — does NOT collide with CF Email Routing on the apex.',
          'SPF must include amazonses.com (Resend uses it under the hood) — or DMARC fails.',
          'Free tier: 100/day, 3000/month. If you target > 3000 sends/month, plan the paid upgrade.',
        ],
      },
      verify: {
        fr: 'Envoie un test depuis Resend dashboard à ton propre Gmail — vérifie l’arrivée et l’absence de spam.',
        en: 'Send a test from the Resend dashboard to your own Gmail — verify arrival and absence from spam.',
      },
    },
    {
      id: 'C-05',
      num: '5',
      title: { fr: 'Activer Stripe', en: 'Activate Stripe' },
      time: '1–3 hr',
      summary: {
        fr: 'Créer compte, infos business, banque, KYC, créer produits, configurer webhook.',
        en: 'Create account, business info, bank, KYC, create products, configure webhook.',
      },
      why: {
        fr: 'Stripe est le seul morceau qui a une vérification humaine (KYC). Le délai est imprévisible mais variable selon ta région.',
        en: 'Stripe is the only piece with human verification (KYC). The delay is unpredictable but varies by region.',
      },
      how: {
        fr: [
          'stripe.com → créer un compte',
          'Compléter Business profile, Banking, Identity verification',
          'Products → créer « Custodian Mode » (recurring $200/yr)',
          'Copier le price_id dans wrangler.toml STRIPE_CUSTODIAN_PRICE_ID',
          'Webhooks → +Add endpoint → ton-domaine.com/api/payments/webhook',
          'Écouter : checkout.session.completed, customer.subscription.deleted, invoice.payment_failed',
        ],
        en: [
          'stripe.com → create account',
          'Complete Business profile, Banking, Identity verification',
          'Products → create “Custodian Mode” (recurring $200/yr)',
          'Copy the price_id into wrangler.toml STRIPE_CUSTODIAN_PRICE_ID',
          'Webhooks → +Add endpoint → your-domain.com/api/payments/webhook',
          'Listen to: checkout.session.completed, customer.subscription.deleted, invoice.payment_failed',
        ],
      },
      gotcha: {
        fr: [
          'Test mode et live mode ont des catalogues SÉPARÉS. Le price_id test ne fonctionne pas en live.',
          'Le webhook signing secret diffère test/live — facile à confondre, signature échoue silencieusement.',
          'Hold de 7 jours sur le premier payout pour les nouveaux comptes — ne panique pas.',
          'Si tu rates le KYC, le compte est gelé — pas de paiements jusqu’à résolution. Soumets tôt.',
        ],
        en: [
          'Test mode and live mode have SEPARATE catalogs. A test price_id won’t work in live.',
          'Webhook signing secret differs test/live — easy to confuse, signature fails silently.',
          '7-day hold on the first payout for new accounts — don’t panic.',
          'If you fail KYC, the account is frozen — no payments until resolved. Submit early.',
        ],
      },
      verify: {
        fr: 'Carte test 4242 4242 4242 4242 en test mode → webhook → session.status active.',
        en: 'Test card 4242 4242 4242 4242 in test mode → webhook → session.status active.',
      },
    },
    {
      id: 'C-06',
      num: '6',
      title: { fr: 'Rebrand', en: 'Rebrand' },
      time: '2–4 hr',
      summary: {
        fr: 'Nom, palette, logo, OG cards, copies — substitue « Marc » partout.',
        en: 'Name, palette, logo, OG cards, copy — replace “Marc” everywhere.',
      },
      why: {
        fr: 'La crédibilité du portail repose sur la cohérence du brand. Une fuite « Marc » sur une page mineure = visiteur confus.',
        en: 'Portal credibility depends on brand consistency. A “Marc” leak on a minor page = confused visitor.',
      },
      how: {
        fr: [
          'src/i18n.ts — hero, footer, taglines',
          'src/components/Footer.tsx, Header.tsx — branding visible',
          'src/styles.css — palette (--accent, --bg, --text)',
          'functions/og/ — OG card renderer (Satori)',
          'public/og-fallback.png — fallback statique',
          'src/lib/consoleGreeting.ts — easter egg console',
          'src/pages/Privacy.tsx + Pia.tsx — nom du DPO',
          '`grep -ri "marc" src/ functions/` — chasse les fuites',
        ],
        en: [
          'src/i18n.ts — hero, footer, taglines',
          'src/components/Footer.tsx, Header.tsx — visible branding',
          'src/styles.css — palette (--accent, --bg, --text)',
          'functions/og/ — OG card renderer (Satori)',
          'public/og-fallback.png — static fallback',
          'src/lib/consoleGreeting.ts — console easter egg',
          'src/pages/Privacy.tsx + Pia.tsx — DPO name',
          '`grep -ri "marc" src/ functions/` — hunt for leaks',
        ],
      },
      gotcha: {
        fr: [
          'Les screenshots du repo (README, docs/) gardent l’ancien brand — pas critique mais à nettoyer.',
          'Les feature.json (lac-mcp) référencent l’ancien contexte — laisse ou nettoie selon ton modèle de doc.',
          'L’URL marcportal.com dans i18n.ts apparaît dans des copies — pas seulement dans le code.',
        ],
        en: [
          'README/docs screenshots keep the old brand — non-critical but worth cleaning.',
          'feature.json files (lac-mcp) reference the old context — keep or clean per your doc model.',
          'The marcportal.com URL in i18n.ts appears in copy strings — not only in code.',
        ],
      },
      verify: {
        fr: 'Ouvre /admin/showcase — toutes les cartes doivent montrer ton brand. Ouvre /og/home — preview OG correcte.',
        en: 'Open /admin/showcase — every card should show your brand. Open /og/home — OG preview correct.',
      },
    },
    {
      id: 'C-07',
      num: '7',
      title: { fr: 'Adapter le légal', en: 'Adapt the legal' },
      time: '1 hr',
      summary: {
        fr: 'PIA + politique de confidentialité ajustées à ta juridiction et ton identité.',
        en: 'PIA + privacy policy adjusted to your jurisdiction and identity.',
      },
      why: {
        fr: 'Le portail est conçu pour Loi 25 (Québec). Si tu opères ailleurs (RGPD, CCPA), tu réutilises la structure mais tu changes les références légales. Sinon, ton claim de conformité est faux.',
        en: 'The portal is designed for Loi 25 (Quebec). If you operate elsewhere (GDPR, CCPA), reuse the structure but swap legal references. Otherwise your compliance claim is false.',
      },
      how: {
        fr: [
          'src/pages/Privacy.tsx — substitue Marc → ton nom, marc@marcportal.com → ton email',
          'src/pages/Pia.tsx — vérifie chaque mention « Loi 25 » selon ta juridiction',
          'docs/loi-25-pia.md + loi-25-pia-stripe.md — adapter ou retirer',
          'Si non-Québec : remplace « Loi 25 » par RGPD/CCPA/etc. dans i18n.ts et les pages légales',
        ],
        en: [
          'src/pages/Privacy.tsx — replace Marc → your name, marc@marcportal.com → your email',
          'src/pages/Pia.tsx — verify every “Bill 25” mention against your jurisdiction',
          'docs/loi-25-pia.md + loi-25-pia-stripe.md — adapt or remove',
          'If non-Quebec: replace “Bill 25” with GDPR/CCPA/etc. in i18n.ts and legal pages',
        ],
      },
      gotcha: {
        fr: [
          'Le template ne te donne PAS la conformité — il te donne la structure. Tu restes responsable.',
          'Si tu enlèves la PIA, retire aussi le lien dans Footer.tsx.',
          'Le délai de réponse 30 jours mentionné est spécifique à Loi 25 — peut différer ailleurs.',
        ],
        en: [
          'The template does NOT give you compliance — it gives you structure. You stay responsible.',
          'If you remove the PIA, also remove the Footer.tsx link.',
          'The 30-day response window mentioned is Loi 25-specific — may differ elsewhere.',
        ],
      },
      verify: {
        fr: 'Lis /confidentialite et /pia en entier en mode « inspecteur CAI » — aucune fausse promesse.',
        en: 'Read /privacy and /pia end-to-end in “inspector mode” — no false promises.',
      },
    },
    {
      id: 'C-08',
      num: '8',
      title: { fr: 'Sentry (ou skip)', en: 'Sentry (or skip)' },
      time: '5 min',
      summary: {
        fr: 'Créer un projet Sentry, copier le DSN, skip si tu acceptes d’opérer aveugle.',
        en: 'Create a Sentry project, copy the DSN, skip if you accept blind operation.',
      },
      why: {
        fr: 'Sans Sentry, une erreur SPA ou Pages Function échoue sans que tu le saches. Le tier gratuit (5k events/mois) couvre largement un solo.',
        en: 'Without Sentry, an SPA or Pages Function error fails silently. Free tier (5k events/month) easily covers a solo practice.',
      },
      how: {
        fr: [
          'sentry.io → créer un projet (JavaScript pour SPA + Cloudflare Workers pour Functions)',
          'Copier le DSN dans src/lib/sentry.ts et functions/_lib/sentry.ts',
          'Vérifier que beforeSend strip bien Cookie/Authorization (conformité)',
        ],
        en: [
          'sentry.io → create a project (JavaScript for SPA + Cloudflare Workers for Functions)',
          'Copy the DSN into src/lib/sentry.ts and functions/_lib/sentry.ts',
          'Verify beforeSend strips Cookie/Authorization (compliance)',
        ],
      },
      gotcha: {
        fr: [
          'Le DSN est PUBLIC par design — c’est OK qu’il soit committé.',
          'Si tu skip Sentry, retire les imports pour éviter les warnings.',
          'Sentry envoie aux États-Unis — si Loi 25 stricte, vérifie ton PIA mentionne ce transfert.',
        ],
        en: [
          'DSN is PUBLIC by design — fine to commit.',
          'If you skip Sentry, remove imports to avoid warnings.',
          'Sentry transmits to the US — if Loi 25 strict, verify your PIA mentions this transfer.',
        ],
      },
      verify: {
        fr: 'Force une erreur dans une page (throw new Error) et vérifie qu’elle apparaît dans Sentry sous 1 min.',
        en: 'Force an error in a page (throw new Error) and verify it appears in Sentry within 1 min.',
      },
    },
    {
      id: 'C-09',
      num: '9',
      title: { fr: 'Test de fumée', en: 'Smoke test' },
      time: '30 min',
      summary: {
        fr: 'Auto-intake → auto-paiement Stripe test → auto-vouch. Tu joues les 3 rôles.',
        en: 'Self-intake → self-Stripe-test-payment → self-vouch. You play all 3 roles.',
      },
      why: {
        fr: 'Le seul moyen de prouver que les pièces (intake, Resend, Stripe webhook, D1, R2) s’enchaînent vraiment — sans dépendre d’un client réel.',
        en: 'The only way to prove the pieces (intake, Resend, Stripe webhook, D1, R2) actually chain together — without a real client.',
      },
      how: {
        fr: [
          'Navigateur privé : soumets un intake avec un email différent du tien',
          'Reçois le courriel de connexion — vérifie l’arrivée dans inbox, pas en spam',
          'Clique le lien, ouvre /me',
          'Dans /admin (ton compte) : passe la session en triage → assigne Tier 1',
          'Reçois le courriel « j’embarque » côté visiteur',
          'Clique payer → Stripe test card → vérifie webhook + statut',
          'Soumets un vouch → modère → vérifie qu’il apparaît sur /vouches',
        ],
        en: [
          'Private window: submit an intake with a different email than yours',
          'Receive the sign-in email — check inbox arrival, not spam',
          'Click the link, open /me',
          'In /admin (your account): set session triage → assign Tier 1',
          'Receive the “I’m in” email on the visitor side',
          'Click pay → Stripe test card → verify webhook + status',
          'Submit a vouch → moderate → verify it shows on /vouches',
        ],
      },
      gotcha: {
        fr: [
          'Test Stripe mode : aucun argent ne bouge. Live mode : 33 ¢ de frais par dollar de test.',
          'Si tu testes avec ton vrai email partout, tu ne sauras pas si les courriels visiteur arrivent vraiment chez un destinataire externe.',
        ],
        en: [
          'Stripe test mode: no real money moves. Live mode: 33¢ in fees per dollar tested.',
          'If you test with your real email everywhere, you don’t know whether visitor emails actually reach an external recipient.',
        ],
      },
      verify: {
        fr: 'Les 7 étapes du how passent sans erreur, dans l’ordre.',
        en: 'The 7 “how” steps complete without error, in order.',
      },
    },
    {
      id: 'C-10',
      num: '10',
      title: { fr: 'Premier client payant', en: 'First paying friend' },
      time: 'variable',
      summary: {
        fr: 'Un ami fait le parcours complet en live (vrai Stripe, vrai Resend, vrai D1). Tu factures pour de vrai.',
        en: 'A friend walks the full live path (real Stripe, real Resend, real D1). You charge for real.',
      },
      why: {
        fr: 'Test mode prouve la mécanique. Live mode prouve les clés, le webhook live, et le payout réel. C’est le dernier filet avant les inconnus.',
        en: 'Test mode proves the mechanics. Live mode proves the keys, the live webhook, and the real payout. Last safety net before strangers.',
      },
      how: {
        fr: [
          'Trouve un ami qui veut un VRAI projet (pas un test) à petit prix (Tier 1)',
          'Bascule Stripe en live : nouvelles clés, nouveau price_id, nouveau webhook signing secret',
          'Fais le parcours — pas d’aide, pas de raccourci. Comporte-toi comme avec un inconnu.',
          'Note où ça grince — ajoute aux gotchas de ce runbook',
        ],
        en: [
          'Find a friend who wants a REAL project (not a test) at small price (Tier 1)',
          'Flip Stripe to live: new keys, new price_id, new webhook signing secret',
          'Walk the journey — no help, no shortcut. Behave as you would with a stranger.',
          'Note where it creaks — add to this runbook’s gotchas',
        ],
      },
      gotcha: {
        fr: [
          'Premier payout = 7 jours de hold sur Stripe. Ton ami paie mais l’argent n’apparaît pas tout de suite.',
          'Resend en prod consomme du tier gratuit — si tu envoies 100 courriels en testant, tu plafonnes.',
          'Si quelque chose casse, ton ami se souvient — sois prêt à corriger en live et à recontacter humainement.',
        ],
        en: [
          'First payout = 7-day hold on Stripe. Your friend pays but money doesn’t appear immediately.',
          'Live Resend consumes free tier — if you send 100 emails testing, you hit the cap.',
          'If something breaks, your friend remembers — be ready to fix live and re-contact humanely.',
        ],
      },
      verify: {
        fr: 'L’argent arrive dans ta banque (7 j plus tard). La session est en « shipped ». Le vouch est public.',
        en: 'Money lands in your bank (7 days later). Session is “shipped”. The vouch is public.',
      },
    },
    {
      id: 'C-11',
      num: '11',
      title: { fr: 'Lancement', en: 'Launch' },
      time: '—',
      summary: {
        fr: 'Vouches visibles, sitemap soumis, monitoring actif. Tu ouvres à des inconnus.',
        en: 'Vouches visible, sitemap submitted, monitoring active. You open to strangers.',
      },
      why: {
        fr: 'C’est le point de bascule où ton temps cesse d’être 100 % setup et devient 100 % opérations. Lance trop tôt, tu te brûles en pompiers. Trop tard, tu polish à vide.',
        en: 'The tipping point where your time stops being 100% setup and becomes 100% operations. Launch too early, you burn out firefighting. Too late, you polish into the void.',
      },
      how: {
        fr: [
          'Annonce sur 1–2 canaux où ta communauté lit (LinkedIn, Reddit local, mailing list)',
          'Soumets sitemap.xml à Google Search Console',
          'Ouvre le digest quotidien (cron-job.org → POST /api/admin/digest avec DIGEST_TOKEN)',
          'Garde Sentry ouvert pendant les premiers jours',
        ],
        en: [
          'Announce on 1–2 channels where your community reads (LinkedIn, local Reddit, mailing list)',
          'Submit sitemap.xml to Google Search Console',
          'Wire the daily digest (cron-job.org → POST /api/admin/digest with DIGEST_TOKEN)',
          'Keep Sentry open during the first days',
        ],
      },
      gotcha: {
        fr: [
          'N’annonce PAS partout en même temps — tu veux pouvoir absorber un pic.',
          'Si tu fais Product Hunt ou HN, attends d’avoir 3+ vouches publics.',
          'Le tier gratuit Resend (100/jour) peut sauter si une mention vire viral.',
        ],
        en: [
          'Do NOT announce everywhere at once — you want to absorb a spike.',
          'If you do Product Hunt or HN, wait until you have 3+ public vouches.',
          'The Resend free tier (100/day) can blow if a mention goes mildly viral.',
        ],
      },
      verify: {
        fr: 'Le premier intake d’un inconnu arrive et tu réponds dans les 72 h promises.',
        en: 'The first stranger’s intake arrives and you reply within the promised 72 hours.',
      },
    },
  ],
}
