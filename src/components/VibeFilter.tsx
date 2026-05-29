import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { HOME_FOLIOS } from '../lib/folios'
import { HOME_SECTION_FEATURE } from '../lib/features'
import { SectionEyebrow } from './SectionEyebrow'

export function VibeFilter({ lang }: { lang: Lang }) {
  const t = DICT[lang].vibe
  const feature = HOME_SECTION_FEATURE['vibe']
  return (
    <section className="section section--editorial" id="vibe" data-feature={feature}>
      <div className="section__inner">
        <header className="section__head">
          <div className="section__folio mono" aria-hidden="true">
            {HOME_FOLIOS.vibe}
          </div>
          <SectionEyebrow lang={lang} feature={feature}>
            {t.eyebrow}
          </SectionEyebrow>
          <h2 className="section__display">{t.title}</h2>
          <p className="section__lead">{t.body}</p>
        </header>
        <div className="vibe vibe--ledger">
          <div className="vibe__col vibe__col--do">
            <h3>{t.do.title}</h3>
            <ul>
              {t.do.items.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>
          </div>
          <div className="vibe__rule" aria-hidden="true" />
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
