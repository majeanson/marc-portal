/**
 * Guard tests for the cross-cutting feature-colour maps.
 *
 * The site has FOUR surface→feature maps living in src/lib/features.ts:
 *   PAGE_FEATURE         — page-node id → feature   (guarded in map.test.ts)
 *   HOME_SECTION_FEATURE — home anchor id → feature
 *   SESSION_TAB_FEATURE  — session sub-header tab id → feature
 *   FAQ_FEATURE          — FAQ slug → feature
 *
 * If a key in one of these maps doesn't match the DOM ids/slugs the
 * consumers actually render, the colour silently goes nowhere. These
 * tests catch that drift in CI rather than as a visitor-reported "the
 * dot is grey but Pricing is plum on the next page over."
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  FAQ_FEATURE,
  FAQ_LABEL,
  FEATURE_HOME_SECTION,
  FEATURE_IDS,
  FEATURE_NEXT,
  HOME_SECTION_FEATURE,
  HOME_SECTION_LABEL,
  HOME_SECTION_ORDER,
  META_PAGE_LINK,
  META_PAGE_NEXT,
  PAGE_FEATURE,
  PRODUCT_FEATURE_IDS,
  SESSION_TAB_FEATURE,
  SESSION_TAB_LABEL,
  isFeatureId,
} from './features'
import { HOME_FOLIOS } from './folios'
import { DICT } from '../i18n'

/** Section ids the Header nav surfaces (mirrors NAV_LINKS in Header.tsx;
 *  the `Header NAV_LINKS mirror` test below ties this constant to the
 *  actual source so the two can't drift). */
const HEADER_SECTION_IDS = ['featured', 'how', 'vibe', 'pricing', 'about'] as const

/** Section ids the SectionRail surfaces (mirrors the FR/EN ITEMS arrays
 *  in SectionRail.tsx; the `SectionRail ITEMS mirror` test below ties this
 *  constant to the actual source). Brackets HOME_SECTION_ORDER with the
 *  non-folio'd `hero` cover and the trailing `cta`. */
const RAIL_SECTION_IDS = [
  'hero',
  'featured',
  'how',
  'vibe',
  'bring-anything',
  'pricing',
  'about',
  'testimonials',
  'faq',
  'cta',
] as const

/** Tab ids the SessionSubHeader surfaces (mirrors TABS in
 *  SessionSubHeader.tsx). */
const SESSION_TAB_IDS = [
  'session-statut',
  'session-conversation',
  'session-builds',
  'session-paiement',
  'session-livraison',
  'session-intake',
] as const

describe('HOME_SECTION_FEATURE map', () => {
  it('covers every Header nav section id', () => {
    for (const id of HEADER_SECTION_IDS) {
      expect(
        Object.prototype.hasOwnProperty.call(HOME_SECTION_FEATURE, id),
        `Header nav surfaces "${id}" but HOME_SECTION_FEATURE has no entry`,
      ).toBe(true)
    }
  })

  it('covers every SectionRail item id', () => {
    for (const id of RAIL_SECTION_IDS) {
      expect(
        Object.prototype.hasOwnProperty.call(HOME_SECTION_FEATURE, id),
        `SectionRail surfaces "${id}" but HOME_SECTION_FEATURE has no entry`,
      ).toBe(true)
    }
  })

  it('every defined feature is a real FeatureId', () => {
    for (const [id, fid] of Object.entries(HOME_SECTION_FEATURE)) {
      if (fid === undefined) continue
      expect(isFeatureId(fid), `${id} → "${fid}" is not a real FeatureId`).toBe(true)
    }
  })
})

describe('SESSION_TAB_FEATURE map', () => {
  it('covers every session sub-header tab', () => {
    for (const id of SESSION_TAB_IDS) {
      expect(
        Object.prototype.hasOwnProperty.call(SESSION_TAB_FEATURE, id),
        `SessionSubHeader surfaces "${id}" but SESSION_TAB_FEATURE has no entry`,
      ).toBe(true)
    }
  })

  it('every defined feature is a real FeatureId', () => {
    for (const [id, fid] of Object.entries(SESSION_TAB_FEATURE)) {
      if (fid === undefined) continue
      expect(isFeatureId(fid), `${id} → "${fid}" is not a real FeatureId`).toBe(true)
    }
  })
})

