// POST /api/payments/webhook — Stripe -> us. Verified by HMAC over the raw
// body using STRIPE_WEBHOOK_SECRET. CSRF-exempt (see _middleware.ts) — auth
// is the signature, not a cookie.
//
// Events handled:
//   checkout.session.completed     — link Stripe ids, mark our row paid;
//                                     for sub mode, cache sub_id on session.
//   invoice.paid                   — first invoice = attach to existing row;
//                                     renewals = insert new payments row.
//   invoice.payment_failed         — sessions.custodian_status = past_due.
//   customer.subscription.deleted  — sessions.custodian_status =
//                                     switched_to_tout_a_toi (per /handoff:
//                                     auto-switch on non-renewal is the
//                                     visitor-visible promise).
//   customer.subscription.updated  — logged only; we wait for terminal events
//                                     before changing custodian_status.
//   charge.refunded                — track refunded_amount_cents; flip status
//                                     only when fully refunded.
//
// Idempotency: every event.id is recorded in webhook_events on first arrival.
// Stripe retries (same event.id) short-circuit at the top with no side
// effects — the DB UPDATEs are already idempotent, but admin-notification
// emails are NOT, so this prevents duplicate Marc-alerts on retry storms.
//
// We return 200 on every internal failure path so Stripe doesn't retry into
// backoff — the rethrow path forwards the error to Sentry via the
// middleware's captureWorkerException wrapping. Signature failures are the
// only case that returns 401: those would be malicious or misconfigured and
// should NOT be retried.

import { randomTokenB64url } from '../../_lib/bytes'
import { sendAdminAlert, sendInstallmentClearedPrompt, sendRefundNotice } from '../../_lib/email'
import type { Env } from '../../_lib/env'
import { ok, unauthorized } from '../../_lib/json'
import { primaryAdminEmail } from '../../_lib/sessions'
import { type StripeEvent, type StripeObject, verifyWebhookSignature } from '../../_lib/stripe'
import { getLang, getLangExplicit, isValidLang } from '../../_lib/userPrefs'

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    // Endpoint is reachable but un-configured — refuse loudly so a real
    // event doesn't get silently dropped.
    return unauthorized('webhook secret not configured')
  }

  // Stripe insists on the EXACT raw body for signature verification —
  // re-encoded JSON has different whitespace and breaks the HMAC.
  const rawBody = await request.text()
  const sig = request.headers.get('Stripe-Signature')
  const valid = await verifyWebhookSignature(rawBody, sig, env.STRIPE_WEBHOOK_SECRET)
  if (!valid) return unauthorized('signature mismatch')

  let event: StripeEvent
  try {
    event = JSON.parse(rawBody) as StripeEvent
  } catch {
    // Malformed body but signature passed — log + 200 so Stripe doesn't retry.
    console.error('stripe webhook: signed body did not parse')
    return ok({ received: true })
  }

  // Event dedupe. INSERT OR IGNORE returns changes=0 on conflict — that's a
  // Stripe retry of an event we've already processed. Side effects (admin
  // emails, visitor prompts) are NOT idempotent in the handlers below, so we
  // short-circuit here. The DB UPDATEs further down are independently
  // idempotent (COALESCE / UNIQUE), but a duplicate run would re-send
  // notifications.
  if (event.id) {
    const nowSec = Math.floor(Date.now() / 1000)
    const ins = await env.DB.prepare(
      `INSERT OR IGNORE INTO webhook_events (event_id, event_type, received_at)
       VALUES (?, ?, ?)`,
    )
      .bind(event.id, event.type, nowSec)
      .run()
    const changes = (ins.meta as { changes?: number }).changes ?? 0
    if (changes === 0) {
      console.log(`stripe webhook: duplicate event ${event.id} (${event.type}); skipping`)
      return ok({ received: true, duplicate: true })
    }
  }

  const origin = new URL(request.url).origin

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(env, event.data.object, origin)
        break
      case 'invoice.paid':
        await handleInvoicePaid(env, event.data.object)
        break
      case 'invoice.payment_failed':
        await handleInvoiceFailed(env, request, event.data.object)
        break
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(env, request, event.data.object)
        break
      case 'customer.subscription.updated':
        // Logged for visibility; no D1 mutation. The terminal event
        // (deleted/expired) is the one that changes custodian_status.
        console.log(`stripe webhook: subscription.updated ${event.data.object.id}`)
        break
      case 'charge.refunded':
        await handleChargeRefunded(env, request, event.data.object)
        break
      default:
        // Many event types fire by default (Stripe sends ~30 enabled events
        // for a basic Checkout flow). Unknown = no-op; logged at debug only
        // to keep the logs scannable.
        break
    }
  } catch (err) {
    // Stripe retries 3xx-5xx with exponential backoff. We'd rather log + 200
    // and investigate via Sentry than enter a retry storm on a transient D1
    // failure. captureWorkerException is wired in _middleware.ts for the
    // rethrow path; we instead log here so a 200 still goes back.
    console.error(`stripe webhook handler failed for ${event.type}`, err)
  }

  return ok({ received: true })
}

