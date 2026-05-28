import { useEffect, useState } from 'react'
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

  // Capacity-aware CTA label. atCap defaults to false until /api/capacity
  // responds — the "loading" state therefore reads identically to "open",
  // which is the right side of the fence for a hero that should never
  // look broken on cold-start. Visitors who land while the request is
  // in-flight see the normal CTA; if the API says we're full, it swaps
  // to the waitlist label.
  const [atCap, setAtCap] = useState<boolean>(false)
  useEffect(() => {
    let cancelled = false
    getCapacityLive()
      .then((c) => {
        if (!cancelled) setAtCap(c.atCap)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const ctaLabel = email ? t.ctaLoggedIn : atCap ? t.ctaWaitlist : t.cta

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
          <a className="hero__cta hero__cta--primary" href={intakeHref}>
            {ctaLabel}
          </a>
          <span
            className={`hero__slot-pill mono${atCap ? ' hero__slot-pill--full' : ' hero__slot-pill--open'}`}
          >
            {atCap ? t.slotFull : t.slotOpen}
          </span>
          {email && (
            <a className="hero__sessions-link mono" href={sessionsHref}>
              {t.mySessionsLink}
            </a>
          )}
        </div>
      </div>
    </section>
  )
}
