import type { Lang } from '../i18n'
import { DICT } from '../i18n'

export function DemoEmbed({ lang }: { lang: Lang }) {
  const t = DICT[lang].demo
  return (
    <section className="section" id="demo">
      <div className="section__inner">
        <div className="section__eyebrow">{t.eyebrow}</div>
        <h2>{t.title}</h2>
        <p style={{ fontSize: 17, color: 'var(--text)' }}>{t.sub}</p>
        <div className="demo-embed">
          <p style={{ margin: 0, color: 'var(--text-mid)', fontSize: 16 }}>{t.body}</p>
          <div
            style={{
              marginTop: 18,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              flexWrap: 'wrap',
            }}
          >
            <a
              className="hero__cta"
              href={
                lang === 'fr' ? '/showcase/sunday-night-dread' : '/en/showcase/sunday-night-dread'
              }
            >
              {t.cta}
            </a>
            <span className="mono" style={{ fontSize: 13, color: 'var(--accent-warm)' }}>
              {t.tag}
            </span>
          </div>
          <div className="demo-embed__disclosure">{t.disclosure}</div>
        </div>
      </div>
    </section>
  )
}
