// Negative-space coverage of POST /api/payments/webhook. The happy-path
// specs (tier1, tier2) only exercise the "loop closes" side — these prove
// the gate actually rejects the things it should.
//
// Two cases here, both real production failure modes Stripe exhibits:
//   1. Signature mismatch (rotating keys, wrong endpoint, prod webhook
//      pointed at staging) — must 401 + leave DB untouched.
//   2. Stripe retry of an already-processed event.id — must short-circuit
//      at the dedupe table without re-mutating the row or re-firing side
//      effects (admin emails on a retry storm would page Marc 12 times).

import { test, expect } from '@playwright/test'
import { randomBytes } from 'node:crypto'
import {
  clearTestRows,
  countWebhookEvents,
  readPayment,
  seedPendingPayment,
  seedSession,
} from './helpers/db'
import { deliverWebhook, makeCheckoutCompletedEvent } from './helpers/webhook'

const VISITOR_EMAIL = 'visitor-webhook@e2e.test'

test.describe('webhook rejections', () => {
  test.beforeEach(() => clearTestRows())

  test('signature signed with wrong secret → 401, no DB writes', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    const paymentId = `pay_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionId, email: VISITOR_EMAIL, tier: 1 })
    seedPendingPayment({ paymentId, sessionId, amountCents: 75_000 })

    const event = makeCheckoutCompletedEvent({
      paymentId,
      sessionId,
      kind: 'build',
      tier: 1,
    })
    const response = await deliverWebhook(event, { secretOverride: 'whsec_wrong_key' })
    expect(response.status).toBe(401)

    // Row must still be pending — the rejection happens BEFORE any handler
    // runs, so no UPDATE statement reached payments.
    const row = readPayment(paymentId)
    expect(row?.status).toBe('pending')
    expect(row?.paid_at).toBeNull()

    // Dedupe table must also be untouched. Recording the event_id on a
    // signature-failed POST would make a subsequent legitimate retry of the
    // same id silently short-circuit (we'd lose the payment).
    expect(countWebhookEvents(event.id as string)).toBe(0)
  })

  test('missing Stripe-Signature header → 401', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    const paymentId = `pay_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionId, email: VISITOR_EMAIL, tier: 1 })
    seedPendingPayment({ paymentId, sessionId })

    const response = await deliverWebhook(
      makeCheckoutCompletedEvent({ paymentId, sessionId, kind: 'build', tier: 1 }),
      { signatureOverride: '' },
    )
    expect(response.status).toBe(401)
    expect(readPayment(paymentId)?.status).toBe('pending')
  })

  test('replayed event.id is idempotent (200 + duplicate=true, no double mutation)', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    const paymentId = `pay_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionId, email: VISITOR_EMAIL, tier: 1 })
    seedPendingPayment({ paymentId, sessionId, amountCents: 75_000 })

    // Build ONE event object so the second delivery has an identical event.id.
    // (makeCheckoutCompletedEvent stamps `Date.now()` into the id — calling
    // it twice would mint different ids and bypass the dedupe.)
    const event = makeCheckoutCompletedEvent({
      paymentId,
      sessionId,
      kind: 'build',
      tier: 1,
    })

    const first = await deliverWebhook(event)
    expect(first.status).toBe(200)
    const firstBody = (await first.json()) as { received: boolean; duplicate?: boolean }
    expect(firstBody.received).toBe(true)
    expect(firstBody.duplicate).toBeUndefined()

    const paidAfterFirst = readPayment(paymentId)
    expect(paidAfterFirst?.status).toBe('paid')
    const paidAtAfterFirst = paidAfterFirst?.paid_at
    expect(paidAtAfterFirst).toBeGreaterThan(0)
    expect(countWebhookEvents(event.id as string)).toBe(1)

    // Second delivery — same event.id. Handler must short-circuit at the
    // INSERT OR IGNORE without re-running the side-effect block.
    const second = await deliverWebhook(event)
    expect(second.status).toBe(200)
    const secondBody = (await second.json()) as { received: boolean; duplicate?: boolean }
    expect(secondBody.duplicate).toBe(true)

    // Row must be unchanged. COALESCE in the UPDATE would also keep paid_at
    // stable, but the dedupe runs before that — so this assertion is the
    // contract that side effects (admin emails, visitor prompts) didn't
    // re-fire, even though we can't directly see "no email sent" from here.
    const paidAfterSecond = readPayment(paymentId)
    expect(paidAfterSecond?.status).toBe('paid')
    expect(paidAfterSecond?.paid_at).toBe(paidAtAfterFirst)
    expect(countWebhookEvents(event.id as string)).toBe(1)
  })
})
