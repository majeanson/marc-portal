// GET /api/payments?sessionId=X — payment summary for one session. Visitor
// sees their own; admin sees anyone's. Returns:
//   { rows: PaymentRow[], hasPaidDeposit: boolean, custodianStatus: CustodianStatus }
//
// hasPaidDeposit is a derived convenience: true when there's at least one paid
// row of a one-time kind (tier1 / tier2-deposit / tier3). The /me UI flips
// "Pay now" → "Paid ✓" off this flag.

import { currentEmail } from '../../_lib/auth'
import type { Env } from '../../_lib/env'
import { isAdmin } from '../../_lib/env'
import { badRequest, forbidden, notFound, ok, unauthorized } from '../../_lib/json'
import { canAccessSession, type SessionRow } from '../../_lib/sessions'

export type CustodianStatus = 'none' | 'active' | 'past_due' | 'canceled' | 'switched_to_tout_a_toi'

export interface PaymentRow {
  id: string
  session_id: string
  kind: string
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
}

interface SessionWithCustodian extends SessionRow {
  custodian_status: CustodianStatus | null
}

const ONE_TIME_KINDS: ReadonlySet<string> = new Set([
  'tier1',
  'tier2-deposit',
  'tier2-final',
  'tier3',
])

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()

  const url = new URL(request.url)
  const sessionId = url.searchParams.get('sessionId')
  if (!sessionId) return badRequest('sessionId required')

  const session = await env.DB.prepare(
    `SELECT id, email, intake_json, status, created_at, updated_at,
            deleted_at, status_history,
            showcased_at, showcase_title, showcase_tagline, tier,
            custodian_status
     FROM sessions WHERE id = ? AND deleted_at IS NULL`,
  )
    .bind(sessionId)
    .first<SessionWithCustodian>()
  if (!session) return notFound('session not found')

  const admin = isAdmin(env, email)
  if (!canAccessSession(email, admin, session)) return forbidden()

  const res = await env.DB.prepare(
    `SELECT id, session_id, kind, amount_cents, currency, status,
            stripe_checkout_session_id, stripe_payment_intent_id,
            stripe_subscription_id, stripe_invoice_id, stripe_customer_id,
            created_at, paid_at, refunded_at
       FROM payments
      WHERE session_id = ?
      ORDER BY created_at DESC`,
  )
    .bind(sessionId)
    .all<PaymentRow>()
  const rows = res.results ?? []

  const hasPaidDeposit = rows.some((r) => r.status === 'paid' && ONE_TIME_KINDS.has(r.kind))

  return ok({
    rows,
    hasPaidDeposit,
    custodianStatus: (session.custodian_status ?? 'none') as CustodianStatus,
  })
}
