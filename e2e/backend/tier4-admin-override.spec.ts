// Tier 4 admin amountCadOverride happy path + range bounds. The
// negative-space spec (checkout-rejections.spec.ts) proves a non-admin's
// override is dropped; this proves an admin's actually drives the price and
// gets sanity-checked.
//
// Range: 100 ≤ dollars ≤ 100_000 (checkout.ts L167). Override is per-
// checkout — it does NOT persist to session.tier4_amount_cents. A second
// checkout without an override on the same unquoted session must still 409.

import { test, expect } from '@playwright/test'
import { randomBytes } from 'node:crypto'
import { E2E_BASE_URL, E2E_BINDINGS } from './constants'
import { forgeAuthHeaders } from './helpers/auth'
import { clearTestRows, readPayment, readSessionState, seedSession } from './helpers/db'

const ADMIN_EMAIL = E2E_BINDINGS.ADMIN_EMAILS

async function postCheckout(headers: Record<string, string>, body: object): Promise<Response> {
  return await fetch(`${E2E_BASE_URL}/api/payments/checkout`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

test.describe('Tier 4 admin amountCadOverride', () => {
  test.beforeEach(() => clearTestRows())

  test('happy path: admin override yields 40% leg-1', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({
      id: sessionId,
      email: 'visitor-t4@e2e.test',
      tier: 4,
      tier4AmountCents: null, // unquoted
    })

    const headers = forgeAuthHeaders(ADMIN_EMAIL)
    const res = await postCheckout(headers, {
      sessionId,
      kind: 'build',
      amountCadOverride: 2_000, // $2,000 → 40/40/20 → $800 / $800 / $400
    })
    expect(res.status).toBe(200)
    const { paymentId } = (await res.json()) as { paymentId: string }
    const row = readPayment(paymentId)
    expect(row?.amount_cents).toBe(80_000)
    expect(row?.installment_index).toBe(1)
    expect(row?.installment_of).toBe(3)

    // Override is per-checkout. Session row's tier4_amount_cents stays NULL.
    const sessionState = readSessionState(sessionId)
    expect(sessionState?.id).toBe(sessionId)
    // (We don't expose tier4_amount_cents on readSessionState, but the next
    //  assertion exercises the same invariant: a checkout without an
    //  override still hits the unquoted path.)
    const followUp = await postCheckout(headers, { sessionId, kind: 'build' })
    expect(followUp.status).toBe(409)
    const followUpBody = (await followUp.json()) as { error: string }
    expect(followUpBody.error).toMatch(/tier 4 not quoted yet/i)
  })

  test('override below $100 floor → 400', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionId, email: 'visitor-t4@e2e.test', tier: 4 })
    const headers = forgeAuthHeaders(ADMIN_EMAIL)
    const res = await postCheckout(headers, {
      sessionId,
      kind: 'build',
      amountCadOverride: 99,
    })
    expect(res.status).toBe(400)
  })

  test('override above $100,000 ceiling → 400', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionId, email: 'visitor-t4@e2e.test', tier: 4 })
    const headers = forgeAuthHeaders(ADMIN_EMAIL)
    const res = await postCheckout(headers, {
      sessionId,
      kind: 'build',
      amountCadOverride: 100_001,
    })
    expect(res.status).toBe(400)
  })
})
