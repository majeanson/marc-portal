import type { Page } from '@playwright/test'

/**
 * Settle a page before a full-page screenshot.
 *
 * Tall pages (the home page is ~12,600px) carry lazy-loaded images and
 * scroll-triggered reveals. If the capture runs before they resolve, the
 * document height differs run-to-run and the screenshot diff fails on a
 * phantom shift — a dimension mismatch, which `maxDiffPixelRatio` cannot
 * absorb.
 *
 * The old version scrolled the page once and returned on the next frame —
 * it *triggered* the lazy images and IntersectionObserver reveals but never
 * waited for them to finish mutating layout, so whatever won the race
 * against the capture varied between runs. Three explicit phases now:
 *
 *  1. Scroll the whole page once so every lazy image and IO reveal fires.
 *  2. Wait for fonts and for every <img> to finish loading — an in-flight
 *     lazy image has no box yet, so the height jumps when it lands.
 *  3. Poll the document height until it holds steady across consecutive
 *     frames. The catch-all: reveal transitions and any late reflow
 *     converge here before the capture. Capped by a deadline so a page
 *     that never settles degrades to best-effort instead of hanging.
 */
export async function settle(page: Page): Promise<void> {
  // Phase 1 — scroll through to trigger lazy images + IO reveals.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let y = 0
        const step = () => {
          window.scrollTo(0, y)
          y += window.innerHeight
          if (y < document.documentElement.scrollHeight) {
            requestAnimationFrame(step)
          } else {
            window.scrollTo(0, 0)
            requestAnimationFrame(() => resolve())
          }
        }
        step()
      }),
  )

  // Phase 2 — fonts ready, then every *visible* image settled. Two guards
  // matter here: skip images with no layout box — a display:none responsive
  // variant never loads and fires neither `load` nor `error`, so waiting on
  // it hangs forever — and cap each wait so a broken/stalled src can't hang
  // the suite either. Phase 3 is the real height guarantee regardless.
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all(
      Array.from(document.images)
        .filter((img) => !img.complete && img.getClientRects().length > 0)
        .map(
          (img) =>
            new Promise<void>((res) => {
              const done = () => res()
              img.addEventListener('load', done, { once: true })
              img.addEventListener('error', done, { once: true })
              setTimeout(done, 3000)
            }),
        ),
    )
  })

  // Phase 3 — wait for the document height to stop changing. Resolves once
  // it is unchanged for STABLE_FRAMES consecutive frames; bails after
  // DEADLINE_MS so a never-settling page can't hang the suite.
  //
  // STABLE_FRAMES + DEADLINE_MS were tuned up from 15/6000 after a recurring
  // ±14-140px flake on the home page (project memory:
  // `project_e2e_home_screenshot_flake.md`). Some late lazy reveals weren't
  // converging inside 6s on a loaded CI runner, so the deadline was being
  // hit instead of the stability gate, and the capture landed mid-layout.
  // 60 frames at 60Hz ≈ 1s of held-steady, 15s deadline gives the home
  // page's slowest section room to land.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const STABLE_FRAMES = 60
        const DEADLINE_MS = 15000
        const started = performance.now()
        let last = -1
        let stable = 0
        const check = () => {
          const h = document.documentElement.scrollHeight
          if (h === last) {
            stable += 1
          } else {
            stable = 0
            last = h
          }
          if (stable >= STABLE_FRAMES || performance.now() - started > DEADLINE_MS) {
            resolve()
          } else {
            requestAnimationFrame(check)
          }
        }
        check()
      }),
  )
}
