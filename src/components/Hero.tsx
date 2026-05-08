import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { CapacityCounter } from './CapacityCounter'
import { getCapacity } from '../lib/capacity'
import { useAuth } from '../lib/authContext'

const FACTS: Record<Lang, string[]> = {
  fr: ['72 h · réponse honnête', 'Async · pas de calls', 'Démos testables', '≈ $300 – $3000+'],
  en: ['72h · honest reply', 'Async · no calls', 'Live demos', '≈ $300 – $3000+'],
}

const ANCHORS: Record<Lang, Array<[string, string]>> = {
  fr: [
    ['#how', 'Comment ça marche'],
    ['#pricing', 'Prix'],
    ['#vibe', 'On fait / on fait pas'],
    ['#demo', 'Démo'],
    ['#about', 'À propos'],
  ],
  en: [
    ['#how', 'How it works'],
    ['#pricing', 'Pricing'],
    ['#vibe', 'We do / we don’t'],
    ['#demo', 'Demo'],
    ['#about', 'About'],
  ],
}

export function Hero({ lang }: { lang: Lang }) {
  const t = DICT[lang].hero
  const capacity = getCapacity()
  const { email, isAdmin } = useAuth()
  const langPrefix = lang === 'en' ? '/en' : ''
  const intakeHref = `${langPrefix}/intake`
  const sessionsHref = `${langPrefix}${isAdmin ? '/admin/inbox' : '/me'}`
  const ctaLabel = email ? t.ctaLoggedIn : capacity.atCap ? t.ctaWaitlist : t.cta

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