async function handleCheckoutCompleted(env: Env, obj: StripeObject, origin: string): Promise<void> {
  const paymentId = obj.client_reference_id
  if (!paymentId) {
    console.warn('checkout.completed without client_reference_id; ignoring', obj.id)
    return
  }
  const kind = obj.metadata?.kind ?? null
  const customerId = obj.customer ?? null
  const subscriptionId = obj.subscription ?? null
  const paymentIntentId = obj.payment_intent ?? null
  const now = Math.floor(Date.now() / 1000)

  // Pre-read the row so we can tell first-transition from a Stripe retry.
  // Side-effects (email nudges) MUST fire only on first transition; the
  // status mutation below is idempotent via COALESCE.
  const before = await env.DB.prepare(`SELECT paid_at FROM payments WHERE id = ?`)
    .bind(paymentId)
    .first<{ paid_at: number | null }>()
  const isFirstTransition = before != null && before.paid_at == null

  // Update our payment row. Guarded by id so two arrivals of the same event
  // (Stripe retries) leave the row in the same terminal state.
  await env.DB.prepare(
    `UPDATE payments
        SET status = 'paid',
            paid_at = COALESCE(paid_at, ?),
            stripe_payment_intent_id = COALESCE(stripe_payment_intent_id, ?),
            stripe_subscription_id = COALESCE(stripe_subscription_id, ?),
            stripe_customer_id = COALESCE(stripe_customer_id, ?)
      WHERE id = ?`,
  )
    .bind(now, paymentIntentId, subscriptionId, customerId, paymentId)
    .run()

  // Sub-mode side effect: cache the subscription id on the session so renewal
  // webhooks (which carry sub id but not session id) can find their way home.
  if (kind === 'custodian' && subscriptionId) {
    const sessionId = obj.metadata?.session_id
    if (sessionId) {
      await env.DB.prepare(
        `UPDATE sessions
            SET custodian_status = 'active',
                custodian_subscription_id = ?,
                custodian_plan = ?
          WHERE id = ?`,
      )
        .bind(subscriptionId, obj.metadata?.custodian_plan ?? null, sessionId)
        .run()
    }
  }

  // Build installment cleared on first transition: when more legs remain,
  // nudge the visitor that the next installment button is now live on /me.
  // Skipped on Stripe retries and when Resend isn't configured.
  if (isFirstTransition && kind === 'build' && env.RESEND_API_KEY) {
    const sessionId = obj.metadata?.session_id
    const idx = Number(obj.metadata?.installment_index ?? '0')
    const of = Number(obj.metadata?.installment_of ?? '0')
    if (sessionId && idx > 0 && of > idx) {
      const session = await env.DB.prepare(
        `SELECT email FROM sessions WHERE id = ? AND deleted_at IS NULL`,
      )
        .bind(sessionId)
        .first<{ email: string }>()
      if (session?.email) {
        // Lang resolution order:
        //   1. Explicit account pref (user_prefs row OR session intake_json
        //      that says fr/en) — wins unconditionally so a visitor who
        //      picked FR after browsing the EN-Checkout still gets FR.
        //   2. Checkout-time metadata.lang — the language they were browsing
        //      when they clicked Pay. Used only with no explicit signal.
        //   3. 'fr' default.
        const explicit = await getLangExplicit(env.DB, session.email)
        const metaLang = obj.metadata?.lang
        const lang: 'fr' | 'en' = explicit ?? (isValidLang(metaLang) ? metaLang : 'fr')
        // Durable: a visitor whose installment cleared but who never hears
        // about it has no obvious recovery path. sendInstallmentClearedPrompt
        // is hardcoded as 'installment-cleared' kind so the outbox catches
        // any Resend hiccup automatically.
        await sendInstallmentClearedPrompt(env, session.email, sessionId, idx, of, origin, lang)
      }
    }
  }
}

