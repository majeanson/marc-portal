import type { Lang } from '../i18n'
import { DICT } from '../i18n'

const GITHUB_URL = 'https://github.com/majeanson'
const LINKEDIN_URL = 'https://www.linkedin.com/in/marc-jeanson/'
// Drop a real photo at /public/marc.jpg to replace this placeholder. The
// component falls back gracefully (no image rendered) if the file is missing.
const PORTRAIT_SRC = '/marc.jpg'

export function About({ lang }: { lang: Lang }) {
  const t = DICT[lang].about
  return (
    <section className="section section--alt" id="about">
      <div className="section__inner">
        <div className="section__eyebrow">{t.eyebrow}</div>
        <h2>{t.title}</h2>
        <div className="about__layout">
          <img
            className="about__portrait"
            src={PORTRAIT_SRC}
            alt={t.portraitAlt}
            loading="lazy"
            width={140}
            height={140}
            // If the portrait isn't deployed yet, hide it rather than show a
            // broken-image icon (the rest of the section reads fine without it).
            onError={(e) => {
              ;(e.currentTarget as HTMLImageElement).style.display = 'none'
            }}
          />
          <div className="about__copy">
            <p>{t.body}</p>
            <p>{t.body2}</p>
            <ul className="about__links" aria-label={t.title}>
              <li>
                <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                  {t.githubLabel}
                </a>
              </li>
              <li>
                <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer">
                  {t.linkedinLabel}
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
