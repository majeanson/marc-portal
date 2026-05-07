import type { Lang } from '../i18n'
import { DICT } from '../i18n'

export function Pricing({ lang }: { lang: Lang }) {
  const t = DICT[lang].pricing
  const tier0Href = lang === 'fr' ? '/tier-0' : '/en/tier-0'
  return (
    <section className="section section--alt" id="pricing">
      <div className="section__inner">
        <div className="section__eyebrow">{t.eyebrow}</div>
        <h2>{t.title}</h2>
        <p>{t.body}</p>
        <div className="tiers">
          {t.tiers.map((tier) => {
            const isTier0 = tier.name === 'Tier 0'
            const cardClass = `tier${'anchor' in tier && tier.anchor ? ' tier--anchor' : ''}`
            const inner = (
              <>
                <div className="tier__name">{tier.name}</div>
                <div className="tier__price">{tier.price}</div>
                <p className="tier__scope">{tier.scope}</p>
                <div className="tier__after">{tier.after}</div>
              </>
            )
            if (isTier0) {
              return (
                <a key={tier.name} className={`${cardClass} tier--link`} href={tier0Href}>
                  {inner}
                </a>
              )
            }
            return (
              <div key={tier.name} className={cardClass}>
                {inner}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
