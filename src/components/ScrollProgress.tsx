import { useEffect, useState } from 'react'
import type { Lang } from '../i18n'
import { HOME_SECTION_FEATURE, type FeatureId } from '../lib/features'

/**
 * Thin progress thread that fills horizontally as the visitor scrolls.
 *
 * On most pages it reads as the napperon palette (sage → warm terracotta) —
 * like a coffee ring drying along the placemat's edge. On the HOME page it
 * does something extra: the thread takes the colour of the funnel section
 * the visitor is currently in, so they watch themselves move through the
 * practice's seven feature colours as they scroll. Off the home page (no
 * funnel sections in the DOM) it falls back to the gradient.
 *
 * When the visitor reaches the bottom (>=98% scrolled) a tiny LU / READ
 * stamp fades in at the right terminus, reusing the VÉRIFIÉ stamp family
 * already on the hero and 404. Decorative only — aria-hidden.
 */
export function ScrollProgress({ lang }: { lang: Lang }) {
  const [ratio, setRatio] = useState(0)
  // null = not on the home funnel → the gradient shows.
  const [feature, setFeature] = useState<FeatureId | null>(null)

  useEffect(() => {
    let rafId: number | null = null
    // Funnel section ids, in render order — HOME_SECTION_FEATURE is the
    // single source of truth, so adding/reordering a section needs no
    // change here.
    const sectionIds = Object.keys(HOME_SECTION_FEATURE)
    const compute = () => {
      const scroll = window.scrollY
      const max = document.documentElement.scrollHeight - window.innerHeight
      setRatio(max > 0 ? Math.min(1, Math.max(0, scroll / max)) : 0)

      // Which funnel section is the visitor in? The last one whose top has
      // crossed the viewport midline. No section element in the DOM → this
      // isn't the home page, so we leave the gradient in place.
      const mid = window.innerHeight * 0.5
      let onFunnel = false
      let current: FeatureId | null = null
      for (const id of sectionIds) {
        const el = document.getElementById(id)
        if (!el) continue
        onFunnel = true
        if (el.getBoundingClientRect().top <= mid) {
          current = HOME_SECTION_FEATURE[id] ?? current
        }
      }
      setFeature(onFunnel ? current : null)
      rafId = null
    }
    const onScroll = () => {
      if (rafId !== null) return
      rafId = requestAnimationFrame(compute)
    }
    compute()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', compute, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', compute)
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [])

  const done = ratio >= 0.98

  return (
    <div className="scroll-progress" aria-hidden="true">
      <div
        className="scroll-progress__fill"
        data-feature={feature ?? undefined}
        style={{ transform: `scaleX(${ratio})` }}
      />
      <svg
        className={`scroll-progress__stamp${done ? ' is-done' : ''}`}
        viewBox="0 0 60 28"
        focusable="false"
      >
        <g transform="translate(30 14) rotate(-7)">
          <rect
            x="-26"
            y="-11"
            width="52"
            height="22"
            rx="3"
            ry="3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <rect
            x="-23"
            y="-8"
            width="46"
            height="16"
            rx="2"
            ry="2"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.75"
          />
          <text
            x="0"
            y="4"
            textAnchor="middle"
            fontFamily="var(--mono), monospace"
            fontSize="10"
            fontWeight="700"
            letterSpacing="3"
            fill="currentColor"
          >
            {lang === 'fr' ? 'LU' : 'READ'}
          </text>
        </g>
      </svg>
    </div>
  )
}
