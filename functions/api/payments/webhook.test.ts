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
