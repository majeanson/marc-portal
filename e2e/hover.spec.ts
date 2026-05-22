/**
 * Hover-integrity E2E — hovers every interactive element on every public
 * route and asserts the hover state is not visually clipped.
 *
 * Why this exists — the gap the other specs left:
 *  - smoke / full-tour CLICK every nav affordance but never HOVER one;
 *  - a11y / screenshot specs visit every route but only capture the
 *    *resting* state.
 * So a `:hover` rule that MOVES an element could push it past a clip
 * boundary and nothing in CI would see it. The page-mast "← back" link did
 * exactly this: `transform: translateX(-3px)` on hover slid the arrow under
 * the `.page-mast` `clip-path` left edge and shaved ~3px off the "←".
 *
 * What each hovered element is checked for:
 *  1. It stays inside the viewport — no drift off the left/right edge.
 *  2. It stays inside every ancestor carrying a `clip-path: inset()` mask —
 *     the exact class of bug above. (`polygon()` / non-inset masks are
 *     skipped: only inset masks have a parseable rectangular clip.)
 * Plus: no uncaught page error fires during the whole sweep.
 *
 * Transitions are flattened (see KILL_MOTION) so the hovered end-state is
 * measured immediately rather than mid-animation.
 *
 * Elements parked off-screen by design — the skip-link, `sr-only` content —
 * are skipped (they have a real box but live at a huge negative offset);
 * elements that can't be hovered (covered by sticky chrome, detached) are
 * skipped too. Neither is a hover-clip bug.
 *
 * Runs on the `narrow` viewport only (see playwright.config.ts): the checks
 * here — clip-path and viewport escapes on :hover — don't change with width.
 */

import { expect, test, type Locator } from '@playwright/test'
import { installApiMocks } from './mocks'
import { PUBLIC_ROUTES } from './routes'

/** Flatten every transition/animation so a hovered element jumps straight
 *  to its final geometry. 0s (not 1ms) is deliberate: a non-zero duration
 *  leaves the `getBoundingClientRect()` read racing the transform, so a
 *  hover translate is sometimes measured mid-flight and the clip is missed. */
const KILL_MOTION = `*, *::before, *::after {
  transition-duration: 0s !important;
  transition-delay: 0s !important;
  animation-duration: 0s !important;
  animation-delay: 0s !important;
}`

/**
 * Inspect a currently-hovered element. Returns a human-readable violation
 * string, or null when the element sits cleanly inside the viewport and
 * every clip-path ancestor.
 */
async function inspect(loc: Locator): Promise<string | null> {
  return loc.evaluate((el) => {
    // Absorbs sub-pixel anti-alias/rounding drift; the real bug (a 3px+
    // hover translate escaping a clip) sits well above it.
    const EPS = 1.5

    const r = el.getBoundingClientRect()
    if (r.width < 0.5 || r.height < 0.5) return null

    const cls = (el.getAttribute('class') ?? '').split(/\s+/)[0]
    const text = el.textContent?.trim().replace(/\s+/g, ' ').slice(0, 32) ?? ''
    const label = `<${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}>${text ? ` “${text}”` : ''}`

    const out: string[] = []

    // 1. viewport bounds. clientWidth excludes any scrollbar gutter.
    const vw = document.documentElement.clientWidth
    if (r.left < -EPS) out.push(`${(-r.left).toFixed(1)}px past the left viewport edge`)
    if (r.right > vw + EPS) out.push(`${(r.right - vw).toFixed(1)}px past the right viewport edge`)

    // 2. every clip-path: inset() ancestor. getComputedStyle resolves the
    //    mask to px (e.g. `inset(0px -1517px 0px 0px)`); a negative inset
    //    pushes that edge of the clip rect outward.
    for (let a = el.parentElement; a; a = a.parentElement) {
      const raw = getComputedStyle(a).clipPath
      if (!raw || !raw.startsWith('inset(')) continue
      const ab = a.getBoundingClientRect()
      // Drop an optional `round <radius>` suffix before reading the insets.
      const body = raw.slice(6, raw.lastIndexOf(')')).split(/\bround\b/)[0]
      const n = body
        .split(/\s+/)
        .map(parseFloat)
        .filter((x) => !Number.isNaN(x))
      if (n.length === 0) continue
      // CSS 1–4 value shorthand: top / right / bottom / left.
      const [t, rr, b, l] =
        n.length === 1
          ? [n[0], n[0], n[0], n[0]]
          : n.length === 2
            ? [n[0], n[1], n[0], n[1]]
            : n.length === 3
              ? [n[0], n[1], n[2], n[1]]
              : [n[0], n[1], n[2], n[3]]
      const anc = `.${(a.getAttribute('class') ?? '?').split(/\s+/)[0]}`
      const clip = {
        top: ab.top + t,
        right: ab.right - rr,
        bottom: ab.bottom - b,
        left: ab.left + l,
      }
      if (r.left < clip.left - EPS)
        out.push(`clipped ${(clip.left - r.left).toFixed(1)}px on its left by ${anc}'s clip-path`)
      if (r.right > clip.right + EPS)
        out.push(
          `clipped ${(r.right - clip.right).toFixed(1)}px on its right by ${anc}'s clip-path`,
        )
      if (r.top < clip.top - EPS)
        out.push(`clipped ${(clip.top - r.top).toFixed(1)}px on its top by ${anc}'s clip-path`)
      if (r.bottom > clip.bottom + EPS)
        out.push(
          `clipped ${(r.bottom - clip.bottom).toFixed(1)}px on its bottom by ${anc}'s clip-path`,
        )
    }

    return out.length ? `  ${label} — ${out.join('; ')}` : null
  })
}

test.describe('hover integrity — interactive elements stay un-clipped on hover', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page)
  })

  for (const route of PUBLIC_ROUTES) {
    test(route.name, async ({ page }) => {
      // One full goto + a hover for every link/button/summary on the page —
      // comfortably more work than the default per-test budget.
      test.slow()

      const pageErrors: string[] = []
      page.on('pageerror', (err) => pageErrors.push(err.message))

      await page.goto(route.path, { waitUntil: 'networkidle' })
      await page.addStyleTag({ content: KILL_MOTION })

      const targets = await page.locator('a:visible, button:visible, summary:visible').all()
      expect(targets.length, 'route exposes interactive elements to hover').toBeGreaterThan(0)

      const violations: string[] = []
      for (const loc of targets) {
        // Skip elements parked off-screen by design — the skip-link and
        // sr-only content keep a real box but at a huge negative offset, or
        // collapsed to ~1px. Neither is a navigable, hover-clippable target.
        const box = await loc.boundingBox()
        if (!box || box.width < 2 || box.height < 2 || box.x + box.width < 2) continue

        try {
          await loc.scrollIntoViewIfNeeded({ timeout: 2000 })
          await loc.hover({ timeout: 2000 })
        } catch {
          // Covered by sticky chrome / detached mid-sweep — not a hover-clip
          // bug, so don't fail the run over it.
          continue
        }

        const violation = await inspect(loc)
        if (violation) violations.push(violation)
      }

      expect(
        violations,
        `hover clipped ${violations.length} element(s) on ${route.path}:\n${violations.join('\n')}`,
      ).toEqual([])
      expect(
        pageErrors,
        `uncaught page error(s) during the hover sweep on ${route.path}:\n${pageErrors.join('\n')}`,
      ).toEqual([])
    })
  }
})
