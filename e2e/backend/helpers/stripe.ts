// Stop the browser from navigating to the stub Stripe URL. The portal's
// pay handler does window.location.assign(checkoutUrl) on the response,
// which would otherwise drive Playwright into a network error (the host
// e2e-stub.local does not resolve). page.route('*url*', route => route.abort())
// catches the navigation request before DNS and aborts it cleanly.

import type { Page } from '@playwright/test'
import { E2E_STRIPE_STUB_URL_PREFIX } from '../constants'

export async function blockStripeRedirect(page: Page): Promise<void> {
  await page.route(`${E2E_STRIPE_STUB_URL_PREFIX}**`, (route) => route.abort('aborted'))
  // Also block the real Stripe Checkout host — if a spec ever runs against a
  // backend that fell off the stub path (misconfig, leaked real secret in
  // CI), we'd rather see a clear "navigation aborted" than a real
  // checkout.stripe.com session show up in someone's test dashboard.
  await page.route('https://checkout.stripe.com/**', (route) => route.abort('aborted'))
}
