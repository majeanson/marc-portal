import { useEffect, useState } from 'react'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { CapacityCounter } from './CapacityCounter'
import { useAuth } from '../lib/authContext'
import { getCapacityLive } from '../lib/sessionsApi'

const FACTS: Record<Lang, string[]> = {
  fr: ['72 h · réponse honnête', 'Async · pas de calls', 'Démos testables', '≈ $300 – $3000+'],
  en: ['72h · honest reply', 'Async · no calls', 'Live demos', '≈ $300 – $3000+'],
}

const ANCHORS: Record<Lang, Array<[string, string]>> = {
  fr: [
    ['#featured', 'Projets'],
    ['#how', 'Comment ça marche'],
    ['#pricing', 'Prix'],
    ['#vibe', 'je fais / je ne fais pas'],
    ['#about', 'À propos'],
  ],
  en: [
    ['#featured', 'Projects'],
    ['#how', 'How it works'],
    ['#pricing', 'Pricing'],
    ['#vibe', 'We do / we don’t'],
    ['#about', 'About'],
  ],
}

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
          <span className="hero__display-line hero__display-line--emph">{t.display.emphasis}</span>
          <span className="hero__display-line hero__display-line--tail">{t.display.tail}</span>
        </h1>

        <p className="hero__lead hero__lead--primary">
          <strong>{t.body2}</strong>
        </p>

        <p className="hero__lead hero__lead--meta">
          {t.body1} {t.body3}
        </p>

        <div className="hero__actions">
          <a className="hero__cta" href={intakeHref}>
            {ctaLabel}
          </a>
          {email && (
            <a className="hero__sessions-link mono" href={sessionsHref}>
              {t.mySessionsLink}
            </a>
          )}
        </div>

        <ul className="hero__facts" aria-label={lang === 'fr' ? 'Faits en bref' : 'Quick facts'}>
          {FACTS[lang].map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>

        <div className="hero__bilingual mono">{t.bilingual}</div>

        <CapacityCounter lang={lang} />
      </div>

      <nav
        className="hero__toc"
        aria-label={lang === 'fr' ? 'Sections de la page' : 'Page sections'}
      >
        <span className="hero__toc-label mono">{lang === 'fr' ? 'Lire' : 'Read'}</span>
        <ol className="hero__toc-list">
          {ANCHORS[lang].map(([href, label], i) => (
            <li key={href}>
              <a href={href} className="hero__toc-link">
                <span className="hero__toc-num mono">{String(i + 1).padStart(2, '0')}</span>
                <span className="hero__toc-text">{label}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </section>
  )
}
