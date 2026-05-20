import type { Page } from '@playwright/test'

/**
 * Settle a page before a full-page screenshot.
 *
 * Tall pages (the home page is ~12,600px) carry lazy-loaded images and
 * scroll-triggered reveals. If the capture runs before they resolve, the
 * document height differs run-to-run and the screenshot diff fails on a
 * phantom shift. Scrolling the whole page once forces every lazy image and
 * IntersectionObserver reveal to fire; we then return to the top and wait
 * for fonts so the capture starts from a fully-settled, deterministic DOM.
 */
export async function settle(page: Page): Promise<void> {
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
  await page.evaluate(() => document.fonts.ready)
}
