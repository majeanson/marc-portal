import type { Lang } from '../i18n'
import { DICT } from '../i18n'

export function Pricing({ lang }: { lang: Lang }) {
  const t = DICT[lang].pricing
  const langPrefix = lang === 'fr' ? '' : '/en'
  // Each tier card links to the projects gallery pre-filtered to its tier, so
  // visitors who care about a given price level see actual work shipped at
  // that level before they submit. Tier 0 is the exception — it routes to its
  // dedicated self-serve patterns page since it isn't a paid engagement.
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
            const tierDigit = tier.name.replace(/^Tier\s*/, '')
            const isTier0 = tierDigit === '0'
            const isAnchor = 'anchor' in tier && tier.anchor
            const cardClass = `tier tier--menu${isAnchor ? ' tier--anchor' : ''}`
            const href = isTier0
              ? `${langPrefix}/tier-0`
              : `${langPrefix}/projects?tier=${tierDigit}`
            return (
              <li key={tier.name} className="tier__row">
                <a className={`${cardClass} tier--link`} href={href}>
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
                </a>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
