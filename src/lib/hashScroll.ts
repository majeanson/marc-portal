import { useEffect } from 'react'

/**
 * Robust deep-link-on-load scroll for the home page.
 *
 * The naive "useEffect once, find the element, scrollIntoView" approach was
 * leaving visitors at the wrong place when they clicked a header section
 * link (Prix / About / etc.). Trace:
 *
 *   1. Home mounts (cold load at /#pricing, or a client-side nav to /#id).
 *      Pricing renders synchronously, so the target element exists almost
 *      immediately.
 *   2. Above #pricing, FeaturedProjects is still fetching its API call.
 *      When the response lands a few hundred ms later, it renders cards
 *      and the section grows from "loading line" height to "3 cards"
 *      height — pushing #pricing further down the page.
 *   3. Whatever earlier scroll happened lands at the OLD coordinates. The
 *      visitor lands above #pricing, looking at FeaturedProjects content.
 *
 * PR2 hash-link conversion note: the header's section links used to be
 * raw `<a href="/#pricing">`, so a click was a full same-document hash
 * navigation and the browser's native `hashchange` event fired reliably.
 * They're now react-router `<Link to="/#pricing">` (so navigating away
 * from a deep route and back stays client-side, matching the rest of the
 * app). A `<Link>` click drives `history.pushState` under the hood, which
 * — unlike setting `location.hash` or clicking a real anchor — does NOT
 * fire `hashchange`. That's why this hook takes the current hash as an
 * argument (the caller passes `useLocation().hash`) instead of reading
 * `window.location.hash` itself and listening for the DOM event: react-
 * router hands us a fresh value on every navigation, including hash-only
 * ones, so keying the effect on that argument reruns the whole
 * find-and-scroll routine exactly when it needs to — on mount (cold load
 * or SPA arrival at /#id) and on every subsequent in-page hash change,
 * with no event listener required.
 *
 * (react-router's own `<ScrollRestoration>` also jumps to the hash element
 * on navigation, so the very first jump is covered even without this hook.
 * What it doesn't do is keep watching afterward — the reflow-correction
 * loop below is this hook's remaining job.)
 *
 * Strategy here:
 *
 *   - Defer the first tick to the next macrotask so the synchronous mount
 *     pass settles before we measure anything.
 *   - Poll for the target up to 2s — handles slow lazy chunks.
 *   - Once found and scrolled, watch document.scrollHeight for ~1.2s. If
 *     it shifts by more than 40px (an async section finished mounting),
 *     re-scroll. Two or three re-scrolls is usually all it takes.
 *
 * Reduced-motion users get an instant scroll instead of smooth.
 */
export function useHashScroll(hash: string): void {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const id = hash.replace(/^#/, '')
    if (!id) return

    let stopped = false
    let timer: number | undefined

    const prefersReduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const behavior: ScrollBehavior = prefersReduced ? 'auto' : 'smooth'

    let findAttempts = 0
    let watchAttempts = 0
    let lastHeight = 0
    const MAX_FIND = 25 // 25 * 80ms ≈ 2s
    const MAX_WATCH = 12 // 12 * 100ms ≈ 1.2s

    const watchTick = (el: HTMLElement) => {
      if (stopped) return
      const h = document.documentElement.scrollHeight
      if (Math.abs(h - lastHeight) > 40) {
        lastHeight = h
        el.scrollIntoView({ behavior, block: 'start' })
      }
      if (++watchAttempts < MAX_WATCH) {
        timer = window.setTimeout(() => watchTick(el), 100)
      }
    }

    const findTick = () => {
      if (stopped) return
      const el = document.getElementById(id)
      if (el) {
        lastHeight = document.documentElement.scrollHeight
        el.scrollIntoView({ behavior, block: 'start' })
        timer = window.setTimeout(() => watchTick(el), 100)
        return
      }
      if (++findAttempts < MAX_FIND) {
        timer = window.setTimeout(findTick, 80)
      }
    }

    // Defer one macrotask so the synchronous mount pass settles before
    // we start measuring — avoids a "false find" against a half-laid-out
    // tree on very fast machines.
    timer = window.setTimeout(findTick, 0)

    return () => {
      stopped = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [hash])
}
