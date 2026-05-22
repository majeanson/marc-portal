import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { HOME_FOLIOS } from '../lib/folios'
import { HOME_SECTION_FEATURE, PAGE_FEATURE } from '../lib/features'
import { SectionEyebrow } from './SectionEyebrow'
import { CrossFeatureLink } from './CrossFeatureLink'

export function Pricing({ lang }: { lang: Lang }) {
  const t = DICT[lang].pricing
  const langPrefix = lang === 'fr' ? '' : '/en'
  // Each tier card links to the projects gallery pre-filtered to its tier, so
  // visitors who care about a given price level see actual work shipped at
  // that level before they submit. Tier 0 is the exception — it routes to its
  // dedicated self-serve patterns page since it isn't a paid engagement.
  const recoLabel = lang === 'fr' ? 'Le bon point de départ' : 'The sweet spot'
  const feature = HOME_SECTION_FEATURE['pricing']
  // Custodian-mode cross-link points at /handoff — a different feature
  // (keys). Reading from PAGE_FEATURE keeps the colour in sync if that
  // page ever moves clusters.
  const handoffFeature = PAGE_FEATURE['page.handoff']
  // Rescue is a parallel entry point (not a tier) — its callout links into
  // the intake, so it carries the intake cluster's colour.
  const intakeFeature = PAGE_FEATURE['page.intake']
  return (
    <section
      className="section section--alt section--editorial"
      id="pricing"
      data-feature={feature}
    >
      <div className="section__inner">
        <header className="section__head">
          <div className="section__folio mono" aria-hidden="true">
            {HOME_FOLIOS.pricing}
          </div>
          <SectionEyebrow lang={lang} feature={feature}>
            {t.eyebrow}
          </SectionEyebrow>
          <h2 className="section__display">{t.title}</h2>
          <p className="section__lead">{t.body}</p>
          <p className="tier__asof mono">
            {HOME_FOLIOS.pricing} — {t.asOf}
          </p>
        </header>
        <ol className="tiers tiers--menu">
          {t.tiers.map((tier) => {
            // Robust digit extraction so the routing keeps working when the
            // FR copy renames the prefix to "Niveau".
            const tierDigit = tier.name.match(/\d+/)?.[0] ?? '0'
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
                  <p className="tier__example">{tier.example}</p>
                  <div className="tier__after mono">{tier.after}</div>
                </a>
              </li>
            )
          })}
        </ol>
        {/* Hardware floor — a sizing rule, not a tier. Anything with a
            physical device skips the software-only lower tiers, so this
            sits first below the ladder where it qualifies a reader's tier
            guess before the parallel-entry notes. No CTA: it's a rule. */}
        <aside className="tier__hardware-note" aria-labelledby="tier-hardware-heading">
          <h3 id="tier-hardware-heading" className="tier__hardware-heading mono">
            {t.hardwareNoteHeading}
          </h3>
          <p className="tier__hardware-body">{t.hardwareNote}</p>
        </aside>
        {/* Rescue — a parallel entry point, not a tier. The ladder above
            measures build size; a rescue is sized by its audit, so it sits
            below the ladder as its own note and links into the intake. */}
        <aside className="tier__rescue-note" aria-labelledby="tier-rescue-heading">
          <h3 id="tier-rescue-heading" className="tier__rescue-heading mono">
            {t.rescueNoteHeading}
          </h3>
          <p className="tier__rescue-body">
            {t.rescueNote}{' '}
            <CrossFeatureLink
              lang={lang}
              feature={intakeFeature}
              href={`${langPrefix}/intake`}
              mono
            >
              {t.rescueNoteCta}
            </CrossFeatureLink>
          </p>
        </aside>
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
            <CrossFeatureLink
              lang={lang}
              feature={handoffFeature}
              href={`${langPrefix}/handoff`}
              mono
            >
              {t.custodianNoteCta}
            </CrossFeatureLink>
          </p>
        </aside>
        <p className="tier__disclaimer">{t.disclaimer}</p>
      </div>
    </section>
  )
}
