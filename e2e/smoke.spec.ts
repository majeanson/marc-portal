/**
 * Smoke E2E — the load-bearing wayfinding behaviour, checked in a real
 * browser. Runs at every viewport, so it also covers the mobile header.
 */

import { expect, test } from '@playwright/test'

/** Mirror of HOME_SECTION_ORDER (src/lib/features.ts) — the funnel order.
 *  Guarded against the surfaces by the vitest suite; here we check the
 *  rendered DOM agrees. */
const FUNNEL = [
  'featured',
  'how',
  'about',
  'vibe',
  'bring-anything',
  'pricing',
  'testimonials',
  'faq',
]

test.describe('site wayfinding', () => {
  test('home renders the funnel sections in order', async ({ page }) => {
    await page.goto('/')
    const ids = await page.evaluate((funnel) => {
      const present = new Set(funnel)
      return [...document.querySelectorAll('[id]')]
        .map((el) => el.id)
        .filter((id) => present.has(id))
    }, FUNNEL)
    // featured + testimonials self-hide when their feeds are empty; allow
    // them to be absent but never out of order.
    expect(ids).toEqual(FUNNEL.filter((id) => ids.includes(id)))
  })

  test('continue-tour pointer advances to the next feature', async ({ page }) => {
    await page.goto('/handoff')
    const link = page.locator('.feature-continue__link')
    await expect(link).toBeVisible()
    await link.click()
    // handoff = keys; FEATURE_NEXT keys → shipped; shipped page = /vouches.
    await expect(page).toHaveURL(/\/vouches$/)
  })

  test('back-to-home exit points at the matching home section', async ({ page }) => {
    await page.goto('/handoff')
    const home = page.locator('.feature-continue__home')
    await expect(home).toBeVisible()
    // keys has no dedicated home section → falls back to #how.
    await expect(home).toHaveAttribute('href', '/#how')
  })

  test('language switch moves from fr to en', async ({ page }) => {
    await page.goto('/')
    await page.locator('nav.lang a', { hasText: 'EN' }).click()
    await expect(page).toHaveURL(/\/en$/)
  })

  test('the site map page renders', async ({ page }) => {
    await page.goto('/carte')
    await expect(page.locator('.map-page')).toBeVisible()
  })

  test('the atelier page renders both of its sections', async ({ page }) => {
    // /atelier is excluded from the screenshot suite (see routes.ts), so this
    // is its load-bearing check: the design-system exhibit + the gallery grid.
    await page.goto('/atelier')
    await expect(page.locator('.atelier-lang')).toBeVisible()
    await expect(page.locator('.atelier-grid')).toBeVisible()
  })
})
