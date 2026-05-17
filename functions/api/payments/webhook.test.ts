/**
 * Stripe webhook handler tests — focused on the new Tier-2 deposit auto-
 * prompt path. Idempotency is load-bearing: a re-delivered Stripe event
 * MUST update the payments row exactly once and send the visitor email
 * exactly once. Stripe routinely retries webhooks, so this matters in prod.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as StripeLib from '../../_lib/stripe'
import { makeMockEnv } from '../../../tests/d1-mock'

// Bypass HMAC verification for tests — we trust the raw body and exercise
// the dispatch + handler path. Re-export everything else from the real
// module so StripeEvent / StripeObject types continue to resolve.
vi.mock('../../_lib/stripe', async () => {
  const real = await vi.importActual<typeof StripeLib>('../../_lib/stripe')
  return {
    ...real,
    verifyWebhookSignature: vi.fn().mockResolvedValue(true),
  }
})

vi.mock('../../_lib/email', () => ({
  sendTier2DepositReceiptAndFinalPrompt: vi.fn().mockResolvedValue(true),
}))

import * as email from '../../_lib/email'
import { onRequestPost } from './webhook'

beforeEach(() => {
  vi.clearAllMocks()
})

function buildEnv() {
  return makeMockEnv({
    STRIPE_WEBHOOK_SECRET: 'whsec_test',
  })
}

function buildWebhookRequest(payload: unknown): Request {
  return new Request('https://portal.test/api/payments/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // Real header is unused — verifyWebhookSignature is mocked to true.
      'Stripe-Signature': 't=123,v1=stub',
    },
    body: JSON.stringify(payload),
  })
}

function checkoutCompletedEvent(opts: {
  paymentId: string
  sessionId: string
  kind: string
  lang?: 'fr' | 'en'
}) {
  return {
    id: 'evt_test',
    type: 'checkout.session.completed',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: 'cs_test_xxx',
        object: 'checkout.session',
        client_reference_id: opts.paymentId,
        payment_intent: 'pi_test',
        customer: 'cus_test',
        metadata: {
          payment_id: opts.paymentId,
          session_id: opts.sessionId,
          kind: opts.kind,
          ...(opts.lang ? { lang: opts.lang } : {}),
        },
      },
    },
  }
}

function seedSessionAndPayment(env: ReturnType<typeof buildEnv>, opts: { kind: string }) {
  const sessionId = 'sess_t2_test'
  const paymentId = 'pay_t2_test'
  env._db.sessions.set(sessionId, {
    id: sessionId,
    email: 'visitor@example.com',
    intake_json: null,
    status: 'active',
    created_at: 1700000000,
    updated_at: 1700000000,
    deleted_at: null,
    status_history: null,
    showcased_at: null,
    showcase_title: null,
    showcase_tagline: null,
  })
  env._db.payments.set(paymentId, {
    id: paymentId,
    session_id: sessionId,
    kind: opts.kind,
    amount_cents: 75000,
    currency: 'cad',
    status: 'pending',
    stripe_checkout_session_id: 'cs_test_xxx',
    stripe_payment_intent_id: null,
    stripe_subscription_id: null,
    stripe_invoice_id: null,
    stripe_customer_id: null,
    created_at: 1700000000,
    paid_at: null,
  })
  return { sessionId, paymentId }
}

describe('POST /api/payments/webhook — tier2-deposit auto-prompt', () => {
  it('sends the final-prompt email exactly once on first transition', async () => {
    const env = buildEnv()
    const { paymentId, sessionId } = seedSessionAndPayment(env, { kind: 'tier2-deposit' })

    const ctx = {
      request: buildWebhookRequest(
        checkoutCompletedEvent({ paymentId, sessionId, kind: 'tier2-deposit', lang: 'fr' }),
      ),
      env,
      params: {},
    }
    const res = await onRequestPost(ctx as never)
    expect(res.status).toBe(200)

    // Email fired once with the right shape.
    expect(email.sendTier2DepositReceiptAndFinalPrompt).toHaveBeenCalledOnce()
    const call = (email.sendTier2DepositReceiptAndFinalPrompt as ReturnType<typeof vi.fn>).mock
      .calls[0]
    expect(call?.[0]).toBe('test-key') // apiKey
    expect(call?.[1]).toBe('visitor@example.com')
    expect(call?.[2]).toBe(sessionId)
    expect(call?.[3]).toBe('https://portal.test')
    expect(call?.[4]).toBe('fr')

    // Row went from pending → paid, paid_at set.
    expect(env._db.payments.get(paymentId)?.status).toBe('paid')
    expect(env._db.payments.get(paymentId)?.paid_at).toBeGreaterThan(0)
  })

  it('does NOT send the email on a Stripe retry (paid_at already set)', async () => {
    const env = buildEnv()
    const { paymentId, sessionId } = seedSessionAndPayment(env, { kind: 'tier2-deposit' })
    const event = checkoutCompletedEvent({
      paymentId,
      sessionId,
      kind: 'tier2-deposit',
      lang: 'fr',
    })

    // First delivery — email fires.
    await onRequestPost({
      request: buildWebhookRequest(event),
      env,
      params: {},
    } as never)
    expect(email.sendTier2DepositReceiptAndFinalPrompt).toHaveBeenCalledOnce()

    // Second delivery (same event id, Stripe retry) — must NOT fire again.
    await onRequestPost({
      request: buildWebhookRequest(event),
      env,
      params: {},
    } as never)
    expect(email.sendTier2DepositReceiptAndFinalPrompt).toHaveBeenCalledOnce()
  })

  it('defaults lang=fr when metadata.lang is missing', async () => {
    const env = buildEnv()
    const { paymentId, sessionId } = seedSessionAndPayment(env, { kind: 'tier2-deposit' })

    await onRequestPost({
      request: buildWebhookRequest(
        checkoutCompletedEvent({ paymentId, sessionId, kind: 'tier2-deposit' }),
      ),
      env,
      params: {},
    } as never)

    const call = (email.sendTier2DepositReceiptAndFinalPrompt as ReturnType<typeof vi.fn>).mock
      .calls[0]
    expect(call?.[4]).toBe('fr')
  })

  it('routes en when metadata.lang === "en"', async () => {
    const env = buildEnv()
    const { paymentId, sessionId } = seedSessionAndPayment(env, { kind: 'tier2-deposit' })

    await onRequestPost({
      request: buildWebhookRequest(
        checkoutCompletedEvent({ paymentId, sessionId, kind: 'tier2-deposit', lang: 'en' }),
      ),
      env,
      params: {},
    } as never)

    const call = (email.sendTier2DepositReceiptAndFinalPrompt as ReturnType<typeof vi.fn>).mock
      .calls[0]
    expect(call?.[4]).toBe('en')
  })

  it('does NOT send the email for tier1 payments', async () => {
    const env = buildEnv()
    const { paymentId, sessionId } = seedSessionAndPayment(env, { kind: 'tier1' })

    await onRequestPost({
      request: buildWebhookRequest(
        checkoutCompletedEvent({ paymentId, sessionId, kind: 'tier1', lang: 'fr' }),
      ),
      env,
      params: {},
    } as never)

    expect(email.sendTier2DepositReceiptAndFinalPrompt).not.toHaveBeenCalled()
    // Row still went paid.
    expect(env._db.payments.get(paymentId)?.status).toBe('paid')
  })

  it('does NOT send the email when RESEND_API_KEY is unset', async () => {
    const env = makeMockEnv({
      STRIPE_WEBHOOK_SECRET: 'whsec_test',
      RESEND_API_KEY: undefined,
    })
    const sessionId = 'sess_no_resend'
    const paymentId = 'pay_no_resend'
    env._db.sessions.set(sessionId, {
      id: sessionId,
      email: 'v@example.com',
      intake_json: null,
      status: 'active',
      created_at: 0,
      updated_at: 0,
      deleted_at: null,
      status_history: null,
      showcased_at: null,
      showcase_title: null,
      showcase_tagline: null,
    })
    env._db.payments.set(paymentId, {
      id: paymentId,
      session_id: sessionId,
      kind: 'tier2-deposit',
      amount_cents: 75000,
      currency: 'cad',
      status: 'pending',
      stripe_checkout_session_id: null,
      stripe_payment_intent_id: null,
      stripe_subscription_id: null,
      stripe_invoice_id: null,
      stripe_customer_id: null,
      created_at: 0,
      paid_at: null,
    })

    await onRequestPost({
      request: buildWebhookRequest(
        checkoutCompletedEvent({ paymentId, sessionId, kind: 'tier2-deposit', lang: 'fr' }),
      ),
      env,
      params: {},
    } as never)

    expect(email.sendTier2DepositReceiptAndFinalPrompt).not.toHaveBeenCalled()
    // The row still transitions even without email — the email is a side effect.
    expect(env._db.payments.get(paymentId)?.status).toBe('paid')
  })

  it('returns 401 on bad signature', async () => {
    const stripeMod = await import('../../_lib/stripe')
    ;(stripeMod.verifyWebhookSignature as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false)
    const env = buildEnv()
    const res = await onRequestPost({
      request: buildWebhookRequest({ id: 'x', type: 'checkout.session.completed', data: { object: {} } }),
      env,
      params: {},
    } as never)
    expect(res.status).toBe(401)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Event dedupe — webhook_events table short-circuits Stripe retries before
// any handler runs. Without it, the partial-refund handler below would
// double-count refunded_amount_cents on a retried event.
// ────────────────────────────────────────────────────────────────────────────

describe('POST /api/payments/webhook — event dedupe', () => {
  it('short-circuits a second arrival of the same event.id with { duplicate: true }', async () => {
    const env = buildEnv()
    const { paymentId, sessionId } = seedSessionAndPayment(env, { kind: 'tier1' })
    const event = checkoutCompletedEvent({ paymentId, sessionId, kind: 'tier1', lang: 'fr' })

    const first = await onRequestPost({
      request: buildWebhookRequest(event),
      env,
      params: {},
    } as never)
    expect(first.status).toBe(200)
    expect(env._db.webhook_events.size).toBe(1)
    expect(env._db.webhook_events.has('evt_test')).toBe(true)

    const second = await onRequestPost({
      request: buildWebhookRequest(event),
      env,
      params: {},
    } as never)
    expect(second.status).toBe(200)
    const body = (await second.json()) as { received: boolean; duplicate?: boolean }
    expect(body.duplicate).toBe(true)
    // Still just one row — the second event was ignored.
    expect(env._db.webhook_events.size).toBe(1)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// charge.refunded — partial vs full. Status only flips to 'refunded' on
// full; partial leaves status='paid' and only updates refunded_amount_cents.
// ────────────────────────────────────────────────────────────────────────────

function chargeRefundedEvent(opts: {
  eventId: string
  paymentIntent: string
  amountRefunded: number
}) {
  return {
    id: opts.eventId,
    type: 'charge.refunded',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: 'ch_test',
        object: 'charge',
        payment_intent: opts.paymentIntent,
        amount_refunded: opts.amountRefunded,
      },
    },
  }
}

function seedPaidPayment(
  env: ReturnType<typeof buildEnv>,
  opts: { paymentIntent: string; amountCents: number },
) {
  const sessionId = 'sess_refund'
  const paymentId = 'pay_refund'
  env._db.sessions.set(sessionId, {
    id: sessionId,
    email: 'v@example.com',
    intake_json: null,
    status: 'active',
    created_at: 1700000000,
    updated_at: 1700000000,
    deleted_at: null,
    status_history: null,
    showcased_at: null,
    showcase_title: null,
    showcase_tagline: null,
  })
  env._db.payments.set(paymentId, {
    id: paymentId,
    session_id: sessionId,
    kind: 'tier2-deposit',
    amount_cents: opts.amountCents,
    currency: 'cad',
    status: 'paid',
    stripe_checkout_session_id: null,
    stripe_payment_intent_id: opts.paymentIntent,
    stripe_subscription_id: null,
    stripe_invoice_id: null,
    stripe_customer_id: null,
    created_at: 1700000000,
    paid_at: 1700000010,
  })
  return { paymentId, sessionId }
}

describe('POST /api/payments/webhook — charge.refunded', () => {
  it('partial refund: updates refunded_amount_cents but leaves status=paid', async () => {
    const env = buildEnv()
    const { paymentId } = seedPaidPayment(env, {
      paymentIntent: 'pi_partial',
      amountCents: 150000, // $1500
    })

    await onRequestPost({
      request: buildWebhookRequest(
        chargeRefundedEvent({
          eventId: 'evt_partial',
          paymentIntent: 'pi_partial',
          amountRefunded: 10000, // $100 partial
        }),
      ),
      env,
      params: {},
    } as never)

    const row = env._db.payments.get(paymentId)!
    expect(row.status).toBe('paid')
    expect(row.refunded_amount_cents).toBe(10000)
    expect(row.refunded_at).toBeFalsy()
  })

  it('full refund: flips status=refunded and stamps refunded_at', async () => {
    const env = buildEnv()
    const { paymentId } = seedPaidPayment(env, {
      paymentIntent: 'pi_full',
      amountCents: 30000, // $300
    })

    await onRequestPost({
      request: buildWebhookRequest(
        chargeRefundedEvent({
          eventId: 'evt_full',
          paymentIntent: 'pi_full',
          amountRefunded: 30000,
        }),
      ),
      env,
      params: {},
    } as never)

    const row = env._db.payments.get(paymentId)!
    expect(row.status).toBe('refunded')
    expect(row.refunded_amount_cents).toBe(30000)
    expect(row.refunded_at).toBeGreaterThan(0)
  })

  it('refund for an unknown payment_intent is a no-op (out-of-band charge)', async () => {
    const env = buildEnv()
    seedPaidPayment(env, { paymentIntent: 'pi_known', amountCents: 30000 })

    const res = await onRequestPost({
      request: buildWebhookRequest(
        chargeRefundedEvent({
          eventId: 'evt_unknown',
          paymentIntent: 'pi_does_not_exist',
          amountRefunded: 10000,
        }),
      ),
      env,
      params: {},
    } as never)
    // 200 — we don't want Stripe to retry a non-error.
    expect(res.status).toBe(200)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// admin_alerts fallback — when Resend fails (or is unreachable) on an
// operationally important event (sub-cancel, payment-failed), the alert
// must land in admin_alerts so the daily digest surfaces it.
// ────────────────────────────────────────────────────────────────────────────

describe('POST /api/payments/webhook — admin_alerts fallback', () => {
  it('writes to admin_alerts when Resend returns non-2xx', async () => {
    const env = buildEnv()
    // Seed a session with the soon-to-be-canceled sub so the handler finds it.
    env._db.sessions.set('sess_cancel', {
      id: 'sess_cancel',
      email: 'v@example.com',
      intake_json: null,
      status: 'active',
      created_at: 0,
      updated_at: 0,
      deleted_at: null,
      status_history: null,
      showcased_at: null,
      showcase_title: null,
      showcase_tagline: null,
      custodian_subscription_id: 'sub_xyz',
    })

    // Resend 503 → fall back to admin_alerts.
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('upstream error', { status: 503 }))

    await onRequestPost({
      request: buildWebhookRequest({
        id: 'evt_cancel',
        type: 'customer.subscription.deleted',
        created: Math.floor(Date.now() / 1000),
        data: { object: { id: 'sub_xyz', object: 'subscription' } },
      }),
      env,
      params: {},
    } as never)

    expect(env._db.admin_alerts.size).toBe(1)
    const alert = [...env._db.admin_alerts.values()][0]
    expect(alert.kind).toBe('stripe')
    expect(alert.body).toContain('sub_xyz')
    expect(alert.resolved_at).toBeNull()

    fetchSpy.mockRestore()
  })

  it('does NOT write to admin_alerts when Resend returns 200 (email delivered)', async () => {
    const env = buildEnv()
    env._db.sessions.set('sess_ok', {
      id: 'sess_ok',
      email: 'v@example.com',
      intake_json: null,
      status: 'active',
      created_at: 0,
      updated_at: 0,
      deleted_at: null,
      status_history: null,
      showcased_at: null,
      showcase_title: null,
      showcase_tagline: null,
      custodian_subscription_id: 'sub_ok',
    })

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }))

    await onRequestPost({
      request: buildWebhookRequest({
        id: 'evt_cancel_ok',
        type: 'customer.subscription.deleted',
        created: Math.floor(Date.now() / 1000),
        data: { object: { id: 'sub_ok', object: 'subscription' } },
      }),
      env,
      params: {},
    } as never)

    expect(env._db.admin_alerts.size).toBe(0)

    fetchSpy.mockRestore()
  })
})
