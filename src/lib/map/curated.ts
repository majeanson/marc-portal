/**
 * Curated overlay for the layered atlas.
 *
 * The skeleton (src/data/map-skeleton.json) is dumb — file paths, table
 * names, route slugs. This file adds the human layer: labels in both
 * languages, what each node *is*, which group it belongs to, which edges
 * connect them, and the named journeys that get drawn as arrows.
 *
 * Mirrors the runbook's trackA.ts/trackB.ts pattern: hand-curated data
 * file, rendered by a single component. When you add a route or rename a
 * component, the skeleton regenerates automatically — but the friendly
 * label and group placement live here and may need a hand-edit.
 *
 * Edges are not exhaustive on purpose. The atlas should be *legible*, not
 * a callgraph. We pick the load-bearing connections that explain how the
 * site actually works.
 */

import type {
  CuratedOverlay,
  MapNode,
  MapEdge,
  MapGroup,
  MapJourney,
  Bi,
  VisionBubble,
} from './types'

const bi = (fr: string, en: string): Bi => ({ fr, en })

// ─── Patches (overrides on skeleton-derived nodes) ────────────────────────────

// Patches are grouped by feature to mirror the Vision-layer bubbles, so the
// Pages and Vision layers tell the same story at different altitudes.
//
//   1. Bring a project       → group.feat-intake     (operational front door)
//   2. How it works          → group.howto           (explainer — not a feature)
//   3. Conversation          → group.feat-conversation
//   4. Pricing               → group.feat-pricing
//   5. Portfolio             → group.feat-portfolio
//   6. Privacy               → group.feat-privacy
//   7. Handoff               → group.feat-handoff
//   8. Operator console      → group.feat-operator   (admin layer toggle in map)
//
// "Bring a project" is the operational concern — the pages you actually move
// through to get a project in. "How it works" is the separate explainer
// concern — pages that *describe* the process rather than being a step of it.

