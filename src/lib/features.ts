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

export type FeatureId = 'intake' | 'conversation' | 'iterative' | 'pricing' | 'keys' | 'shipped'

export const FEATURE_IDS: readonly FeatureId[] = [
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
 * Pages absent from this map have no feature (Privacy, Pia, Meta, Map —
 * intentional: they're transparency / meta pages, not user-facing features).
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
}

/** Parse a `group.feat-X` id and return its FeatureId, or null if the id
 *  doesn't follow the feat- convention (e.g. group.transparency). */
export function groupToFeature(groupId: string): FeatureId | null {
  const m = /^group\.feat-(\w+)$/.exec(groupId)
  if (!m) return null
  return isFeatureId(m[1]) ? m[1] : null
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
  // "Comment ça marche" — covers the whole arc (intake → conversation →
  // builds → handoff). Pinning to one colour would be a half-truth.
  how: undefined,
  // "Prix" — the only place that ever talks plum.
  pricing: 'pricing',
  // "Je fais / Je fais pas" — qualification gate, same role as the intake
  // form, hence intake.
  vibe: 'intake',
  // "Apporte n'importe quoi" — neutralises the vibe gate and pushes the
  // visitor toward /intake.
  'bring-anything': 'intake',
  // Pull-quote, About, Testimonials, ShareSite, FAQ — see below; only
  // ones with a clean feature-equivalent appear here.
  about: undefined,
  testimonials: 'shipped',
  faq: undefined,
  // Final CTA — points at /intake.
  cta: 'intake',
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
