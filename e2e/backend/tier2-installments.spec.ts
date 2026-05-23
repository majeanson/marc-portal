// Tier 2 installments — proves the two-leg flow (deposit + final) walks
// through both checkout calls and lands on "Paid" only after the second
// webhook. The server derives which leg is next by counting paid build
// rows for the session (checkout.ts ~L182), so a stale read of that
// counter would surface here as a wrong-amount leg or a double-charge of
// leg 1.
//
// Mirrors the manual RUNBOOK bullet "Tier 2: deposit clears, /me invites
// final, final clears, /me flips to Paid". The auto-prompt email after
// leg 1 (sendInstallmentClearedPrompt) is a separate concern verified in
// its own spec — keep this one focused on the loop closing twice.

import { test, expect } from '@playwright/test'
import { randomBytes } from 'node:crypto'
import { clearTestRows, readPayment, seedSession } from './helpers/db'
import { signInAs } from './helpers/auth'
import { deliverWebhook, makeCheckoutCompletedEvent } from './helpers/webhook'
import { blockStripeRedirect } from './helpers/stripe'

const VISITOR_EMAIL = 'visitor-t2@e2e.test'
const LEG_CENTS = 90_000 // Tier 2 is fixed 50/50 over $1,800.

interface CheckoutResp {
  paymentId: string
  url: string
}

test.describe('Tier 2 installments', () => {
  test.beforeEach(() => clearTestRows())

  test('deposit → final, both legs paid via separate webhooks', async ({ page, context }) => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({
      id: sessionId,
      email: VISITOR_EMAIL,
      tier: 2,
      status: 'active',
      showcaseTitle: 'e2e tier-2 fixture',
    })

    await signInAs(context, VISITOR_EMAIL)
    await blockStripeRedirect(page)
    await page.goto('/me')

    const sessionRow = page
      .locator('li')
      .filter({ has: page.locator(`a[href$="/session/${sessionId}"]`) })
    await expect(sessionRow).toBeVisible({ timeout: 30_000 })
    const payButton = sessionRow.locator('button.me-portal__pay-btn')

    // ── Leg 1 (deposit) ───────────────────────────────────────────────────
    await expect(payButton).toBeVisible({ timeout: 15_000 })
    const leg1ResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/payments/checkout') && res.request().method() === 'POST',
    )
    await payButton.click()
    const leg1Response = await leg1ResponsePromise
    expect(leg1Response.status()).toBe(200)
    const leg1 = (await leg1Response.json()) as CheckoutResp

    const leg1Pending = readPayment(leg1.paymentId)
    expect(leg1Pending?.status).toBe('pending')
    expect(leg1Pending?.amount_cents).toBe(LEG_CENTS)

    const wh1 = await deliverWebhook(
      makeCheckoutCompletedEvent({
        paymentId: leg1.paymentId,
        sessionId,
        kind: 'build',
        tier: 2,
        installmentIndex: 1,
        installmentOf: 2,
      }),
    )
    expect(wh1.status).toBe(200)
    expect(readPayment(leg1.paymentId)?.status).toBe('paid')

    // ── Leg 2 (final) ─────────────────────────────────────────────────────
    // After leg 1 lands the Pay button is still visible — it's now the
    // *next* installment. The server picks the leg by counting paid build
    // rows; we re-fetch /me so the client sees the new state too.
    await page.reload()
    await expect(payButton).toBeVisible({ timeout: 15_000 })

    const leg2ResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/payments/checkout') && res.request().method() === 'POST',
    )
    await payButton.click()
    const leg2Response = await leg2ResponsePromise
    expect(leg2Response.status()).toBe(200)
    const leg2 = (await leg2Response.json()) as CheckoutResp
    expect(leg2.paymentId).not.toBe(leg1.paymentId)

    const leg2Pending = readPayment(leg2.paymentId)
    expect(leg2Pending?.status).toBe('pending')
    expect(leg2Pending?.amount_cents).toBe(LEG_CENTS)

    const wh2 = await deliverWebhook(
      makeCheckoutCompletedEvent({
        paymentId: leg2.paymentId,
        sessionId,
        kind: 'build',
        tier: 2,
        installmentIndex: 2,
        installmentOf: 2,
      }),
    )
    expect(wh2.status).toBe(200)
    expect(readPayment(leg2.paymentId)?.status).toBe('paid')

    // ── Final state — both legs paid, /me flips to "Paid" ─────────────────
    await page.reload()
    await expect(sessionRow.locator('.me-portal__pay-paid')).toBeVisible({ timeout: 15_000 })
    await expect(sessionRow.locator('button.me-portal__pay-btn')).toHaveCount(0)
  })
})
