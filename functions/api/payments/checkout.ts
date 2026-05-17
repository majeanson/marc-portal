// POST /api/payments/checkout — mint a Stripe Checkout session for a session
// row. Body: { sessionId, kind, lang? }. Auth: visitor-self or admin. The
// route follows the existing access-control pattern (canAccessSession).
//
// Two outcomes:
//   - 200 { url } — redirect the browser to it; Stripe handles the rest.
//   - 503         — STRIPE_SECRET_KEY (or STRIPE_CUSTODIAN_PRICE_ID for the
//                   sub kind) is not configured. Graceful degrade so the
//                   button on /me can stay visible while infra is being wired.

import { currentEmail } from '../../_lib/auth'
import { randomTokenB64url } from '../../_lib/bytes'
import type { Env } from '../../_lib/env'
import { isAdmin } from '../../_lib/env'
import {
  badRequest,
  forbidden,
  notFound,
  ok,
  serviceUnavailable,
  unauthorized,
} from '../../_lib/json'
import { canAccessSession, type SessionRow } from '../../_lib/sessions'
import {
  createOneTimeCheckoutSession,
  createSubscriptionCheckoutSession,
  type PaymentKind,
} from '../../_lib/stripe'

interface CheckoutBody {
  sessionId?: string
  kind?: PaymentKind
  lang?: 'fr' | 'en'
  /** Optional override for tier amounts. Admin-only; visitor's request always
   *  uses the canonical TIER_AMOUNTS below. Lets Marc quote-and-charge custom
   *  Tier 3 figures without a code change. */
  amountCadOverride?: number
}

/**
 * Canonical CAD amounts in cents, matched to the public pricing copy. Source
 * of truth lives in i18n.ts (`pricing.tiers`); these duplicate the numbers
 * server-side so visitors can't mutate the price client-side and short-pay.
 * If the public list changes, change here too.
 */
const TIER_AMOUNTS: Record<Exclude<PaymentKind, 'custodian-sub'>, number> = {
  tier1: 30000, // 300 CAD
  'tier2-deposit': 75000, // 750 CAD (50% of 1500)
  'tier2-final': 75000, // 750 CAD (final 50%)
  tier3: 300000, // 3000 CAD baseline; override expected for higher quotes
}

