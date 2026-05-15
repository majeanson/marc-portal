import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { useAuth } from '../lib/authContext'

export function CTA({ lang }: { lang: Lang }) {
  const t = DICT[lang].cta
  const { email } = useAuth()
  const intakeHref = `${lang === 'en' ? '/en' : ''}/intake`
  return (
    <section className="section section--editorial section--finale" id="cta">
      <div className="section__inner cta__inner">
        <div className="asterism" aria-hidden="true">
          ✶ ✶ ✶
        </div>
        <div className="section__eyebrow">{t.eyebrow}</div>
        <h2 className="cta__title">{t.title}</h2>
        <p className="cta__body">{t.body}</p>
        <a className="hero__cta cta__button" href={intakeHref}>
          {email ? t.buttonLoggedIn : t.button}
        </a>
        <div className="cta__micro mono">{t.micro}</div>
      </div>
    </section>
  )
}
