/**
 * Feature taxonomy — the SIX user-facing features the site is organized around.
 *
 * Each feature carries a stable id + display label + a "hue" (a short human
 * color name). The actual color values live in :root CSS variables
 * (--feat-{id}-color and --feat-{id}-soft), defined in styles.css for both
 * light + dark themes. Components reference the tokens via `var(--feat-X-color)`
 * so theme switches just work.
 *
 * The taxonomy lets a visitor follow one feature across the whole site:
 *   - Vision bubbles ARE the features (one bubble per FeatureId)
 *   - Pages-layer groups in the /carte map use feat-X group ids
 *   - Individual page nodes inherit the feature of their group
 *   - Real content pages (Privacy, Map, Handoff, etc.) carry their feature
 *     via a `data-feature` attribute on the wrapper + a colored folio-mark
 *   - Every feature dot anywhere links to /carte?feature=X, which filters the
 *     map down to just that feature
 *
 * Privacy/Pia/Meta/Map are NOT features — they're transparency / meta pages.
 * They have no feature dot and don't appear in /carte?feature=X filters.
 */

import type { Bi } from './map/types'

/**
 * The colour taxonomy has SEVEN tags. Six are PRODUCT features — the things
 * a visitor gets, the ones that headline the Vision layer and ride the
 * "continue the tour" arc. The seventh, `meta`, is the backstage layer:
 * How it works, About, FAQ, and the transparency/meta pages (Privacy, PIA,
 * Meta, Map). It carries a colour like the others — so nothing renders an
 * "uncoloured" dot — but it is NOT a Vision bubble and NOT in the arc,
 * because it isn't something you're sold; it's how the practice explains
 * itself.
 */
export type FeatureId =
  | 'intake'
  | 'conversation'
  | 'iterative'
  | 'pricing'
  | 'keys'
  | 'shipped'
  | 'meta'

/** The six PRODUCT features — everything except `meta`. Used by surfaces
 *  that should only ever show the sellable features: the Vision bubbles
 *  and the FEATURE_NEXT continue arc. */
export type ProductFeatureId = Exclude<FeatureId, 'meta'>

/** All seven colour tags. */
export const FEATURE_IDS: readonly FeatureId[] = [
  'intake',
  'conversation',
  'iterative',
  'pricing',
  'keys',
  'shipped',
  'meta',
] as const

/** The six product features, in Vision order. */
export const PRODUCT_FEATURE_IDS: readonly ProductFeatureId[] = [
  'intake',
  'conversation',
  'iterative',
  'pricing',
  'keys',
  'shipped',
] as const

export interface Feature {
  id: FeatureId
  /** Display label per language — matches the Vision bubble label. */
  label: Bi
  /** Human color hue ("sage", "ochre"...) — surfaced in tooltips + dev refs. */
  hue: string
}

export const FEATURES: Record<FeatureId, Feature> = {
  intake: {
    id: 'intake',
    label: { fr: 'Apporte un projet', en: 'Bring a project' },
    hue: 'sage',
  },
  conversation: {
    id: 'conversation',
    label: { fr: 'Discussion async', en: 'Async conversation' },
    hue: 'cool blue',
  },
  iterative: {
    id: 'iterative',
    label: { fr: 'Tu vois chaque build', en: 'You see every build' },
    hue: 'ochre',
  },
  pricing: {
    id: 'pricing',
    label: { fr: 'Tarification claire', en: 'Clear pricing' },
    hue: 'plum',
  },
  keys: {
    id: 'keys',
    label: { fr: 'Tu gardes les clés', en: 'You keep the keys' },
    hue: 'terracotta',
  },
  shipped: {
    id: 'shipped',
    label: { fr: 'Voir le déjà-fait', en: "See what's shipped" },
    hue: 'teal',
  },
  // The backstage layer — not a product feature. How it works, About, FAQ,
  // and the transparency/meta pages all carry this slate accent.
  meta: {
    id: 'meta',
    label: { fr: 'Les coulisses', en: 'Behind the scenes' },
    hue: 'slate',
  },
}

/** Type guard for arbitrary strings (e.g. URL params). */
export function isFeatureId(s: string | null | undefined): s is FeatureId {
  return !!s && (FEATURE_IDS as readonly string[]).includes(s)
}

/**
 * Page-id → feature mapping. Single source of truth for which feature each
 * page belongs to. The Map's data layer also derives this via group
 * membership; this map is what page components import directly to colour
 * their folio-mark + wrapper without having to load the whole map graph.
 *
 * Privacy, Pia, Meta, and Map are the `meta` (backstage) feature — they
 * explain the practice rather than being a product surface, but they still
 * carry a colour so nothing renders uncoloured.
 */
