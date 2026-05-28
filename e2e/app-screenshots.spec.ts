/**
 * Visual-regression suite for the AUTHENTICATED + multi-step surface — one
 * full-page screenshot per scenario, per viewport. Complements the public
 * gallery (screenshots.spec.ts): this one mocks /api/me + the session/admin
 * endpoints (app-mocks.ts) and seeds localStorage to reach intake form steps,
 * session pages (user + admin), and the admin shell — none of which the public
 * suite can render.
 *
 * Determinism: `page.clock.setFixedTime` pins Date so the SLA pill and any
 * age math are stable (timers keep running, so settle()'s scroll/reveal still
 * works). The shared masks cover the footer build hash + clock; `.me-portal__sla`
 * is masked too as belt-and-suspenders for the relative reply-window label.
 */

import { expect, test } from '@playwright/test'
import { FIXED_NOW_MS, installAppMocks } from './app-mocks'
import { settle } from './prepare'
import { APP_SCENARIOS } from './scenarios'

test.describe('app screenshots', () => {
  for (const scenario of APP_SCENARIOS) {
    test(scenario.name, async ({ page }) => {
      await page.clock.setFixedTime(new Date(FIXED_NOW_MS))

      if (scenario.seed) {
        const seed = scenario.seed
        await page.addInitScript((entries) => {
          try {
            for (const [k, v] of Object.entries(entries)) window.localStorage.setItem(k, v)
          } catch {
            // storage blocked — scenario falls back to its empty-state step
          }
        }, seed)
      }

      await installAppMocks(page, { role: scenario.role, ...scenario.mocks })

      await page.goto(scenario.path, { waitUntil: 'networkidle' })
      await settle(page)
      if (scenario.prepare) {
        await scenario.prepare(page)
        await settle(page)
      }

      // Horizontal-overflow guard — the "content spreading out of the
      // fieldview" class of mobile bug this suite was built to catch
      // (operator tables clipped in their card, the intake sketch/voice
      // header running off the edge). A configured horizontal scroller is
      // allowed (a scrollable tab bar, .table-scroll); content silently
      // clipped by an overflow:hidden/clip ancestor is a real bug and fails.
      const vw = page.viewportSize()!.width
      const { clipped } = await page.evaluate((vw) => {
        const desc = (el: Element) => {
          const cls =
            typeof el.className === 'string'
              ? el.className.trim().split(/\s+/).slice(0, 3).join('.')
              : ''
          return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}`
        }
        const clipped: string[] = []
        for (const el of Array.from(document.body.querySelectorAll('*'))) {
          const r = el.getBoundingClientRect()
          if (r.width === 0 || r.height === 0 || r.right <= vw + 1) continue
          const cs = getComputedStyle(el)
          if (cs.visibility === 'hidden' || cs.position === 'fixed') continue
          // Skip elements that are themselves *configured* horizontal scrollers
          // (overflow-x auto/scroll). An overflowing <table> has scrollWidth >
          // clientWidth too but overflow-x:visible, so it stays in scope.
          if (
            el.scrollWidth > el.clientWidth + 1 &&
            (cs.overflowX === 'auto' || cs.overflowX === 'scroll')
          )
            continue
          let intentionalScroll = false
          let clipper: Element | null = null
          for (let p = el.parentElement; p; p = p.parentElement) {
            const pcs = getComputedStyle(p)
            if (pcs.overflowX === 'auto' || pcs.overflowX === 'scroll') {
              intentionalScroll = true
              break
            }
            if (!clipper && (pcs.overflowX === 'hidden' || pcs.overflowX === 'clip')) clipper = p
          }
          if (intentionalScroll || !clipper) continue
          clipped.push(`${desc(el)}@${Math.round(r.right)} clipped by ${desc(clipper)}`)
        }
        return { clipped: [...new Set(clipped)] }
      }, vw)
      expect(clipped, `content clipped past the ${vw}px viewport`).toEqual([])

      // `app-` prefix namespaces these baselines so they never collide with
      // the public suite's (screenshots.spec.ts) — e.g. both have a
      // `me-dossier` route, but this one renders it signed-in.
      await expect(page).toHaveScreenshot(`app-${scenario.name}.png`, {
        fullPage: true,
        mask: [
          page.locator('.site-footer__build'),
          page.locator('.site-footer__qctime'),
          page.locator('.meta-feature__fresh'),
          page.locator('.me-portal__sla'),
        ],
      })
    })
  }
})