const PAGE_PATCHES = [
  // 1 — Bring a project
  {
    id: 'page.home',
    label: bi('Accueil', 'Home'),
    desc: bi('La page d’atterrissage.', 'The landing page.'),
    group: 'group.feat-intake',
    // Folio comes from PAGE_FOLIOS.home via data.ts — no manual override here.
  },
  {
    id: 'page.intake',
    label: bi('Intake', 'Intake'),
    desc: bi(
      'Le formulaire d’admission — la porte d’entrée pour proposer un projet.',
      'The intake form — the front door for submitting a project idea.',
    ),
    group: 'group.feat-intake',
  },

  // 2 — How it works (explainer concern, kept out of "Bring a project")
  {
    id: 'page.journey',
    label: bi('Le parcours', 'The journey'),
    desc: bi(
      'Ce que ça donne d’atterrir ici jusqu’à recevoir un livrable.',
      'What it looks like from landing here to receiving a deliverable.',
    ),
    // The journey *describes* the process — it isn't a page you operate to
    // bring a project. It lives in group.howto, not group.feat-intake.
    group: 'group.howto',
  },

  // 3 — Conversation
  {
    id: 'page.login',
    label: bi('Connexion', 'Login'),
    desc: bi(
      'Entre ton courriel — un lien magique arrive en 30 secondes.',
      'Enter your email — a magic link arrives in 30 seconds.',
    ),
    group: 'group.feat-conversation',
  },
  {
    id: 'page.magic-link-sent',
    label: bi('Lien envoyé', 'Magic link sent'),
    desc: bi(
      'Page de confirmation après envoi du lien.',
      'Confirmation page after the link is sent.',
    ),
    group: 'group.feat-conversation',
  },
  {
    id: 'page.me-portal',
    label: bi('Mes sessions', 'My sessions'),
    desc: bi(
      'Le portail visiteur — toutes tes conversations en un endroit.',
      'Visitor portal — every conversation in one place.',
    ),
    group: 'group.feat-conversation',
  },
  {
    id: 'page.session-page',
    label: bi('Session', 'Session'),
    desc: bi(
      'Fil de conversation pour une session. Visiteur ou admin — même surface.',
      'Conversation thread for one session. Visitor or admin — same surface.',
    ),
    group: 'group.feat-conversation',
    // Skeleton flags SessionPage as admin because it's also reachable via
    // /admin/inbox/:id (dual context). The canonical surface is the visitor
    // /session/:id view, so explicitly bring it back to public here. The
    // navigates edge from page.admin-inbox preserves the dual-context story.
    visibility: 'public',
  },
  {
    id: 'page.public-advancements',
    label: bi('Lien de partage', 'Public share'),
    desc: bi(
      'Lien public partageable pour les avancements d’une session.',
      'Shareable public link for a session’s advancements.',
    ),
    group: 'group.feat-iterative',
  },

  // 3 — Pricing
  {
    id: 'page.tier0',
    label: bi('Tier 0', 'Tier 0'),
    desc: bi('La conversation gratuite, sans engagement.', 'The free, no-strings conversation.'),
    group: 'group.feat-pricing',
  },

  // 4 — Portfolio
  {
    id: 'page.projects',
    label: bi('Projets', 'Projects'),
    desc: bi(
      'Galerie publique des projets livrés et en cours.',
      'Public gallery of shipped + in-flight projects.',
    ),
    group: 'group.feat-shipped',
  },
  {
    id: 'page.engagement',
    label: bi('Engagement', 'Engagement'),
    desc: bi(
      'Page dynamique d’un engagement spécifique.',
      'Dynamic page for a specific engagement.',
    ),
    group: 'group.feat-shipped',
  },
  {
    id: 'page.vouches',
    label: bi('Témoignages', 'Vouches'),
    desc: bi('Témoignages publics modérés.', 'Public moderated testimonials.'),
    group: 'group.feat-shipped',
  },
  {
    id: 'page.vouch',
    label: bi('Soumettre un témoignage', 'Submit a vouch'),
    desc: bi(
      'Formulaire pour soumettre un témoignage (modéré avant publication).',
      'Form to submit a testimonial (moderated before going live).',
    ),
    group: 'group.feat-shipped',
  },

  // 5 — Privacy
  {
    id: 'page.privacy',
    label: bi('Confidentialité', 'Privacy'),
    desc: bi(
      'Politique de confidentialité — version visiteur de la Loi 25.',
      'Privacy policy — visitor-facing Loi 25 statement.',
    ),
    group: 'group.feat-meta',
  },
  {
    id: 'page.pia',
    label: bi('PIA', 'PIA'),
    desc: bi(
      'Évaluation d’impact relative à la vie privée (Loi 25).',
      'Privacy impact assessment (Loi 25).',
    ),
    group: 'group.feat-meta',
  },

  // 6 — Handoff (+ transparency pages a buyer would consult during takeover)
  {
    id: 'page.handoff',
    label: bi('Handoff', 'Handoff'),
    desc: bi(
      'Le guide « acheteur » pour reprendre la pratique au complet.',
      'The “buyer” guide for taking over the whole practice.',
    ),
    group: 'group.feat-keys',
  },
  {
    id: 'page.handoff-checklist',
    label: bi('Checklist handoff', 'Handoff checklist'),
    desc: bi('Liste exécutable des étapes de reprise.', 'Executable checklist of takeover steps.'),
    group: 'group.feat-keys',
  },
  {
    id: 'page.meta',
    label: bi('Meta', 'Meta'),
    desc: bi(
      'Manifeste de fonctionnalités LAC — généré depuis feat-*/feature.json.',
      'LAC feature manifest — generated from feat-*/feature.json.',
    ),
    group: 'group.feat-meta',
  },
  {
    id: 'page.atelier',
    label: bi('Atelier', 'Workshop'),
    desc: bi(
      'Le système visuel du portail + chaque écran vérifié à chaque commit.',
      'The portal’s visual system + every screen verified on each commit.',
    ),
    group: 'group.feat-meta',
  },
  {
    id: 'page.map-page',
    label: bi('Carte', 'Map'),
    desc: bi(
      'Cette carte — un atlas du site, pages, données, parcours.',
      'This map — an atlas of the site, pages, data, journeys.',
    ),
    group: 'group.feat-meta',
  },

  // 7 — Operator console (admin)
  {
    id: 'page.admin-hub',
    label: bi('Console', 'Console'),
    desc: bi(
      'Le hub admin — index de toutes les surfaces opérateur.',
      'Admin hub — index of every operator surface.',
    ),
    group: 'group.feat-operator',
  },
  {
    id: 'page.admin-inbox',
    label: bi('Boîte de réception', 'Inbox'),
    desc: bi(
      'Sessions en cours, triage, réponses. La surface de travail principale.',
      'Live sessions, triage, replies. The primary working surface.',
    ),
    group: 'group.feat-operator',
  },
  {
    id: 'page.admin-trash',
    label: bi('Corbeille', 'Trash'),
    desc: bi(
      'Sessions soft-deleted. Restauration ou suppression définitive.',
      'Soft-deleted sessions. Restore or hard-delete.',
    ),
    group: 'group.feat-operator',
  },
  {
    id: 'page.admin-custodians',
    label: bi('Dépositaires', 'Custodians'),
    desc: bi(
      'Abonnements « Je m’en occupe ». MRR d’un coup d’œil.',
      '“I handle it” subscriptions. MRR at a glance.',
    ),
    group: 'group.feat-operator',
  },
  {
    id: 'page.admin-vouches',
    label: bi('Modération témoignages', 'Vouches moderation'),
    desc: bi(
      'File de modération — approuver / rejeter / supprimer.',
      'Moderation queue — approve / reject / delete.',
    ),
    group: 'group.feat-operator',
  },
  {
    id: 'page.admin-runbook',
    label: bi('Runbook', 'Runbook'),
    desc: bi(
      'Mémoire opérateur en deux pistes parallèles (handoff dev || parcours visiteur).',
      'Operator memory in two parallel tracks (dev handoff || user journey).',
    ),
    group: 'group.feat-operator',
  },
  {
    id: 'page.admin-showcase',
    label: bi('Vitrine', 'Showcase'),
    desc: bi('Aperçu en direct des cartes OG.', 'Live preview of OG cards.'),
    group: 'group.feat-operator',
  },
  {
    id: 'page.admin-audit',
    label: bi('Journal d’audit', 'Audit log'),
    desc: bi('Actions opérateur dans le temps.', 'Operator actions over time.'),
    group: 'group.feat-operator',
  },
] as const

