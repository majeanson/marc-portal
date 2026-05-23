// Custodian subscription full lifecycle — the load-bearing one. The
// /handoff page makes a hard promise: when the sub stops renewing, the
// engagement auto-switches to 'Tout à toi' (visitor keeps everything,
// no surprise lockout). Verifying that promise end-to-end is what this
// spec exists for.
//
// Walked here:
//   1. POST /api/payments/checkout kind=custodian, plan=watch  →  cs_id
//   2. checkout.session.completed                              →  row 'paid',
//                                                                 session
//                                                                 custodian_status='active',
//                                                                 plan='watch',
//                                                                 sub_id cached
//   3. invoice.paid (initial)  →  row keeps id; invoice_id attached; no NEW row
//   4. invoice.paid (renewal year 2) →  NEW payments row inserted,
//                                       session.custodian_status='active'
//   5. invoice.payment_failed       →  session.custodian_status='past_due'
//                                       + admin_alert row written
//   6. invoice.paid (recovery)       →  session.custodian_status flips back
//                                       to 'active'
//   7. customer.subscription.deleted →  session.custodian_status flips to
//                                       'switched_to_tout_a_toi' + alert

import { test, expect } from '@playwright/test'
import { randomBytes } from 'node:crypto'
import { E2E_BASE_URL } from './constants'
import { forgeAuthHeaders } from './helpers/auth'
import {
  clearTestRows,
  countAdminAlertsContaining,
  readPayment,
  readPaymentByInvoiceId,
  readSessionState,
  seedSession,
} from './helpers/db'
import {
  deliverWebhook,
  makeCheckoutCompletedEvent,
  makeInvoicePaidEvent,
  makeInvoicePaymentFailedEvent,
  makeSubscriptionDeletedEvent,
} from './helpers/webhook'

const VISITOR_EMAIL = 'visitor-custodian@e2e.test'

