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
        {/* Empathy-first manifesto. The closer is split out so it can
            carry italic + sage emphasis — the eye lands on it before
            reaching the CTA. The h1 anchors the page for SEO + a11y;
            CSS overrides the default heading weight so it reads as a
            running paragraph, not a display headline. */}
        <h1 id="hero-title" className="hero__manifesto">
          {t.body} <span className="hero__closer">{t.closer}</span>
        </h1>

        {/* Signature block — sage hairline + small-caps name. Replaces the
            old hand-drawn flourish SVG. The rule's left-edge scale-in
            animation lives in CSS so it lines up with the manifesto's
            ink-absorb (which runs ~240ms after page-load). */}
        <div className="hero__sig">
          <span className="hero__sig-rule" aria-hidden="true" />
          <span className="hero__sig-name">{t.signature}</span>
        </div>

        <div className="hero__actions">
          <a className="hero__cta hero__cta--primary" href={intakeHref}>
            {ctaLabel}
          </a>
          <span
            className={`hero__slot-pill mono${atCap ? ' hero__slot-pill--full' : ' hero__slot-pill--open'}`}
            aria-live="polite"
          >
            {atCap
              ? lang === 'fr'
                ? 'plein — liste d’attente ouverte'
                : 'currently full — waitlist open'
              : lang === 'fr'
                ? '1 place ouverte'
                : '1 slot open'}
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
