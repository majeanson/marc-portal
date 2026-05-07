import type { Lang } from '../i18n'
import { DICT } from '../i18n'

export function VibeFilter({ lang }: { lang: Lang }) {
  const t = DICT[lang].vibe
  return (
    <section className="section" id="vibe">
      <div className="section__inner">
        <div className="section__eyebrow">{t.eyebrow}</div>
        <h2>{t.title}</h2>
        <p>{t.body}</p>
        <div className="vibe">
          <div className="vibe__col vibe__col--do">
            <h3>{t.do.title}</h3>
            <ul>
              {t.do.items.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>
          </div>
          <div className="vibe__col vibe__col--dont">
            <h3>{t.dont.title}</h3>
            <ul>
              {t.dont.items.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
