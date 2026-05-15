import type { Lang } from '../i18n'
import { DICT } from '../i18n'

const GITHUB_URL = 'https://github.com/majeanson'
const LINKEDIN_URL = 'https://www.linkedin.com/in/marc-jeanson/'
// onError on the img hides the figure if /marc.jpg ever 404s, so a missing
// asset degrades to text-only rather than a broken-image icon.
const PORTRAIT_SRC = '/marc.jpg'

export function About({ lang }: { lang: Lang }) {
  const t = DICT[lang].about
  return (
    <section className="section section--alt section--editorial" id="about">
      <div className="section__inner">
        <header className="section__head">
          <div className="section__folio mono" aria-hidden="true">
            VI
          </div>
          <div className="section__eyebrow">{t.eyebrow}</div>
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
              <li>
                <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer">
                  {t.linkedinLabel}
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