async function handleInvoicePaid(env: Env, obj: StripeObject): Promise<void> {
  const invoiceId = obj.id
  const subscriptionId = obj.subscription ?? null
  const customerId = obj.customer ?? null
  const amountPaid = obj.amount_paid ?? 0
  const now = Math.floor(Date.now() / 1000)

  // Idempotency: the UNIQUE index on stripe_invoice_id makes the SELECT-then-
  // INSERT race-free in SQLite — a duplicate insert below would just fail.
  // The first-invoice path is the unusual one: we already minted a row at
  // Checkout time, so we attach the invoice id rather than inserting.
  const existing = await env.DB.prepare(
    `SELECT id FROM payments WHERE stripe_invoice_id = ? LIMIT 1`,
  )
    .bind(invoiceId)
    .first<{ id: string }>()
  if (existing) return

  if (subscriptionId) {
    // Try to attach to the open first-invoice row (sub created via Checkout
    // but invoice id not yet linked). If that exists, this is the initial
    // invoice — just attach. If not, this is a renewal — insert a new row.
    const linkRes = await env.DB.prepare(
      `UPDATE payments
          SET stripe_invoice_id = ?,
              paid_at = COALESCE(paid_at, ?),
              status = 'paid'
        WHERE stripe_subscription_id = ?
          AND stripe_invoice_id IS NULL
          AND kind = 'custodian'`,
    )
      .bind(invoiceId, now, subscriptionId)
      .run()
    if (
      (linkRes.meta as { changes?: number }).changes &&
      (linkRes.meta as { changes?: number }).changes! > 0
    ) {
      return
    }

    // Renewal — locate the session via the cached sub id and insert a fresh
    // row. If the session can't be found (sub created out-of-band, weird
    // state), we still record the invoice to avoid losing money provenance.
    const sessionRow = await env.DB.prepare(
      `SELECT id FROM sessions WHERE custodian_subscription_id = ? LIMIT 1`,
    )
      .bind(subscriptionId)
      .first<{ id: string }>()
    const newId = `pay_inv_${invoiceId.slice(-12)}`
    await env.DB.prepare(
      `INSERT INTO payments
         (id, session_id, kind, amount_cents, currency, status,
          stripe_invoice_id, stripe_subscription_id, stripe_customer_id,
          created_at, paid_at)
       VALUES (?, ?, 'custodian', ?, 'cad', 'paid', ?, ?, ?, ?, ?)`,
    )
      .bind(
        newId,
        sessionRow?.id ?? 'unknown',
        amountPaid,
        invoiceId,
        subscriptionId,
        customerId,
        now,
        now,
      )
      .run()
    // Bump custodian_status back to active in case it was past_due (Stripe
    // succeeded on retry).
    if (sessionRow) {
      await env.DB.prepare(`UPDATE sessions SET custodian_status = 'active' WHERE id = ?`)
        .bind(sessionRow.id)
        .run()
    }
  }
}

async function handleInvoiceFailed(env: Env, request: Request, obj: StripeObject): Promise<void> {
  const subscriptionId = obj.subscription ?? null
  if (!subscriptionId) return
  await env.DB.prepare(
    `UPDATE sessions SET custodian_status = 'past_due' WHERE custodian_subscription_id = ?`,
  )
    .bind(subscriptionId)
    .run()
  // Tell Marc so he can email the client before Stripe gives up retrying.
  await maybeNotifyAdmin(
    env,
    request,
    `Custodian sub renewal failed (subscription ${subscriptionId})`,
  )
}

async function handleSubscriptionDeleted(
  env: Env,
  request: Request,
  obj: StripeObject,
): Promise<void> {
  const subscriptionId = obj.id
  // Per /handoff: a canceled sub auto-switches the engagement back to "Tout
  // à toi" — same effect as the visitor choosing it from day 1. We mark it
  // here so the visitor's /me view reflects the change immediately; the
  // operational steps (transfer accounts, update DNS) are still Marc's job.
  await env.DB.prepare(
    `UPDATE sessions
        SET custodian_status = 'switched_to_tout_a_toi'
      WHERE custodian_subscription_id = ?`,
  )
    .bind(subscriptionId)
    .run()
  await maybeNotifyAdmin(
    env,
    request,
    `Custodian sub canceled (subscription ${subscriptionId}) — initiate transfer to 'Tout à toi'`,
  )
}

