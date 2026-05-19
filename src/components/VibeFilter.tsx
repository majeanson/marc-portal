import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { HOME_FOLIOS } from '../lib/folios'

export function VibeFilter({ lang }: { lang: Lang }) {
  const t = DICT[lang].vibe
  return (
    <section className="section section--editorial" id="vibe">
      <div className="section__inner">
        <header className="section__head">
          <div className="section__folio mono" aria-hidden="true">
            {HOME_FOLIOS.vibe}
          </div>
          <div className="section__eyebrow">{t.eyebrow}</div>
          <h2 className="section__display">{t.title}</h2>
          <p className="section__lead">{t.body}</p>
        </header>
        <div className="vibe vibe--ledger">
          <div className="vibe__col vibe__col--do">
            <div className="vibe__mark vibe__mark--do" aria-hidden="true">
              ✓
            </div>
            <h3>{t.do.title}</h3>
            <ul>
              {t.do.items.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>
          </div>
          <div className="vibe__rule" aria-hidden="true" />
          <div className="vibe__col vibe__col--dont">
            <div className="vibe__mark vibe__mark--dont" aria-hidden="true">
              ✗
            </div>
            <h3>{t.dont.title}</h3>
            <ul>
              {t.dont.items.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>
          </div>
        </div>
        {/* Permission line — softens the gate created by the do/don't ledger
            above so a visitor with an idea that doesn't obviously fit a row
            doesn't quietly close the tab. Triage is Marc's job, not theirs. */}
        <p className="vibe__outro">{t.outro}</p>
      </div>
    </section>
  )
}
