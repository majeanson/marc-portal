// Canonical pricing — the single server-side source of truth for the public
// tier ladder. Mirrors the public copy in src/i18n.ts (pricing.tiers); when
// the public prices change, change them here too. Visitors never send an
// amount — the checkout endpoint computes every figure from these constants.
//
// Tax: Marc operates as a Quebec sole proprietor under the GST/QST small-
// supplier threshold ($30,000 CAD / 12-month rolling window). No tax is
// collected at checkout; Stripe line items are the final amount the visitor
// is charged. When annualized revenue from this portal crosses the
// threshold, Marc must register and start collecting GST 5% + QST 9.975%
// — that's a code change here (Stripe automatic_tax flag or fixed-tax line
// items) plus a Stripe Dashboard registration, NOT just a flip-the-switch.
// Track revenue elsewhere (admin MRR + payments table sum) to know when.

/** The $250 scoping report — credited to a build's first installment. */
export const SCOPING_CENTS = 25_000

/** One-time build tier totals (CAD cents). Tier 4 is admin-quoted per project
 *  (sessions.tier4_amount_cents), so it has no fixed entry here. */
export const TIER_TOTAL_CENTS: Record<1 | 2 | 3, number> = {
  1: 75_000, // $750
  2: 180_000, // $1,800
  3: 360_000, // $3,600
}

/** Annual custodian plan amounts. Recorded on the local payment row for admin
 *  display; Stripe's Price object remains the billing source of truth. */
export const CUSTODIAN_CENTS: Record<'watch' | 'care', number> = {
  watch: 12_000, // $120/yr
  care: 40_000, // $400/yr
}

/** Operator-applied discount for community projects (OBNL, organismes
 *  communautaires, projets sans but lucratif). Boolean on sessions —
 *  see migration 0025. The discount applies to the tier TOTAL before
 *  the installment split so the 40/40/20 rounding stays clean and every
 *  leg is discounted consistently. Does NOT apply to the scoping report
 *  or custodian subscriptions (custodian uses a Stripe Price object and
 *  would need a separate Coupon — out of scope for v1). */
export const COMMUNITY_DISCOUNT_PCT = 20

/** Apply the community discount to a CAD-cents amount when `community`
 *  is true. Single rounding point — Math.round — to keep parity between
 *  client display and server charge exact. Returns the original amount
 *  unchanged when `community` is false. */
export function applyCommunityDiscount(amountCents: number, community: boolean): number {
  if (!community) return amountCents
  return Math.round(amountCents * (1 - COMMUNITY_DISCOUNT_PCT / 100))
}

export type Tier3Split = '50-50' | '40-40-20'

/**
 * The installment plan for a build tier — an array of CAD-cent amounts, one
 * entry per leg. Tier 1 is a single upfront charge; Tier 2 is a fixed 50/50;
 * Tier 3 is admin-chosen 50/50 or 40/40/20; Tier 4 splits the quoted total
 * 40/40/20.
 *
 * When `community` is true, the 20% discount is applied to the TOTAL before
 * splitting — that way the 40/40/20 split's rounding remainder math doesn't
 * silently shift extra cents into a single leg, and a visitor inspecting the
 * receipt sees three evenly-discounted legs.
 *
 * Returns null when the plan can't be computed yet — i.e. Tier 4 with no quote
 * (tier4Cents null), or a tier outside 1-4.
 */
export function buildInstallmentPlan(
  tier: number | null,
  tier3Split: string | null,
  tier4Cents: number | null,
  community: boolean = false,
): number[] | null {
  if (tier === 1) return [applyCommunityDiscount(TIER_TOTAL_CENTS[1], community)]
  if (tier === 2) {
    const total = applyCommunityDiscount(TIER_TOTAL_CENTS[2], community)
    const half = Math.floor(total / 2)
    // Remainder absorbed by the final leg so the legs sum to exactly `total`.
    // Without community pricing, TIER_TOTAL_CENTS[2] is even and this is a no-op.
    return [half, total - half]
  }
  if (tier === 3) {
    const total = applyCommunityDiscount(TIER_TOTAL_CENTS[3], community)
    if (tier3Split === '40-40-20') return split402020(total)
    const half = Math.floor(total / 2)
    return [half, total - half]
  }
  if (tier === 4) {
    if (tier4Cents == null) return null
    return split402020(applyCommunityDiscount(tier4Cents, community))
  }
  return null
}

// 40 / 40 / 20 split. The rounding remainder is absorbed by the final leg so
// the three legs always sum to exactly `total`.
function split402020(total: number): number[] {
  const a = Math.round(total * 0.4)
  const b = Math.round(total * 0.4)
  return [a, b, total - a - b]
}

/** Line-item label for a build installment, shown on the Stripe receipt.
 *  When `community` is true, the label gets a "communautaire" / "community"
 *  suffix so the visitor + Marc + the CRA all see why the amount is lower
 *  than the public tier price. */
export function installmentLabel(
  tier: number,
  index: number,
  of: number,
  lang: 'fr' | 'en',
  community: boolean = false,
): string {
  const t = `Tier ${tier}`
  const tail = community ? (lang === 'fr' ? ' — tarif communautaire' : ' — community rate') : ''
  if (of === 1) return lang === 'fr' ? `${t} — projet${tail}` : `${t} — project${tail}`
  return lang === 'fr'
    ? `${t} — versement ${index}/${of}${tail}`
    : `${t} — installment ${index}/${of}${tail}`
}

/** Line-item label for the scoping report. */
export function scopingLabel(lang: 'fr' | 'en'): string {
  return lang === 'fr' ? 'Rapport de cadrage' : 'Scoping report'
}
