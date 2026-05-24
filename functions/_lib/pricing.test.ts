// Unit guards for the pricing math. The shape we care about isn't just
// "discount applied" — it's the invariants that matter at 11pm:
//   1. legs sum exactly to the discounted total (no rounding leakage),
//   2. the 40/40/20 split stays a clean 40/40/20 *of the discounted total*,
//   3. the community label suffix shows up so the Stripe receipt + admin
//      audit trail can answer "why was this charge lower than the public
//      tier price?" without a code dig.
//
// Parity with the client display constants is checked separately in
// src/lib/pricingParity.test.ts.

import { describe, expect, it } from 'vitest'
import {
  applyCommunityDiscount,
  buildInstallmentPlan,
  COMMUNITY_DISCOUNT_PCT,
  CUSTODIAN_CENTS,
  installmentLabel,
  SCOPING_CENTS,
  TIER_TOTAL_CENTS,
} from './pricing'

describe('applyCommunityDiscount', () => {
  it('returns the input unchanged when community=false', () => {
    expect(applyCommunityDiscount(75_000, false)).toBe(75_000)
    expect(applyCommunityDiscount(180_000, false)).toBe(180_000)
  })

  it('applies the discount exactly for round amounts', () => {
    // Tier 1: 75000 * 0.8 = 60000
    expect(applyCommunityDiscount(75_000, true)).toBe(60_000)
    // Tier 2: 180000 * 0.8 = 144000
    expect(applyCommunityDiscount(180_000, true)).toBe(144_000)
    // Tier 3: 360000 * 0.8 = 288000
    expect(applyCommunityDiscount(360_000, true)).toBe(288_000)
  })

  it('uses Math.round at a single point (matches the client mirror)', () => {
    // 99 * 0.8 = 79.2 → round = 79; this pins the rounding policy so an
    // accidental Math.floor or Math.ceil later breaks the test instead of
    // silently shifting a cent between client display and server charge.
    expect(applyCommunityDiscount(99, true)).toBe(79)
    expect(applyCommunityDiscount(101, true)).toBe(81)
  })

  it('the constant is the documented 20%', () => {
    expect(COMMUNITY_DISCOUNT_PCT).toBe(20)
  })
})

describe('buildInstallmentPlan — community OFF (regression of legacy behaviour)', () => {
  it('Tier 1: single full-tier leg', () => {
    expect(buildInstallmentPlan(1, null, null, false)).toEqual([TIER_TOTAL_CENTS[1]])
  })
  it('Tier 2: two equal legs summing to the total', () => {
    const plan = buildInstallmentPlan(2, null, null, false)
    expect(plan).toHaveLength(2)
    expect(plan!.reduce((s, n) => s + n, 0)).toBe(TIER_TOTAL_CENTS[2])
  })
  it('Tier 3 default (50-50)', () => {
    const plan = buildInstallmentPlan(3, null, null, false)
    expect(plan).toHaveLength(2)
    expect(plan!.reduce((s, n) => s + n, 0)).toBe(TIER_TOTAL_CENTS[3])
  })
  it('Tier 3 with 40-40-20', () => {
    const plan = buildInstallmentPlan(3, '40-40-20', null, false)
    expect(plan).toHaveLength(3)
    expect(plan!.reduce((s, n) => s + n, 0)).toBe(TIER_TOTAL_CENTS[3])
  })
  it('Tier 4 returns null when unquoted', () => {
    expect(buildInstallmentPlan(4, null, null, false)).toBeNull()
  })
  it('Tier 4 with a quote: 40/40/20 split that sums exactly', () => {
    const quote = 900_000
    const plan = buildInstallmentPlan(4, null, quote, false)
    expect(plan).toHaveLength(3)
    expect(plan!.reduce((s, n) => s + n, 0)).toBe(quote)
  })
})