describe('FAQ_FEATURE map', () => {
  it('every slug exists in the FAQ dictionary (both languages)', () => {
    const frSlugs = new Set(DICT.fr.faq.slugs as readonly string[])
    const enSlugs = new Set(DICT.en.faq.slugs as readonly string[])
    for (const slug of Object.keys(FAQ_FEATURE)) {
      expect(frSlugs, `FAQ_FEATURE["${slug}"] but FR FAQ has no such slug`).toContain(slug)
      expect(enSlugs, `FAQ_FEATURE["${slug}"] but EN FAQ has no such slug`).toContain(slug)
    }
  })

  it('every FAQ slug has a feature entry (no question is silently uncoloured)', () => {
    for (const slug of DICT.fr.faq.slugs) {
      expect(
        Object.prototype.hasOwnProperty.call(FAQ_FEATURE, slug),
        `FAQ slug "${slug}" has no FAQ_FEATURE mapping — add an entry (use undefined for "no feature")`,
      ).toBe(true)
    }
  })

  it('every defined feature is a real FeatureId', () => {
    for (const [slug, fid] of Object.entries(FAQ_FEATURE)) {
      if (fid === undefined) continue
      expect(isFeatureId(fid), `${slug} → "${fid}" is not a real FeatureId`).toBe(true)
    }
  })
})

describe('FeatureIndex label maps', () => {
  // The FeatureIndex panel lists every surface of a feature with a human
  // label. A *-FEATURE key without a matching *-LABEL entry would render a
  // raw slug ("session-paiement") to the visitor.
  it('every HOME_SECTION_FEATURE slug has a bilingual HOME_SECTION_LABEL', () => {
    for (const slug of Object.keys(HOME_SECTION_FEATURE)) {
      const label = HOME_SECTION_LABEL[slug]
      expect(label, `HOME_SECTION_FEATURE["${slug}"] has no HOME_SECTION_LABEL`).toBeDefined()
      expect(label?.fr && label?.en, `HOME_SECTION_LABEL["${slug}"] missing fr/en`).toBeTruthy()
    }
  })

  it('every FAQ_FEATURE slug has a bilingual FAQ_LABEL', () => {
    for (const slug of Object.keys(FAQ_FEATURE)) {
      const label = FAQ_LABEL[slug]
      expect(label, `FAQ_FEATURE["${slug}"] has no FAQ_LABEL`).toBeDefined()
      expect(label?.fr && label?.en, `FAQ_LABEL["${slug}"] missing fr/en`).toBeTruthy()
    }
  })

  it('every SESSION_TAB_FEATURE slug has a bilingual SESSION_TAB_LABEL', () => {
    for (const slug of Object.keys(SESSION_TAB_FEATURE)) {
      const label = SESSION_TAB_LABEL[slug]
      expect(label, `SESSION_TAB_FEATURE["${slug}"] has no SESSION_TAB_LABEL`).toBeDefined()
      expect(label?.fr && label?.en, `SESSION_TAB_LABEL["${slug}"] missing fr/en`).toBeTruthy()
    }
  })
})

describe('cross-feature continue arc', () => {
  it('FEATURE_NEXT is one closed cycle through every PRODUCT feature', () => {
    // Walking NEXT from any product feature must visit all six exactly once
    // and return home — a dead end or sub-loop would break the tour. `meta`
    // is not part of the arc, so the cycle is over PRODUCT_FEATURE_IDS only.
    const seen: string[] = []
    let cur = PRODUCT_FEATURE_IDS[0]
    for (let i = 0; i < PRODUCT_FEATURE_IDS.length; i++) {
      seen.push(cur)
      cur = FEATURE_NEXT[cur]
    }
    expect(cur, 'FEATURE_NEXT does not return to the start').toBe(PRODUCT_FEATURE_IDS[0])
    expect(new Set(seen).size, 'FEATURE_NEXT skips or repeats a feature').toBe(
      PRODUCT_FEATURE_IDS.length,
    )
  })

  it('no product feature points the continue nudge at itself', () => {
    // The nudge always advances to the NEXT feature — a self-link would be
    // a "continue" that goes nowhere.
    for (const f of PRODUCT_FEATURE_IDS) {
      expect(FEATURE_NEXT[f], `feature ${f} points NEXT at itself`).not.toBe(f)
    }
  })
})

/**
 * Home funnel ordering. HOME_SECTION_ORDER is the canonical sequence; the
 * <Home /> JSX, the HOME_FOLIOS Roman numerals, the SectionRail and the
 * Header nav must all agree with it. A reshuffle in any one of those four
 * places without updating HOME_SECTION_ORDER fails here in CI rather than
 * shipping a funnel where the rail says one order and the page another.
 */
