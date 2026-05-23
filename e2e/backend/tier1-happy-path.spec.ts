// Tier 1 happy path — proves the checkout → Stripe → webhook → DB → /me
// loop closes under one automated run. Replaces the manual RUNBOOK smoke
// test bullet "Tier 1 deposit clears, /me flips to Paid".
//
// What's stubbed and what's real:
//   - Pages Function code paths: REAL (checkout.ts, webhook.ts, sessions
//     listing, auth verification, D1 reads/writes).
//   - Stripe API call: STUBBED. functions/_lib/stripe.ts short-circuits on
//     the sentinel STRIPE_SECRET_KEY value and returns a deterministic
//     stub URL. No network call leaves the harness.
//   - Webhook delivery: SYNTHETIC. The helper POSTs a hand-rolled event
//     with a valid Stripe-Signature header. Same code path as production.
//   - Magic-link email: SKIPPED. The auth helper signs the session cookie
//     directly with the same SESSION_SECRET the running server verifies
//     against — the bypass exists only because SESSION_SECRET is a stub
//     value, never a production secret.

import { test, expect } from '@playwright/test'
import { randomBytes } from 'node:crypto'
import { clearTestRows, readPayment, seedSession } from './helpers/db'
import { signInAs } from './helpers/auth'
import { deliverWebhook, makeCheckoutCompletedEvent } from './helpers/webhook'
import { blockStripeRedirect } from './helpers/stripe'

const VISITOR_EMAIL = 'visitor@e2e.test'

test.describe('Tier 1 happy path', () => {
  test.beforeEach(() => {
    // Per-test wipe: previous runs may have left rows under the same id
    // patterns (test reruns within one webServer lifetime).
    clearTestRows()
  })

  test('Pay → webhook → /me flips to Paid', async ({ page, context }) => {
    // 1. Seed a session ready for the deposit click. tier=1 is a single-leg
    //    build ($750) — buildInstallmentPlan returns [75000] (cents).
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({
      id: sessionId,
      email: VISITOR_EMAIL,
      tier: 1,
      status: 'active',
      showcaseTitle: 'e2e tier-1 fixture',
    })

    // 2. Forge the auth cookies — the server verifies them with the same
    //    SESSION_SECRET passed to wrangler via -b.
    await signInAs(context, VISITOR_EMAIL)

    // 3. Block the (stubbed) Stripe redirect so the browser doesn't try to
    //    resolve e2e-stub.local on click.
    await blockStripeRedirect(page)

    // 4. Land on /me. The portal lazy-loads MePortal; wait for the session
    //    row hydration + the payments summary fetch to land by anchoring on
    //    the per-session list item, then dig into its compact-variant
    //    PaymentActions (a <div>, not the full-variant <section>).
    await page.goto('/me')
    const sessionRow = page
      .locator('li')
      .filter({ has: page.locator(`a[href$="/session/${sessionId}"]`) })
    await expect(sessionRow).toBeVisible({ timeout: 30_000 })
    const payButton = sessionRow.locator('button.me-portal__pay-btn')
    await expect(payButton).toBeVisible({ timeout: 15_000 })

    // 5. Click Pay. Capture the checkout response so we can pull the
    //    server-minted payment id out of it.
    const checkoutResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/payments/checkout') && res.request().method() === 'POST',
    )
    await payButton.click()
    const checkoutResponse = await checkoutResponsePromise
    expect(checkoutResponse.status()).toBe(200)
    const { paymentId, url: stripeUrl } = (await checkoutResponse.json()) as {
      paymentId: string
      url: string
    }
    expect(paymentId).toMatch(/^pay_/)
    expect(stripeUrl).toContain('e2e-stub.local')

    // 6. Confirm the DB row is at status='pending' before the webhook fires
    //    — this is the state a real visitor would be parked at if they
    //    closed the Stripe tab.
    const pending = readPayment(paymentId)
    expect(pending?.status).toBe('pending')
    expect(pending?.kind).toBe('build')
    expect(pending?.amount_cents).toBe(75000) // Tier 1 = $750

    // 7. Synthesize the checkout.session.completed event Stripe would POST.
    const webhookResponse = await deliverWebhook(
      makeCheckoutCompletedEvent({
        paymentId,
        sessionId,
        kind: 'build',
        tier: 1,
        installmentIndex: 1,
        installmentOf: 1,
      }),
    )
    expect(webhookResponse.status).toBe(200)

    // 8. DB should now show paid.
    const paid = readPayment(paymentId)
    expect(paid?.status).toBe('paid')
    expect(paid?.paid_at).toBeGreaterThan(0)

    // 9. Refresh /me. The pay button is gone; the Paid pill is up. This is
    //    the visitor-visible end of the loop the RUNBOOK manually verifies.
    await page.reload()
    await expect(sessionRow.locator('.me-portal__pay-paid')).toBeVisible({ timeout: 15_000 })
    await expect(sessionRow.locator('button.me-portal__pay-btn')).toHaveCount(0)
  })
})
