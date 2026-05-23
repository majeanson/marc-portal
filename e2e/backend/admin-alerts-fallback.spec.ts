// Durable fallback for admin-notification webhook events. When Resend is
// down (or, in our harness, keyed with a stub that returns 401), the
// maybeNotifyAdmin path in webhook.ts must write to admin_alerts so the
// daily digest cron still surfaces the event to Marc.
//
// Triggered by invoice.payment_failed and customer.subscription.deleted —
// both load-bearing for the custodian engagement. Losing either to a
// transient Resend outage is exactly what the fallback is built to prevent.

import { test, expect } from '@playwright/test'
import { randomBytes } from 'node:crypto'
import {
  clearTestRows,
  countAdminAlertsContaining,
  readSessionState,
  seedSession,
} from './helpers/db'
import {
  deliverWebhook,
  makeInvoicePaymentFailedEvent,
  makeSubscriptionDeletedEvent,
} from './helpers/webhook'

test.describe('admin_alerts durable fallback', () => {
  test.beforeEach(() => clearTestRows())

  test('invoice.payment_failed → admin_alerts row when Resend rejects', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    const subscriptionId = `sub_test_e2e_${randomBytes(6).toString('hex')}`
    seedSession({
      id: sessionId,
      email: 'visitor-pastdue@e2e.test',
      tier: 2,
      custodianSubscriptionId: subscriptionId,
      custodianStatus: 'active',
    })

    const res = await deliverWebhook(
      makeInvoicePaymentFailedEvent({
        invoiceId: `in_test_${randomBytes(4).toString('hex')}`,
        subscriptionId,
      }),
    )
    expect(res.status).toBe(200)

    // Session row should be flagged past_due.
    expect(readSessionState(sessionId)?.custodian_status).toBe('past_due')
    // And the alert landed (Resend stub returns 401 → fallback path writes
    // to admin_alerts).
    expect(countAdminAlertsContaining(subscriptionId)).toBeGreaterThanOrEqual(1)
  })

  test('subscription.deleted → admin_alerts row + session flips to switched_to_tout_a_toi', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    const subscriptionId = `sub_test_e2e_${randomBytes(6).toString('hex')}`
    seedSession({
      id: sessionId,
      email: 'visitor-canceled@e2e.test',
      tier: 2,
      custodianSubscriptionId: subscriptionId,
      custodianStatus: 'active',
    })

    const res = await deliverWebhook(makeSubscriptionDeletedEvent({ subscriptionId }))
    expect(res.status).toBe(200)
    expect(readSessionState(sessionId)?.custodian_status).toBe('switched_to_tout_a_toi')
    expect(countAdminAlertsContaining(subscriptionId)).toBeGreaterThanOrEqual(1)
  })
})
