// Scoping flow + credit on first build leg. Drives the full loop the
// manual smoke test "Scoping report applied as credit" bullet covers.
//
// The credit math lives in checkout.ts L191-201: when nextIndex === 1, sum
// the session's paid scoping rows and subtract from leg-1 (clamped at the
// 50¢ Stripe floor). Three guarantees worth pinning:
//
//   1. Paying scoping mints a row that flips to 'paid' on webhook.
//   2. A second scoping POST while one is already paid → 409 (single $250).
//   3. The next build leg-1 is debited (75_000 - 25_000 = 50_000 for Tier 1).
//      Later legs are NOT credited — only nextIndex === 1.

import { test, expect } from '@playwright/test'
import { randomBytes } from 'node:crypto'
import { E2E_BASE_URL } from './constants'
import { forgeAuthHeaders } from './helpers/auth'
import { clearTestRows, readPayment, seedSession } from './helpers/db'
import { deliverWebhook, makeCheckoutCompletedEvent } from './helpers/webhook'

const VISITOR_EMAIL = 'visitor-scoping@e2e.test'

async function postCheckout(headers: Record<string, string>, body: object): Promise<Response> {
  return await fetch(`${E2E_BASE_URL}/api/payments/checkout`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

test.describe('scoping flow + credit on first build leg', () => {
  test.beforeEach(() => clearTestRows())

  test('pay scoping → credit applied to Tier 2 leg-1 only', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionId, email: VISITOR_EMAIL, tier: 2 })
    const headers = forgeAuthHeaders(VISITOR_EMAIL)

    // ── pay scoping ─────────────────────────────────────────────────────
    const scopingRes = await postCheckout(headers, { sessionId, kind: 'scoping' })
    expect(scopingRes.status).toBe(200)
    const scoping = (await scopingRes.json()) as { paymentId: string }
    expect(readPayment(scoping.paymentId)?.amount_cents).toBe(25_000)

    const wh = await deliverWebhook(
      makeCheckoutCompletedEvent({
        paymentId: scoping.paymentId,
        sessionId,
        kind: 'scoping',
      }),
    )
    expect(wh.status).toBe(200)
    expect(readPayment(scoping.paymentId)?.status).toBe('paid')

    // ── second scoping POST is rejected ─────────────────────────────────
    const dup = await postCheckout(headers, { sessionId, kind: 'scoping' })
    expect(dup.status).toBe(409)

    // ── build leg-1 is credited (Tier 2 leg = $900 - $250 = $650) ───────
    const leg1Res = await postCheckout(headers, { sessionId, kind: 'build' })
    expect(leg1Res.status).toBe(200)
    const leg1 = (await leg1Res.json()) as { paymentId: string }
    const leg1Row = readPayment(leg1.paymentId)
    expect(leg1Row?.amount_cents).toBe(90_000 - 25_000)
    expect(leg1Row?.installment_index).toBe(1)

    // Pay leg 1 so the next checkout advances to leg 2.
    const whLeg1 = await deliverWebhook(
      makeCheckoutCompletedEvent({
        paymentId: leg1.paymentId,
        sessionId,
        kind: 'build',
        tier: 2,
        installmentIndex: 1,
        installmentOf: 2,
      }),
    )
    expect(whLeg1.status).toBe(200)

    // ── leg-2 is NOT credited ───────────────────────────────────────────
    const leg2Res = await postCheckout(headers, { sessionId, kind: 'build' })
    expect(leg2Res.status).toBe(200)
    const leg2 = (await leg2Res.json()) as { paymentId: string }
    const leg2Row = readPayment(leg2.paymentId)
    expect(leg2Row?.amount_cents).toBe(90_000) // full $900, no credit
    expect(leg2Row?.installment_index).toBe(2)
  })
})
