import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { useAuth } from '../lib/authContext'
import { getCapacityLive } from '../lib/sessionsApi'

export function Hero({ lang }: { lang: Lang }) {
  const t = DICT[lang].hero
  const { email, isAdmin } = useAuth()
  const langPrefix = lang === 'en' ? '/en' : ''
  const intakeHref = `${langPrefix}/intake`
  const sessionsHref = `${langPrefix}${isAdmin ? '/admin/inbox' : '/me'}`

  // Capacity-aware CTA + slot pill. `open` stays null until /api/capacity
  // answers — the "loading" state reads as a neutral "open for projects"
  // label and a not-at-cap CTA, which is the right side of the fence for a
  // hero that should never look broken on cold-start. Once the real numbers
  // land, the pill shows the actual count of open build slots (cap is 2).
  const [open, setOpen] = useState<number | null>(null)
  const [atCap, setAtCap] = useState<boolean>(false)
  useEffect(() => {
    let cancelled = false
    getCapacityLive()
      .then((c) => {
        if (cancelled) return
        setAtCap(c.atCap)
        setOpen(Math.max(0, c.activeCap - c.active))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const ctaLabel = email ? t.ctaLoggedIn : atCap ? t.ctaWaitlist : t.cta
  const slotLabel = atCap ? t.slotFull : open === null ? t.slotOpenLoading : t.slotOpen(open)

  return (
    <section className="section hero" id="hero" aria-labelledby="hero-title">
      <div className="section__inner">
        {/* Empathy-first manifesto. Body is the h1 (LCP + SEO anchor);
            closer lives in a sibling <p> styled identically so the two
            visually read as one paragraph. They were merged into one
            h1 originally, but screen readers announce h1s as a single
            heading and the closer disappeared into the announcement —
            splitting fixes that without changing the rendered look. */}
        <h1 id="hero-title" className="hero__manifesto">
          {t.body}
        </h1>
        <p className="hero__closer-line">
          <span className="hero__closer">{t.closer}</span>
        </p>

        <div className="hero__actions">
          <Link className="hero__cta hero__cta--primary" to={intakeHref}>
            {ctaLabel}
          </Link>
          <span
            className={`hero__slot-pill mono${atCap ? ' hero__slot-pill--full' : ' hero__slot-pill--open'}`}
          >
            {slotLabel}
          </span>
          {email && (
            <Link className="hero__sessions-link mono" to={sessionsHref}>
              {t.mySessionsLink}
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}
