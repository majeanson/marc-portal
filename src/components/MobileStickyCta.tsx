import { useEffect, useState } from 'react'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'

/**
 * Bottom-fixed "start a session" pill, visible only on narrow viewports.
 *
 * Appears once the visitor has scrolled enough (`appearAfterRatio` of the
 * viewport height) so it never competes with a page's primary above-fold
 * CTA. Hides again when a "we're near the bottom" sentinel is in view —
 * by default `#cta` (the home page's final CTA section) or `.site-footer`
 * (every other page), to avoid stacking two of the same action.
 *
 * Hidden via `display: none` on viewports > 768px so the desktop layout is
 * untouched. Respects prefers-reduced-motion (snap, no slide).
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
  // Stringify selectors for the effect dep array. Callers typically pass an
  // inline literal that's reference-unstable; the join lets us compare by
  // value and avoids re-arming the listener on every parent render.
  const hideNearKey = hideNearSelectors.join('|')

  useEffect(() => {
    const selectors = hideNearKey.split('|').filter(Boolean)
    let ticking = false
    const compute = () => {
      ticking = false
      const scrolledPastHero = window.scrollY > window.innerHeight * appearAfterRatio
      // Hide near a sentinel (final CTA section or footer). First match wins.
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

  return (
    <a
      className={`mobile-sticky-cta${show ? ' is-visible' : ''}`}
      href={intakeHref}
      aria-label={t.ariaLabel}
      aria-hidden={!show}
      tabIndex={show ? 0 : -1}
    >
      <span className="mobile-sticky-cta__label">{t.label}</span>
      <span className="mobile-sticky-cta__arrow" aria-hidden="true">
        →
      </span>
    </a>
  )
}