// ─── Extras (synthesized — no skeleton equivalent) ────────────────────────────

const SERVICE_NODES: MapNode[] = [
  {
    id: 'svc.stripe',
    kind: 'service',
    label: bi('Stripe', 'Stripe'),
    desc: bi(
      'Paiements + abonnements. Mode test pendant le développement.',
      'Payments + subscriptions. Test mode during development.',
    ),
    badge: 'stripe.com',
    href: 'https://stripe.com',
    hrefExternal: true,
    visibility: 'public',
    layers: ['data'],
    group: 'group.data-services',
  },
  {
    id: 'svc.resend',
    kind: 'service',
    label: bi('Resend', 'Resend'),
    desc: bi(
      'Envoi de courriels (liens magiques + notifications).',
      'Email sending (magic links + notifications).',
    ),
    badge: 'resend.com',
    href: 'https://resend.com',
    hrefExternal: true,
    visibility: 'public',
    layers: ['data'],
    group: 'group.data-services',
  },
  {
    id: 'svc.sentry',
    kind: 'service',
    label: bi('Sentry', 'Sentry'),
    desc: bi(
      'Journalisation d’erreurs. PII retirée — voir le PIA Loi 25.',
      'Error logging. PII stripped — see the Loi 25 PIA.',
    ),
    badge: 'sentry.io',
    href: 'https://sentry.io',
    hrefExternal: true,
    visibility: 'public',
    layers: ['data'],
    group: 'group.data-services',
  },
  {
    id: 'svc.cloudflare',
    kind: 'service',
    label: bi('Cloudflare', 'Cloudflare'),
    desc: bi(
      'Hébergement (Pages), base de données (D1), stockage (R2). Région Eastern North America (Toronto).',
      'Hosting (Pages), database (D1), storage (R2). Eastern North America region (Toronto).',
    ),
    badge: 'cloudflare.com',
    href: 'https://cloudflare.com',
    hrefExternal: true,
    visibility: 'public',
    layers: ['data'],
    group: 'group.data-services',
  },
]

