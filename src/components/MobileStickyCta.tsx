import { useEffect, useState } from 'react'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'

/**
 * Bottom-fixed "start a session" pill, visible only on narrow viewports.
 * Appears after the visitor has scrolled past the hero (~70vh) so it never
 * competes with the hero's primary CTA, and hides again when the final
 * CTA section (`#cta`) is within ~140px of the viewport to avoid
 * doubling-up on the same action.
 *
 * Hidden via `display: none` on viewports > 768px so the desktop layout is
 * untouched. Respects prefers-reduced-motion (snap, no slide).
 */
export function MobileStickyCta({ lang }: { lang: Lang }) {
  const t = DICT[lang].stickyCta
  const intakeHref = `${lang === 'en' ? '/en' : ''}/intake`
  const [show, setShow] = useState(false)

  useEffect(() => {
    let ticking = false
    const compute = () => {
      ticking = false
      const scrolledPastHero = window.scrollY > window.innerHeight * 0.7
      // Hide near the final CTA so we don't render two of the same button
      // stacked. Looks for the CTA section by id.
      let nearFinalCta = false
      const finalCta = document.getElementById('cta')
      if (finalCta) {
        const rect = finalCta.getBoundingClientRect()
        nearFinalCta = rect.top < window.innerHeight + 140
      }
      setShow(scrolledPastHero && !nearFinalCta)
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
  }, [])

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
