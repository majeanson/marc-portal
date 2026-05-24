// GET /api/payments?sessionId=X — payment summary for one session. Visitor
// sees their own; admin sees anyone's. Returns:
//   { rows, custodianStatus, stripeMode, build, scoping }
//
// `build` is the installment summary the /me UI renders directly — the server
// owns all pricing math (see functions/_lib/pricing.ts), so the client never
// computes an amount. It carries the next unpaid leg + its amount (with the
// scoping credit already applied to leg 1), or signals a Tier-4 quote pending.
//
// stripeMode lets the UI render a visible "TEST MODE" pill so visitors don't
// mistake a sandbox charge for a real one. Derived from the secret-key prefix.

import { currentEmail } from '../../_lib/auth'
import type { Env } from '../../_lib/env'
import { isAdmin } from '../../_lib/env'
import { badRequest, ok, unauthorized } from '../../_lib/json'
import { buildInstallmentPlan } from '../../_lib/pricing'
import { requireSessionAccess } from '../../_lib/sessions'

export type CustodianStatus = 'none' | 'active' | 'past_due' | 'canceled' | 'switched_to_tout_a_toi'

export interface PaymentRow {
  id: string
  session_id: string
  /** 'build' | 'scoping' | 'custodian'. */
  kind: string
  /** build only: 1-4. NULL for scoping / custodian. */
  tier: number | null
  /** build only: 1-based leg index and total legs. NULL otherwise. */
  installment_index: number | null
  installment_of: number | null
  /** custodian only: 'watch' | 'care'. NULL otherwise. */
  custodian_plan: string | null
  amount_cents: number
  currency: string
  status: string
  stripe_checkout_session_id: string | null
  stripe_payment_intent_id: string | null
  stripe_subscription_id: string | null
  stripe_invoice_id: string | null
  stripe_customer_id: string | null
  created_at: number
  paid_at: number | null
  refunded_at: number | null
  /** Cumulative refunded cents. 0 = nothing refunded; = amount_cents on a
   * full refund; in between = partial (status stays 'paid'). */
  refunded_amount_cents: number
}

/** Installment summary for the session's build tier. */
export interface BuildSummary {
  tier: number
  /** Total installment legs (0 while a Tier-4 quote is pending). */
  installmentCount: number
  paidCount: number
  /** 1-based index of the next unpaid leg; null = fully paid OR quote pending. */
  nextIndex: number | null
  /** CAD-cent amount for the next leg — scoping credit already applied to
   *  leg 1. null when nextIndex is null. */
  nextAmountCents: number | null
  /** Tier 4 only: classified but not yet quoted by admin. */
  quotePending: boolean
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()

  const url = new URL(request.url)
  const sessionId = url.searchParams.get('sessionId')
  if (!sessionId) return badRequest('sessionId required')

  // Deleted sessions have no live payments summary to render.
  const admin = isAdmin(env, email)
  const access = await requireSessionAccess(
    env.DB,
    sessionId,
    { email, isAdmin: admin },
    { softDeleted: 'hide-from-all' },
  )
  if (access instanceof Response) return access
  const session = access

  const res = await env.DB.prepare(
    `SELECT id, session_id, kind, tier, installment_index, installment_of,
            custodian_plan, amount_cents, currency, status,
            stripe_checkout_session_id, stripe_payment_intent_id,
            stripe_subscription_id, stripe_invoice_id, stripe_customer_id,
            created_at, paid_at, refunded_at, refunded_amount_cents
       FROM payments
      WHERE session_id = ?
      ORDER BY created_at DESC`,
  )
    .bind(sessionId)
    .all<PaymentRow>()
  const rows = res.results ?? []

  // Build installment summary — null for an unclassified or Tier-0 session.
  let build: BuildSummary | null = null
  if (session.tier != null && session.tier > 0) {
    const plan = buildInstallmentPlan(session.tier, session.tier3_split, session.tier4_amount_cents)
    const paidCount = rows.filter((r) => r.kind === 'build' && r.status === 'paid').length
    if (plan == null) {
      // Only a Tier-4 session with no quote yet reaches here.
      build = {
        tier: session.tier,
        installmentCount: 0,
        paidCount,
        nextIndex: null,
        nextAmountCents: null,
        quotePending: true,
      }
    } else {
      const nextIndex = paidCount < plan.length ? paidCount + 1 : null
      let nextAmountCents: number | null = nextIndex != null ? plan[nextIndex - 1] : null
      // Scoping credit applies once, to leg 1.
      if (nextIndex === 1 && nextAmountCents != null) {
        const credit = rows
          .filter((r) => r.kind === 'scoping' && r.status === 'paid')
          .reduce((sum, r) => sum + r.amount_cents, 0)
        nextAmountCents = Math.max(50, nextAmountCents - credit)
      }
      build = {
        tier: session.tier,
        installmentCount: plan.length,
        paidCount,
        nextIndex,
        nextAmountCents,
        quotePending: false,
      }
    }
  }

  const scopingPaid = rows.some((r) => r.kind === 'scoping' && r.status === 'paid')

  const stripeMode: 'test' | 'live' | 'unset' = env.STRIPE_SECRET_KEY
    ? env.STRIPE_SECRET_KEY.startsWith('sk_live_')
      ? 'live'
      : 'test'
    : 'unset'

  return ok({
    rows,
    custodianStatus: (session.custodian_status ?? 'none') as CustodianStatus,
    stripeMode,
    build,
    scoping: { paid: scopingPaid },
  })
}