// ─── Groups ───────────────────────────────────────────────────────────────────

const GROUPS: MapGroup[] = [
  // Pages layer — six feature groups, one per colour tag (the product
  // features, 1-1 with the Vision bubbles), plus three groups outside the
  // feature taxonomy: group.feat-meta (the backstage layer — privacy/PIA/
  // meta/atelier/map), group.howto (the "how it works" explainer concern),
  // and the admin-only operator console.
  //
  // Group ids "group.feat-{id}" are recognized by groupToFeature() in
  // src/lib/features.ts; pages inside inherit that feature's accent.
  // "group.feat-operator" matches the prefix but 'operator' isn't a real
  // FeatureId, so groupToFeature returns null — no accent, by design.
  // "group.howto" doesn't match the prefix at all — same null result, an
  // intentionally neutral cluster.
  {
    id: 'group.feat-intake',
    label: bi('Apporte un projet', 'Bring a project'),
    layer: 'pages',
    visibility: 'public',
    order: 0,
    // The operational front door only — the pages you actually move
    // through to bring a project in. The narrated explainer of that
    // process (the journey) is a separate concern; it lives in
    // group.howto, not here.
    nodeIds: ['page.home', 'page.intake'],
  },
  {
    id: 'group.howto',
    label: bi('Comment ça marche', 'How it works'),
    layer: 'pages',
    visibility: 'public',
    order: 1,
    // The explainer concern — pages that *describe* the process rather
    // than being a step you operate. group.howto is not a group.feat-*
    // id, so groupToFeature() returns null and the cluster renders with
    // no feature accent (the neutral treatment, like group.feat-operator).
    // The home page's #how section is slotted in here by data.ts via
    // SECTION_GROUP_OVERRIDE, alongside the journey page.
    nodeIds: ['page.journey'],
  },
  {
    id: 'group.feat-conversation',
    label: bi('Discussion async', 'Async conversation'),
    layer: 'pages',
    visibility: 'public',
    order: 2,
    nodeIds: ['page.login', 'page.magic-link-sent', 'page.me-portal', 'page.session-page'],
  },
  {
    id: 'group.feat-iterative',
    label: bi('Tu vois chaque build', 'You see every build'),
    layer: 'pages',
    visibility: 'public',
    order: 3,
    nodeIds: ['page.public-advancements'],
  },
  {
    id: 'group.feat-pricing',
    label: bi('Tarification claire', 'Clear pricing'),
    layer: 'pages',
    visibility: 'public',
    order: 4,
    nodeIds: ['page.tier0'],
  },
  {
    id: 'group.feat-keys',
    label: bi('Tu gardes les clés', 'You keep the keys'),
    layer: 'pages',
    visibility: 'public',
    order: 5,
    nodeIds: ['page.handoff', 'page.handoff-checklist'],
  },
  {
    id: 'group.feat-shipped',
    label: bi('Voir le déjà-fait', "See what's shipped"),
    layer: 'pages',
    visibility: 'public',
    order: 6,
    nodeIds: ['page.projects', 'page.engagement', 'page.vouches', 'page.vouch'],
  },
  {
    id: 'group.feat-meta',
    label: bi('Les coulisses', 'Behind the scenes'),
    layer: 'pages',
    visibility: 'public',
    order: 7,
    nodeIds: ['page.privacy', 'page.pia', 'page.meta', 'page.atelier', 'page.map-page'],
  },
  {
    id: 'group.feat-operator',
    label: bi('Console opérateur', 'Operator console'),
    layer: 'pages',
    visibility: 'admin',
    order: 8,
    nodeIds: [
      'page.admin-hub',
      'page.admin-inbox',
      'page.admin-trash',
      'page.admin-custodians',
      'page.admin-vouches',
      'page.admin-runbook',
      'page.admin-showcase',
      'page.admin-audit',
    ],
  },

  // Data layer — render as 4 columns left-to-right
  {
    id: 'group.data-pages',
    label: bi('Pages', 'Pages'),
    layer: 'data',
    visibility: 'public',
    order: 0,
    nodeIds: [
      // Representative pages with API calls — kept short to read as a column,
      // not as the full Pages layer.
      'page.intake',
      'page.login',
      'page.me-portal',
      'page.session-page',
      'page.admin-inbox',
      'page.admin-runbook',
    ],
  },
  {
    id: 'group.data-endpoints',
    label: bi('Endpoints', 'Endpoints'),
    layer: 'data',
    visibility: 'admin',
    order: 1,
    nodeIds: [
      'api.auth.request-link',
      'api.auth.verify',
      'api.sessions.index',
      'api.sessions.id',
      'api.sessions.id.messages',
      'api.me',
      'api.payments.checkout',
      'api.payments.webhook',
      'api.public.projects',
      'api.public.vouches',
    ],
  },
  {
    id: 'group.data-tables',
    label: bi('Tables D1', 'D1 tables'),
    layer: 'data',
    visibility: 'admin',
    order: 2,
    nodeIds: [
      'table.sessions',
      'table.messages',
      'table.magic_link_tokens',
      'table.payments',
      'table.vouches',
      'table.user_prefs',
      'table.audit_log',
    ],
  },
  {
    id: 'group.data-services',
    label: bi('Services externes', 'External services'),
    layer: 'data',
    visibility: 'public',
    order: 3,
    nodeIds: ['svc.stripe', 'svc.resend', 'svc.sentry', 'svc.cloudflare'],
  },
]

