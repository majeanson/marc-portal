import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { cssVars } from '../lib/styleVars'
import { HOME_FOLIOS } from '../lib/folios'
import { SectionEyebrow } from './SectionEyebrow'
import { HomeDrillCard } from './HomeDrillCard'
import { HOME_SECTION_FEATURE, PAGE_FEATURE } from '../lib/features'
import { Surface } from './Surface'

export function HowItWorks({ lang }: { lang: Lang }) {
  const t = DICT[lang].how
  const journeyHref = lang === 'fr' ? '/parcours' : '/en/journey'
  // HOME_SECTION_FEATURE['how'] is undefined on purpose — this section
  // covers the whole arc (intake → conversation → builds → handoff),
  // pinning it to one colour would be a half-truth. The eyebrow still
  // gets a neutral hollow dot so the rhythm holds.
  const feature = HOME_SECTION_FEATURE['how']
  return (
    <section className="section section--alt section--editorial" id="how" data-feature={feature}>
      <div className="section__inner">
        <header className="section__head">
          <div className="section__folio mono" aria-hidden="true">
            {HOME_FOLIOS.how}
          </div>
          <SectionEyebrow lang={lang} feature={feature}>
            {t.eyebrow}
          </SectionEyebrow>
          <h2 className="section__display">{t.title}</h2>
        </header>
        <ol className="steps steps--editorial">
          {t.steps.map((s, i) => (
            <Surface
              as="li"
              key={s.num}
              className="step step--editorial"
              style={cssVars({ '--i': i })}
            >
              <div className="step__numeral" aria-hidden="true">
                {s.num}
              </div>
              <div className="step__body">
                <h3 className="step__title">{s.title}</h3>
                <p>{s.body}</p>
              </div>
            </Surface>
          ))}
        </ol>
        {/* Drill-card to /parcours (Journey) — that page belongs to the
            intake feature, so the dot + eyebrow carry the sage accent. */}
        <HomeDrillCard
          lang={lang}
          feature={PAGE_FEATURE['page.journey']}
          href={journeyHref}
          eyebrow={t.journeyCard.eyebrow}
          title={t.journeyCard.title}
          body={t.journeyCard.body}
          cta={t.journeyCard.cta}
          stats={t.journeyCard.stats}
        />
      </div>
    </section>
  )
}
