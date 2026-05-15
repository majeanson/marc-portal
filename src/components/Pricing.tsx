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
  const recoLabel = lang === 'fr' ? 'Le bon point de départ' : 'The sweet spot'
  return (
    <section className="section section--alt section--editorial" id="pricing">
      <div className="section__inner">
        <header className="section__head">
          <div className="section__folio mono" aria-hidden="true">
            IV
          </div>
          <div className="section__eyebrow">{t.eyebrow}</div>
          <h2 className="section__display">{t.title}</h2>
          <p className="section__lead">{t.body}</p>
        </header>
        <ol className="tiers tiers--menu">
          {t.tiers.map((tier) => {
            const isTier0 = tier.name === 'Tier 0'
            const isAnchor = 'anchor' in tier && tier.anchor
            const cardClass = `tier tier--menu${isAnchor ? ' tier--anchor' : ''}`
            const inner = (
              <>
                {isAnchor && (
                  <span className="tier__stamp mono" aria-hidden="true">
                    {recoLabel}
                  </span>
                )}
                <div className="tier__head">
                  <span className="tier__name mono">{tier.name}</span>
                  <span className="tier__leader" aria-hidden="true" />
                  <span className="tier__price">{tier.price}</span>
                </div>
                <p className="tier__scope">{tier.scope}</p>
                <div className="tier__after mono">{tier.after}</div>
              </>
            )
            if (isTier0) {
              return (
                <li key={tier.name} className="tier__row">
                  <a className={`${cardClass} tier--link`} href={tier0Href}>
                    {inner}
                  </a>
                </li>
              )
            }
            if (isAnchor) {
              return (
                <li key={tier.name} className="tier__row">
                  <a className={`${cardClass} tier--link`} href={anchorHref}>
                    {inner}
                  </a>
                </li>
              )
            }
            return (
              <li key={tier.name} className="tier__row">
                <div className={cardClass}>{inner}</div>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
