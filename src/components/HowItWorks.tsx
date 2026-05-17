import type { Lang } from '../i18n'
import { DICT } from '../i18n'

export function HowItWorks({ lang }: { lang: Lang }) {
  const t = DICT[lang].how
  const journeyHref = lang === 'fr' ? '/parcours' : '/en/journey'
  return (
    <section className="section section--alt section--editorial" id="how">
      <div className="section__inner">
        <header className="section__head">
          <div className="section__folio mono" aria-hidden="true">
            II
          </div>
          <div className="section__eyebrow">{t.eyebrow}</div>
          <h2 className="section__display">{t.title}</h2>
        </header>
        <ol className="steps steps--editorial">
          {t.steps.map((s) => (
            <li key={s.num} className="step step--editorial">
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
        <a className="how__journey-card" href={journeyHref}>
          <div className="how__journey-card-text">
            <div className="how__journey-card-eyebrow mono">{t.journeyCard.eyebrow}</div>
            <h3 className="how__journey-card-title">{t.journeyCard.title}</h3>
            <p className="how__journey-card-body">{t.journeyCard.body}</p>
          </div>
          <ul className="how__journey-card-stats" aria-hidden="true">
            {t.journeyCard.stats.map((s) => (
              <li key={s.label} className="how__journey-card-stat">
                <span className="how__journey-card-stat-val">{s.val}</span>
                <span className="how__journey-card-stat-label mono">{s.label}</span>
              </li>
            ))}
          </ul>
          <span className="how__journey-card-cta mono">{t.journeyCard.cta}</span>
        </a>
      </div>
    </section>
  )
}
