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
    hue: 'green',
  },
  conversation: {
    id: 'conversation',
    label: { fr: 'Discussion async', en: 'Async conversation' },
    hue: 'blue',
  },
  iterative: {
    id: 'iterative',
    label: { fr: 'Tu vois chaque build', en: 'You see every build' },
    hue: 'amber',
  },
  pricing: {
    id: 'pricing',
    label: { fr: 'Tarification claire', en: 'Clear pricing' },
    hue: 'purple',
  },
  keys: {
    id: 'keys',
    label: { fr: 'Tu gardes les clés', en: 'You keep the keys' },
    hue: 'red',
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
  'page.home': 'intake',
  'page.intake': 'intake',
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
  'page.atelier': 'meta',
  'page.map-page': 'meta',
  // "Ton passage" arc — three meta-tinted pages that surface the visitor's
  // own data trail. Receipt (per-visit), dossier (per-account contrast vs
  // common SaaS), au-revoir (the erasure ritual after DELETE /api/me).
  'page.passage': 'meta',
  'page.dossier': 'meta',
  'page.au-revoir': 'meta',
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
 *
 *  Two features have no dedicated public page: `conversation`'s surfaces are
 *  all auth-gated (login, sessions) and `iterative`'s public surface is the
 *  dynamic /share/:id link. Sending the tour to /login (a bare form) or to
 *  /projects (which is actually the `shipped` gallery) lands the visitor
 *  somewhere irrelevant — so those two stops point at the home-page section
 *  that explains the feature instead (the `#how` anchor, matching
 *  FEATURE_HOME_SECTION). Validated against the route skeleton in
 *  map.test.ts, which also accepts a `#section` anchor. */
export const FEATURE_PRIMARY_PAGE: Record<ProductFeatureId, Bi> = {
  intake: { fr: '/intake', en: '/en/intake' },
  conversation: { fr: '/#how', en: '/en/#how' },
  iterative: { fr: '/#how', en: '/en/#how' },
  pricing: { fr: '/tier-0', en: '/en/tier-0' },
  keys: { fr: '/handoff', en: '/en/handoff' },
  shipped: { fr: '/vouches', en: '/en/vouches' },
}

/* -------------------------------------------------------------------------
 * Backstage (meta) page loop. The five explanatory meta pages form their
 * own small loop — site map → under the hood → the workshop → privacy →
 * PIA → back to the map — so the page-outro "where next" pointer works
 * for backstage pages too.
 *
 * The "ton passage" trio (passage / dossier / au-revoir) is meta-tinted
 * but deliberately NOT on this loop: each one already carries its own
 * exits (Passage has a related-aside, Dossier is auth-gated and exits to
 * /me, Au-revoir is a terminal page whose emotional weight depends on
 * NOT offering a "keep browsing" pointer). They render the meta accent
 * without being tour stops — features.test.ts allows this opt-out.
 * ------------------------------------------------------------------------- */

/** Next backstage page in the loop, keyed by page-node id. A single
 *  closed 5-cycle; guarded in features.test.ts. */
export const META_PAGE_NEXT: Record<string, string> = {
  'page.map-page': 'page.meta',
  'page.meta': 'page.atelier',
  'page.atelier': 'page.privacy',
  'page.privacy': 'page.pia',
  'page.pia': 'page.map-page',
}

/** Route + short label for each backstage page on the tour — what the
 *  page-outro pointer needs to render a link. Paths validated against
 *  the route skeleton in map.test.ts. */
export const META_PAGE_LINK: Record<string, { label: Bi; path: Bi }> = {
  'page.map-page': {
    label: { fr: 'La carte du site', en: 'The site map' },
    path: { fr: '/carte', en: '/en/map' },
  },
  'page.meta': {
    label: { fr: 'Sous le capot', en: 'Under the hood' },
    path: { fr: '/meta', en: '/en/meta' },
  },
  'page.atelier': {
    label: { fr: 'L’atelier', en: 'The workshop' },
    path: { fr: '/atelier', en: '/en/atelier' },
  },
  'page.privacy': {
    label: { fr: 'Vie privée', en: 'Privacy' },
    path: { fr: '/confidentialite', en: '/en/privacy' },
  },
  'page.pia': {
    label: { fr: 'Protection des données', en: 'Data protection' },
    path: { fr: '/pia', en: '/en/pia' },
  },
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

/**
 * Home anchor sections in render order — the canonical funnel sequence.
 * <Home /> renders these eight folio'd sections in exactly this order;
 * HOME_FOLIOS, the SectionRail and the Header nav each surface this order
 * (or an ordered subsequence of it). Guarded in features.test.ts.
 *
 * The arc: prove (featured) → explain (how) → qualify (vibe) → reassure
 * (bring-anything) → price (pricing) → trust (about) → social-proof
 * (testimonials) → objections (faq). Vibe sits before Pricing so the
 * visitor self-qualifies before the numbers land.
 */
export const HOME_SECTION_ORDER = [
  'featured',
  'how',
  'vibe',
  'bring-anything',
  'pricing',
  'about',
  'testimonials',
  'faq',
] as const

/** Home page anchor sections → feature. Header nav links, SectionRail,
 *  and any future surface that points at #pricing / #vibe / etc. all
 *  agree on the colour by reading this map. Key order follows
 *  HOME_SECTION_ORDER, bracketed by the non-folio'd `hero` cover and the
 *  trailing `cta`. */
export const HOME_SECTION_FEATURE: Record<string, FeatureId | undefined> = {
  // Hero — the magazine cover: the offer + primary CTA. It crosses every
  // feature rather than belonging to one, so it carries the neutral hollow
  // dot (undefined — see the header note above).
  hero: undefined,
  // "Projets" — drills into the shipped gallery.
  featured: 'shipped',
  // "Comment ça marche" — explains the whole practice; that's the backstage
  // (meta) layer, not any single product feature.
  how: 'meta',
  // "Je fais / Je fais pas" — qualification gate, same role as the intake
  // form, hence intake.
  vibe: 'intake',
  // "Apporte n'importe quoi" — neutralises the vibe gate and pushes the
  // visitor toward /intake.
  'bring-anything': 'intake',
  // "Prix" — the only place that ever talks plum.
  pricing: 'pricing',
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
  hero: { fr: 'Accueil', en: 'Home' },
  featured: { fr: 'Projets en vedette', en: 'Featured projects' },
  how: { fr: 'Comment ça marche', en: 'How it works' },
  vibe: { fr: 'Je fais / je fais pas', en: 'What I do / don’t' },
  'bring-anything': { fr: 'Apporte n’importe quoi', en: 'Bring anything' },
  pricing: { fr: 'Prix', en: 'Pricing' },
  about: { fr: 'À propos', en: 'About' },
  testimonials: { fr: 'Témoignages', en: 'Testimonials' },
  faq: { fr: 'FAQ', en: 'FAQ' },
  cta: { fr: 'Appel final', en: 'Final call' },
}

/** Feature → the home-page anchor section that best represents it. The
 *  page-outro pointer (FeatureContinue) uses this to offer a "back to the
 *  home page" exit from the tour loops, landing the visitor on the section
 *  that matches the page they were reading. Several features have no
 *  dedicated home section (conversation, iterative, keys), so they point
 *  at `how` — the catch-all "how it works" explainer. Every value is a
 *  real HOME_SECTION_ORDER id; guarded in features.test.ts. */
export const FEATURE_HOME_SECTION: Record<FeatureId, string> = {
  intake: 'vibe',
  conversation: 'how',
  iterative: 'how',
  pricing: 'pricing',
  keys: 'how',
  shipped: 'featured',
  meta: 'how',
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
  // "Je pourrais pas le faire moi-même avec une IA?" — the why-pay
  // objection. Sits in the pricing cluster, same plum as the question above.
  'diy-ai': 'pricing',
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
  'diy-ai': { fr: 'Le faire moi-même', en: 'Build it myself' },
  timeline: { fr: 'Si ça déborde', en: 'If it overruns' },
  result: { fr: 'Si je n’aime pas', en: 'If I don’t like it' },
  unclear: { fr: 'Idée encore floue', en: 'Idea still fuzzy' },
  ownership: { fr: 'À qui le code', en: 'Who owns the code' },
  'bring-own': { fr: 'Mes propres designs', en: 'My own designs' },
}
