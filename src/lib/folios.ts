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
 * Folio policy (decided 2026-05 standardization pass):
 *   - **Content pages** get a sequential PAGE_FOLIOS entry. Home through
 *     Map below — the "issues" of the magazine.
 *   - **Functional flows** do NOT get folios. These are forms and
 *     account-state surfaces (Intake, Login, MagicLinkSent, MePortal,
 *     SessionPage, PublicAdvancements, Vouch form, Engagement, Napkin).
 *     A folio on a form would feel like flair on a tax return.
 *   - **Admin surfaces** never get folios — they're operator tools, not
 *     publication content.
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
 * the descriptive subtitle. The numeric `home: '01'` below mirrors that
 * for surfaces that need the bare number (e.g. the /carte atlas badge).
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
 * Sequence — content pages, intended reading order:
 *   00 tier0     (the free first chat — the entry)
 *   01 home      (the cover / landing)
 *   02 projects  (the gallery)
 *   03 vouches   (testimonials)
 *   04 journey   (visitor's path explained)
 *   05 meta      (under the hood — LAC features)
 *   06 handoff   (how it ends — buyer guide)
 *   07 handoffChecklist (companion to handoff — executable list)
 *   08 privacy   (Loi 25 visitor statement)
 *   09 pia       (companion to privacy — PIA)
 *   10 map       (the carte / atlas — meta-meta)
 *
 * When adding a new content page, take the next sequential number; don't
 * recycle. When adding a functional flow (form, portal surface), DO NOT
 * add it here — see the policy in this file's header doc.
 */
export const PAGE_FOLIOS = {
  tier0: '00',
  home: '01',
  projects: '02',
  vouches: '03',
  journey: '04',
  meta: '05',
  handoff: '06',
  handoffChecklist: '07',
  privacy: '08',
  pia: '09',
  map: '10',
} as const

export type PageFolioKey = keyof typeof PAGE_FOLIOS
