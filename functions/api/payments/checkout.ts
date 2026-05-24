// POST /api/payments/checkout — mint a Stripe Checkout session for a session.
// Body: { sessionId, kind, custodianPlan?, lang?, amountCadOverride? }.
//   kind 'build'     — the next unpaid installment of the session's tier (1-4).
//                      The server derives WHICH leg from the paid rows; the
//                      client never sends an amount or a leg index.
//   kind 'scoping'   — the $250 scoping report. Credited to the build's first
//                      installment once that build is checked out.
//   kind 'custodian' — an annual custodian subscription (Watch or Care).
// Auth: visitor-self or admin (canAccessSession).
//
// 200 { url, paymentId } — redirect the browser to it; Stripe handles the rest.
// 503 — STRIPE_SECRET_KEY (or the needed custodian Price) is not configured.

import { currentEmail } from '../../_lib/auth'
import { randomTokenB64url } from '../../_lib/bytes'
import type { Env } from '../../_lib/env'
import { isAdmin } from '../../_lib/env'
import { badRequest, conflict, ok, serviceUnavailable, unauthorized } from '../../_lib/json'
import {
  buildInstallmentPlan,
  CUSTODIAN_CENTS,
  installmentLabel,
  scopingLabel,
  SCOPING_CENTS,
} from '../../_lib/pricing'
import { requireSessionAccess } from '../../_lib/sessions'
import {
  createOneTimeCheckoutSession,
  createSubscriptionCheckoutSession,
  type CustodianPlan,
  type PaymentKind,
} from '../../_lib/stripe'

interface CheckoutBody {
  sessionId?: string
  kind?: PaymentKind
  custodianPlan?: CustodianPlan
  lang?: 'fr' | 'en'
  /** Admin-only Tier-4 total override (CAD dollars). Lets Marc quote-and-
   *  charge a one-off without persisting tier4_amount_cents first. Ignored
   *  for non-admins and for tiers other than 4. */
  amountCadOverride?: number
}

const VALID_KINDS: ReadonlySet<string> = new Set(['build', 'scoping', 'custodian'])

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()
  if (!env.STRIPE_SECRET_KEY) return serviceUnavailable('payments not configured')

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

  // Deleted sessions can't checkout — hide-from-all even for admin.
  const admin = isAdmin(env, email)
  const access = await requireSessionAccess(
    env.DB,
    sessionId,
    { email, isAdmin: admin },
    { softDeleted: 'hide-from-all' },
  )
  if (access instanceof Response) return access
  const session = access

  // Redirect URLs — ?paid=1/0 lets the SPA paint the right pill on return
  // without an extra API round-trip.
  const origin = new URL(request.url).origin
  const langPath = lang === 'en' ? '/en' : ''
  const paymentId = `pay_${randomTokenB64url(12)}`
  const now = Math.floor(Date.now() / 1000)
  const successUrl = `${origin}${langPath}/me?paid=1&pay=${paymentId}`
  const cancelUrl = `${origin}${langPath}/me?paid=0&pay=${paymentId}`

  // -- kind: scoping -------------------------------------------------------
  if (kind === 'scoping') {
    // One scoping report per session — guard an accidental double-click into
    // a second $250 charge.
    const already = await env.DB.prepare(
      `SELECT 1 FROM payments WHERE session_id = ? AND kind = 'scoping' AND status = 'paid' LIMIT 1`,
    )
      .bind(sessionId)
      .first()
    if (already) return conflict('scoping report already paid for this session')

    await insertPending(env, {
      paymentId,
      sessionId,
      kind: 'scoping',
      amountCents: SCOPING_CENTS,
      now,
    })
    return await mintOneTime(env, paymentId, {
      amountCents: SCOPING_CENTS,
      label: scopingLabel(lang),
      visitorEmail: session.email,
      successUrl,
      cancelUrl,
      lang,
      meta: { payment_id: paymentId, session_id: sessionId, kind: 'scoping', lang },
    })
  }

  // -- kind: custodian -----------------------------------------------------
  if (kind === 'custodian') {
    const plan = body.custodianPlan
    if (plan !== 'watch' && plan !== 'care') {
      return badRequest('custodianPlan must be watch or care')
    }
    const priceId =
      plan === 'watch' ? env.STRIPE_CUSTODIAN_WATCH_PRICE_ID : env.STRIPE_CUSTODIAN_CARE_PRICE_ID
    if (!priceId) return serviceUnavailable(`custodian ${plan} price not configured`)

    await insertPending(env, {
      paymentId,
      sessionId,
      kind: 'custodian',
      custodianPlan: plan,
      amountCents: CUSTODIAN_CENTS[plan],
      now,
    })
    try {
      const result = await createSubscriptionCheckoutSession({
        apiKey: env.STRIPE_SECRET_KEY,
        priceId,
        paymentId,
        visitorEmail: session.email,
        successUrl,
        cancelUrl,
        lang,
        meta: {
          payment_id: paymentId,
          session_id: sessionId,
          kind: 'custodian',
          custodian_plan: plan,
          lang,
        },
      })
      await linkCheckout(env, paymentId, result.id)
      return ok({ url: result.url, paymentId })
    } catch (err) {
      await markFailed(env, paymentId, err)
      throw err
    }
  }

  // -- kind: build ---------------------------------------------------------
  const tier = session.tier
  if (tier == null || tier === 0) return badRequest('session has no paid tier')

  // Tier-4 total: an admin one-off override wins, else the persisted quote.
  let tier4Cents = session.tier4_amount_cents
  if (admin && tier === 4 && typeof body.amountCadOverride === 'number') {
    const dollars = Math.floor(body.amountCadOverride)
    if (dollars < 100 || dollars > 100_000) {
      return badRequest('amountCadOverride out of range (100..100000 CAD)')
    }
    tier4Cents = dollars * 100
  }

  const plan = buildInstallmentPlan(tier, session.tier3_split, tier4Cents)
  // Only Tier 4 with no quote yet reaches a null plan.
  if (plan == null) return conflict('tier 4 not quoted yet')

  // Which leg is next? Count this session's PAID build installments.
  const paidRow = await env.DB.prepare(
    `SELECT COUNT(*) AS c FROM payments
      WHERE session_id = ? AND kind = 'build' AND status = 'paid'`,
  )
    .bind(sessionId)
    .first<{ c: number }>()
  const nextIndex = (paidRow?.c ?? 0) + 1
  if (nextIndex > plan.length) return conflict('build already fully paid')

  let amountCents = plan[nextIndex - 1]
  // Scoping credit — applied once, only to the first installment. The paid
  // scoping row IS the credit record; because it can only ever reduce leg 1,
  // it cannot be double-applied across legs.
  if (nextIndex === 1) {
    const credit = await env.DB.prepare(
      `SELECT COALESCE(SUM(amount_cents), 0) AS c FROM payments
        WHERE session_id = ? AND kind = 'scoping' AND status = 'paid'`,
    )
      .bind(sessionId)
      .first<{ c: number }>()
    // 50¢ floor = Stripe's minimum CAD charge. Unreachable in practice (every
    // first leg is ≥ $500 after a single $250 credit); cheap insurance.
    amountCents = Math.max(50, amountCents - (credit?.c ?? 0))
  }

  const baseLabel = installmentLabel(tier, nextIndex, plan.length, lang)
  const label = session.showcase_title ? `${baseLabel} — ${session.showcase_title}` : baseLabel

  await insertPending(env, {
    paymentId,
    sessionId,
    kind: 'build',
    tier,
    installmentIndex: nextIndex,
    installmentOf: plan.length,
    amountCents,
    now,
  })
  return await mintOneTime(env, paymentId, {
    amountCents,
    label,
    visitorEmail: session.email,
    successUrl,
    cancelUrl,
    lang,
    meta: {
      payment_id: paymentId,
      session_id: sessionId,
      kind: 'build',
      tier: String(tier),
      installment_index: String(nextIndex),
      installment_of: String(plan.length),
      lang,
    },
  })
}

