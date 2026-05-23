// charge.refunded handler. Stripe sends one event per refund, and
// amount_refunded is the CUMULATIVE total on the parent charge (not the
// delta of this one refund) — so two partial refunds arrive as e.g.
// {amount_refunded: 300} then {amount_refunded: 750}, where 750 is the
// total to date. webhook.ts L341 flips status only when amount_refunded
// >= amount_cents; otherwise it just updates refunded_amount_cents so the
// UI can show "partially refunded" without losing the original total.

import { test, expect } from '@playwright/test'
import { randomBytes } from 'node:crypto'
import { clearTestRows, readPayment, seedPendingPayment, seedSession } from './helpers/db'
import {
  deliverWebhook,
  makeChargeRefundedEvent,
  makeCheckoutCompletedEvent,
} from './helpers/webhook'

const VISITOR_EMAIL = 'visitor-refund@e2e.test'

async function payTier1(sessionId: string): Promise<{ paymentId: string; pi: string }> {
  // Seed + drive the loop by hand (no need for the SPA — refunds run
  // entirely server-side once a paid row exists).
  const paymentId = `pay_e2e_${randomBytes(6).toString('hex')}`
  const pi = `pi_test_e2e_${paymentId}`
  // seedPendingPayment + checkout.completed gives us the paid row with the
  // PI populated (the webhook handler sets stripe_payment_intent_id from
  // the event's payment_intent field).
  seedPendingPayment({ paymentId, sessionId, amountCents: 75_000 })
  const wh = await deliverWebhook(
    makeCheckoutCompletedEvent({
      paymentId,
      sessionId,
      kind: 'build',
      tier: 1,
      installmentIndex: 1,
      installmentOf: 1,
    }),
  )
  expect(wh.status).toBe(200)
  expect(readPayment(paymentId)?.status).toBe('paid')
  expect(readPayment(paymentId)?.stripe_payment_intent_id).toBe(pi)
  return { paymentId, pi }
}

test.describe('refunds', () => {
  test.beforeEach(() => clearTestRows())

  test('partial refund keeps status=paid, updates refunded_amount_cents', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionId, email: VISITOR_EMAIL, tier: 1 })
    const { paymentId, pi } = await payTier1(sessionId)

    // $100 refund on a $750 payment — Stripe's amount_refunded is the
    // cumulative total (10_000 cents = $100 in this single event).
    const res = await deliverWebhook(
      makeChargeRefundedEvent({ paymentIntentId: pi, amountRefunded: 10_000 }),
    )
    expect(res.status).toBe(200)

    const row = readPayment(paymentId)
    expect(row?.status).toBe('paid') // not flipped — partial only
    expect(row?.refunded_amount_cents).toBe(10_000)
    expect(row?.refunded_at).toBeNull()
  })

  test('full refund flips status to refunded + stamps refunded_at', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionId, email: VISITOR_EMAIL, tier: 1 })
    const { paymentId, pi } = await payTier1(sessionId)

    const res = await deliverWebhook(
      makeChargeRefundedEvent({ paymentIntentId: pi, amountRefunded: 75_000 }),
    )
    expect(res.status).toBe(200)

    const row = readPayment(paymentId)
    expect(row?.status).toBe('refunded')
    expect(row?.refunded_amount_cents).toBe(75_000)
    expect(row?.refunded_at).toBeGreaterThan(0)
  })

  test('partial then full: cumulative amount_refunded drives the flip', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionId, email: VISITOR_EMAIL, tier: 1 })
    const { paymentId, pi } = await payTier1(sessionId)

    // First: $300 partial — cumulative is $300.
    const first = await deliverWebhook(
      makeChargeRefundedEvent({ paymentIntentId: pi, amountRefunded: 30_000 }),
    )
    expect(first.status).toBe(200)
    expect(readPayment(paymentId)?.status).toBe('paid')
    expect(readPayment(paymentId)?.refunded_amount_cents).toBe(30_000)

    // Second: another $450 — Stripe reports cumulative $750.
    const second = await deliverWebhook(
      makeChargeRefundedEvent({ paymentIntentId: pi, amountRefunded: 75_000 }),
    )
    expect(second.status).toBe(200)
    const finalRow = readPayment(paymentId)
    expect(finalRow?.status).toBe('refunded')
    expect(finalRow?.refunded_amount_cents).toBe(75_000)
  })
})
