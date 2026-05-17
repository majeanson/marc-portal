import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { DICT, type Lang } from '../i18n'

/**
 * Catch-all 404 page. Replaces the previous silent <Navigate to="/"> which
 * swallowed bad URLs and made debugging "where did my link go?" impossible.
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

  return (
    <div className="app">
      <Header lang={lang} />
      <main id="main-content" className="page">
        <section className="page__panel page__panel--centered error-panel">
          <ErrorStamp label={lang === 'fr' ? 'PAS LÀ' : 'NOT HERE'} sub="404 · MARC.PORTAL" />
          <div className="mono section__eyebrow">404</div>
          <h1>{t.title}</h1>
          <p>{t.body}</p>
          <p className="mono not-found__path">
            {lang === 'en' ? 'You hit' : 'Tu es allé sur'}: <code>{loc.pathname}</code>
          </p>
          <div className="not-found__actions">
            <a className="hero__cta" href={lang === 'en' ? '/en' : '/'}>
              {t.homeCta}
            </a>
            <a className="not-found__intake-link mono" href={`${langPrefix}/intake`}>
              {t.intakeCta}
            </a>
          </div>
        </section>
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
