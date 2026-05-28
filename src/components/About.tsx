import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { HOME_FOLIOS } from '../lib/folios'
import { HOME_SECTION_FEATURE } from '../lib/features'

const GITHUB_URL = 'https://github.com/majeanson'
// onError on the img hides the figure if /marc.jpg ever 404s, so a missing
// asset degrades to text-only rather than a broken-image icon.
const PORTRAIT_SRC = '/marc.jpg'

export function About({ lang }: { lang: Lang }) {
  const t = DICT[lang].about
  // HOME_SECTION_FEATURE['about'] = undefined on purpose — About is bio,
  // not a feature.
  const feature = HOME_SECTION_FEATURE['about']
  return (
    <section className="section section--alt section--editorial" id="about" data-feature={feature}>
      <div className="section__inner">
        {/* About deliberately skips the SectionEyebrow scaffolding (folio +
            eyebrow chip + hairline + feature dot) every other home section
            wears. By section 4 the eye predicts the template and skips
            ahead; About is Marc's own section and reads better arriving
            without the editorial frame, just folio + h2. */}
        <header className="section__head section__head--bare">
          <div className="section__folio mono" aria-hidden="true">
            {HOME_FOLIOS.about}
          </div>
          <h2 className="section__display">{t.title}</h2>
        </header>
        <div className="about__layout about__layout--editorial">
          <figure className="about__portrait-frame">
            <img
              className="about__portrait"
              src={PORTRAIT_SRC}
              alt={t.portraitAlt}
              loading="lazy"
              width={180}
              height={180}
              onError={(e) => {
                ;(e.currentTarget.parentElement as HTMLElement).style.display = 'none'
              }}
            />
            <figcaption className="about__portrait-caption mono">{t.portraitAlt}</figcaption>
          </figure>
          <div className="about__copy">
            <p className="about__dropcap">{t.body}</p>
            <p>{t.body2}</p>
            <ul className="about__links" aria-label={t.title}>
              <li>
                <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                  {t.githubLabel}
                  <span aria-hidden="true"> ↗</span>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
