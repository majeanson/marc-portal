import type { Lang } from '../i18n'
import { DICT } from '../i18n'

export function HowItWorks({ lang }: { lang: Lang }) {
  const t = DICT[lang].how
  return (
    <section className="section section--alt" id="how">
      <div className="section__inner">
        <div className="section__eyebrow">{t.eyebrow}</div>
        <h2>{t.title}</h2>
        <ol className="steps">
          {t.steps.map((s) => (
            <li key={s.num} className="step">
              <div className="step__num">{s.num}</div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