// ─── Edges ────────────────────────────────────────────────────────────────────

const EDGES: MapEdge[] = [
  // Page → endpoint (calls)
  {
    id: 'e.intake-create',
    from: 'page.intake',
    to: 'api.sessions.index',
    kind: 'calls',
    visibility: 'public',
    layers: ['data'],
  },
  {
    id: 'e.login-request',
    from: 'page.login',
    to: 'api.auth.request-link',
    kind: 'calls',
    visibility: 'public',
    layers: ['data'],
  },
  {
    id: 'e.magic-verify',
    from: 'page.magic-link-sent',
    to: 'api.auth.verify',
    kind: 'calls',
    visibility: 'public',
    layers: ['data'],
  },
  {
    id: 'e.me-read',
    from: 'page.me-portal',
    to: 'api.me',
    kind: 'reads',
    visibility: 'public',
    layers: ['data'],
  },
  {
    id: 'e.session-read',
    from: 'page.session-page',
    to: 'api.sessions.id',
    kind: 'reads',
    visibility: 'public',
    layers: ['data'],
  },
  {
    id: 'e.session-msg',
    from: 'page.session-page',
    to: 'api.sessions.id.messages',
    kind: 'writes',
    visibility: 'public',
    layers: ['data'],
  },
  {
    id: 'e.inbox-list',
    from: 'page.admin-inbox',
    to: 'api.sessions.index',
    kind: 'reads',
    visibility: 'admin',
    layers: ['data'],
  },

  // Endpoint → table
  {
    id: 'e.sessions-tbl',
    from: 'api.sessions.index',
    to: 'table.sessions',
    kind: 'reads',
    visibility: 'admin',
    layers: ['data'],
  },
  {
    id: 'e.sessionid-tbl',
    from: 'api.sessions.id',
    to: 'table.sessions',
    kind: 'reads',
    visibility: 'admin',
    layers: ['data'],
  },
  {
    id: 'e.msg-tbl',
    from: 'api.sessions.id.messages',
    to: 'table.messages',
    kind: 'writes',
    visibility: 'admin',
    layers: ['data'],
  },
  {
    id: 'e.magic-tbl',
    from: 'api.auth.request-link',
    to: 'table.magic_link_tokens',
    kind: 'writes',
    visibility: 'admin',
    layers: ['data'],
  },
  {
    id: 'e.verify-tbl',
    from: 'api.auth.verify',
    to: 'table.magic_link_tokens',
    kind: 'reads',
    visibility: 'admin',
    layers: ['data'],
  },
  {
    id: 'e.pay-tbl',
    from: 'api.payments.webhook',
    to: 'table.payments',
    kind: 'writes',
    visibility: 'admin',
    layers: ['data'],
  },

  // Endpoint → service
  {
    id: 'e.magic-resend',
    from: 'api.auth.request-link',
    to: 'svc.resend',
    kind: 'calls',
    visibility: 'public',
    layers: ['data'],
  },
  {
    id: 'e.checkout-stripe',
    from: 'api.payments.checkout',
    to: 'svc.stripe',
    kind: 'calls',
    visibility: 'public',
    layers: ['data'],
  },
  {
    id: 'e.webhook-stripe',
    from: 'api.payments.webhook',
    to: 'svc.stripe',
    kind: 'reads',
    visibility: 'public',
    layers: ['data'],
  },

  // Table → service (implementations)
  {
    id: 'e.sessions-d1',
    from: 'table.sessions',
    to: 'svc.cloudflare',
    kind: 'depends',
    visibility: 'admin',
    layers: ['data'],
  },
  // (other tables also depend on Cloudflare; one representative edge keeps the diagram legible)

  // Pages-layer cross-context navigation (drawn on the Pages layer)
  {
    id: 'e.inbox-session',
    from: 'page.admin-inbox',
    to: 'page.session-page',
    kind: 'navigates',
    visibility: 'admin',
    layers: ['pages'],
  },
  {
    id: 'e.me-session',
    from: 'page.me-portal',
    to: 'page.session-page',
    kind: 'navigates',
    visibility: 'public',
    layers: ['pages'],
  },
]

