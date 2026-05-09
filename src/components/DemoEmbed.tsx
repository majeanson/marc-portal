import { lazy, Suspense } from 'react'
import type { Lang } from '../i18n'
import { DICT } from '../i18n'

// Cornerstone CTA: render the SND demo *inline* on the homepage instead of
// routing visitors to /showcase/... A cold-landing visitor (e.g. a roofer at
// 9pm Sunday) hits "play" inside 5s. Lazy-loaded so the homepage critical
// path stays small — the demo bundle (~12kb gz) only fetches when the visitor
// scrolls into this section.
const SndDemo = lazy(() => import('../pages/SndDemo').then((m) => ({ default: m.SndDemo })))

export function DemoEmbed({ lang }: { lang: Lang }) {
  const t = DICT[lang].demo
  const showcaseHref =
    lang === 'fr' ? '/showcase/sunday-night-dread' : '/en/showcase/sunday-night-dread'

  return (
    <section className="section" id="demo">
      <div className="section__inner">
        <div className="section__eyebrow">{t.eyebrow}</div>
        <h2>{t.title}</h2>
        <p style={{ fontSize: 17, color: 'var(--text)' }}>{t.sub}</p>

        <div className="demo-embed">
          <Suspense fallback={<p className="mono">…</p>}>
            <SndDemo lang={lang} embedded />
          </Suspense>
          <div
            style={{
              marginTop: 18,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              flexWrap: 'wrap',
            }}
          >
            <a className="hero__cta" href={showcaseHref}>
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