async function handleChargeRefunded(env: Env, request: Request, obj: StripeObject): Promise<void> {
  // Stripe sends a `charge.refunded` event with the CHARGE id as obj.id and
  // the parent payment_intent as obj.payment_intent. We don't populate
  // stripe_charge_id on our payment rows (checkout.completed gives us
  // payment_intent, not charge), so match via the payment_intent — that's
  // the field webhook.ts:121 wrote on checkout completion.
  const paymentIntentId = obj.payment_intent
  if (!paymentIntentId) {
    console.warn('charge.refunded without payment_intent; ignoring', obj.id)
    return
  }
  const amountRefunded = obj.amount_refunded ?? 0
  const now = Math.floor(Date.now() / 1000)

  // Find the payment row + its amount_cents so we can decide partial vs full.
  // Pre-read refunded_amount_cents + session_id too so we can (a) gate the
  // visitor notification to the FIRST transition out of 0 — otherwise a
  // partial-then-full sequence would email twice — and (b) resolve the
  // session for the link/email-lookup.
  const row = await env.DB.prepare(
    `SELECT id, amount_cents, refunded_amount_cents, session_id
       FROM payments WHERE stripe_payment_intent_id = ? LIMIT 1`,
  )
    .bind(paymentIntentId)
    .first<{
      id: string
      amount_cents: number
      refunded_amount_cents: number
      session_id: string
    }>()
  if (!row) {
    // Not finding a row is OK: refunds initiated from the Stripe Dashboard on
    // out-of-band charges shouldn't break the webhook. The Dashboard remains
    // the source of truth.
    console.log(`charge.refunded: no local row for pi=${paymentIntentId}; ignoring`)
    return
  }

  const isFullyRefunded = amountRefunded >= row.amount_cents
  const isFirstRefund = (row.refunded_amount_cents ?? 0) === 0 && amountRefunded > 0
  // Record the refunded amount unconditionally; flip status only on full
  // refund. UI surfaces refunded_amount_cents as a separate field so a
  // partial refund is visible.
  await env.DB.prepare(
    `UPDATE payments
        SET refunded_amount_cents = ?,
            status = CASE WHEN ? = 1 THEN 'refunded' ELSE status END,
            refunded_at = CASE WHEN ? = 1 THEN COALESCE(refunded_at, ?) ELSE refunded_at END
      WHERE id = ?`,
  )
    .bind(amountRefunded, isFullyRefunded ? 1 : 0, isFullyRefunded ? 1 : 0, now, row.id)
    .run()

  // Notify the visitor on FIRST transition only. Stripe's own receipt is
  // billing-platform tone; this one is in Marc's voice + deep-links to /me
  // where the refunded row is already visible. Skipped on partial-then-full
  // sequences and when Resend isn't configured.
  if (isFirstRefund && env.RESEND_API_KEY) {
    const visitor = await env.DB.prepare(
      `SELECT email FROM sessions WHERE id = ? AND deleted_at IS NULL`,
    )
      .bind(row.session_id)
      .first<{ email: string }>()
    if (visitor?.email) {
      try {
        const lang = await getLang(env.DB, visitor.email)
        const origin = new URL(request.url).origin
        // Durable: Stripe sends its own receipt but the portal's status
        // change MUST reach the visitor. sendRefundNotice is hardcoded as
        // 'refund-notice' kind in the outbox.
        await sendRefundNotice(env, visitor.email, amountRefunded, row.amount_cents, origin, lang)
      } catch (err) {
        // Notification failure is non-fatal — the DB has already absorbed
        // the refund. Logged so we can investigate, but the webhook still
        // returns 200 so Stripe doesn't retry.
        console.error('refund notice send failed', err)
      }
    }
  }
}

/**
 * Notify Marc that something operationally important happened. Tries Resend
 * first; if that fails (network blip, Resend outage, missing API key), writes
 * a row to admin_alerts so the admin UI surfaces the alert on next load.
 *
 * This is the only durable path for sub-cancel + payment-failed signals —
 * losing one of these to a transient outage means the auto-switch-to-
 * tout-a-toi happens silently. The alerts table is the safety net.
 */
async function maybeNotifyAdmin(env: Env, request: Request, body: string): Promise<void> {
  const to = primaryAdminEmail(env.ADMIN_EMAILS)
  let emailDelivered = false
  if (to && env.RESEND_API_KEY) {
    try {
      const lang = await getLang(env.DB, to)
      const origin = new URL(request.url).origin
      emailDelivered = (await sendAdminAlert(env, to, origin, body, lang)).ok
    } catch (err) {
      console.error('admin notify failed', err)
    }
  }
  // Durable fallback: write to admin_alerts whenever email did not land.
  // Insert is best-effort — a D1 failure here just falls back to the log.
  if (!emailDelivered) {
    try {
      const id = `alrt_${randomTokenB64url(10)}`
      const now = Math.floor(Date.now() / 1000)
      await env.DB.prepare(
        `INSERT INTO admin_alerts (id, kind, body, created_at) VALUES (?, 'stripe', ?, ?)`,
      )
        .bind(id, body, now)
        .run()
    } catch (err) {
      console.error('admin_alerts insert failed', err)
    }
  }
}
