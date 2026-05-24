// Public copy in src/i18n.ts has the prices visitors see; pricing.ts has the
// figures the server actually charges. Two locations means two opportunities
// to drift — one says "$750" while the other charges $800, or vice versa.
// This test pins them together so a change in either has to update both.
//
// What's checked:
//   - Tier 1/2/3 displayed price (FR + EN) matches TIER_TOTAL_CENTS.
//   - Custodian Watch + Care annual figures appear somewhere in the language
//     dict (the strings are embedded in body copy, so an exact-match assert
//     is too brittle — substring is the right granularity).
//
// What's NOT checked:
//   - Tier 0 (Free / aucun paiement — no constant in pricing.ts).
//   - Tier 4 (quoted per-project; "from $7,500" is a marketing anchor with
//     no server constant). The display string is just a starting figure.
//   - Scoping report ($250 SCOPING_CENTS) — currently surfaces only inside
//     Marc's admin copy, not on the public pricing surface. If that
//     changes, add a substring check here.

import { describe, expect, it } from 'vitest'
import { DICT } from '../i18n'
import {
  applyCommunityDiscount as serverApply,
  COMMUNITY_DISCOUNT_PCT as serverPct,
  CUSTODIAN_CENTS,
  TIER_TOTAL_CENTS,
} from '../../functions/_lib/pricing'
import {
  applyCommunityDiscount as clientApply,
  COMMUNITY_DISCOUNT_PCT as clientPct,
} from './pricing'

const LANGUAGES = ['fr', 'en'] as const

/** Strip every non-digit char and parse as integer dollars. FR strings carry
 *  thin-space thousands separators ("1 800 $"), EN strings carry commas
 *  ("$1,800") — both collapse cleanly once non-digits are removed. */
function priceStringToDollars(displayPrice: string): number {
  const digits = displayPrice.replace(/[^0-9]/g, '')
  return digits ? parseInt(digits, 10) : NaN
}

describe('pricing constants ↔ i18n display parity', () => {
  for (const lang of LANGUAGES) {
    describe(lang, () => {
      const tiers = DICT[lang].pricing.tiers

      // Tier 0 is the "Free" tier; we skip it and pick the next three by
      // index. The index alignment (tiers[1] = Tier 1, etc.) is also a
      // contract — assert it explicitly so a reorder fails loudly.
      it('tier list is ordered Tier 0, 1, 2, 3, 4', () => {
        expect(tiers).toHaveLength(5)
        for (let i = 0; i < tiers.length; i++) {
          expect(tiers[i]!.name).toMatch(new RegExp(String(i)))
        }
      })

      it.each([1, 2, 3] as const)('Tier %i displayed price === TIER_TOTAL_CENTS[%i]', (tier) => {
        const t = tiers[tier]!
        const dollars = priceStringToDollars(t.price)
        expect(dollars * 100).toBe(TIER_TOTAL_CENTS[tier])
      })

      it('Tier 4 displayed price contains a starting anchor (no constant to assert)', () => {
        const t = tiers[4]!
        expect(priceStringToDollars(t.price)).toBeGreaterThan(0)
      })

      it('Custodian Watch + Care annual prices appear in the dict copy', () => {
        // Both prices live in body strings, not in a dedicated field. A
        // substring assertion is the right granularity — if Marc rewrites
        // the body copy the test still passes as long as the right number
        // is in there.
        const haystack = JSON.stringify(DICT[lang])
        const watchDollars = CUSTODIAN_CENTS.watch / 100
        const careDollars = CUSTODIAN_CENTS.care / 100
        expect(haystack).toContain(String(watchDollars))
        expect(haystack).toContain(String(careDollars))
      })
    })
  }
})

describe('community discount: client ↔ server lockstep', () => {
  // Two pricing files, two opportunities to drift. The server charges based
  // on the SERVER constant; the client shows a discounted preview based on
  // the CLIENT constant. If they ever disagree, the visitor sees a number
  // that isn't what gets billed.
  it('the percentage is the same on both sides', () => {
    expect(clientPct).toBe(serverPct)
  })

  it.each([1, 99, 100, 75_000, 180_000, 360_000, 7501, 900_000])(
    'both apply identically to %i cents (community=true)',
    (cents) => {
      expect(clientApply(cents, true)).toBe(serverApply(cents, true))
    },
  )

  it.each([0, 75_000, 12_000, 40_000])(
    'both leave %i cents unchanged when community=false',
    (cents) => {
      expect(clientApply(cents, false)).toBe(cents)
      expect(serverApply(cents, false)).toBe(cents)
    },
  )
})
