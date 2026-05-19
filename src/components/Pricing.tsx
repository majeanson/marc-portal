import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { HOME_FOLIOS } from '../lib/folios'

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
            {HOME_FOLIOS.pricing}
          </div>
          <div className="section__eyebrow">{t.eyebrow}</div>
          <h2 className="section__display">{t.title}</h2>
          <p className="section__lead">{t.body}</p>
          <p className="tier__asof mono">
            {HOME_FOLIOS.pricing} — {t.asOf}
          </p>
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
        {/* Custodian-mode mini-section. Previously rendered only under the
            Tier-2 card via tier2Note, which falsely implied custodian was a
            Tier-2-only option. It applies to every paid tier (1, 2, 3) by
            default, so it lives below the tier list now as a single shared
            note instead of a per-card addendum. */}
        <aside className="tier__custodian-note" aria-labelledby="tier-custodian-heading">
          <h3 id="tier-custodian-heading" className="tier__custodian-heading mono">
            {t.custodianNoteHeading}
          </h3>
          <p className="tier__custodian-body">
            {t.custodianNote}{' '}
            <a href={`${langPrefix}/handoff`} className="tier__custodian-cta mono">
              {t.custodianNoteCta}
            </a>
          </p>
        </aside>
        <p className="tier__disclaimer">{t.disclaimer}</p>
      </div>
    </section>
  )
}
