/**
 * Decisions — strategic questions the operator owes themselves before
 * selling Track C (the template) externally. These are open prompts: the
 * Runbook surface renders each as a card with a free-text answer field
 * persisted to localStorage (via useDecisionAnswer).
 *
 * Not actions, not steps — these are *choices* that gate downstream copy
 * decisions on /template and the actual sales offer. Surfacing them
 * in-product means you can't ship the buyer journey without confronting
 * them.
 */

import type { Decision } from './types'

export const decisions: Decision[] = [
  {
    id: 'D-license',
    num: '1',
    question: {
      fr: 'Modèle de licence ?',
      en: 'License model?',
    },
    context: {
      fr: 'Qu’est-ce que l’acheteur reçoit légalement quand il « achète » le template ? Le droit de revendre ? D’héberger pour un client ? D’afficher ton nom dans ses crédits ?',
      en: 'What does the buyer legally receive when they “buy” the template? Right to resell? Right to host for a client? Right to credit you in their docs?',
    },
    options: {
      fr: [
        'MIT — gratuit, open source, tu vends du service autour',
        'Source-available payant — code visible, revente interdite',
        'Licence commerciale exclusive — fork privé, no resale',
        'Modèle open core — gratuit pour usage perso, payant pour usage commercial',
      ],
      en: [
        'MIT — free, open source, you sell service around it',
        'Source-available paid — code visible, resale forbidden',
        'Exclusive commercial license — private fork, no resale',
        'Open core — free for personal use, paid for commercial use',
      ],
    },
    unlocks: {
      fr: 'La copie « Tu reçois… » de la sales card sur /template, et la formulation légale du LICENSE.',
      en: 'The “You get…” copy on /template’s sales card, and the legal wording in LICENSE.',
    },
  },
  {
    id: 'D-pricing',
    num: '2',
    question: {
      fr: 'Forme de tarification ?',
      en: 'Pricing shape?',
    },
    context: {
      fr: 'Achat unique, abonnement, ou cut du volume Stripe de l’acheteur ? Chaque choix a un impact sur ton MRR et sur la friction d’achat.',
      en: 'One-time purchase, subscription, or a cut of the buyer’s Stripe volume? Each shapes your MRR and the purchase friction.',
    },
    options: {
      fr: [
        'Achat unique (100–500 $) — friction faible, revenu ponctuel',
        'Abonnement annuel (100–300 $/an) — MRR mais friction d’achat élevée',
        '% du volume Stripe de l’acheteur — aligné mais lourd à mesurer',
        'Donation / tip jar — pas un business model, mais zéro friction',
      ],
      en: [
        'One-time (100–500 $) — low friction, lump-sum revenue',
        'Annual subscription (100–300 $/yr) — MRR but higher purchase friction',
        '% of buyer’s Stripe volume — aligned but heavy to measure',
        'Donation / tip jar — not a business model, but zero friction',
      ],
    },
    unlocks: {
      fr: 'Le bouton « Acheter pour X $ » sur /template + la mécanique de checkout dédiée.',
      en: 'The “Buy for $X” button on /template + the dedicated checkout flow.',
    },
  },
  {
    id: 'D-support',
    num: '3',
    question: {
      fr: 'Niveau de support ?',
      en: 'Support tier?',
    },
    context: {
      fr: 'Le code seul ne suffit pas — il faut décider combien de toi tu vends avec. Trop = tu redeviens un dev de service ; trop peu = ton template a une mauvaise réputation.',
      en: 'Code alone isn’t enough — you must decide how much of YOU you sell with it. Too much = you become an agency again; too little = template gets a bad rep.',
    },
    options: {
      fr: [
        'Repo seul (README + ce runbook public)',
        'Repo + 1 h d’appel async (Loom) au choix de l’acheteur',
        'Repo + bootcamp 1 jour — payant à part',
        'White-glove — tu setup pour l’acheteur (rebrand inclus)',
      ],
      en: [
        'Repo only (README + this public runbook)',
        'Repo + 1h async call (Loom) at the buyer’s discretion',
        'Repo + 1-day bootcamp — priced separately',
        'White-glove — you set up for the buyer (rebrand included)',
      ],
    },
    unlocks: {
      fr: 'La section « Support inclus » sur /template + la planification de ton temps post-vente.',
      en: 'The “Support included” section on /template + your post-sale time planning.',
    },
  },
  {
    id: 'D-rebrand',
    num: '4',
    question: {
      fr: 'Portée du rebrand ?',
      en: 'Rebrand scope?',
    },
    context: {
      fr: 'Track C-06 demande à l’acheteur de remplacer « Marc » partout. Tu peux laisser ça à lui (DIY) ou facturer un rebrand express. Le DIY est plus risqué mais zéro travail pour toi.',
      en: 'Track C-06 asks the buyer to replace “Marc” everywhere. You can leave it to them (DIY) or charge for an express rebrand. DIY is riskier but zero work for you.',
    },
    options: {
      fr: [
        'DIY total — l’acheteur fait tout, doc fournie',
        'Variables d’env brand — { BRAND_NAME, BRAND_PALETTE } pour réduire le grep',
        'Rebrand-as-a-service — tu factures 200–500 $ pour swap brand complet',
        'Theme builder — UI dans /admin pour palette + nom (gros effort eng)',
      ],
      en: [
        'Full DIY — buyer does everything, docs provided',
        'Brand env vars — { BRAND_NAME, BRAND_PALETTE } to reduce grep',
        'Rebrand-as-a-service — you charge 200–500 $ for a full swap',
        'Theme builder — UI in /admin for palette + name (heavy eng effort)',
      ],
    },
    unlocks: {
      fr: 'L’estimé temps réel de Track C-06 sur /template + une nouvelle ligne de revenu si tu vends le rebrand.',
      en: 'The realistic time estimate for Track C-06 on /template + a new revenue line if you sell the rebrand.',
    },
  },
  {
    id: 'D-legal',
    num: '5',
    question: {
      fr: 'Responsabilité légale du template ?',
      en: 'Legal liability?',
    },
    context: {
      fr: 'Le portail est designé pour Loi 25. Si tu vends en disant « conforme Loi 25 », tu prends une exposition si un acheteur l’utilise mal. C’est une question juridique réelle, pas une nuance.',
      en: 'The portal is designed for Bill 25. Selling it as “Bill 25 compliant” takes on liability if a buyer misuses it. This is a real legal question, not a nuance.',
    },
    options: {
      fr: [
        'Disclaimer fort — « structure conforme, à toi d’adapter à ta juridiction »',
        'Template PIA + Privacy adaptables — tu fournis le squelette, pas la garantie',
        'Tu vends seulement aux acheteurs Québec — réduit l’exposition',
        'Consultation légale obligatoire — l’acheteur signe que tu n’as pas avocaté',
      ],
      en: [
        'Strong disclaimer — “structure is compliant, you adapt to your jurisdiction”',
        'Adaptable PIA + Privacy template — you provide the skeleton, not the guarantee',
        'You sell only to Quebec buyers — reduces exposure',
        'Mandatory legal consult — buyer signs that you did not act as counsel',
      ],
    },
    unlocks: {
      fr: 'La page disclaimer + le LICENSE.md + la copie légale visible sur /template.',
      en: 'The disclaimer page + LICENSE.md + the legal copy visible on /template.',
    },
  },
  {
    id: 'D-showcase',
    num: '6',
    question: {
      fr: 'Droit de vitrine ?',
      en: 'Showcase rights?',
    },
    context: {
      fr: 'Les acheteurs deviendront-ils visibles sur ta page d’accueil comme « projets construits avec le portail » ? Preuve sociale puissante, mais aussi création de concurrents directs visibles.',
      en: 'Will buyers become visible on your home page as “projects built with the portal”? Powerful social proof, but also creates visible direct competitors.',
    },
    options: {
      fr: [
        'Oui systématique — chaque acheteur apparaît (preuve sociale max)',
        'Opt-in — l’acheteur coche s’il veut figurer',
        'Opt-out — apparaît par défaut sauf demande contraire',
        'Jamais — tu gardes la marque pour toi seul',
      ],
      en: [
        'Always — every buyer appears (max social proof)',
        'Opt-in — buyer ticks if they want to appear',
        'Opt-out — appears by default unless they ask out',
        'Never — you keep the brand for yourself only',
      ],
    },
    unlocks: {
      fr: 'La section « Construit avec ce template » sur la home, et la clause correspondante dans la licence.',
      en: 'The “Built with this template” section on the home, and the matching license clause.',
    },
  },
  {
    id: 'D-updates',
    num: '7',
    question: {
      fr: 'Canal de mises à jour ?',
      en: 'Update channel?',
    },
    context: {
      fr: 'Quand tu ships une amélioration du template, comment l’acheteur la reçoit ? Git pull manuel ? Notification ? Payant ? La réponse détermine combien d’acheteurs sont sur ta version actuelle vs des versions antiques.',
      en: 'When you ship a portal improvement, how does the buyer receive it? Manual git pull? Notification? Paid? The answer determines how many buyers stay on your current version vs ancient ones.',
    },
    options: {
      fr: [
        'Git pull libre — acheteur tire quand il veut, à ses risques',
        'Newsletter mensuelle des changements + git pull',
        'Upgrades majeures payantes (50 $ par version majeure)',
        'Sync auto — webhook qui PR sur leur fork (effort eng important)',
      ],
      en: [
        'Free git pull — buyer pulls when they want, at their risk',
        'Monthly newsletter of changes + git pull',
        'Paid major upgrades (50 $ per major version)',
        'Auto-sync — webhook that PRs to their fork (heavy eng effort)',
      ],
    },
    unlocks: {
      fr: 'Ta cadence de release publique + la promesse « tu reçois X » dans la sales card.',
      en: 'Your public release cadence + the “you receive X” promise on the sales card.',
    },
  },
  {
    id: 'D-scrub',
    num: '8',
    question: {
      fr: 'Nettoyage avant vente ?',
      en: 'Pre-sale scrubbing?',
    },
    context: {
      fr: 'Le repo contient des artefacts spécifiques à Marc — feature.json, screenshots, vouches, projets vitrine, copies « Marc Jeanson » et « depuis Montréal ». Tout vendre tel quel = acheteur confus. Tout retirer = perte du contexte de doc.',
      en: 'The repo contains Marc-specific artifacts — feature.json files, screenshots, vouches, showcased projects, “Marc Jeanson” and “from Montreal” copy. Selling as-is = confused buyer. Stripping everything = loss of doc context.',
    },
    options: {
      fr: [
        'Repo séparé `portal-template` (branche neutre) — tu maintiens 2 repos',
        'Script post-checkout qui scrub automatiquement (sed sur N fichiers)',
        'Repo unique + section « ce qui est exemple, ce qui est code » dans CLAUDE.md',
        'Vendre tel quel avec disclaimer « comportements et copies de Marc sont des exemples »',
      ],
      en: [
        'Separate `portal-template` repo (neutral branch) — you maintain 2 repos',
        'Post-checkout script that auto-scrubs (sed on N files)',
        'Single repo + “what is example, what is code” section in CLAUDE.md',
        'Sell as-is with disclaimer “Marc’s copy and behavior are examples”',
      ],
    },
    unlocks: {
      fr: 'La structure du repo livré aux acheteurs + la première impression à l’ouverture du fork.',
      en: 'The structure of the repo delivered to buyers + the first impression on fork open.',
    },
  },
]
