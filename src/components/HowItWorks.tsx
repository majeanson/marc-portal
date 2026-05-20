import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { cssVars } from '../lib/styleVars'
import { HOME_FOLIOS } from '../lib/folios'
import { FeatureDot } from './FeatureDot'
import { PAGE_FEATURE } from '../lib/features'

export function HowItWorks({ lang }: { lang: Lang }) {
  const t = DICT[lang].how
  const journeyHref = lang === 'fr' ? '/parcours' : '/en/journey'
  return (
    <section className="section section--alt section--editorial" id="how">
      <div className="section__inner">
        <header className="section__head">
          <div className="section__folio mono" aria-hidden="true">
            {HOME_FOLIOS.how}
          </div>
          <div className="section__eyebrow">{t.eyebrow}</div>
          <h2 className="section__display">{t.title}</h2>
        </header>
        <ol className="steps steps--editorial">
          {t.steps.map((s, i) => (
            <li key={s.num} className="step step--editorial" style={cssVars({ '--i': i })}>
              <div className="step__numeral" aria-hidden="true">
                {s.num}
              </div>
              <div className="step__body">
                <h3 className="step__title">{s.title}</h3>
                <p>{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        {/* Drill-card to /parcours (Journey) — that page belongs to the
            intake feature, so the dot carries the sage accent and the
            eyebrow inherits --ft-color via data-feature on the wrapper. */}
        <div className="home-drill-card-wrap" data-feature={PAGE_FEATURE['page.journey']}>
          <a className="home-drill-card" href={journeyHref}>
            <div className="home-drill-card-text">
              <span className="home-drill-card-feature">
                <FeatureDot
                  feature={PAGE_FEATURE['page.journey']}
                  lang={lang}
                  size="sm"
                  decorative
                />
                <span className="home-drill-card-eyebrow mono">{t.journeyCard.eyebrow}</span>
              </span>
              <h3 className="home-drill-card-title">{t.journeyCard.title}</h3>
              <p className="home-drill-card-body">{t.journeyCard.body}</p>
            </div>
            <ul className="home-drill-card-stats" aria-hidden="true">
              {t.journeyCard.stats.map((s) => (
                <li key={s.label} className="home-drill-card-stat">
                  <span className="home-drill-card-stat-val">{s.val}</span>
                  <span className="home-drill-card-stat-label mono">{s.label}</span>
                </li>
              ))}
            </ul>
            <span className="home-drill-card-cta mono">{t.journeyCard.cta}</span>
          </a>
        </div>
      </div>
    </section>
  )
}
