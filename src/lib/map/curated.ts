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

const PAGE_PATCHES = [
  // Public front-of-house
  {
    id: 'page.root-by-template',
    label: bi('Accueil', 'Home'),
    desc: bi('La page d’atterrissage.', 'The landing page.'),
    group: 'group.public-front',
    // Folio comes from PAGE_FOLIOS.home via data.ts — no manual override here.
  },
  {
    id: 'page.intake',
    label: bi('Intake', 'Intake'),
    desc: bi(
      'Le formulaire d’admission — la porte d’entrée pour proposer un projet.',
      'The intake form — the front door for submitting a project idea.',
    ),
    group: 'group.public-front',
  },
  {
    id: 'page.napkin',
    label: bi('Napperon', 'Napkin'),
    desc: bi(
      'Tableau Excalidraw partagé — pour griffonner une idée avant l’intake.',
      'Shared Excalidraw whiteboard — to sketch an idea before the intake.',
    ),
    group: 'group.public-front',
  },
  {
    id: 'page.tier0',
    label: bi('Tier 0', 'Tier 0'),
    desc: bi('La conversation gratuite, sans engagement.', 'The free, no-strings conversation.'),
    group: 'group.public-front',
  },
  {
    id: 'page.journey',
    label: bi('Le parcours', 'The journey'),
    desc: bi(
      'Ce que ça donne d’atterrir ici jusqu’à recevoir un livrable.',
      'What it looks like from landing here to receiving a deliverable.',
    ),
    group: 'group.public-front',
  },
  {
    id: 'page.projects',
    label: bi('Projets', 'Projects'),
    desc: bi(
      'Galerie publique des projets livrés et en cours.',
      'Public gallery of shipped + in-flight projects.',
    ),
    group: 'group.public-front',
  },
  {
    id: 'page.engagement',
    label: bi('Engagement', 'Engagement'),
    desc: bi(
      'Page dynamique d’un engagement spécifique.',
      'Dynamic page for a specific engagement.',
    ),
    group: 'group.public-front',
  },
  {
    id: 'page.vouches',
    label: bi('Témoignages', 'Vouches'),
    desc: bi('Témoignages publics modérés.', 'Public moderated testimonials.'),
    group: 'group.public-front',
  },
  {
    id: 'page.vouch',
    label: bi('Soumettre un témoignage', 'Submit a vouch'),
    desc: bi(
      'Formulaire pour soumettre un témoignage (modéré avant publication).',
      'Form to submit a testimonial (moderated before going live).',
    ),
    group: 'group.public-front',
  },

  // Account / auth
  {
    id: 'page.login',
    label: bi('Connexion', 'Login'),
    desc: bi(
      'Entre ton courriel — un lien magique arrive en 30 secondes.',
      'Enter your email — a magic link arrives in 30 seconds.',
    ),
    group: 'group.account',
  },
  {
    id: 'page.magic-link-sent',
    label: bi('Lien envoyé', 'Magic link sent'),
    desc: bi(
      'Page de confirmation après envoi du lien.',
      'Confirmation page after the link is sent.',
    ),
    group: 'group.account',
  },
  {
    id: 'page.me-portal',
    label: bi('Mes sessions', 'My sessions'),
    desc: bi(
      'Le portail visiteur — toutes tes conversations en un endroit.',
      'Visitor portal — every conversation in one place.',
    ),
    group: 'group.account',
  },
  {
    id: 'page.session-page',
    label: bi('Session', 'Session'),
    desc: bi(
      'Fil de conversation pour une session. Visiteur ou admin — même surface.',
      'Conversation thread for one session. Visitor or admin — same surface.',
    ),
    group: 'group.account',
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
    group: 'group.account',
  },

  // Legal / docs
  {
    id: 'page.privacy',
    label: bi('Confidentialité', 'Privacy'),
    desc: bi(
      'Politique de confidentialité — version visiteur de la Loi 25.',
      'Privacy policy — visitor-facing Loi 25 statement.',
    ),
    group: 'group.legal',
  },
  {
    id: 'page.pia',
    label: bi('PIA', 'PIA'),
    desc: bi(
      'Évaluation d’impact relative à la vie privée (Loi 25).',
      'Privacy impact assessment (Loi 25).',
    ),
    group: 'group.legal',
  },
  {
    id: 'page.handoff',
    label: bi('Handoff', 'Handoff'),
    desc: bi(
      'Le guide « acheteur » pour reprendre la pratique au complet.',
      'The “buyer” guide for taking over the whole practice.',
    ),
    group: 'group.legal',
  },
  {
    id: 'page.handoff-checklist',
    label: bi('Checklist handoff', 'Handoff checklist'),
    desc: bi('Liste exécutable des étapes de reprise.', 'Executable checklist of takeover steps.'),
    group: 'group.legal',
  },
  {
    id: 'page.meta',
    label: bi('Meta', 'Meta'),
    desc: bi(
      'Manifeste de fonctionnalités LAC — généré depuis feat-*/feature.json.',
      'LAC feature manifest — generated from feat-*/feature.json.',
    ),
    group: 'group.legal',
  },
  {
    id: 'page.map-page',
    label: bi('Carte', 'Map'),
    desc: bi(
      'Cette carte — un atlas du site, pages, données, parcours.',
      'This map — an atlas of the site, pages, data, journeys.',
    ),
    group: 'group.legal',
  },

  // Admin — working surfaces
  {
    id: 'page.admin-hub',
    label: bi('Console', 'Console'),
    desc: bi(
      'Le hub admin — index de toutes les surfaces opérateur.',
      'Admin hub — index of every operator surface.',
    ),
    group: 'group.admin-working',
  },
  {
    id: 'page.admin-inbox',
    label: bi('Boîte de réception', 'Inbox'),
    desc: bi(
      'Sessions en cours, triage, réponses. La surface de travail principale.',
      'Live sessions, triage, replies. The primary working surface.',
    ),
    group: 'group.admin-working',
  },
  {
    id: 'page.admin-trash',
    label: bi('Corbeille', 'Trash'),
    desc: bi(
      'Sessions soft-deleted. Restauration ou suppression définitive.',
      'Soft-deleted sessions. Restore or hard-delete.',
    ),
    group: 'group.admin-working',
  },
  {
    id: 'page.admin-custodians',
    label: bi('Dépositaires', 'Custodians'),
    desc: bi(
      'Abonnements « Je m’en occupe ». MRR d’un coup d’œil.',
      '“I handle it” subscriptions. MRR at a glance.',
    ),
    group: 'group.admin-working',
  },
  {
    id: 'page.admin-vouches',
    label: bi('Modération témoignages', 'Vouches moderation'),
    desc: bi(
      'File de modération — approuver / rejeter / supprimer.',
      'Moderation queue — approve / reject / delete.',
    ),
    group: 'group.admin-working',
  },
  {
    id: 'page.admin-runbook',
    label: bi('Runbook', 'Runbook'),
    desc: bi(
      'Mémoire opérateur en deux pistes parallèles (handoff dev || parcours visiteur).',
      'Operator memory in two parallel tracks (dev handoff || user journey).',
    ),
    group: 'group.admin-working',
  },

  // Admin — other
  {
    id: 'page.admin-showcase',
    label: bi('Vitrine', 'Showcase'),
    desc: bi('Aperçu en direct des cartes OG.', 'Live preview of OG cards.'),
    group: 'group.admin-other',
  },
  {
    id: 'page.admin-audit',
    label: bi('Journal d’audit', 'Audit log'),
    desc: bi('Actions opérateur dans le temps.', 'Operator actions over time.'),
    group: 'group.admin-other',
  },
  {
    id: 'page.admin-fleet',
    label: bi('Flotte', 'Fleet'),
    desc: bi('Liste des tenants (instances) hébergés.', 'List of hosted tenants (instances).'),
    group: 'group.admin-other',
  },
  {
    id: 'page.admin-fleet-new',
    label: bi('Nouvel onboarding', 'New onboarding'),
    desc: bi('Assistant pour ajouter un nouveau tenant.', 'Wizard to add a new tenant.'),
    group: 'group.admin-other',
  },
  {
    id: 'page.admin-appearance',
    label: bi('Apparence', 'Appearance'),
    desc: bi('Configuration de la marque d’un tenant.', 'Tenant brand configuration.'),
    group: 'group.admin-other',
  },
  {
    id: 'page.admin-team',
    label: bi('Équipe', 'Team'),
    desc: bi('Gestion d’équipe (placeholder).', 'Team management (placeholder).'),
    group: 'group.admin-other',
  },
  {
    id: 'page.admin-billing',
    label: bi('Facturation', 'Billing'),
    desc: bi('Vue facturation tenant.', 'Tenant billing view.'),
    group: 'group.admin-other',
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
  // Pages layer — render order top-to-bottom
  {
    id: 'group.public-front',
    label: bi('Surface publique', 'Public surface'),
    layer: 'pages',
    visibility: 'public',
    order: 0,
    nodeIds: [
      'page.root-by-template',
      'page.intake',
      'page.napkin',
      'page.tier0',
      'page.journey',
      'page.projects',
      'page.engagement',
      'page.vouches',
      'page.vouch',
    ],
  },
  {
    id: 'group.account',
    label: bi('Compte & sessions', 'Account & sessions'),
    layer: 'pages',
    visibility: 'public',
    order: 1,
    nodeIds: [
      'page.login',
      'page.magic-link-sent',
      'page.me-portal',
      'page.session-page',
      'page.public-advancements',
    ],
  },
  {
    id: 'group.legal',
    label: bi('Documents & légal', 'Docs & legal'),
    layer: 'pages',
    visibility: 'public',
    order: 2,
    nodeIds: [
      'page.privacy',
      'page.pia',
      'page.handoff',
      'page.handoff-checklist',
      'page.meta',
      'page.map-page',
    ],
  },
  {
    id: 'group.admin-working',
    label: bi('Admin — surfaces de travail', 'Admin — working surfaces'),
    layer: 'pages',
    visibility: 'admin',
    order: 3,
    nodeIds: [
      'page.admin-hub',
      'page.admin-inbox',
      'page.admin-trash',
      'page.admin-custodians',
      'page.admin-vouches',
      'page.admin-runbook',
    ],
  },
  {
    id: 'group.admin-other',
    label: bi('Admin — autres', 'Admin — other'),
    layer: 'pages',
    visibility: 'admin',
    order: 4,
    nodeIds: [
      'page.admin-showcase',
      'page.admin-audit',
      'page.admin-fleet',
      'page.admin-fleet-new',
      'page.admin-appearance',
      'page.admin-team',
      'page.admin-billing',
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
        nodeId: 'page.root-by-template',
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
]

// ─── Vision — the “big picture” layer ────────────────────────────────────────
//
// Six bubbles, ≤ 5 words per language, that summarize Marc's whole idea
// without forcing the visitor to read 9 home sections to get it. Sized and
// positioned by hand for a napperon / sketchbook feel — not a grid. The
// sequence numbers (index) trace a natural read path: who → deal → rhythm →
// entry → values → exit.

const VISION: VisionBubble[] = [
  {
    id: 'vision.who',
    label: bi('Marc, dev solo, QC', 'Marc, solo dev, QC'),
    desc: bi(
      'Un humain à Montréal. Pas une agence, pas une équipe.',
      'One human in Montréal. Not an agency, not a team.',
    ),
    size: 'lg',
    pos: { x: 22, y: 22 },
    index: 1,
  },
  {
    id: 'vision.deal',
    label: bi('Tu décris, je code', 'You describe, I code'),
    desc: bi(
      'Tu apportes le problème quotidien ; je le tourne en logiciel qui marche.',
      'You bring the everyday problem; I turn it into software that works.',
    ),
    size: 'lg',
    pos: { x: 65, y: 30 },
    index: 2,
  },
  {
    id: 'vision.rhythm',
    label: bi('Async, pas de meetings', 'Async, no meetings'),
    desc: bi(
      'Tout passe par écrit, à ton rythme. Soirs et fins de semaine.',
      'Everything in writing, at your pace. Evenings and weekends.',
    ),
    size: 'md',
    pos: { x: 30, y: 55 },
    index: 3,
  },
  {
    id: 'vision.entry',
    label: bi('Tier 0 : on jase', 'Tier 0: we just talk'),
    desc: bi(
      'Premier échange gratuit, sans engagement. Tu vois la vibe avant.',
      'First conversation free, no strings. You feel the vibe first.',
    ),
    size: 'md',
    pos: { x: 72, y: 58 },
    index: 4,
  },
  {
    id: 'vision.privacy',
    label: bi('Vie privée, Loi 25', 'Privacy first, Loi 25'),
    desc: bi(
      'Données hébergées au Canada. PIA publié. Aucun pixel publicitaire.',
      'Canada-hosted data. Published PIA. Zero ad pixels.',
    ),
    size: 'sm',
    pos: { x: 24, y: 82 },
    index: 5,
  },
  {
    id: 'vision.exit',
    label: bi('Tu reprends quand tu veux', 'Take the keys any time'),
    desc: bi(
      'À la livraison, deux modes : « je m’en occupe » ou « tout à toi ».',
      'At delivery, two modes: "I handle it" or "all yours".',
    ),
    size: 'md',
    pos: { x: 70, y: 82 },
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
