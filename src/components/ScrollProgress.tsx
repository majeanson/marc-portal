import { useEffect, useState } from 'react'
import type { Lang } from '../i18n'

/**
 * Thin progress thread that fills horizontally as the visitor scrolls. Reads
 * as the napperon palette (sage → warm terracotta) — like a coffee ring
 * drying along the placemat's edge.
 *
 * When the visitor reaches the bottom (>=98% scrolled) a tiny LU / READ
 * stamp fades in at the right terminus, reusing the VÉRIFIÉ stamp family
 * already on the hero and 404. Decorative only — aria-hidden.
 */
export function ScrollProgress({ lang }: { lang: Lang }) {
  const [ratio, setRatio] = useState(0)

  useEffect(() => {
    let rafId: number | null = null
    const compute = () => {
      const scroll = window.scrollY
      const max = document.documentElement.scrollHeight - window.innerHeight
      setRatio(max > 0 ? Math.min(1, Math.max(0, scroll / max)) : 0)
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
      <div className="scroll-progress__fill" style={{ transform: `scaleX(${ratio})` }} />
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