export const PAGE_FEATURE: Partial<Record<string, FeatureId>> = {
  // Intake
  'page.root-by-template': 'intake',
  'page.intake': 'intake',
  'page.napkin': 'intake',
  'page.journey': 'intake',
  // Conversation
  'page.login': 'conversation',
  'page.magic-link-sent': 'conversation',
  'page.me-portal': 'conversation',
  'page.session-page': 'conversation',
  // Iterative builds
  'page.public-advancements': 'iterative',
  // Pricing
  'page.tier0': 'pricing',
  // Keys (handoff)
  'page.handoff': 'keys',
  'page.handoff-checklist': 'keys',
  // Shipped (proof of work)
  'page.projects': 'shipped',
  'page.engagement': 'shipped',
  'page.vouches': 'shipped',
  'page.vouch': 'shipped',
  // Meta (backstage — transparency + how-it-works pages)
  'page.privacy': 'meta',
  'page.pia': 'meta',
  'page.meta': 'meta',
  'page.map-page': 'meta',
}

/** Parse a `group.feat-X` id and return its FeatureId, or null if the id
 *  doesn't follow the feat- convention (e.g. group.transparency). */
export function groupToFeature(groupId: string): FeatureId | null {
  const m = /^group\.feat-(\w+)$/.exec(groupId)
  if (!m) return null
  return isFeatureId(m[1]) ? m[1] : null
}

/* -------------------------------------------------------------------------
 * Cross-feature "continue" arc. The six features form one loop — the order
 * a curious visitor naturally walks: bring a project → talk → see builds →
 * pricing → keys → proof → (back to bring a project, as the conversion
 * close). FeatureContinue reads this to render a "next up" pointer at the
 * bottom of each content page, coloured with the DESTINATION feature.
 * ------------------------------------------------------------------------- */

/** Next feature in the arc. A single 6-cycle over the PRODUCT features
 *  (meta is excluded — it isn't part of the tour). Guarded in
 *  features.test.ts. */
export const FEATURE_NEXT: Record<ProductFeatureId, ProductFeatureId> = {
  intake: 'conversation',
  conversation: 'iterative',
  iterative: 'pricing',
  pricing: 'keys',
  keys: 'shipped',
  shipped: 'intake',
}

/** The page a "continue" nudge lands on for each PRODUCT feature — the
 *  most representative, visitor-pleasant page in that feature's cluster.
 *  Validated against the route skeleton in map.test.ts. */
export const FEATURE_PRIMARY_PAGE: Record<ProductFeatureId, Bi> = {
  intake: { fr: '/intake', en: '/en/intake' },
  // Conversation has no marketing page — its surfaces are all functional
  // (login, sessions). /login is the honest "this is where it starts".
  conversation: { fr: '/login', en: '/en/login' },
  iterative: { fr: '/projects', en: '/en/projects' },
  pricing: { fr: '/tier-0', en: '/en/tier-0' },
  keys: { fr: '/handoff', en: '/en/handoff' },
  shipped: { fr: '/vouches', en: '/en/vouches' },
}

/* -------------------------------------------------------------------------
 * Surface → feature maps. SINGLE SOURCE OF TRUTH for "where on the site
 * does a colour belong, beyond a real page?". Every nav/header/subheader/
 * accordion consumer reads from one of these so a colour never goes stale
 * in just one place.
 *
 *   PAGE_FEATURE          (above) — page-node id → feature
 *   HOME_SECTION_FEATURE  — home anchor section id → feature
 *   SESSION_TAB_FEATURE   — session sub-header tab id → feature
 *   FAQ_FEATURE           — FAQ item slug → feature
 *
 * `undefined` is deliberate, not absence: it means "this surface is real,
 * but it crosses every feature" (e.g. "How it works" covers the full arc).
 * Such surfaces still render a neutral hollow FeatureDot so the visual
 * rhythm of "every title has a dot" never breaks.
 * ------------------------------------------------------------------------- */

/** Home page anchor sections → feature. Header nav links, SectionRail,
 *  and any future surface that points at #pricing / #vibe / etc. all
 *  agree on the colour by reading this map. */
export const HOME_SECTION_FEATURE: Record<string, FeatureId | undefined> = {
  // "Projets" — drills into the shipped gallery.
  featured: 'shipped',
  // "Comment ça marche" — explains the whole practice; that's the backstage
  // (meta) layer, not any single product feature.
  how: 'meta',
  // "Prix" — the only place that ever talks plum.
  pricing: 'pricing',
  // "Je fais / Je fais pas" — qualification gate, same role as the intake
  // form, hence intake.
  vibe: 'intake',
  // "Apporte n'importe quoi" — neutralises the vibe gate and pushes the
  // visitor toward /intake.
  'bring-anything': 'intake',
  // About — who's behind the practice — and FAQ — how it works in detail —
  // are both backstage (meta). Testimonials is proof of shipped work.
  about: 'meta',
  testimonials: 'shipped',
  faq: 'meta',
  // Final CTA — points at /intake.
  cta: 'intake',
}