// ─── Journeys ─────────────────────────────────────────────────────────────────

const JOURNEYS: MapJourney[] = [
  {
    id: 'journey.visitor-intake',
    label: bi('Première visite → première session', 'First visit → first session'),
    visibility: 'public',
    steps: [
      {
        nodeId: 'page.home',
        note: bi('Visiteur atterrit ici.', 'Visitor lands here.'),
      },
      { nodeId: 'page.intake', note: bi('Remplit le formulaire.', 'Fills out the form.') },
      { nodeId: 'page.login', note: bi('Entre son courriel.', 'Enters their email.') },
      {
        nodeId: 'page.magic-link-sent',
        note: bi('Attend le lien magique.', 'Waits for the magic link.'),
      },
      {
        nodeId: 'page.me-portal',
        note: bi(
          'Revient via le lien — voit ses sessions.',
          'Returns via the link — sees their sessions.',
        ),
      },
      {
        nodeId: 'page.session-page',
        note: bi('Ouvre la conversation.', 'Opens the conversation.'),
      },
    ],
  },
  // The post-shipment arc — picks up where visitor-intake ends (the
  // session page) and walks the "Tu gardes les clés" handoff story.
  {
    id: 'journey.buyer-handoff',
    label: bi('Livraison → tu reprends les clés', 'Delivery → you take the keys'),
    visibility: 'public',
    steps: [
      {
        nodeId: 'page.me-portal',
        note: bi('Tu reviens dans tes sessions.', 'You come back to your sessions.'),
      },
      {
        nodeId: 'page.session-page',
        note: bi('Le projet est livré.', 'The project ships.'),
      },
      {
        nodeId: 'page.handoff',
        note: bi('Tu lis le guide de reprise.', 'You read the takeover guide.'),
      },
      {
        nodeId: 'page.handoff-checklist',
        note: bi('Tu coches chaque étape.', 'You tick off each step.'),
      },
    ],
  },
  // The operator's daily loop — admin-only, so filterForViewer drops it
  // from the visitor view (same gate as the operator-console group).
  {
    id: 'journey.operator-triage',
    label: bi('La boucle de triage de l’opérateur', 'The operator’s triage loop'),
    visibility: 'admin',
    steps: [
      {
        nodeId: 'page.admin-hub',
        note: bi('Tu ouvres la console.', 'You open the console.'),
      },
      {
        nodeId: 'page.admin-inbox',
        note: bi('Tu vois les sessions en triage.', 'You see the sessions in triage.'),
      },
      {
        nodeId: 'page.session-page',
        note: bi('Tu réponds dans le fil.', 'You reply in the thread.'),
      },
      {
        nodeId: 'page.admin-audit',
        note: bi('L’action est journalisée.', 'The action is logged.'),
      },
    ],
  },
]