describe('home section ordering', () => {
  const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8')
  const homeSrc = read('../pages/Home.tsx')
  const railSrc = read('../components/SectionRail.tsx')
  const headerSrc = read('../components/Header.tsx')

  /** Section component tag → anchor id, for the eight folio'd sections. */
  const SECTION_COMPONENT: Record<string, string> = {
    FeaturedProjects: 'featured',
    HowItWorks: 'how',
    VibeFilter: 'vibe',
    BringAnything: 'bring-anything',
    Pricing: 'pricing',
    About: 'about',
    Testimonials: 'testimonials',
    FAQ: 'faq',
  }

  it('Home.tsx renders the folio sections in HOME_SECTION_ORDER', () => {
    const rendered: string[] = []
    for (const m of homeSrc.matchAll(/<([A-Z][A-Za-z]+) lang=/g)) {
      const id = SECTION_COMPONENT[m[1]]
      if (id) rendered.push(id)
    }
    expect(rendered).toEqual([...HOME_SECTION_ORDER])
  })

  it('HOME_FOLIOS key order matches HOME_SECTION_ORDER', () => {
    // HOME_FOLIOS uses a camelCase key for bring-anything; every other key
    // is the anchor id verbatim. Folio Roman numerals are assigned by this
    // key order, so a mismatch would print the wrong numeral on a section.
    const folioKeys = Object.keys(HOME_FOLIOS).map((k) =>
      k === 'bringAnything' ? 'bring-anything' : k,
    )
    expect(folioKeys).toEqual([...HOME_SECTION_ORDER])
  })

  it('SectionRail ITEMS mirror RAIL_SECTION_IDS in both languages', () => {
    const ids = [...railSrc.matchAll(/\{ id: '([^']+)'/g)].map((m) => m[1])
    expect(ids.slice(0, RAIL_SECTION_IDS.length)).toEqual([...RAIL_SECTION_IDS])
    expect(ids.slice(RAIL_SECTION_IDS.length)).toEqual([...RAIL_SECTION_IDS])
  })

  it('SectionRail brackets the folio sections with the hero cover and the CTA', () => {
    expect(RAIL_SECTION_IDS[0]).toBe('hero')
    expect(RAIL_SECTION_IDS.slice(1, -1)).toEqual([...HOME_SECTION_ORDER])
    expect(RAIL_SECTION_IDS.at(-1)).toBe('cta')
  })

  it('Header NAV_LINKS mirror HEADER_SECTION_IDS', () => {
    const ids = [...headerSrc.matchAll(/\{ id: '([^']+)', labelKey:/g)].map((m) => m[1])
    expect(ids).toEqual([...HEADER_SECTION_IDS])
  })

  it('Header nav is an ordered subsequence of HOME_SECTION_ORDER', () => {
    // The nav surfaces a curated subset of sections; whatever it lists must
    // appear in the same relative order as the page itself.
    const order = [...HOME_SECTION_ORDER]
    let last = -1
    for (const id of HEADER_SECTION_IDS) {
      const idx = order.indexOf(id)
      expect(idx, `nav id "${id}" is not a folio section`).toBeGreaterThanOrEqual(0)
      expect(idx, `nav id "${id}" breaks funnel order`).toBeGreaterThan(last)
      last = idx
    }
  })

  it('every HOME_SECTION_ORDER id has a feature, label and folio', () => {
    for (const id of HOME_SECTION_ORDER) {
      expect(
        Object.prototype.hasOwnProperty.call(HOME_SECTION_FEATURE, id),
        `${id} missing from HOME_SECTION_FEATURE`,
      ).toBe(true)
      expect(HOME_SECTION_LABEL[id], `${id} missing from HOME_SECTION_LABEL`).toBeDefined()
    }
  })
})

/**
 * Backstage page loop. The explanatory meta pages form a closed cycle so
 * the page-outro pointer (FeatureContinue) never dead-ends on a backstage
 * page. Not every meta-tinted page is on the loop — pages with their own
 * exits (the "ton passage" trio, auth-gated /me/ surfaces, terminal pages)
 * opt out by simply not appearing in META_PAGE_NEXT. The invariants here
 * are: every loop key is a real meta page, every loop key has a bilingual
 * label + route, and the keys form one closed cycle.
 */
describe('backstage page loop', () => {
  /** The meta page-ids, derived from PAGE_FEATURE — the source of truth. */
  const metaPages = Object.entries(PAGE_FEATURE)
    .filter(([, f]) => f === 'meta')
    .map(([id]) => id)

  it('every META_PAGE_NEXT key is a real meta-feature page', () => {
    const meta = new Set(metaPages)
    for (const id of Object.keys(META_PAGE_NEXT)) {
      expect(meta.has(id), `${id} is in META_PAGE_NEXT but not a meta page`).toBe(true)
    }
  })

  it('META_PAGE_NEXT is one closed cycle through every meta page', () => {
    const keys = Object.keys(META_PAGE_NEXT)
    const seen: string[] = []
    let cur = keys[0]
    for (let i = 0; i < keys.length; i++) {
      seen.push(cur)
      cur = META_PAGE_NEXT[cur]
    }
    expect(cur, 'META_PAGE_NEXT does not return to the start').toBe(keys[0])
    expect(new Set(seen).size, 'META_PAGE_NEXT skips or repeats a page').toBe(keys.length)
  })

  it('no meta page points its pointer at itself', () => {
    for (const [from, to] of Object.entries(META_PAGE_NEXT)) {
      expect(to, `${from} points at itself`).not.toBe(from)
    }
  })

  it('every loop page has a bilingual META_PAGE_LINK label and route', () => {
    for (const id of Object.keys(META_PAGE_NEXT)) {
      const link = META_PAGE_LINK[id]
      expect(link, `${id} missing from META_PAGE_LINK`).toBeDefined()
      expect(link?.label.fr && link?.label.en, `${id} link label missing fr/en`).toBeTruthy()
      expect(link?.path.fr && link?.path.en, `${id} link path missing fr/en`).toBeTruthy()
    }
  })
})

/**
 * Page wayfinding completeness. Every content page must end with a
 * FeatureContinue pointing at its OWN page-id — that's what turns the site
 * into a walkable loop with no dead ends. A new content page that forgets
 * the pointer (or passes the wrong id) fails here.
 */
describe('page wayfinding', () => {
  /** Page source file → the page-id it must hand to FeatureContinue. Home
   *  is excluded — it's the funnel start and has its own CTAs. */
  const CONTENT_PAGES: Record<string, string> = {
    'Tier0.tsx': 'page.tier0',
    'Projects.tsx': 'page.projects',
    'Vouches.tsx': 'page.vouches',
    'Journey.tsx': 'page.journey',
    'Handoff.tsx': 'page.handoff',
    'HandoffChecklist.tsx': 'page.handoff-checklist',
    'Meta.tsx': 'page.meta',
    'Atelier.tsx': 'page.atelier',
    'Privacy.tsx': 'page.privacy',
    'Pia.tsx': 'page.pia',
    'Map.tsx': 'page.map-page',
  }

  // vitest runs with cwd = project root, so resolve page sources from
  // there. (A template literal inside `new URL(..., import.meta.url)` is
  // not rewritten by Vite, so import.meta.url can't be used for a dynamic
  // filename — cwd is the reliable base.)
  const pagesDir = join(process.cwd(), 'src', 'pages')
  const sources = Object.fromEntries(
    Object.keys(CONTENT_PAGES).map((file) => [file, readFileSync(join(pagesDir, file), 'utf8')]),
  )

  it('every content page renders a FeatureContinue with its own page-id', () => {
    for (const [file, pageId] of Object.entries(CONTENT_PAGES)) {
      expect(sources[file], `${file} must render <FeatureContinue page="${pageId}" ...>`).toContain(
        `<FeatureContinue page="${pageId}"`,
      )
    }
  })

  it('every wayfinding page-id is a known page with a feature', () => {
    for (const pageId of Object.values(CONTENT_PAGES)) {
      expect(PAGE_FEATURE[pageId], `${pageId} has no PAGE_FEATURE entry`).toBeDefined()
    }
  })
})

/**
 * Back-to-home exits. Every feature must map to a real home section so the
 * page-outro pointer can always offer a "back to home" link — neither tour
 * loop should ever be a trap.
 */
describe('feature → home section exits', () => {
  const sectionIds = new Set<string>(HOME_SECTION_ORDER)

  it('FEATURE_HOME_SECTION maps every feature to a real, labelled home section', () => {
    for (const fid of FEATURE_IDS) {
      const section = FEATURE_HOME_SECTION[fid]
      expect(section, `${fid} has no FEATURE_HOME_SECTION entry`).toBeDefined()
      expect(sectionIds.has(section), `${fid} → "${section}" is not a home section`).toBe(true)
      expect(HOME_SECTION_LABEL[section], `home section "${section}" has no label`).toBeDefined()
    }
  })
})