async function postCheckout(headers: Record<string, string>, body: object): Promise<Response> {
  return await fetch(`${E2E_BASE_URL}/api/payments/checkout`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

test.describe('custodian subscription lifecycle', () => {
  test.beforeEach(() => clearTestRows())

  test('Watch plan: checkout → renew → fail → recover → cancel', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionId, email: VISITOR_EMAIL, tier: 1 })
    const headers = forgeAuthHeaders(VISITOR_EMAIL)

    // ── 1. Mint the Stripe Checkout (stubbed) ───────────────────────────
    const checkoutRes = await postCheckout(headers, {
      sessionId,
      kind: 'custodian',
      custodianPlan: 'watch',
    })
    expect(checkoutRes.status).toBe(200)
    const { paymentId, url } = (await checkoutRes.json()) as { paymentId: string; url: string }
    expect(url).toContain('e2e-stub.local')

    const pending = readPayment(paymentId)
    expect(pending?.status).toBe('pending')
    expect(pending?.kind).toBe('custodian')
    expect(pending?.amount_cents).toBe(12_000) // Watch = $120/yr

    // ── 2. Stripe redirects back; checkout.session.completed fires ──────
    const subscriptionId = `sub_test_e2e_${randomBytes(6).toString('hex')}`
    const customerId = `cus_test_e2e_${randomBytes(6).toString('hex')}`
    const wh1 = await deliverWebhook(
      makeCheckoutCompletedEvent({
        paymentId,
        sessionId,
        kind: 'custodian',
        custodianPlan: 'watch',
        subscriptionId,
        customerId,
      }),
    )
    expect(wh1.status).toBe(200)

    const paid = readPayment(paymentId)
    expect(paid?.status).toBe('paid')
    expect(paid?.stripe_subscription_id).toBe(subscriptionId)
    expect(paid?.stripe_customer_id).toBe(customerId)

    const state1 = readSessionState(sessionId)
    expect(state1?.custodian_status).toBe('active')
    expect(state1?.custodian_plan).toBe('watch')
    expect(state1?.custodian_subscription_id).toBe(subscriptionId)

    // ── 3. Initial invoice.paid attaches to the existing row (no new row) ──
    const initialInvoiceId = `in_test_initial_${randomBytes(4).toString('hex')}`
    const wh2 = await deliverWebhook(
      makeInvoicePaidEvent({
        invoiceId: initialInvoiceId,
        subscriptionId,
        customerId,
        amountPaid: 12_000,
      }),
    )
    expect(wh2.status).toBe(200)

    // The pre-existing row picked up the invoice id; no second row was
    // minted for the initial invoice (handler L235 UPDATEd in place).
    const afterInitial = readPayment(paymentId)
    expect(afterInitial?.stripe_invoice_id).toBe(initialInvoiceId)
    const initialByInvoice = readPaymentByInvoiceId(initialInvoiceId)
    expect(initialByInvoice?.id).toBe(paymentId) // same row, found via invoice lookup

    // ── 4. Year 2 renewal: new invoice.paid → NEW payments row ──────────
    const renewalInvoiceId = `in_test_renewal_${randomBytes(4).toString('hex')}`
    const wh3 = await deliverWebhook(
      makeInvoicePaidEvent({
        invoiceId: renewalInvoiceId,
        subscriptionId,
        customerId,
        amountPaid: 12_000,
      }),
    )
    expect(wh3.status).toBe(200)

    const renewal = readPaymentByInvoiceId(renewalInvoiceId)
    expect(renewal).toBeDefined()
    expect(renewal?.stripe_invoice_id).toBe(renewalInvoiceId)
    expect(renewal?.id).not.toBe(paymentId) // distinct from the initial row
    expect(renewal?.status).toBe('paid')
    expect(renewal?.stripe_subscription_id).toBe(subscriptionId)

    // ── 5. invoice.payment_failed → past_due + admin alert ──────────────
    const failedInvoiceId = `in_test_failed_${randomBytes(4).toString('hex')}`
    const wh4 = await deliverWebhook(
      makeInvoicePaymentFailedEvent({
        invoiceId: failedInvoiceId,
        subscriptionId,
        customerId,
      }),
    )
    expect(wh4.status).toBe(200)
    expect(readSessionState(sessionId)?.custodian_status).toBe('past_due')
    expect(countAdminAlertsContaining(subscriptionId)).toBeGreaterThanOrEqual(1)

    // ── 6. invoice.paid recovery → status back to active ────────────────
    const recoveryInvoiceId = `in_test_recovery_${randomBytes(4).toString('hex')}`
    const wh5 = await deliverWebhook(
      makeInvoicePaidEvent({
        invoiceId: recoveryInvoiceId,
        subscriptionId,
        customerId,
        amountPaid: 12_000,
      }),
    )
    expect(wh5.status).toBe(200)
    expect(readSessionState(sessionId)?.custodian_status).toBe('active')

    // ── 7. subscription.deleted → switched_to_tout_a_toi + alert ────────
    const alertsBefore = countAdminAlertsContaining(subscriptionId)
    const wh6 = await deliverWebhook(makeSubscriptionDeletedEvent({ subscriptionId, customerId }))
    expect(wh6.status).toBe(200)
    expect(readSessionState(sessionId)?.custodian_status).toBe('switched_to_tout_a_toi')
    expect(countAdminAlertsContaining(subscriptionId)).toBeGreaterThan(alertsBefore)
  })

  test('Care plan: checkout-time amount lands at $400/yr', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionId, email: 'visitor-care@e2e.test', tier: 1 })
    const headers = forgeAuthHeaders('visitor-care@e2e.test')

    const res = await postCheckout(headers, {
      sessionId,
      kind: 'custodian',
      custodianPlan: 'care',
    })
    expect(res.status).toBe(200)
    const { paymentId } = (await res.json()) as { paymentId: string }
    const row = readPayment(paymentId)
    expect(row?.amount_cents).toBe(40_000) // Care = $400/yr
    expect(row?.custodian_plan).toBe('care')
  })

  test('invalid custodian plan → 400', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionId, email: 'visitor-bad@e2e.test', tier: 1 })
    const headers = forgeAuthHeaders('visitor-bad@e2e.test')

    const res = await postCheckout(headers, {
      sessionId,
      kind: 'custodian',
      custodianPlan: 'bogus',
    })
    expect(res.status).toBe(400)
  })
})
