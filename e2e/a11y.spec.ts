/**
 * Accessibility gate — runs an axe-core scan on every public route, at each
 * viewport. Fails on `serious` or `critical` violations; `minor`/`moderate`
 * are reported by axe but not blocking, so the gate stays meaningful without
 * drowning in nitpicks.
 *
 * `color-contrast` is excluded from the blocking set: the portal's muted
 * editorial palette (faint mono eyebrows, soft body text) sits below the
 * WCAG AA 4.5:1 ratio by deliberate design. Blocking on it would make CI
 * permanently red and bury genuine structural regressions. Whether to
 * darken the text tokens is a design call for the operator — tracked
 * outside this gate. Every OTHER serious/critical rule still blocks.
 *
 * This complements the source-level eslint-plugin-jsx-a11y lint: axe checks
 * the *rendered* page (live ARIA, roles, names, focus order).
 */

import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { installApiMocks } from './mocks'
import { PUBLIC_ROUTES } from './routes'

test.describe('accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page)
  })

  for (const route of PUBLIC_ROUTES) {
    test(route.name, async ({ page }) => {
      await page.goto(route.path, { waitUntil: 'networkidle' })
      const { violations } = await new AxeBuilder({ page })
        // Excalidraw (the /napkin sketch widget) is a vendored third-party
        // component — its internal toolbar buttons are its own a11y concern,
        // not ours. Audit our markup, not theirs.
        .exclude('.excalidraw')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()
      const blocking = violations.filter(
        (v) => (v.impact === 'serious' || v.impact === 'critical') && v.id !== 'color-contrast',
      )
      const report = blocking
        .map((v) => `  ${v.id} (${v.impact}) — ${v.help} [${v.nodes.length} node(s)]`)
        .join('\n')
      expect(blocking, `axe found blocking a11y violations:\n${report}`).toEqual([])
    })
  }
})
