import { useEffect, useState } from 'react'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { CapacityCounter } from './CapacityCounter'
import { useAuth } from '../lib/authContext'
import { getCapacityLive } from '../lib/sessionsApi'

const FACTS: Record<Lang, string[]> = {
  fr: ['72 h · réponse honnête', 'Async · pas de calls', 'Démos testables', '≈ 300 $ – 3 000 $+'],
  en: ['72h · honest reply', 'Async · no calls', 'Live demos', '≈ $300 – $3000+'],
}

const SECONDARY_CTA: Record<Lang, { label: string; href: string }> = {
  fr: { label: 'Voir un projet en cours →', href: '/projects' },
  en: { label: 'See a project in progress →', href: '/en/projects' },
}

// In-hero ToC removed per §2.2 — duplicated by SectionRail (the sticky
// side rail on /). Anchor list now lives in SectionRail.tsx as the
// single source of truth.

export function Hero({ lang }: { lang: Lang }) {
  const t = DICT[lang].hero
  const { email, isAdmin } = useAuth()
  const langPrefix = lang === 'en' ? '/en' : ''
  const intakeHref = `${langPrefix}/intake`
  const sessionsHref = `${langPrefix}${isAdmin ? '/admin/inbox' : '/me'}`

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
    <section className="section hero hero--editorial" aria-labelledby="hero-title">
      <div className="hero__folio mono" aria-hidden="true">
        {t.folio}
      </div>

      <div className="section__inner hero__inner">
        <h1 id="hero-title" className="hero__display">
          <span className="hero__display-line hero__display-line--pre">{t.display.pre}</span>
          <span className="hero__display-line hero__display-line--lead">{t.display.lead}</span>
          <span className="hero__display-line hero__display-line--emph">
            <span className="hero__display-emph-mark">{t.display.emphasis}</span>
          </span>
          <span className="hero__display-line hero__display-line--tail">{t.display.tail}</span>
        </h1>

        <p className="hero__lead hero__lead--primary">
          <strong>{t.body2}</strong>
        </p>

        <p className="hero__lead hero__lead--meta">
          {t.body1} {t.body3}
        </p>

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
        <a className="hero__secondary-cta mono" href={SECONDARY_CTA[lang].href}>
          {SECONDARY_CTA[lang].label}
        </a>

        <ul className="hero__facts" aria-label={lang === 'fr' ? 'Faits en bref' : 'Quick facts'}>
          {FACTS[lang].map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>

        <div className="hero__bilingual mono">{t.bilingual}</div>

        <CapacityCounter lang={lang} />
      </div>
    </section>
  )
}
