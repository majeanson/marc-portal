/**
 * Set `data-scroll-direction="up" | "down"` on <html> based on the user's
 * vertical scroll movement. CSS reads the attribute to hide sticky headers
 * when scrolling down (more reading space) and slide them back when
 * scrolling up (the iOS-Safari-URL-bar pattern, applied to our own nav).
 *
 * Idempotent — install once at app boot. Plain DOM mutation (no React
 * state) so it doesn't trigger re-renders or care about route changes.
 *
 * Behaviour:
 *   - Below 80 px: always `"up"`. The hero / top-of-page should never
 *     show a hidden header on first paint.
 *   - 5 px hysteresis on the delta to ignore sub-pixel scroll jitter
 *     (notable on track-pads).
 *   - Throttled via requestAnimationFrame so we don't write to the DOM
 *     more than once per frame.
 */
let installed = false

export function installScrollDirection(): void {
  if (installed || typeof window === 'undefined') return
  installed = true

  const root = document.documentElement
  let lastY = Math.max(0, window.scrollY)
  let ticking = false

  // Initial state — we're at the top of the page on every fresh mount.
  root.setAttribute('data-scroll-direction', 'up')

  const onScroll = () => {
    if (ticking) return
    ticking = true
    requestAnimationFrame(() => {
      const y = Math.max(0, window.scrollY)
      if (y < 80) {
        root.setAttribute('data-scroll-direction', 'up')
      } else if (Math.abs(y - lastY) > 5) {
        root.setAttribute('data-scroll-direction', y > lastY ? 'down' : 'up')
      }
      lastY = y
      ticking = false
    })
  }

  window.addEventListener('scroll', onScroll, { passive: true })
}
