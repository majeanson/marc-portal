/**
 * Print-stylesheet E2E.
 *
 * The proposal sheet's print CSS hides everything but the sheet so the
 * confirmation page prints as a clean one-pager. That blackout is scoped
 * with `:has(.proposal-sheet)` precisely so it CANNOT reach an ordinary
 * page — printing the home page, the privacy policy, anything, must still
 * produce the real content, not a blank sheet. This guards that scoping.
 */

import { expect, test } from '@playwright/test'
import { installApiMocks } from './mocks'

test('an ordinary page still prints its content — the proposal blackout is scoped', async ({
  page,
}) => {
  await installApiMocks(page)
  await page.goto('/en', { waitUntil: 'networkidle' })

  // Precondition: an ordinary page carries no proposal sheet.
  await expect(page.locator('.proposal-sheet')).toHaveCount(0)

  await page.emulateMedia({ media: 'print' })

  // With no .proposal-sheet present, the :has()-scoped blackout must not
  // apply — the page's main content still prints. An unscoped `body *`
  // blackout would have hidden it. (The header is a poor probe: the site
  // already hides site chrome in print, blackout or not.)
  await expect(page.locator('#main-content')).toBeVisible()
})
