// Unknown-id paths in the webhook handler. Stripe occasionally retries old
// events after we've cleaned up rows, or fires events for charges initiated
// in the Stripe Dashboard (refunds especially). Both must 200 — anything
// else triggers Stripe's exponential-backoff retry storm.

import { test, expect } from '@playwright/test'
import { randomBytes } from 'node:crypto'
import {
  clearTestRows,
  countPendingBuildPayments,
  countWebhookEvents,
  seedSession,
} from './helpers/db'
import {
  deliverWebhook,
  makeChargeRefundedEvent,
  makeCheckoutCompletedEvent,
} from './helpers/webhook'

test.describe('webhook: unknown identifiers', () => {
  test.beforeEach(() => clearTestRows())

  test('checkout.completed with unknown client_reference_id → 200, no rows touched', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionId, email: 'visitor-unknown@e2e.test', tier: 1 })

    const event = makeCheckoutCompletedEvent({
      paymentId: 'pay_does_not_exist_999',
      sessionId,
      kind: 'build',
      tier: 1,
    })
    const res = await deliverWebhook(event)
    expect(res.status).toBe(200)

    // Even though the payment_id was bogus, the event itself was processed —
    // event_id is recorded so a Stripe retry of the same id short-circuits.
    expect(countWebhookEvents(event.id as string)).toBe(1)
    expect(countPendingBuildPayments(sessionId)).toBe(0)
  })

  test('charge.refunded for unknown payment_intent → 200, no error', async () => {
    const event = makeChargeRefundedEvent({
      paymentIntentId: 'pi_never_seen_xyz',
      amountRefunded: 100,
    })
    const res = await deliverWebhook(event)
    expect(res.status).toBe(200)
    expect(countWebhookEvents(event.id as string)).toBe(1)
  })
})
