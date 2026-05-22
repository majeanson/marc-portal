/**
 * Site-search E2E — the ⌘K / `/` panel that searches the /carte atlas.
 *
 * Covers the load-bearing behaviour: the trigger opens a panel that leads
 * with priority suggestions, a query narrows to matching destinations,
 * choosing a result navigates and closes the panel, the "on the map"
 * hand-off lands on /carte deep-linked to the node, and Escape closes.
 */

import { expect, test } from '@playwright/test'
import { installApiMocks } from './mocks'

const TRIGGER = /search the site/i

test.describe('site search', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page)
    await page.goto('/en', { waitUntil: 'networkidle' })
  })

  test('the trigger opens a panel that leads with suggestions', async ({ page }) => {
    await page.getByRole('button', { name: TRIGGER }).click()
    const dialog = page.getByRole('dialog', { name: /search/i })
    await expect(dialog).toBeVisible()
    // An empty query is useful immediately — top destinations, not blankness.
    await expect(dialog.getByText('Start here')).toBeVisible()
    await expect(dialog.locator('.site-search__result')).not.toHaveCount(0)
  })

  test('a query narrows to matching destinations', async ({ page }) => {
    await page.getByRole('button', { name: TRIGGER }).click()
    const dialog = page.getByRole('dialog', { name: /search/i })
    await dialog.getByRole('searchbox').fill('intake')
    await expect(dialog.getByText('Results')).toBeVisible()
    await expect(dialog.locator('.site-search__result-main').first()).toContainText(/intake/i)
  })

  test('choosing a result navigates and closes the panel', async ({ page }) => {
    await page.getByRole('button', { name: TRIGGER }).click()
    const dialog = page.getByRole('dialog', { name: /search/i })
    await dialog.getByRole('searchbox').fill('intake')
    await dialog.locator('.site-search__result-main').first().click()
    await expect(dialog).toBeHidden()
    await expect(page).toHaveURL(/\/intake/)
  })

  test('the "on the map" hand-off deep-links into /carte', async ({ page }) => {
    await page.getByRole('button', { name: TRIGGER }).click()
    const dialog = page.getByRole('dialog', { name: /search/i })
    await dialog.getByRole('searchbox').fill('intake')
    await dialog.locator('.site-search__on-map').first().click()
    await expect(page).toHaveURL(/\/en\/map\?.*node=/)
  })

  test('Escape closes the panel', async ({ page }) => {
    await page.getByRole('button', { name: TRIGGER }).click()
    const dialog = page.getByRole('dialog', { name: /search/i })
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })
})