// ─── Vision — the “big picture” layer ────────────────────────────────────────
//
// Six bubbles that each answer one question a curious visitor naturally asks,
// in that order. Sub is ONE SENTENCE — what the user gets or can do — not a
// list of internal pages (page names mean nothing to a first-time visitor).
//
//   1. What do I bring?       → Apporte un projet
//   2. How does it work?      → Discussion async
//   3. Will I see it work?    → Tu vois chaque build
//   4. What does it cost?     → Tarification claire
//   5. What after delivery?   → Tu gardes les clés
//   6. Has this shipped?      → Voir le déjà-fait
//
// Privacy / Loi 25 is intentionally NOT a bubble — it's table-stakes, not a
// selling point. The /confidentialite + /pia pages still exist and still live
// in the Pages layer; they just don't headline the user-facing vision.

const VISION: VisionBubble[] = [
  {
    id: 'vision.intake',
    feature: 'intake',
    label: bi('Apporte un projet', 'Bring a project'),
    sub: bi(
      'Un problème du quotidien — pas besoin de cahier des charges. Je triage en 72 h.',
      'An everyday problem — no spec sheet needed. I triage within 72 hours.',
    ),
    size: 'lg',
    pos: { x: 24, y: 18 },
    index: 1,
  },
  {
    id: 'vision.conversation',
    feature: 'conversation',
    label: bi('Discussion async', 'Async conversation'),
    sub: bi(
      'Tout par écrit, à ton rythme. Pas de meetings — un fil par projet.',
      'All in writing, at your pace. No meetings — one thread per project.',
    ),
    size: 'md',
    pos: { x: 64, y: 18 },
    index: 2,
  },
  {
    id: 'vision.iterative',
    feature: 'iterative',
    label: bi('Tu vois chaque build', 'You see every build'),
    sub: bi(
      'Aperçu en direct à chaque livraison. Partage par lien quand tu veux montrer.',
      'Live preview at every revision. Shareable link when you want to show it.',
    ),
    size: 'md',
    pos: { x: 24, y: 50 },
    index: 3,
  },
  {
    id: 'vision.pricing',
    feature: 'pricing',
    label: bi('Tarification claire', 'Clear pricing'),
    sub: bi(
      'Tier 0 gratuit pour jaser. Trois tiers fixes ensuite. Custodian optionnel.',
      'Free Tier 0 chat. Three fixed tiers after that. Optional Custodian.',
    ),
    size: 'md',
    pos: { x: 64, y: 50 },
    index: 4,
  },
  {
    id: 'vision.keys',
    feature: 'keys',
    label: bi('Tu gardes les clés', 'You keep the keys'),
    sub: bi(
      "À la livraison : « je m'en occupe » ou « tout à toi ». Tu peux changer d'avis.",
      "At delivery: 'I handle it' or 'all yours'. You can switch any time.",
    ),
    size: 'md',
    pos: { x: 24, y: 82 },
    index: 5,
  },
  {
    id: 'vision.shipped',
    feature: 'shipped',
    label: bi('Voir le déjà-fait', "See what's shipped"),
    sub: bi(
      'Projets livrés en vrai, avec témoignages de personnes vraies.',
      'Real shipped projects, with vouches from real people.',
    ),
    size: 'md',
    pos: { x: 64, y: 82 },
    index: 6,
  },
]

export const CURATED: CuratedOverlay = {
  patches: [...PAGE_PATCHES],
  extras: SERVICE_NODES,
  edges: EDGES,
  groups: GROUPS,
  journeys: JOURNEYS,
  vision: VISION,
}
