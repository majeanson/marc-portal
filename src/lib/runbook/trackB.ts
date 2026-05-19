/**
 * Track B — User journey.
 *
 * A visitor's chronological path through the portal under new ownership.
 * Each step that depends on a Track-A step is annotated via `dependsOn`,
 * so the parallel view can highlight broken handoffs ("if A-08 isn't done,
 * B-03 silently fails").
 *
 * Step ids are stable: never renumber, only append. Existing localStorage
 * progress is keyed by these ids.
 */

import type { Track } from './types'

export const trackB: Track = {
  id: 'B',
  eyebrow: {
    fr: 'parcours · visiteur',
    en: 'journey · visitor',
  },
  title: {
    fr: 'Parcours visiteur',
    en: 'User journey',
  },
  sub: {
    fr: 'Ce qu’un visiteur traverse, de la découverte au vouch, après que le nouveau dev a pris les commandes.',
    en: 'What a visitor walks through, from discovery to vouch, once the new dev has taken over.',
  },
  steps: [
    {
      id: 'B-01',
      num: '1',
      title: { fr: 'Découverte', en: 'Discovery' },
      time: 'variable',
      tag: 'public',
      summary: {
        fr: 'Atterrit sur l’accueil — bouche-à-oreille, vouches, ou recherche.',
        en: 'Lands on the home page — word of mouth, vouches, or search.',
      },
      why: {
        fr: 'Premier contact. Si la marque, le ton ou la promesse ne tient pas, ils repartent avant l’intake.',
        en: 'First contact. If brand, tone, or promise feels off, they bounce before reaching intake.',
      },
      how: {
        fr: [
          'Home (/) — hero, projets, vouches, prix, vibe',
          'Pages annexes : /vouches, /projects, /handoff, /confidentialite',
          'OG cards : ce que voient Slack, Messenger, LinkedIn quand quelqu’un partage',
        ],
        en: [
          'Home (/) — hero, projects, vouches, pricing, vibe',
          'Adjacent pages: /vouches, /projects, /handoff, /privacy',
          'OG cards: what Slack, Messenger, LinkedIn show when shared',
        ],
      },
      gotcha: {
        fr: [
          'Si le rebrand est incomplet, le visiteur voit encore « Marc » et se demande à qui il parle.',
          'OG card cassée = 0 clic depuis les apps de messagerie.',
        ],
        en: [
          'If rebranding is incomplete, visitors still see “Marc” and wonder who they’re talking to.',
          'A broken OG card = zero clicks from messaging apps.',
        ],
      },
      verify: {
        fr: 'Ouvre /admin/showcase — toutes les vignettes doivent porter ton nom, pas celui de Marc.',
        en: 'Open /admin/showcase — every card should carry your name, not Marc’s.',
      },
      link: {
        href: { fr: '/', en: '/en' },
        label: { fr: 'Voir l’accueil', en: 'Open home' },
      },
    },
    {
      id: 'B-02',
      num: '2',
      title: { fr: 'Intake', en: 'Intake form' },
      time: '5–10 min',
      summary: {
        fr: 'Vibe gate → typeform → écran de compte (courriel + langue).',
        en: 'Vibe gate → typeform → account screen (email + language).',
      },
      why: {
        fr: 'Filtre primaire et capture des réponses. Autosave à chaque touche — un onglet fermé ne perd rien.',
        en: 'Primary filter and answer capture. Autosaves on every keystroke — closing the tab loses nothing.',
      },
      how: {
        fr: [
          '/intake — étapes : vibe → questions → compte → confirmation',
          'Brouillon sauvé dans localStorage + côté serveur après envoi du courriel',
          'Le visiteur peut éditer ses réponses tant que la session est en draft/triage',
        ],
        en: [
          '/intake — steps: vibe → questions → account → confirmation',
          'Draft saved to localStorage + server-side after email is sent',
          'Visitor can edit answers while the session is in draft/triage',
        ],
      },
      gotcha: {
        fr: [
          'Le vibe gate n’est PAS un blocage technique — il filtre par voix, pas par cocher une case.',
          'Si l’i18n du visiteur diffère de la langue d’URL, l’email final sort dans la langue déclarée, pas l’URL.',
        ],
        en: [
          'The vibe gate is NOT a technical block — it filters by voice, not by ticking a box.',
          'If the visitor’s declared language differs from the URL language, the final email goes in the declared one.',
        ],
      },
      verify: {
        fr: 'Soumets un intake test — vérifie que la session apparaît dans /admin/inbox sous 5 sec.',
        en: 'Submit a test intake — verify the session appears in /admin/inbox within 5 seconds.',
      },
    },
    {
      id: 'B-03',
      num: '3',
      title: { fr: 'Courriel de connexion', en: 'Sign-in email' },
      time: 'instant',
      tag: 'notif',
      summary: {
        fr: 'Reçoit un lien de connexion à usage unique, valide 30 min.',
        en: 'Receives a one-time sign-in link, valid for 30 min.',
      },
      why: {
        fr: 'Pas de mot de passe = onboarding zéro friction. Mais si Resend n’est pas vérifié pour ton domaine, le courriel n’arrive jamais — et tu n’en sauras rien.',
        en: 'No password = zero-friction onboarding. But if Resend isn’t verified for your domain, the email never arrives — silently.',
      },
      how: {
        fr: [
          'Resend envoie depuis noreply@<ton-domaine>',
          'Sujet : « Ton lien de connexion » / « Your sign-in link »',
          'Bouton terracotta — le bouton EST le courriel',
          'Token expire dans 30 min (D1 : table magic_link_tokens)',
        ],
        en: [
          'Resend sends from noreply@<your-domain>',
          'Subject: “Your sign-in link” / “Ton lien de connexion”',
          'Terracotta button — the button IS the email',
          'Token expires in 30 min (D1: magic_link_tokens table)',
        ],
      },
      gotcha: {
        fr: [
          'Resend tier gratuit : 100/jour, 3000/mois. Au-delà, sends silencieusement échouent.',
          'SPF/DKIM/DMARC mal configurés = courriel en spam ou rejeté. Vérifie avec mail-tester.com.',
          'Domaine non vérifié dans Resend = 403 à chaque send. Le code logue l’erreur mais l’UI montre quand même « courriel envoyé ».',
        ],
        en: [
          'Resend free tier: 100/day, 3000/month. Beyond that, sends silently fail.',
          'Misconfigured SPF/DKIM/DMARC = email in spam or rejected. Check via mail-tester.com.',
          'Unverified Resend domain = 403 on every send. The code logs the error but the UI still shows “email sent”.',
        ],
      },
      verify: {
        fr: 'Envoie-toi un lien depuis prod — il doit arriver en moins de 30 sec, hors spam.',
        en: 'Send yourself a link from prod — should arrive within 30 sec, not in spam.',
      },
      dependsOn: 'A-08',
    },
    {
      id: 'B-04',
      num: '4',
      title: { fr: 'Connexion + /me', en: 'Sign in + /me portal' },
      time: '1 min',
      summary: {
        fr: 'Clique le lien, atterrit dans /me avec sa session listée.',
        en: 'Clicks the link, lands on /me with their session listed.',
      },
      why: {
        fr: 'C’est là que le visiteur réalise « ah, ça fonctionne vraiment. » Le contraste entre intake gratuit et portail fonctionnel.',
        en: 'This is where the visitor realizes “oh, this actually works.” The contrast between free intake and a working portal.',
      },
      how: {
        fr: [
          'Lien magique → /api/auth/verify → cookie de session SESSION_SECRET',
          'Redirection vers /me (ou la page d’origine via ?next=)',
          '/me affiche : sessions en cours, statut, dernier message',
        ],
        en: [
          'Magic link → /api/auth/verify → SESSION_SECRET cookie',
          'Redirect to /me (or the origin page via ?next=)',
          '/me shows: live sessions, status, last message',
        ],
      },
      gotcha: {
        fr: [
          'SESSION_SECRET doit faire ≥ 32 octets hex. Plus court = cookies invalidés au prochain restart.',
          'En dev local, le cookie est `secure: false` ; en prod, `secure: true` (Cloudflare Pages).',
        ],
        en: [
          'SESSION_SECRET must be ≥ 32 hex bytes. Shorter = cookies invalidated on next restart.',
          'Local dev: cookie `secure: false`; prod: `secure: true` (Cloudflare Pages).',
        ],
      },
      verify: {
        fr: 'Connecte-toi avec le compte test, ouvre /me, vois ta session test apparaître.',
        en: 'Sign in with the test account, open /me, see your test session appear.',
      },
      dependsOn: 'A-07',
    },
    {
      id: 'B-05',
      num: '5',
      title: { fr: 'Attente de triage', en: 'Triage wait' },
      time: '≤ 72 hr',
      summary: {
        fr: 'Voit le compte à rebours 72 h, peut éditer son intake, peut écrire dans le fil.',
        en: 'Sees the 72h countdown, can edit their intake, can post in the thread.',
      },
      why: {
        fr: 'SLA promis publiquement. Si tu rates 72 h sans répondre, la confiance s’effrite — et il n’y a aucun système qui te le rappelle, sauf le digest quotidien si tu l’as branché.',
        en: 'Publicly-promised SLA. If you miss 72h without replying, trust erodes — and nothing reminds you except the daily digest, if you wired it up.',
      },
      how: {
        fr: [
          'Session en statut triage → countdown affiché côté visiteur',
          'Visiteur peut éditer son intake → /admin reçoit un courriel « visiteur a modifié son intake »',
          'Fil de messages bidirectionnel dès le triage',
        ],
        en: [
          'Session in triage status → countdown shown to visitor',
          'Visitor can edit intake → /admin gets a “visitor edited intake” email',
          'Bidirectional message thread from triage onward',
        ],
      },
      gotcha: {
        fr: [
          'Le timer est cosmétique côté visiteur — la dette opérationnelle est dans ta tête, pas dans la base.',
          'Le digest quotidien (cron) est OPTIONNEL — sans lui, tu peux oublier une session pendant des jours.',
        ],
        en: [
          'The timer is cosmetic on the visitor side — the operational debt lives in your head, not the DB.',
          'The daily digest cron is OPTIONAL — without it, you can forget a session for days.',
        ],
      },
      verify: {
        fr: 'Ouvre /admin/inbox — chaque session en triage doit afficher son âge en haut.',
        en: 'Open /admin/inbox — every triage session should display its age at the top.',
      },
      dependsOn: 'A-10',
      link: {
        href: { fr: '/admin/inbox', en: '/en/admin/inbox' },
        label: { fr: 'Voir l’inbox', en: 'Open inbox' },
      },
    },
    {
      id: 'B-06',
      num: '6',
      title: { fr: 'Tier assigné', en: 'Tier assigned' },
      time: 'notif',
      summary: {
        fr: 'Opérateur triage → tier choisi (0/1/2/3) → courriel « j’embarque » avec bouton payer.',
        en: 'Operator triages → tier chosen (0/1/2/3) → “I’m in” email with pay button.',
      },
      why: {
        fr: 'Le moment où « peut-être » devient « oui, voici le prix ». Si le courriel ne sort pas, le visiteur croit que tu l’as ghosté.',
        en: 'The moment “maybe” becomes “yes, here’s the price.” If the email doesn’t go out, the visitor thinks you ghosted.',
      },
      how: {
        fr: [
          'Admin assigne le tier dans /admin/inbox/<id>',
          'Webhook interne → sendTierAssignedNotification(...)',
          'Le tier-0 redirige vers un patron/template, pas de paiement',
          'Tier 1/2/3 → bouton Stripe Checkout actif sur la page de session',
        ],
        en: [
          'Admin assigns tier in /admin/inbox/<id>',
          'Internal webhook → sendTierAssignedNotification(...)',
          'Tier-0 redirects to a pattern/template, no payment',
          'Tier 1/2/3 → Stripe Checkout button live on the session page',
        ],
      },
      gotcha: {
        fr: [
          'Tier 3 (devis) demande un montant CAD cents — sans ça, le courriel sort sans le montant et a l’air bâclé.',
          'Si Resend down quand tu assignes, l’UI réussit mais le visiteur ne reçoit rien. Vérifie /admin/inbox 5 min plus tard.',
        ],
        en: [
          'Tier 3 (quote) needs a CAD cents amount — without it the email goes without the figure and looks sloppy.',
          'If Resend is down when you assign, the UI succeeds but the visitor gets nothing. Re-check /admin/inbox 5 min later.',
        ],
      },
      verify: {
        fr: 'Assigne Tier 1 sur un intake test, vérifie le courriel reçu et le bouton actif sur la session.',
        en: 'Assign Tier 1 on a test intake, verify the email landed and the button is live on the session.',
      },
      dependsOn: 'A-08',
    },
    {
      id: 'B-07',
      num: '7',
      title: { fr: 'Paiement Stripe', en: 'Stripe payment' },
      time: '5 min',
      summary: {
        fr: 'Clique payer, Stripe Checkout, retour /session/<id> avec statut « actif ».',
        en: 'Clicks pay, Stripe Checkout, returns to /session/<id> with status “active”.',
      },
      why: {
        fr: 'Là où l’argent change de main. Si le webhook Stripe ne pointe pas au bon endroit (ou si le signing secret est faux), le paiement réussit côté Stripe mais le portail croit que la session est encore en attente.',
        en: 'Where money changes hands. If the Stripe webhook doesn’t hit the right URL (or the signing secret is wrong), the payment succeeds on Stripe’s side but the portal still thinks the session is pending.',
      },
      how: {
        fr: [
          'POST /api/payments/create-checkout → URL Stripe',
          'Webhook → POST /api/payments/webhook (signature vérifiée)',
          'Webhook met à jour session.status → active (ou awaiting_deposit pour Tier 2)',
          'Tier 2 : 50 % dépôt maintenant, 50 % à la livraison',
        ],
        en: [
          'POST /api/payments/create-checkout → Stripe URL',
          'Webhook → POST /api/payments/webhook (signature verified)',
          'Webhook updates session.status → active (or awaiting_deposit for Tier 2)',
          'Tier 2: 50% deposit now, 50% at delivery',
        ],
      },
      gotcha: {
        fr: [
          'STRIPE_WEBHOOK_SECRET diffère en test vs live — facile à confondre, signature échoue silencieusement.',
          'Nouveau compte Stripe = rétention 7 jours avant le premier payout. Ne panique pas si le dashboard dit « pending ».',
          'Frais ≈ 2.9 % + 30 ¢. Sur un test à 1 $, tu perds ~33 ¢ — non remboursable au refund au Canada.',
        ],
        en: [
          'STRIPE_WEBHOOK_SECRET differs test vs live — easy to confuse, signature fails silently.',
          'New Stripe account = 7-day hold before the first payout. Don’t panic when the dashboard says “pending.”',
          'Fees ≈ 2.9% + 30¢. On a $1 test you lose ~33¢ — not refundable on refund in Canada.',
        ],
      },
      verify: {
        fr: 'Carte test Stripe 4242 4242 4242 4242, paie, vérifie session.status → active sous 5 sec.',
        en: 'Stripe test card 4242 4242 4242 4242, pay, verify session.status → active within 5 seconds.',
      },
      dependsOn: 'A-07',
    },
    {
      id: 'B-08',
      num: '8',
      title: { fr: 'Phase de build', en: 'Active / build phase' },
      time: 'variable',
      summary: {
        fr: 'Fil de messages devient le poste de commande. Pas de calls, pas de réunions.',
        en: 'Message thread becomes the command post. No calls, no meetings.',
      },
      why: {
        fr: 'C’est le cœur du modèle async. Si le visiteur t’écrit et tu ne reçois pas la notification (ADMIN_EMAILS mal configuré), tu rates des questions et ça prend des jours.',
        en: 'The heart of the async model. If the visitor writes and you don’t get the notification (ADMIN_EMAILS misconfigured), questions go unanswered for days.',
      },
      how: {
        fr: [
          'Messages dans /session/<id> côté visiteur, /admin/inbox/<id> côté opérateur',
          'Chaque message du visiteur → courriel à ADMIN_EMAILS',
          'Chaque message de l’opérateur → courriel au visiteur',
          'Pièces jointes via R2 (binding MEDIA optionnel — sans, picker caché)',
        ],
        en: [
          'Messages in /session/<id> for visitor, /admin/inbox/<id> for operator',
          'Each visitor message → email to ADMIN_EMAILS',
          'Each operator message → email to visitor',
          'Attachments via R2 (MEDIA binding optional — without it, picker hidden)',
        ],
      },
      gotcha: {
        fr: [
          'Pas de notification temps réel — c’est du polling par courriel uniquement.',
          'R2 bucket non créé = picker caché côté visiteur sans erreur affichée.',
        ],
        en: [
          'No real-time notification — email polling only.',
          'No R2 bucket = file picker silently hidden on the visitor side.',
        ],
      },
      verify: {
        fr: 'Envoie un message depuis une session test, vérifie le courriel reçu côté admin.',
        en: 'Send a message from a test session, verify the admin notification email arrives.',
      },
      dependsOn: 'A-09',
    },
    {
      id: 'B-09',
      num: '9',
      title: { fr: 'Livraison', en: 'Shipped notification' },
      time: 'notif',
      summary: {
        fr: 'Statut → livrée, courriel envoyé, lien vers la checklist de handoff.',
        en: 'Status → shipped, email sent, link to the handoff checklist.',
      },
      why: {
        fr: 'Marque la fin du build et ouvre la décision Custodian vs « Tout à toi ». Le ton du courriel doit être chaleureux — c’est le dernier souvenir.',
        en: 'Marks the build’s end and opens the Custodian vs “All yours” decision. Email tone matters — it’s the last memory.',
      },
      how: {
        fr: [
          'Opérateur passe statut → shipped dans /admin/inbox/<id>',
          'sendStatusChangeNotification → courriel « ta session est livrée »',
          'Visiteur voit la checklist via /handoff/checklist',
        ],
        en: [
          'Operator sets status → shipped in /admin/inbox/<id>',
          'sendStatusChangeNotification → “your session shipped” email',
          'Visitor sees the checklist via /handoff/checklist',
        ],
      },
      gotcha: {
        fr: [
          'Si l’opérateur livre sans répondre au dernier message du visiteur, l’expérience reste louche.',
          'Pas de mécanisme « non, ce n’est pas vraiment livré » — c’est un changement de statut binaire.',
        ],
        en: [
          'Shipping without replying to the visitor’s last message leaves things awkward.',
          'No “no, it’s not really shipped” mechanism — status change is binary.',
        ],
      },
      verify: {
        fr: 'Marque livrée sur une session test, vérifie le courriel et l’accès à /handoff/checklist.',
        en: 'Mark a test session shipped, verify the email and /handoff/checklist access.',
      },
      dependsOn: 'A-08',
    },
    {
      id: 'B-10',
      num: '10',
      title: { fr: 'Décision Custodian vs Tout à toi', en: 'Custodian vs All-yours' },
      time: 'à la livraison',
      summary: {
        fr: 'Visiteur choisit : « je te paie 200 $/an pour gérer » ou « je reprends tout ».',
        en: 'Visitor chooses: “I pay you $200/yr to handle it” or “I take everything back”.',
      },
      why: {
        fr: 'Le modèle économique récurrent vit ou meurt ici. Custodian = MRR ; Tout à toi = transfert d’opérations (DNS, Cloudflare, Resend, Stripe).',
        en: 'Recurring revenue lives or dies here. Custodian = MRR; All-yours = ops handover (DNS, Cloudflare, Resend, Stripe).',
      },
      how: {
        fr: [
          'Visiteur clique « Custodian » → abonnement Stripe 200 $/an récurrent',
          '« Tout à toi » → checklist technique à cocher (5 cases) + confirmation',
          'Si Tout à toi : opérateur transfère via /handoff/checklist',
        ],
        en: [
          'Visitor clicks “Custodian” → recurring $200/yr Stripe subscription',
          '“All yours” → technical checklist (5 items) + confirmation',
          'If All-yours: operator transfers via /handoff/checklist',
        ],
      },
      gotcha: {
        fr: [
          'STRIPE_CUSTODIAN_PRICE_ID test vs live diffère — swap au cutover ou rien ne s’abonne en live.',
          'Tout à toi exige une checklist explicite (Loi 25 / honnêteté du modèle) — pas une simple case.',
        ],
        en: [
          'STRIPE_CUSTODIAN_PRICE_ID test vs live differs — swap at cutover or no live subscriptions happen.',
          'All-yours requires an explicit checklist (Loi 25 / model honesty) — not a single checkbox.',
        ],
      },
      verify: {
        fr: 'Test Custodian : visiteur s’abonne, vérifie dans /admin/custodians qu’il apparaît actif.',
        en: 'Test Custodian: visitor subscribes, verify they appear active in /admin/custodians.',
      },
      link: {
        href: { fr: '/admin/custodians', en: '/en/admin/custodians' },
        label: { fr: 'Voir Dépositaires', en: 'Open Custodians' },
      },
    },
    {
      id: 'B-11',
      num: '11',
      title: { fr: 'Vouch (optionnel)', en: 'Vouch (optional)' },
      time: 'post-livraison',
      summary: {
        fr: 'Visiteur soumet un témoignage via /vouch — file de modération côté admin.',
        en: 'Visitor submits a testimonial via /vouch — admin moderation queue.',
      },
      why: {
        fr: 'Preuve sociale qui amène le visiteur suivant. C’est aussi le seul mécanisme où le contenu vient des visiteurs vers le public.',
        en: 'Social proof that brings the next visitor. Also the only mechanism where content flows from visitors to the public.',
      },
      how: {
        fr: [
          '/vouch — formulaire libre (nom, relation, corps)',
          'Admin modère via /admin/vouches — approuve / rejette / édite',
          'Approuvés s’affichent sur /vouches et home',
        ],
        en: [
          '/vouch — free-form form (name, relationship, body)',
          'Admin moderates via /admin/vouches — approve / reject / edit',
          'Approved vouches show on /vouches and the home page',
        ],
      },
      gotcha: {
        fr: [
          'Pas de captcha ni de rate-limit fort — la modération est ton seul filtre. À surveiller si le site décolle.',
          'Le courriel « nouveau vouch » sort à chaque submission — peut spammer ton inbox lors d’un lancement.',
        ],
        en: [
          'No captcha or strong rate-limit — moderation is your only filter. Watch for it if the site takes off.',
          '“New vouch” email fires on every submission — can flood your inbox during a launch.',
        ],
      },
      verify: {
        fr: 'Soumets un vouch test, ouvre /admin/vouches, approuve-le, vérifie son apparition sur /vouches.',
        en: 'Submit a test vouch, open /admin/vouches, approve it, verify it shows on /vouches.',
      },
      dependsOn: 'A-10',
      link: {
        href: { fr: '/admin/vouches', en: '/en/admin/vouches' },
        label: { fr: 'File de modération', en: 'Moderation queue' },
      },
    },
  ],
}