// -- helpers ---------------------------------------------------------------

interface PendingRow {
  paymentId: string
  sessionId: string
  kind: PaymentKind
  tier?: number
  installmentIndex?: number
  installmentOf?: number
  custodianPlan?: CustodianPlan
  amountCents: number
  now: number
}

/** Mint our payment row in 'pending' before talking to Stripe. If Stripe
 *  fails, the row stays visible to admin; the next attempt mints a fresh one. */
async function insertPending(env: Env, r: PendingRow): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO payments
       (id, session_id, kind, tier, installment_index, installment_of,
        custodian_plan, amount_cents, currency, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'cad', 'pending', ?)`,
  )
    .bind(
      r.paymentId,
      r.sessionId,
      r.kind,
      r.tier ?? null,
      r.installmentIndex ?? null,
      r.installmentOf ?? null,
      r.custodianPlan ?? null,
      r.amountCents,
      r.now,
    )
    .run()
}

async function linkCheckout(env: Env, paymentId: string, checkoutId: string): Promise<void> {
  await env.DB.prepare(`UPDATE payments SET stripe_checkout_session_id = ? WHERE id = ?`)
    .bind(checkoutId, paymentId)
    .run()
}

async function markFailed(env: Env, paymentId: string, err: unknown): Promise<void> {
  await env.DB.prepare(`UPDATE payments SET status = 'failed', failure_reason = ? WHERE id = ?`)
    .bind(err instanceof Error ? err.message.slice(0, 500) : 'unknown', paymentId)
    .run()
}

interface OneTimeArgs {
  amountCents: number
  label: string
  visitorEmail: string
  successUrl: string
  cancelUrl: string
  lang: 'fr' | 'en'
  meta: Record<string, string>
}

async function mintOneTime(env: Env, paymentId: string, args: OneTimeArgs): Promise<Response> {
  try {
    const result = await createOneTimeCheckoutSession({
      apiKey: env.STRIPE_SECRET_KEY!,
      paymentId,
      ...args,
    })
    await linkCheckout(env, paymentId, result.id)
    return ok({ url: result.url, paymentId })
  } catch (err) {
    await markFailed(env, paymentId, err)
    throw err
  }
}
