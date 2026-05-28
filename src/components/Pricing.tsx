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
                    {/* Per-tier community-discount chip on every paid tier
                        (1–4). Replaces the standalone strip that used to
                        sit below the ladder — R3 design pass: a strip read
                        as a SaaS coupon banner; per-tier chip reads as a
                        ledger annotation a reader at the right tier will
                        actually see. */}
                    {!isTier0 && (
                      <span className="tier__community-chip mono" aria-label={t.communityNote}>
                        {t.communityChip}
                      </span>
                    )}
                  </div>
                  <p className="tier__scope">{tier.scope}</p>
                  <p className="tier__example">{tier.example}</p>
                  <div className="tier__after mono">{tier.after}</div>
                </a>
              </li>
            )
          })}
        </ol>
        {/* Community-rate promo used to live here as a standalone strip,
            but it pattern-matched as a SaaS coupon banner. The discount is
            now annotated per-tier inside .tier__community-chip (see above),
            visible to anyone scanning the actual price they'd pay. Long-
            form context is preserved in the `tier__more` disclosure below
            under communityNote. */}
        {/* Disclosure: the four sizing/parallel-entry notes. Native
            <details> — no JS state, browsers and screen readers know the
            pattern. Each note keeps its existing class so the cream-card
            styling is untouched; the <details> wrapper only adds the
            summary affordance. */}
        <details className="tier__more">
          <summary className="tier__more-summary mono">
            <span className="tier__more-label">{t.moreInfoLabel}</span>
            <span className="tier__more-marker" aria-hidden="true">
              +
            </span>
          </summary>
          <div className="tier__more-body">
            <aside className="tier__hardware-note" aria-labelledby="tier-hardware-heading">
              <h3 id="tier-hardware-heading" className="tier__hardware-heading mono">
                {t.hardwareNoteHeading}
              </h3>
              <p className="tier__hardware-body">{t.hardwareNote}</p>
            </aside>
            <aside className="tier__hardware-note" aria-labelledby="tier-community-heading">
              <h3 id="tier-community-heading" className="tier__hardware-heading mono">
                {t.communityNoteHeading}
              </h3>
              <p className="tier__hardware-body">{t.communityNote}</p>
            </aside>
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
          </div>
        </details>
        <p className="tier__disclaimer">{t.disclaimer}</p>
      </div>
    </section>
  )
}