describe('buildInstallmentPlan — community ON', () => {
  it('Tier 1: one leg at the discounted total', () => {
    expect(buildInstallmentPlan(1, null, null, true)).toEqual([60_000])
  })

  it('Tier 2: two legs sum to the discounted total', () => {
    const plan = buildInstallmentPlan(2, null, null, true)!
    expect(plan.reduce((s, n) => s + n, 0)).toBe(144_000)
  })

  it('Tier 3 default (50-50): legs sum to the discounted total', () => {
    const plan = buildInstallmentPlan(3, null, null, true)!
    expect(plan.reduce((s, n) => s + n, 0)).toBe(288_000)
  })

  it('Tier 3 40-40-20: each leg is the proportion of the DISCOUNTED total', () => {
    // 360000 * 0.8 = 288000. 40% of 288000 = 115200; last leg absorbs
    // the rounding remainder so the three sum to exactly 288000.
    const plan = buildInstallmentPlan(3, '40-40-20', null, true)!
    expect(plan).toHaveLength(3)
    expect(plan[0]).toBe(115_200)
    expect(plan[1]).toBe(115_200)
    expect(plan[2]).toBe(288_000 - 115_200 - 115_200)
    expect(plan.reduce((s, n) => s + n, 0)).toBe(288_000)
  })

  it('Tier 4: discount applies to the quote, split sums exactly', () => {
    const quote = 900_000
    const plan = buildInstallmentPlan(4, null, quote, true)!
    expect(plan).toHaveLength(3)
    expect(plan.reduce((s, n) => s + n, 0)).toBe(720_000)
  })

  it('Tier 4: with an odd quote, the final leg absorbs the rounding remainder', () => {
    // 7501 * 0.8 = 6000.8 → Math.round = 6001. 40% of 6001 = 2400.4 →
    // round = 2400 (×2 = 4800); final leg = 6001 - 4800 = 1201. The
    // invariant being defended: the legs sum to *exactly* the discounted
    // total, never +1 / -1.
    const plan = buildInstallmentPlan(4, null, 7501, true)!
    expect(plan.reduce((s, n) => s + n, 0)).toBe(6001)
  })
})

describe('installmentLabel', () => {
  it('Tier 1 single-leg, FR + EN, default (no community)', () => {
    expect(installmentLabel(1, 1, 1, 'fr')).toBe('Tier 1 — projet')
    expect(installmentLabel(1, 1, 1, 'en')).toBe('Tier 1 — project')
  })

  it('Tier 2 multi-leg, FR + EN', () => {
    expect(installmentLabel(2, 1, 2, 'fr')).toBe('Tier 2 — versement 1/2')
    expect(installmentLabel(2, 2, 2, 'en')).toBe('Tier 2 — installment 2/2')
  })

  it('community suffix appends in both languages', () => {
    expect(installmentLabel(2, 1, 2, 'fr', true)).toBe(
      'Tier 2 — versement 1/2 — tarif communautaire',
    )
    expect(installmentLabel(2, 2, 2, 'en', true)).toBe('Tier 2 — installment 2/2 — community rate')
    expect(installmentLabel(1, 1, 1, 'fr', true)).toBe('Tier 1 — projet — tarif communautaire')
    expect(installmentLabel(1, 1, 1, 'en', true)).toBe('Tier 1 — project — community rate')
  })
})

describe('community discount scope (v1 invariant)', () => {
  // The constants below are NOT affected by the community flag — scoping
  // and custodian are explicitly out of scope. This test is what stops a
  // future refactor from absent-mindedly threading `community` through
  // those paths without a deliberate spec update.
  it('SCOPING_CENTS does not depend on community state', () => {
    expect(SCOPING_CENTS).toBe(25_000)
  })
  it('CUSTODIAN_CENTS does not depend on community state', () => {
    expect(CUSTODIAN_CENTS.watch).toBe(12_000)
    expect(CUSTODIAN_CENTS.care).toBe(40_000)
  })
})
