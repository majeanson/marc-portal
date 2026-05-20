/**
 * Visual-regression suite — one full-page screenshot per public route, per
 * viewport. The committed baselines under e2e/__screenshots__/ double as a
 * browsable layout gallery.
 *
 * Masked regions are content that legitimately changes between runs and
 * would otherwise fail every diff:
 *  - the footer build hash + live Quebec clock
 *  - the /meta freshness pills (their colour is derived from today's date)
 */

import { expect, test } from '@playwright/test'
import { installApiMocks } from './mocks'
import { settle } from './prepare'
import { PUBLIC_ROUTES } from './routes'

test.describe('page screenshots', () => {
  // Fulfil public API + OG-image requests with fixed fixtures so API-fed
  // pages render representative content instead of their error states.
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page)
  })

  for (const route of PUBLIC_ROUTES) {
    test(route.name, async ({ page }) => {
      await page.goto(route.path, { waitUntil: 'networkidle' })
      // Scroll the page through so lazy images + reveals settle and fonts
      // load — otherwise the document height shifts between runs.
      await settle(page)
      await expect(page).toHaveScreenshot(`${route.name}.png`, {
        fullPage: true,
        mask: [
          page.locator('.site-footer__build'),
          page.locator('.site-footer__qctime'),
          page.locator('.meta-feature__fresh'),
        ],
      })
    })
  }
})
