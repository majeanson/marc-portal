// Negative-space coverage of POST /api/payments/checkout. The happy-path
// specs only show the endpoint mints a row; these prove it refuses to mint
// when it shouldn't, and that the admin-only override is actually gated.
//
//   1. Build already fully paid → second checkout returns 409 with the
//      'build already fully paid' message. Bug guard: a regression that
//      counted PENDING rows instead of PAID rows would let a Tier-1 visitor
//      pay twice.
//   2. Non-admin sends amountCadOverride on a Tier-4 (unquoted) session →
//      the override is IGNORED (not 403'd), the server falls through to
//      the persisted tier4_amount_cents path, and with no quote returns
//      409 'tier 4 not quoted yet'. The visitor cannot self-quote.
//   3. Two concurrent checkouts for the same leg both succeed (two pending
//      rows, both leg-1) — webhook for one advances the paid-counter so the
//      next checkout returns leg-2, the other stays orphaned at pending.
//      Documents the read-then-count behavior so a future "race fix" that
//      serialises mints can't ship without an intentional contract change.

import { test, expect } from '@playwright/test'
import { randomBytes } from 'node:crypto'
import { E2E_BASE_URL } from './constants'
import { forgeAuthHeaders } from './helpers/auth'
import {
  clearTestRows,
  countPendingBuildPayments,
  readPayment,
  seedPendingPayment,
  seedSession,
} from './helpers/db'
import { deliverWebhook, makeCheckoutCompletedEvent } from './helpers/webhook'

async function postCheckout(headers: Record<string, string>, body: object): Promise<Response> {
  return await fetch(`${E2E_BASE_URL}/api/payments/checkout`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

test.describe('checkout rejections', () => {
  test.beforeEach(() => clearTestRows())

  test('Tier 1 already fully paid → second checkout 409', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    const email = 'visitor-already-paid@e2e.test'
    seedSession({ id: sessionId, email, tier: 1 })

    // Short-circuit straight to "Tier 1 deposit already paid" by seeding the
    // row + delivering the webhook. Skips driving the SPA — the contract we
    // care about is the checkout endpoint's behavior post-completion.
    const paidId = `pay_e2e_${randomBytes(6).toString('hex')}`
    seedPendingPayment({ paymentId: paidId, sessionId, amountCents: 75_000 })
    const wh = await deliverWebhook(
      makeCheckoutCompletedEvent({
        paymentId: paidId,
        sessionId,
        kind: 'build',
        tier: 1,
        installmentIndex: 1,
        installmentOf: 1,
      }),
    )
    expect(wh.status).toBe(200)
    expect(readPayment(paidId)?.status).toBe('paid')

    // Now ask for another checkout on the same session. Tier 1 = single-leg
    // plan; nextIndex (2) > plan.length (1) → 409.
    const headers = forgeAuthHeaders(email)
    const res = await postCheckout(headers, { sessionId, kind: 'build' })
    expect(res.status).toBe(409)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/already fully paid/i)
  })

  test('non-admin amountCadOverride is ignored (Tier 4 no quote → 409 not 200)', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    const email = 'visitor-tier4@e2e.test'
    // Tier 4 with NO persisted quote. If the override were honored for non-
    // admins, the server would compute a plan from 5000*100 = 500_000 cents
    // and return 200. The contract is the opposite: the override is silently
    // dropped (admin-gated), tier4Cents stays null, and buildInstallmentPlan
    // returns null → 409.
    seedSession({ id: sessionId, email, tier: 4, tier4AmountCents: null })

    const headers = forgeAuthHeaders(email)
    const res = await postCheckout(headers, {
      sessionId,
      kind: 'build',
      amountCadOverride: 5_000,
    })
    expect(res.status).toBe(409)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/tier 4 not quoted yet/i)
  })

  test('non-admin override does not undercut the persisted Tier-4 quote', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    const email = 'visitor-tier4-quoted@e2e.test'
    // Admin quoted $8,000. Tier 4 splits 40/40/20, so leg 1 is $3,200.
    // A regression that honored the visitor's override (also $1,000) would
    // mint a $400 leg-1 instead — different by an order of magnitude.
    seedSession({ id: sessionId, email, tier: 4, tier4AmountCents: 800_000 })

    const headers = forgeAuthHeaders(email)
    const res = await postCheckout(headers, {
      sessionId,
      kind: 'build',
      amountCadOverride: 1_000,
    })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { paymentId: string; url: string }
    const row = readPayment(json.paymentId)
    expect(row?.amount_cents).toBe(320_000) // 40% of $8,000 = $3,200
    expect(row?.installment_index).toBe(1)
    expect(row?.installment_of).toBe(3)
  })

  test('two concurrent checkouts mint two leg-1 rows; webhook advances paid-count', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    const email = 'visitor-concurrent@e2e.test'
    seedSession({ id: sessionId, email, tier: 2 }) // 50/50 over $1,800 → two $900 legs

    const headers = forgeAuthHeaders(email)

    // Fire two checkout POSTs concurrently. Both see paid-count=0 and both
    // mint a leg-1 pending row — by design. The Stripe-side idempotency-key
    // is `checkout-${paymentId}` so distinct paymentIds mean distinct Stripe
    // sessions, but that's a separate concern from our DB-side accounting.
    const [resA, resB] = await Promise.all([
      postCheckout(headers, { sessionId, kind: 'build' }),
      postCheckout(headers, { sessionId, kind: 'build' }),
    ])
    expect(resA.status).toBe(200)
    expect(resB.status).toBe(200)
    const a = (await resA.json()) as { paymentId: string }
    const b = (await resB.json()) as { paymentId: string }
    expect(a.paymentId).not.toBe(b.paymentId)

    // Both rows at pending, both labeled leg 1 of 2.
    expect(countPendingBuildPayments(sessionId)).toBe(2)
    expect(readPayment(a.paymentId)?.amount_cents).toBe(90_000)
    expect(readPayment(b.paymentId)?.amount_cents).toBe(90_000)

    // Deliver the webhook for A. After it lands, paid-count = 1 — the next
    // checkout must return leg 2 ($900), not a third leg-1 row.
    const whA = await deliverWebhook(
      makeCheckoutCompletedEvent({
        paymentId: a.paymentId,
        sessionId,
        kind: 'build',
        tier: 2,
        installmentIndex: 1,
        installmentOf: 2,
      }),
    )
    expect(whA.status).toBe(200)
    expect(readPayment(a.paymentId)?.status).toBe('paid')
    // B was the simultaneous twin — it's orphaned but harmless (Stripe never
    // charged it; pending rows have no money-side effect).
    expect(readPayment(b.paymentId)?.status).toBe('pending')

    const resC = await postCheckout(headers, { sessionId, kind: 'build' })
    expect(resC.status).toBe(200)
    const c = (await resC.json()) as { paymentId: string }
    const cRow = readPayment(c.paymentId)
    expect(cRow?.installment_index ?? null).toBe(2)
    expect(cRow?.amount_cents).toBe(90_000)
  })
})
