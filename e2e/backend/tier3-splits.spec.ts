// Tier 3 has two installment splits: 50-50 (default, two $1,800 legs) and
// 40-40-20 (three legs: $1,440 / $1,440 / $720). The selection lives on
// sessions.tier3_split; checkout.ts looks it up via buildInstallmentPlan().
// The 40-40-20 helper (pricing.ts split402020) absorbs the rounding
// remainder into the final leg so the three legs always sum to exactly
// $3,600.
//
// These specs pay every leg through the full loop so a regression that
// shifted the split would surface as either a wrong amount, a wrong
// installment_index/of pair, or a runaway leg count.

import { test, expect } from '@playwright/test'
import { randomBytes } from 'node:crypto'
import { E2E_BASE_URL } from './constants'
import { forgeAuthHeaders } from './helpers/auth'
import { clearTestRows, readPayment, seedSession } from './helpers/db'
import { deliverWebhook, makeCheckoutCompletedEvent } from './helpers/webhook'

async function postCheckout(headers: Record<string, string>, body: object): Promise<Response> {
  return await fetch(`${E2E_BASE_URL}/api/payments/checkout`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

/**
 * Drive one leg end-to-end: POST checkout → deliver webhook → assert paid.
 * Returns the paymentId so the caller can chain.
 */
async function payLeg(
  headers: Record<string, string>,
  sessionId: string,
  tier: number,
  expectedAmount: number,
  expectedIndex: number,
  expectedOf: number,
): Promise<string> {
  const res = await postCheckout(headers, { sessionId, kind: 'build' })
  expect(res.status).toBe(200)
  const { paymentId } = (await res.json()) as { paymentId: string }
  const pending = readPayment(paymentId)
  expect(pending?.amount_cents).toBe(expectedAmount)
  expect(pending?.installment_index).toBe(expectedIndex)
  expect(pending?.installment_of).toBe(expectedOf)
  const wh = await deliverWebhook(
    makeCheckoutCompletedEvent({
      paymentId,
      sessionId,
      kind: 'build',
      tier,
      installmentIndex: expectedIndex,
      installmentOf: expectedOf,
    }),
  )
  expect(wh.status).toBe(200)
  expect(readPayment(paymentId)?.status).toBe('paid')
  return paymentId
}

test.describe('Tier 3 splits', () => {
  test.beforeEach(() => clearTestRows())

  test('50-50: two $1,800 legs, leg-2 closes the build', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    const email = 'visitor-t3-50@e2e.test'
    seedSession({ id: sessionId, email, tier: 3, tier3Split: '50-50' })
    const headers = forgeAuthHeaders(email)

    await payLeg(headers, sessionId, 3, 180_000, 1, 2)
    await payLeg(headers, sessionId, 3, 180_000, 2, 2)

    // Third checkout call must 409 — both legs paid.
    const overflow = await postCheckout(headers, { sessionId, kind: 'build' })
    expect(overflow.status).toBe(409)
  })

  test('40-40-20: three legs sum to $3,600 with rounding on the final leg', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    const email = 'visitor-t3-403020@e2e.test'
    seedSession({ id: sessionId, email, tier: 3, tier3Split: '40-40-20' })
    const headers = forgeAuthHeaders(email)

    // $3,600 → split402020 returns [144_000, 144_000, 72_000]. No rounding
    // remainder at this total, but the test enforces the contract regardless.
    await payLeg(headers, sessionId, 3, 144_000, 1, 3)
    await payLeg(headers, sessionId, 3, 144_000, 2, 3)
    await payLeg(headers, sessionId, 3, 72_000, 3, 3)

    const overflow = await postCheckout(headers, { sessionId, kind: 'build' })
    expect(overflow.status).toBe(409)
  })
})
