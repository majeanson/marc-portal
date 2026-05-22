// Canonical pricing — the single server-side source of truth for the public
// tier ladder. Mirrors the public copy in src/i18n.ts (pricing.tiers); when
// the public prices change, change them here too. Visitors never send an
// amount — the checkout endpoint computes every figure from these constants.

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

export type Tier3Split = '50-50' | '40-40-20'

/**
 * The installment plan for a build tier — an array of CAD-cent amounts, one
 * entry per leg. Tier 1 is a single upfront charge; Tier 2 is a fixed 50/50;
 * Tier 3 is admin-chosen 50/50 or 40/40/20; Tier 4 splits the quoted total
 * 40/40/20.
 *
 * Returns null when the plan can't be computed yet — i.e. Tier 4 with no quote
 * (tier4Cents null), or a tier outside 1-4.
 */
export function buildInstallmentPlan(
  tier: number | null,
  tier3Split: string | null,
  tier4Cents: number | null,
): number[] | null {
  if (tier === 1) return [TIER_TOTAL_CENTS[1]]
  if (tier === 2) {
    const half = TIER_TOTAL_CENTS[2] / 2
    return [half, half]
  }
  if (tier === 3) {
    const total = TIER_TOTAL_CENTS[3]
    if (tier3Split === '40-40-20') return split402020(total)
    const half = total / 2
    return [half, half]
  }
  if (tier === 4) {
    if (tier4Cents == null) return null
    return split402020(tier4Cents)
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

/** Line-item label for a build installment, shown on the Stripe receipt. */
export function installmentLabel(
  tier: number,
  index: number,
  of: number,
  lang: 'fr' | 'en',
): string {
  const t = `Tier ${tier}`
  if (of === 1) return lang === 'fr' ? `${t} — projet` : `${t} — project`
  return lang === 'fr' ? `${t} — versement ${index}/${of}` : `${t} — installment ${index}/${of}`
}

/** Line-item label for the scoping report. */
export function scopingLabel(lang: 'fr' | 'en'): string {
  return lang === 'fr' ? 'Rapport de cadrage' : 'Scoping report'
}