/** Display labels for the home anchor sections — keyed by the same slug
 *  HOME_SECTION_FEATURE uses. The FeatureIndex panel reads this to list
 *  "which home sections belong to feature X" with human labels + anchors.
 *  Kept here (not i18n.ts) so the section↔feature↔label triple stays in
 *  one file and can't drift. */
export const HOME_SECTION_LABEL: Record<string, Bi> = {
  featured: { fr: 'Projets en vedette', en: 'Featured projects' },
  how: { fr: 'Comment ça marche', en: 'How it works' },
  pricing: { fr: 'Prix', en: 'Pricing' },
  vibe: { fr: 'Je fais / je fais pas', en: 'What I do / don’t' },
  'bring-anything': { fr: 'Apporte n’importe quoi', en: 'Bring anything' },
  about: { fr: 'À propos', en: 'About' },
  testimonials: { fr: 'Témoignages', en: 'Testimonials' },
  faq: { fr: 'FAQ', en: 'FAQ' },
  cta: { fr: 'Appel final', en: 'Final call' },
}

/** Session sub-header tabs (#session-statut / #session-conversation /
 *  ...). Active tab borrows --ft-color from the matched feature so the
 *  user follows one colour from "Paiement" tab → /tier-0 → /carte. */
export const SESSION_TAB_FEATURE: Record<string, FeatureId | undefined> = {
  // Statut is the session's "where are we" pill row — it's the live state
  // of the async thread, so it reads as conversation.
  'session-statut': 'conversation',
  'session-conversation': 'conversation',
  'session-builds': 'iterative',
  'session-paiement': 'pricing',
  'session-livraison': 'keys',
  'session-intake': 'intake',
}

/** Session sub-header tab labels — keyed by the SESSION_TAB_FEATURE slug.
 *  The FeatureIndex lists these so a feature's full footprint includes
 *  "shows up as the Paiement tab in any session". Tabs aren't standalone-
 *  navigable (they need a session id), so the index renders them as
 *  contextual, non-link entries. */
export const SESSION_TAB_LABEL: Record<string, Bi> = {
  'session-statut': { fr: 'Statut', en: 'Status' },
  'session-conversation': { fr: 'Conversation', en: 'Conversation' },
  'session-builds': { fr: 'Builds', en: 'Builds' },
  'session-paiement': { fr: 'Paiement', en: 'Payment' },
  'session-livraison': { fr: 'Livraison', en: 'Delivery' },
  'session-intake': { fr: 'Intake', en: 'Intake' },
}

/** FAQ items by stable slug. Each Q/A maps to the feature it most clearly
 *  belongs to. A visitor scanning the FAQ sees the same plum dot on the
 *  price question that they saw on the Pricing section heading two
 *  scrolls up, and clicking it lands them on /carte?feature=pricing. */
export const FAQ_FEATURE: Record<string, FeatureId | undefined> = {
  // "Le prix annoncé, c'est vraiment ça?" — pricing.
  price: 'pricing',
  // "Si ça prend plus de temps que prévu?" — promise relies on the per-
  // build cadence (iterative), not pricing or conversation.
  timeline: 'iterative',
  // "Si je n'aime pas le résultat?" — answered with "demo testable à
  // chaque étape" — that promise IS the iterative feature.
  result: 'iterative',
  // "Je ne sais pas exactement ce que je veux" — intake qualification.
  unclear: 'intake',
  // "À qui appartient le code?" — keys / handoff.
  ownership: 'keys',
  // "Apporter mes propres designs?" — intake (what you bring with you).
  'bring-own': 'intake',
}

/** Short labels for FAQ items — keyed by the FAQ_FEATURE slug. Concise
 *  (not the full question) so they fit the FeatureIndex column. The FAQ
 *  item itself has an anchor `#faq-{slug}`, so these are deep-linkable. */
export const FAQ_LABEL: Record<string, Bi> = {
  price: { fr: 'Le prix annoncé', en: 'The quoted price' },
  timeline: { fr: 'Si ça déborde', en: 'If it overruns' },
  result: { fr: 'Si je n’aime pas', en: 'If I don’t like it' },
  unclear: { fr: 'Idée encore floue', en: 'Idea still fuzzy' },
  ownership: { fr: 'À qui le code', en: 'Who owns the code' },
  'bring-own': { fr: 'Mes propres designs', en: 'My own designs' },
}
