/**
 * Studio sign — a small hand-drawn coffee-cup placard in the footer that
 * tells the visitor, honestly, whether Marc is taking work this week.
 *
 * The state is real: it reads /api/capacity (the same source the hero's
 * waitlist CTA uses), so the sign can't drift from the truth. While the
 * request is in flight, or if it fails, the sign falls back to a neutral
 * line rather than guessing — it never claims a status it doesn't know.
 *
 * Deliberately not a coloured pill: a cup, two lines of plain text, an
 * ink outline. The steam rises when the studio is open and settles when
 * it's on a waitlist.
 */

import { useEffect, useState } from 'react'
import type { Lang } from '../i18n'
import { getCapacityLive } from '../lib/sessionsApi'

type Status = 'loading' | 'open' | 'waitlist' | 'unknown'

const COPY = {
  fr: {
    eyebrow: "L'atelier de Marc",
    open: 'Ouvert aux projets',
    waitlist: 'Sur liste d’attente',
    resting: 'Québec · travail async',
    home: "Retour en haut de l'accueil",
  },
  en: {
    eyebrow: "Marc's studio",
    open: 'Open for projects',
    waitlist: 'Waitlist open',
    resting: 'Québec · async',
    home: 'Back to the top of the home page',
  },
} as const

function CoffeeCup({ steaming }: { steaming: boolean }) {
  return (
    <svg
      className="studio-sign__cup"
      viewBox="0 0 44 44"
      width="30"
      height="30"
      aria-hidden="true"
      focusable="false"
    >
      {steaming && (
        <g
          className="studio-sign__steam"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        >
          <path d="M 17 14 Q 13.5 10 17 6.5 Q 20 3.5 17 1" />
          <path d="M 26 14 Q 22.5 10 26 6.5 Q 29 3.5 26 1" />
        </g>
      )}
      {/* Cup body — a quick tapered mug, drawn open at the rim. */}
      <path
        d="M 11 17 L 13 34 Q 13.5 38 18 38 L 25 38 Q 29.5 38 30 34 L 32 17"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 32 20 Q 39 20.5 38 26 Q 37 30.5 30.5 30"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* Saucer — a shallow hand-drawn arc. */}
      <path
        d="M 8 41 Q 21.5 44 35 41"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function StudioSign({ lang }: { lang: Lang }) {
  const t = COPY[lang]
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    let cancelled = false
    getCapacityLive()
      .then((c) => {
        if (!cancelled) setStatus(c.atCap ? 'waitlist' : 'open')
      })
      .catch(() => {
        if (!cancelled) setStatus('unknown')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const line = status === 'open' ? t.open : status === 'waitlist' ? t.waitlist : t.resting

  // The stamp doubles as a "back to home" link, like the header brand: a plain
  // anchor (not a router <Link>), so the native navigation lands at the top of
  // the page — including when you're already on the home page.
  const homeHref = lang === 'fr' ? '/' : '/en'

  return (
    <a className={`studio-sign studio-sign--${status}`} href={homeHref} aria-label={t.home}>
      <CoffeeCup steaming={status !== 'waitlist'} />
      <span className="studio-sign__text">
        <span className="studio-sign__eyebrow mono">{t.eyebrow}</span>
        <span className="studio-sign__status">{line}</span>
      </span>
    </a>
  )
}
