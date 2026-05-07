import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { CapacityCounter } from './CapacityCounter'
import { getCapacity } from '../lib/capacity'
import { useAuth } from '../lib/authContext'

export function Hero({ lang }: { lang: Lang }) {
  const t = DICT[lang].hero
  const capacity = getCapacity()
  const { email, isAdmin } = useAuth()
  const langPrefix = lang === 'en' ? '/en' : ''
  const intakeHref = `${langPrefix}/intake`
  const sessionsHref = `${langPrefix}${isAdmin ? '/admin/inbox' : '/me'}`
  const ctaLabel = email ? t.ctaLoggedIn : capacity.atCap ? t.ctaWaitlist : t.cta

  return (
    <section className="section hero">
      <div className="section__inner">
        <div className="section__eyebrow">{t.eyebrow}</div>
        <h1>{t.salut}</h1>
        <p className="hero__lead">{t.body1}</p>
        <p className="hero__lead">
          <strong>{t.body2}</strong>
        </p>
        <p className="hero__lead">{t.body3}</p>
        <a className="hero__cta" href={intakeHref}>
          {ctaLabel}
        </a>
        {email && (
          <div style={{ marginTop: 12, fontSize: 13, fontFamily: 'var(--mono)' }}>
            <a href={sessionsHref}>{t.mySessionsLink}</a>
          </div>
        )}
        <div
          style={{
            marginTop: 12,
            fontSize: 13,
            color: 'var(--text-soft)',
            fontFamily: 'var(--mono)',
          }}
        >
          {t.bilingual}
        </div>
        <CapacityCounter lang={lang} />
      </div>
    </section>
  )
}
