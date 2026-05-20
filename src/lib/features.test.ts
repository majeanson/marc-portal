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

import { describe, expect, it } from 'vitest'
import {
  FAQ_FEATURE,
  FAQ_LABEL,
  HOME_SECTION_FEATURE,
  HOME_SECTION_LABEL,
  SESSION_TAB_FEATURE,
  SESSION_TAB_LABEL,
  isFeatureId,
} from './features'
import { DICT } from '../i18n'

/** Section ids the Header nav surfaces (mirrors NAV_SECTION_IDS in
 *  Header.tsx — kept in sync by hand since both files import from the
 *  central map). */
const HEADER_SECTION_IDS = ['featured', 'how', 'pricing', 'vibe', 'about'] as const

/** Section ids the SectionRail surfaces (mirrors the FR/EN ITEMS arrays
 *  in SectionRail.tsx). */
const RAIL_SECTION_IDS = [
  'featured',
  'how',
  'pricing',
  'vibe',
  'about',
  'testimonials',
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
