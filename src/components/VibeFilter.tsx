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
            {/* Hand-drawn red-pen check, intentionally wobbly. Decorative —
                the real labels live in the h3 + ul below. */}
            <svg
              className="vibe__mark vibe__mark--do"
              viewBox="0 0 100 100"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M 12 54 Q 26 70 38 78 Q 46 82 54 72 Q 72 48 92 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <h3>{t.do.title}</h3>
            <ul>
              {t.do.items.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>
          </div>
          <div className="vibe__rule" aria-hidden="true" />
          <div className="vibe__col vibe__col--dont">
            {/* Hand-drawn charcoal cross, two strokes with a slight curve so
                it reads as drawn rather than typeset. */}
            <svg
              className="vibe__mark vibe__mark--dont"
              viewBox="0 0 100 100"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M 18 22 Q 50 48 84 80"
                fill="none"
                stroke="currentColor"
                strokeWidth="10"
                strokeLinecap="round"
              />
              <path
                d="M 84 22 Q 52 50 18 80"
                fill="none"
                stroke="currentColor"
                strokeWidth="10"
                strokeLinecap="round"
              />
            </svg>
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
