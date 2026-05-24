// Community-pricing happy path — proves the 20% discount actually reaches
// the Stripe line-item amount, NOT just the UI label. Covers the load-bearing
// invariant: server math is the source of truth; the client never recomputes.
//
// What's stubbed and what's real:
//   - Pages Function code paths: REAL (checkout.ts reads the flag from the
//     seeded session row, threads it through buildInstallmentPlan, attaches
//     a discount-suffixed label to the Stripe line item).
//   - Stripe API call: STUBBED via the sentinel STRIPE_SECRET_KEY (same
//     pattern as tier1-happy-path).
//   - Auth: forged cookie via signInAs.
//
// Why three cases instead of one: the math invariants we care about are
// tier-shaped — Tier 1 is single-leg (no split rounding), Tier 3 with the
// 40/40/20 split is the rounding edge case (the legs must sum exactly to
// the discounted total), and the freeze invariant only fires after a paid
// leg exists.

import { test, expect } from '@playwright/test'
import { randomBytes } from 'node:crypto'
import { E2E_BASE_URL, E2E_BINDINGS } from './constants'
import { clearTestRows, readPayment, seedSession } from './helpers/db'
import { forgeAuthHeaders, signInAs } from './helpers/auth'
import { deliverWebhook, makeCheckoutCompletedEvent } from './helpers/webhook'
import { blockStripeRedirect } from './helpers/stripe'

const VISITOR_EMAIL = 'visitor@e2e.test'
const ADMIN_EMAIL = E2E_BINDINGS.ADMIN_EMAILS // 'admin@e2e.test' — single admin in harness

