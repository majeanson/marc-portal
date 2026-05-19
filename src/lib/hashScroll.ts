import { useEffect } from 'react'

/**
 * Robust deep-link-on-load scroll for the home page.
 *
 * The naive "useEffect once, find the element, scrollIntoView" approach was
 * leaving visitors at the wrong place when they clicked a header section
 * link (Prix / About / etc.) from a non-home route. Trace:
 *
 *   1. Plain <a href="/#pricing"> triggers a full reload to /.
 *   2. Home mounts. Pricing renders synchronously, so the polling effect
 *      finds #pricing almost immediately and smooth-scrolls to it.
 *   3. Above #pricing, FeaturedProjects is still fetching its API call.
 *      When the response lands a few hundred ms later, it renders cards
 *      and the section grows from "loading line" height to "3 cards"
 *      height — pushing #pricing further down the page.
 *   4. The earlier smooth scroll completes at the OLD coordinates. The
 *      visitor lands above #pricing, looking at FeaturedProjects content.
 *
 * Strategy here:
 *
 *   - Defer the first tick to the next macrotask so the synchronous mount
 *     pass settles before we measure anything.
 *   - Poll for the target up to 2s — handles slow lazy chunks.
 *   - Once found and scrolled, watch document.scrollHeight for ~1.2s. If
 *     it shifts by more than 40px (an async section finished mounting),
 *     re-scroll. Two or three re-scrolls is usually all it takes.
 *   - Also listen for hashchange so subsequent in-page hash navigations
 *     work without depending on the browser's native fragment-scroll,
 *     which is unreliable when sections are still in flux.
 *
 * Reduced-motion users get an instant scroll instead of smooth.
 */
export function useHashScroll(): void {
  useEffect(() => {
    if (typeof window === 'undefined') return
    let stopped = false
    let timer: number | undefined

    const prefersReduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const behavior: ScrollBehavior = prefersReduced ? 'auto' : 'smooth'

    const scrollTo = (rawHash: string) => {
      if (stopped) return
      if (timer !== undefined) {
        window.clearTimeout(timer)
        timer = undefined
      }
      const id = rawHash.replace(/^#/, '')
      if (!id) return

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
    }

    scrollTo(window.location.hash)

    const onHashChange = () => scrollTo(window.location.hash)
    window.addEventListener('hashchange', onHashChange)

    return () => {
      stopped = true
      if (timer !== undefined) window.clearTimeout(timer)
      window.removeEventListener('hashchange', onHashChange)
    }
  }, [])
}
