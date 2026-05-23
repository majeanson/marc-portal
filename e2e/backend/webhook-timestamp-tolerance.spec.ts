// Stripe's signature scheme rejects events whose timestamp is more than
// `toleranceSeconds` (5 min) off `now` — the replay window. Bad clocks and
// network buffering can drift a few seconds; anything wider is a captured
// payload being re-played by an attacker.
//
// verifyWebhookSignature lives in functions/_lib/stripe.ts with the
// 300-second tolerance baked in. These cases drive both edges + the
// in-window case via the existing timestampOverride helper.

import { test, expect } from '@playwright/test'
import { randomBytes } from 'node:crypto'
import { clearTestRows, readPayment, seedPendingPayment, seedSession } from './helpers/db'
import { deliverWebhook, makeCheckoutCompletedEvent } from './helpers/webhook'

test.describe('webhook timestamp tolerance', () => {
  test.beforeEach(() => clearTestRows())

  test('ts older than 5 min → 401', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    const paymentId = `pay_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionId, email: 'visitor-ts@e2e.test', tier: 1 })
    seedPendingPayment({ paymentId, sessionId })

    const tooOld = Math.floor(Date.now() / 1000) - 600 // 10 min ago
    const res = await deliverWebhook(
      makeCheckoutCompletedEvent({ paymentId, sessionId, kind: 'build', tier: 1 }),
      { timestampOverride: tooOld },
    )
    expect(res.status).toBe(401)
    expect(readPayment(paymentId)?.status).toBe('pending')
  })

  test('ts more than 5 min in the future → 401', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    const paymentId = `pay_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionId, email: 'visitor-ts@e2e.test', tier: 1 })
    seedPendingPayment({ paymentId, sessionId })

    const tooFuture = Math.floor(Date.now() / 1000) + 600
    const res = await deliverWebhook(
      makeCheckoutCompletedEvent({ paymentId, sessionId, kind: 'build', tier: 1 }),
      { timestampOverride: tooFuture },
    )
    expect(res.status).toBe(401)
    expect(readPayment(paymentId)?.status).toBe('pending')
  })

  test('ts within 5-min window → 200', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    const paymentId = `pay_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionId, email: 'visitor-ts@e2e.test', tier: 1 })
    seedPendingPayment({ paymentId, sessionId })

    const slightlyOld = Math.floor(Date.now() / 1000) - 60 // 1 min ago
    const res = await deliverWebhook(
      makeCheckoutCompletedEvent({ paymentId, sessionId, kind: 'build', tier: 1 }),
      { timestampOverride: slightlyOld },
    )
    expect(res.status).toBe(200)
    expect(readPayment(paymentId)?.status).toBe('paid')
  })
})
