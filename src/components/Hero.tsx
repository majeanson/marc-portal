import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { CapacityCounter } from './CapacityCounter'
import { getCapacity } from '../lib/capacity'

export function Hero({ lang }: { lang: Lang }) {
  const t = DICT[lang].hero
  const capacity = getCapacity()
  const intakeHref = lang === 'fr' ? '/intake' : '/en/intake'
  const ctaLabel = capacity.atCap ? t.ctaWaitlist : t.cta

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
