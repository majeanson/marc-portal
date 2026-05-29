import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { FeatureGlyph } from '../lib/featureGlyphs'
import { DICT, type Lang } from '../i18n'
import { Surface } from '../components/Surface'

/**
 * Catch-all 404 page. Replaces the previous silent <Navigate to="/"> which
 * swallowed bad URLs and made debugging "where did my link go?" impossible.
 *
 * The page renders as a torn corner of the /carte atlas: a small hand-drawn
 * map fragment with a "you are here… actually, no" marker over the bad URL,
 * and the nearest real pages as the routes back. The plain action buttons
 * stay below as the reliable, accessible fallback.
 *
 * Language inferred from the URL prefix — visitors who land on /en/foo see EN
 * copy, everyone else sees FR. We don't try harder than that (no Accept-Language
 * negotiation) because by definition the URL is bogus.
 */
export function NotFound() {
  const loc = useLocation()
  const lang: Lang = loc.pathname === '/en' || loc.pathname.startsWith('/en/') ? 'en' : 'fr'
  const t = DICT[lang].notFound
  const langPrefix = lang === 'en' ? '/en' : ''

  useEffect(() => {
    document.title = `${t.title} — Marc`
  }, [t])

  // The nearest real pages — they double as the way back. Positions are
  // percentages inside the map canvas; the connector lines below run to the
  // same coordinates.
  const nodes = [
    { x: 17, y: 22, href: `${langPrefix}/`.replace(/\/$/, '') || '/', label: t.mapHome },
    {
      x: 83,
      y: 30,
      href: `${langPrefix}/projects`,
      label: t.mapProjects,
      feature: 'shipped' as const,
    },
    {
      x: 33,
      y: 80,
      href: lang === 'en' ? '/en/map' : '/carte',
      label: t.mapAtlas,
      feature: 'meta' as const,
    },
  ]

  return (
    <div className="app">
      <Header lang={lang} />
      <main id="main-content" className="page">
        <Surface as="section" className="page__panel page__panel--centered error-panel">
          <ErrorStamp label={lang === 'fr' ? 'PAS LÀ' : 'NOT HERE'} sub="404 · MARC.PORTAL" />
          <div className="mono section__eyebrow">404</div>
          <h1>{t.title}</h1>
          <p>{t.body}</p>

          <div className="not-found__map">
            <p className="not-found__map-eyebrow mono">{t.mapEyebrow}</p>
            <div className="not-found__map-canvas">
              <svg
                className="not-found__map-lines"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path d="M50,52 Q30,40 17,22" />
                <path d="M50,52 Q70,36 83,30" />
                <path d="M50,52 Q44,68 33,80" />
              </svg>

              {nodes.map((n) => (
                <a
                  key={n.href}
                  className="not-found__node"
                  data-feature={n.feature}
                  href={n.href}
                  style={{ left: `${n.x}%`, top: `${n.y}%` }}
                >
                  <span className="not-found__node-disc">
                    {n.feature && <FeatureGlyph feature={n.feature} />}
                  </span>
                  <span className="not-found__node-label mono">{n.label}</span>
                </a>
              ))}

              <div className="not-found__here" style={{ left: '50%', top: '52%' }}>
                <span className="not-found__here-mark" aria-hidden="true">
                  ✕
                </span>
                <span className="not-found__here-label mono">{t.mapHere}</span>
                <code className="not-found__here-path">{loc.pathname}</code>
              </div>
            </div>
          </div>

          <div className="not-found__actions">
            <a className="hero__cta" href={lang === 'en' ? '/en' : '/'}>
              {t.homeCta}
            </a>
            <a className="not-found__intake-link mono" href={`${langPrefix}/intake`}>
              {t.intakeCta}
            </a>
          </div>
        </Surface>
      </main>
      <Footer lang={lang} />
    </div>
  )
}

/** Shared corner stamp for error pages (NotFound + RouteError). Renders the
 *  same VÉRIFIÉ-style mark but with a context-specific label (PAS LÀ / NOT
 *  HERE on 404, RATÉ / FUMBLED on RouteError). Decorative, aria-hidden. */
export function ErrorStamp({ label, sub }: { label: string; sub: string }) {
  return (
    <svg className="error-panel__stamp" viewBox="0 0 260 100" aria-hidden="true" focusable="false">
      <g transform="translate(130 50) rotate(-7)">
        <rect
          x="-122"
          y="-42"
          width="244"
          height="84"
          rx="10"
          ry="10"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        />
        <rect
          x="-114"
          y="-34"
          width="228"
          height="68"
          rx="6"
          ry="6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <text
          x="0"
          y="-4"
          textAnchor="middle"
          fontFamily="var(--mono), monospace"
          fontSize="20"
          fontWeight="700"
          letterSpacing="4"
          fill="currentColor"
        >
          {label}
        </text>
        <text
          x="0"
          y="20"
          textAnchor="middle"
          fontFamily="var(--mono), monospace"
          fontSize="11"
          letterSpacing="5"
          fill="currentColor"
        >
          {sub}
        </text>
      </g>
    </svg>
  )
}
