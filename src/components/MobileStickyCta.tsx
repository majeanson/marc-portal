import { useEffect, useState } from 'react'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { PAGE_FEATURE } from '../lib/features'

const DISMISS_KEY = 'mp-sticky-cta-dismissed'
// Once the visitor passes this scroll ratio the label swaps to the
// "almost there" variant — a small tonal shift, not a different action.
const FAR_RATIO = 0.82

/**
 * Bottom-fixed "start a session" pill, visible only on narrow viewports.
 *
 * Appears once the visitor has scrolled enough (`appearAfterRatio` of the
 * viewport height) so it never competes with a page's primary above-fold
 * CTA. Hides again when a "we're near the bottom" sentinel is in view —
 * by default `#cta` (the home page's final CTA section) or `.site-footer`
 * (every other page), to avoid stacking two of the same action.
 *
 * Dismissal: tapping the × stores a localStorage flag and the full bar is
 * replaced by a smaller "pebble" — same destination, less screen real
 * estate, soft pulse so it stays visible without nagging.
 *
 * Scroll-aware copy: the label rotates between the default "start a session"
 * and a more time-pressured "almost there →" once the visitor crosses
 * `FAR_RATIO` of the page. Same destination, different mood.
 *
 * Hidden via `display: none` on viewports > 768px so the desktop layout is
 * untouched. Respects prefers-reduced-motion (snap, no slide; no pulse).
 */
export function MobileStickyCta({
  lang,
  appearAfterRatio = 0.7,
  hideNearSelectors = ['#cta', '.site-footer'],
}: {
  lang: Lang
  appearAfterRatio?: number
  hideNearSelectors?: string[]
}) {
  const t = DICT[lang].stickyCta
  const intakeHref = `${lang === 'en' ? '/en' : ''}/intake`
  const [show, setShow] = useState(false)
  const [ratio, setRatio] = useState(0)
  // Read localStorage lazily so SSR/hydration mismatch can't happen (Vite
  // SPA, so no SSR, but the lazy-init pattern stays correct under StrictMode
  // double-mount).
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      return window.localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })
  const hideNearKey = hideNearSelectors.join('|')

  useEffect(() => {
    const selectors = hideNearKey.split('|').filter(Boolean)
    let ticking = false
    const compute = () => {
      ticking = false
      const scrollY = window.scrollY
      const max = document.documentElement.scrollHeight - window.innerHeight
      const r = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0
      setRatio(r)

      const scrolledPastHero = scrollY > window.innerHeight * appearAfterRatio
      let nearBottom = false
      for (const sel of selectors) {
        const el = document.querySelector(sel)
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (rect.top < window.innerHeight + 140) {
          nearBottom = true
          break
        }
      }
      setShow(scrolledPastHero && !nearBottom)
    }
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(compute)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    compute()
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [appearAfterRatio, hideNearKey])

  function dismiss() {
    setDismissed(true)
    try {
      window.localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // localStorage can be disabled (private mode in some browsers);
      // we still want the in-session dismissal to stick via React state.
    }
  }

  const label = ratio >= FAR_RATIO ? t.farLabel : t.label
  // Destination is /intake — borrow that feature's colour so the sticky
  // pill ties visually to the section it leads to.
  const feature = PAGE_FEATURE['page.intake']

  if (dismissed) {
    return (
      <a
        className={`mobile-sticky-pebble${show ? ' is-visible' : ''}`}
        href={intakeHref}
        data-feature={feature}
        aria-label={t.pebbleAriaLabel}
        aria-hidden={!show}
        tabIndex={show ? 0 : -1}
      >
        <span className="mobile-sticky-pebble__arrow" aria-hidden="true">
          →
        </span>
      </a>
    )
  }

  return (
    <div
      className={`mobile-sticky-cta${show ? ' is-visible' : ''}`}
      data-feature={feature}
      aria-hidden={!show}
      role="group"
      aria-label={t.ariaLabel}
    >
      <a
        className="mobile-sticky-cta__link"
        href={intakeHref}
        aria-label={t.ariaLabel}
        tabIndex={show ? 0 : -1}
      >
        <span className="mobile-sticky-cta__label">{label}</span>
      </a>
      <button
        type="button"
        className="mobile-sticky-cta__dismiss"
        onClick={dismiss}
        aria-label={t.dismissLabel}
        tabIndex={show ? 0 : -1}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path
            d="M 4 4 L 12 12 M 12 4 L 4 12"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  )
}
