import type { Lang } from '../i18n'
import { DICT } from '../i18n'

export function Pricing({ lang }: { lang: Lang }) {
  const t = DICT[lang].pricing
  const tier0Href = lang === 'fr' ? '/tier-0' : '/en/tier-0'
  // The "anchor" tier card is the price-anchor — Tier 2 in the lineup. It
  // links to the live /projects gallery; visitors who care about the price
  // see actual Tier 2 work being shipped (badged on each card) instead of a
  // single curated demo.
  const anchorHref = lang === 'fr' ? '/projects' : '/en/projects'
  return (
    <section className="section section--alt" id="pricing">
      <div className="section__inner">
        <div className="section__eyebrow">{t.eyebrow}</div>
        <h2>{t.title}</h2>
        <p>{t.body}</p>
        <div className="tiers">
          {t.tiers.map((tier) => {
            const isTier0 = tier.name === 'Tier 0'
            const isAnchor = 'anchor' in tier && tier.anchor
            const cardClass = `tier${isAnchor ? ' tier--anchor' : ''}`
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
            if (isAnchor) {
              return (
                <a key={tier.name} className={`${cardClass} tier--link`} href={anchorHref}>
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
