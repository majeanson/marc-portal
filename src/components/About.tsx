import type { Lang } from '../i18n'
import { DICT } from '../i18n'

export function About({ lang }: { lang: Lang }) {
  const t = DICT[lang].about
  return (
    <section className="section section--alt" id="about">
      <div className="section__inner">
        <div className="section__eyebrow">{t.eyebrow}</div>
        <h2>{t.title}</h2>
        <p>{t.body}</p>
        <p>{t.body2}</p>
      </div>
    </section>
  )
}