const VALID_KINDS: ReadonlySet<PaymentKind> = new Set([
  'tier1',
  'tier2-deposit',
  'tier2-final',
  'tier3',
  'custodian-sub',
])

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()

  if (!env.STRIPE_SECRET_KEY) {
    return serviceUnavailable('payments not configured')
  }

  let body: CheckoutBody
  try {
    body = (await request.json()) as CheckoutBody
  } catch {
    return badRequest('invalid json')
  }
  const sessionId = body.sessionId
  const kind = body.kind
  const lang: 'fr' | 'en' = body.lang === 'en' ? 'en' : 'fr'
  if (typeof sessionId !== 'string' || !sessionId) return badRequest('sessionId required')
  if (!kind || !VALID_KINDS.has(kind)) return badRequest('invalid kind')

  // Load session — verify it exists and the caller can access it. Reuses the
  // single auth predicate used everywhere else.
  const session = await env.DB.prepare(
    `SELECT id, email, intake_json, status, created_at, updated_at,
            deleted_at, status_history,
            showcased_at, showcase_title, showcase_tagline, tier,
            tier3_amount_cents
     FROM sessions WHERE id = ? AND deleted_at IS NULL`,
  )
    .bind(sessionId)
    .first<SessionRow>()
  if (!session) return notFound('session not found')

  const admin = isAdmin(env, email)
  if (!canAccessSession(email, admin, session)) return forbidden()

  // Compute the line-item amount. Tier 3 precedence:
  //   1. Admin's amountCadOverride on this request (escape hatch for one-offs)
  //   2. sessions.tier3_amount_cents (the persisted admin quote — what the
  //      visitor's self-pay button uses)
  //   3. TIER_AMOUNTS['tier3'] baseline (last-resort fallback so the endpoint
  //      doesn't 4xx; admin should have quoted before exposing the button)
  let amountCents = 0
  if (kind !== 'custodian-sub') {
    if (admin && kind === 'tier3' && typeof body.amountCadOverride === 'number') {
      const dollars = Math.floor(body.amountCadOverride)
      if (dollars < 100 || dollars > 100_000) {
        return badRequest('amountCadOverride out of range (100..100000 CAD)')
      }
      amountCents = dollars * 100
    } else if (kind === 'tier3' && session.tier3_amount_cents != null) {
      amountCents = session.tier3_amount_cents
    } else {
      amountCents = TIER_AMOUNTS[kind]
    }
  } else {
    if (!env.STRIPE_CUSTODIAN_PRICE_ID) {
      return serviceUnavailable('custodian subscription price not configured')
    }
  }

  // Mint our payment row before talking to Stripe. If Stripe fails, the row
  // stays in 'pending' status forever (harmless; visible in admin) and the
  // next attempt creates a fresh one. We tag the row with our own id so the
  // webhook can find it via client_reference_id without scanning.
  const paymentId = `pay_${randomTokenB64url(12)}`
  const now = Math.floor(Date.now() / 1000)
  await env.DB.prepare(
    `INSERT INTO payments (id, session_id, kind, amount_cents, currency, status, created_at)
     VALUES (?, ?, ?, ?, 'cad', 'pending', ?)`,
  )
    .bind(paymentId, sessionId, kind, amountCents, now)
    .run()

  // Build redirect URLs. ?paid=1 vs ?paid=0 lets the SPA show the right pill
  // without hitting the API again on the first paint after redirect.
  const origin = new URL(request.url).origin
  const langPath = lang === 'en' ? '/en' : ''
  const successUrl = `${origin}${langPath}/me?paid=1&pay=${paymentId}`
  const cancelUrl = `${origin}${langPath}/me?paid=0&pay=${paymentId}`

  // Project label for the line-item — gives the customer + Stripe Dashboard
  // a recognizable name. Falls back to the bare tier label.
  const projectLabel = session.showcase_title ?? undefined

  try {
    let result
    if (kind === 'custodian-sub') {
      result = await createSubscriptionCheckoutSession({
        apiKey: env.STRIPE_SECRET_KEY,
        priceId: env.STRIPE_CUSTODIAN_PRICE_ID!,
        paymentId,
        sessionId,
        visitorEmail: session.email,
        successUrl,
        cancelUrl,
        lang,
      })
    } else {
      result = await createOneTimeCheckoutSession({
        apiKey: env.STRIPE_SECRET_KEY,
        amountCents,
        kind,
        paymentId,
        sessionId,
        visitorEmail: session.email,
        successUrl,
        cancelUrl,
        lang,
        projectLabel,
      })
    }
    // Save the Checkout session id so the webhook can match it back. Idempotent
    // — the UNIQUE index on payments.stripe_checkout_session_id catches double-
    // writes (e.g. if the visitor clicks "Pay" twice; the second attempt fails
    // here and we surface 409). For now, accept that and let Stripe show its
    // own "session expired" page; future polish if it becomes a problem.
    await env.DB.prepare(`UPDATE payments SET stripe_checkout_session_id = ? WHERE id = ?`)
      .bind(result.id, paymentId)
      .run()
    return ok({ url: result.url, paymentId })
  } catch (err) {
    // Mark the row as failed so admin can see it; throw so the middleware
    // forwards to Sentry with the request context.
    await env.DB.prepare(`UPDATE payments SET status = 'failed', failure_reason = ? WHERE id = ?`)
      .bind(err instanceof Error ? err.message.slice(0, 500) : 'unknown', paymentId)
      .run()
    throw err
  }
}
