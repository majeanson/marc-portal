import type { Lang } from '../i18n'
import { DICT } from '../i18n'

export function CTA({ lang }: { lang: Lang }) {
  const t = DICT[lang].cta
  return (
    <section className="section" id="cta">
      <div className="section__inner">
        <div className="section__eyebrow">{t.eyebrow}</div>
        <h2>{t.title}</h2>
        <p>{t.body}</p>
        <a className="hero__cta" href="/intake">
          {t.button}
        </a>
        <div
          style={{
            marginTop: 12,
            fontSize: 13,
            color: 'var(--text-soft)',
            fontFamily: 'var(--mono)',
          }}
        >
          {t.micro}
        </div>
      </div>
    </section>
  )
}
