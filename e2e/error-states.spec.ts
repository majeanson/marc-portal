/**
 * Error + empty-state visual coverage. The main screenshot suite mocks the
 * public APIs with populated fixtures; this spec deliberately drives the
 * projects and vouches pages into their *failed* (API 500) and *empty*
 * (API returns []) states so those real UI surfaces are locked down too.
 */

import { expect, test } from '@playwright/test'
import { settle } from './prepare'

const FOOTER_MASK = ['.site-footer__build', '.site-footer__qctime']

const PAGES = [
  { name: 'projects', path: '/projects', api: '**/api/public/projects', key: 'projects' },
  { name: 'vouches', path: '/vouches', api: '**/api/public/vouches**', key: 'vouches' },
] as const

test.describe('error + empty states', () => {
  for (const p of PAGES) {
    test(`${p.name} — error`, async ({ page }) => {
      await page.route(p.api, (route) =>
        route.fulfill({ status: 500, json: { error: 'mock failure' } }),
      )
      await page.goto(p.path, { waitUntil: 'networkidle' })
      await settle(page)
      await expect(page).toHaveScreenshot(`${p.name}-error.png`, {
        fullPage: true,
        mask: FOOTER_MASK.map((s) => page.locator(s)),
      })
    })

    test(`${p.name} — empty`, async ({ page }) => {
      await page.route(p.api, (route) => route.fulfill({ json: { [p.key]: [] } }))
      await page.goto(p.path, { waitUntil: 'networkidle' })
      await settle(page)
      await expect(page).toHaveScreenshot(`${p.name}-empty.png`, {
        fullPage: true,
        mask: FOOTER_MASK.map((s) => page.locator(s)),
      })
    })
  }
})
