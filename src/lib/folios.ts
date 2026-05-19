/**
 * Single source of truth for section + page folios — the Roman-numeral
 * marks shown in the top-right of each home section ("II", "III", …) and
 * the issue numbers on standalone pages ("№ 02", "№ 03", …).
 *
 * Why centralized: before this file existed every section/page hardcoded
 * its own folio inline, which drifted as sections were added or reordered
 * — FeaturedProjects rendered "III" while appearing second on the page;
 * Testimonials rendered "VIII" while appearing before FAQ (which rendered
 * "VII"). The two folios were drifting because each component "remembered"
 * its number from before the last reshuffle.
 *
 * How to use:
 *
 *   import { HOME_FOLIOS } from '../lib/folios'
 *   <div className="section__folio">{HOME_FOLIOS.pricing}</div>
 *
 *   import { PAGE_FOLIOS } from '../lib/folios'
 *   <PageMast folio={`№ ${PAGE_FOLIOS.journey} — le parcours`} ... />
 *
 * Updating: when you reorder sections, just renumber the values in
 * HOME_FOLIOS — every section component reads from here, so the rendered
 * marks update everywhere on the next deploy. Pricing's asOf disclaimer
 * also derives its "IV — " prefix from HOME_FOLIOS.pricing so the section
 * header and the disclaimer never drift apart.
 *
 * Hero is intentionally absent from HOME_FOLIOS: it uses a magazine-style
 * "cover folio" (`№ 01 — Marc, dev québécois`) defined in i18n alongside
 * the descriptive subtitle. That number doubles as the home's "issue"
 * within the PAGE_FOLIOS scheme below.
 */

/**
 * Home page section folios. Order MUST match <Home /> render order.
 * Currently: Hero (cover, № 01) → Featured → How → Pricing → Vibe →
 * BringAnything → About → Testimonials → FAQ.
 */
export const HOME_FOLIOS = {
  featured: 'II',
  how: 'III',
  pricing: 'IV',
  vibe: 'V',
  bringAnything: 'VI',
  about: 'VII',
  testimonials: 'VIII',
  faq: 'IX',
} as const

export type HomeFolioKey = keyof typeof HOME_FOLIOS

/**
 * Standalone-page folios in the "magazine issue" format (`№ XX`).
 * Hero/home uses `№ 01` but defines its own folio in i18n (`hero.folio`)
 * alongside the descriptive subtitle — not duplicated here to avoid a
 * second source of truth for the same number. When adding a new page,
 * take the next sequential number (07, 08, …); don't recycle.
 */
export const PAGE_FOLIOS = {
  tier0: '00',
  projects: '02',
  vouches: '03',
  journey: '04',
  meta: '05',
  handoff: '06',
} as const

export type PageFolioKey = keyof typeof PAGE_FOLIOS
