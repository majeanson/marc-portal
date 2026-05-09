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
    ['#demo', 'Démo'],
    ['#how', 'Comment ça marche'],
    ['#pricing', 'Prix'],
    ['#vibe', 'On fait / on fait pas'],
    ['#about', 'À propos'],
  ],
  en: [
    ['#demo', 'Demo'],
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

  // Hero CTA flips to "join the waitlist" when at cap. We render the standard
  // CTA on first paint (no static fixture to fall back on) and swap once the
  // live count arrives — better than forcing a layout shift on the bedrock
  // value-prop element.
  const [atCap, setAtCap] = useState<boolean>(false)
  useEffect(() => {
    let cancelled = false
    getCapacityLive()
      .then((c) => {
        if (!cancelled) setAtCap(c.atCap)
      })
      .catch(() => {
        // No paint change on failure.
      })
    return () => {
      cancelled = true
    }
  }, [])
  const ctaLabel = email ? t.ctaLoggedIn : atCap ? t.ctaWaitlist : t.cta

  return (
    <section className="section hero" aria-labelledby="hero-title">
      <div className="section__inner">
        <div className="section__eyebrow">{t.eyebrow}</div>
        <h1 id="hero-title">{t.salut}</h1>

        {/* Lead — the offer, foregrounded */}
        <p className="hero__lead hero__lead--primary">
          <strong>{t.body2}</strong>
        </p>

        {/* Supporting line — smaller, single sentence */}
        <p className="hero__lead hero__lead--meta">
          {t.body1} {t.body3}
        </p>

        {/* Primary CTA */}
        <a className="hero__cta" href={intakeHref}>
          {ctaLabel}
        </a>

        {email && (
          <div className="hero__logged-in">
            <a href={sessionsHref}>{t.mySessionsLink}</a>
          </div>
        )}

        {/* Quick-glance fact strip */}
        <ul className="hero__facts" aria-label={lang === 'fr' ? 'Faits en bref' : 'Quick facts'}>
          {FACTS[lang].map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>

        {/* Bilingual notice — quieter */}
        <div className="hero__bilingual">{t.bilingual}</div>

        <CapacityCounter lang={lang} />

        {/* In-page anchor nav for skim-readers + screen readers */}
        <nav
          className="hero__anchors"
          aria-label={lang === 'fr' ? 'Sections de la page' : 'Page sections'}
        >
          {ANCHORS[lang].map(([href, label]) => (
            <a key={href} href={href} className="hero__anchor">
              {label}
            </a>
          ))}
        </nav>
      </div>
    </section>
  )
}
