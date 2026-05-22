// Canonical client-side pricing — the single source of truth for the amounts
// the UI shows. Mirrors functions/_lib/pricing.ts (the server source of truth)
// and the public copy in src/i18n.ts; when the public prices change, change
// all three. All amounts are CAD cents — render them with formatCadCents()
// from ./format so the thousands separator is consistent everywhere.

/** One-time build tier totals (CAD cents). Tier 4 is admin-quoted per project,
 *  so it has no fixed total here — only a public floor (TIER4_FROM_CENTS). */
export const TIER_TOTAL_CENTS: Record<1 | 2 | 3, number> = {
  1: 75_000, // $750
  2: 180_000, // $1,800
  3: 360_000, // $3,600
}

/** Public floor for the quoted Tier 4 — the "from $7,500" figure. */
export const TIER4_FROM_CENTS = 750_000

/** The scoping report — credited to a build's first installment. */
export const SCOPING_CENTS = 25_000 // $250

/** Annual custodian plan amounts (CAD cents). The Stripe Price objects remain
 *  the billing source of truth; these mirror them for display + admin math. */
export const CUSTODIAN_CENTS: Record<'watch' | 'care', number> = {
  watch: 12_000, // $120/yr
  care: 40_000, // $400/yr
}
