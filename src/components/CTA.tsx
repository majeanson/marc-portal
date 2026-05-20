import type { Lang } from '../i18n'
import { DICT } from '../i18n'
import { useAuth } from '../lib/authContext'
import { HOME_SECTION_FEATURE } from '../lib/features'
import { SectionEyebrow } from './SectionEyebrow'

export function CTA({ lang }: { lang: Lang }) {
  const t = DICT[lang].cta
  const { email } = useAuth()
  const intakeHref = `${lang === 'en' ? '/en' : ''}/intake`
  const feature = HOME_SECTION_FEATURE['cta']
  return (
    <section className="section section--editorial section--finale" id="cta" data-feature={feature}>
      <div className="section__inner cta__inner">
        <div className="asterism" aria-hidden="true">
          ✶ ✶ ✶
        </div>
        <SectionEyebrow lang={lang} feature={feature}>
          {t.eyebrow}
        </SectionEyebrow>
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