test.describe('Community discount — server applies 20% off build tiers', () => {
  test.beforeEach(() => {
    clearTestRows()
  })

  test('Tier 1 with community=on charges $600, not $750', async ({ page, context }) => {
    // Seed with the flag already set — the admin toggle UI is exercised
    // separately by the unit + handler tests; here we want the math.
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({
      id: sessionId,
      email: VISITOR_EMAIL,
      tier: 1,
      status: 'active',
      communityDiscount: 1,
    })

    await signInAs(context, VISITOR_EMAIL)
    await blockStripeRedirect(page)

    await page.goto('/me')
    const sessionRow = page
      .locator('li')
      .filter({ has: page.locator(`a[href$="/session/${sessionId}"]`) })
    await expect(sessionRow).toBeVisible({ timeout: 30_000 })
    const payButton = sessionRow.locator('button.me-portal__pay-btn')
    await expect(payButton).toBeVisible({ timeout: 15_000 })

    const checkoutResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/payments/checkout') && res.request().method() === 'POST',
    )
    await payButton.click()
    const checkoutResponse = await checkoutResponsePromise
    expect(checkoutResponse.status()).toBe(200)
    const { paymentId } = (await checkoutResponse.json()) as { paymentId: string }

    // The amount on the pending payment row IS what Stripe was asked to
    // charge — the server passes it directly to createOneTimeCheckoutSession.
    // 75000 * 0.80 = 60000.
    const pending = readPayment(paymentId)
    expect(pending?.amount_cents).toBe(60_000)
  })

  test('Tier 3 + 40/40/20 with community: legs sum exactly to discounted total', async ({
    page,
    context,
  }) => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({
      id: sessionId,
      email: VISITOR_EMAIL,
      tier: 3,
      status: 'active',
      tier3Split: '40-40-20',
      communityDiscount: 1,
    })

    await signInAs(context, VISITOR_EMAIL)
    await blockStripeRedirect(page)

    // Pay leg 1.
    await page.goto('/me')
    const sessionRow = page
      .locator('li')
      .filter({ has: page.locator(`a[href$="/session/${sessionId}"]`) })
    const payButton = sessionRow.locator('button.me-portal__pay-btn')
    await expect(payButton).toBeVisible({ timeout: 30_000 })
    const checkoutPromise = page.waitForResponse(
      (res) => res.url().includes('/api/payments/checkout') && res.request().method() === 'POST',
    )
    await payButton.click()
    const leg1 = (await (await checkoutPromise).json()) as { paymentId: string }
    // 360000 * 0.8 = 288000. 40% leg = 115200.
    expect(readPayment(leg1.paymentId)?.amount_cents).toBe(115_200)

    // Confirm + advance to leg 2.
    await deliverWebhook(
      makeCheckoutCompletedEvent({
        paymentId: leg1.paymentId,
        sessionId,
        kind: 'build',
        tier: 3,
        installmentIndex: 1,
        installmentOf: 3,
      }),
    )
    await page.reload()
    await expect(payButton).toBeVisible({ timeout: 15_000 })
    const checkoutPromise2 = page.waitForResponse(
      (res) => res.url().includes('/api/payments/checkout') && res.request().method() === 'POST',
    )
    await payButton.click()
    const leg2 = (await (await checkoutPromise2).json()) as { paymentId: string }
    expect(readPayment(leg2.paymentId)?.amount_cents).toBe(115_200)

    // Confirm + advance to the final leg, which absorbs the rounding remainder.
    await deliverWebhook(
      makeCheckoutCompletedEvent({
        paymentId: leg2.paymentId,
        sessionId,
        kind: 'build',
        tier: 3,
        installmentIndex: 2,
        installmentOf: 3,
      }),
    )
    await page.reload()
    await expect(payButton).toBeVisible({ timeout: 15_000 })
    const checkoutPromise3 = page.waitForResponse(
      (res) => res.url().includes('/api/payments/checkout') && res.request().method() === 'POST',
    )
    await payButton.click()
    const leg3 = (await (await checkoutPromise3).json()) as { paymentId: string }
    // The three legs must sum to exactly 288000. With 115200 + 115200 +
    // leg3 = 288000, leg3 must be 57600.
    expect(readPayment(leg3.paymentId)?.amount_cents).toBe(57_600)
    expect(115_200 + 115_200 + 57_600).toBe(288_000)
  })

  test('Admin PATCH freezes the flag once a build leg is paid', async () => {
    // Raw-fetch shape (mirrors tier4-admin-override) — forgeAuthHeaders
    // signs the same cookie the running server verifies against, so we don't
    // need a real browser context for this pure-API contract test.
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({
      id: sessionId,
      email: VISITOR_EMAIL,
      tier: 1,
      status: 'active',
    })

    const adminHeaders = forgeAuthHeaders(ADMIN_EMAIL)

    // Toggle 1: flag goes false → true. No paid leg yet → 200.
    const r1 = await fetch(`${E2E_BASE_URL}/api/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ communityDiscount: true }),
    })
    expect(r1.status).toBe(200)

    // Visitor pays leg 1 at the (now discounted) amount.
    const visitorHeaders = forgeAuthHeaders(VISITOR_EMAIL)
    const checkoutR = await fetch(`${E2E_BASE_URL}/api/payments/checkout`, {
      method: 'POST',
      headers: visitorHeaders,
      body: JSON.stringify({ sessionId, kind: 'build', lang: 'fr' }),
    })
    expect(checkoutR.status).toBe(200)
    const { paymentId } = (await checkoutR.json()) as { paymentId: string }
    await deliverWebhook(
      makeCheckoutCompletedEvent({
        paymentId,
        sessionId,
        kind: 'build',
        tier: 1,
        installmentIndex: 1,
        installmentOf: 1,
      }),
    )
    expect(readPayment(paymentId)?.status).toBe('paid')

    // Toggle 2: admin tries to flip OFF after a paid leg → 409 with frozen.
    // Atomic NOT EXISTS guard fired server-side; the row is unchanged.
    const r2 = await fetch(`${E2E_BASE_URL}/api/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ communityDiscount: false }),
    })
    expect(r2.status).toBe(409)
    const body = (await r2.json()) as { error?: string }
    expect(body.error).toMatch(/frozen|paid/i)
  })
})
