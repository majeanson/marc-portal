import { useEffect } from 'react'
import { useLocation, useRouteError, isRouteErrorResponse } from 'react-router-dom'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { DICT, type Lang } from '../i18n'
import { captureException } from '../lib/sentry'

/**
 * Root-level error boundary. Wired as `errorElement` on the layout route in
 * router.tsx — catches anything a route or its loaders throw, including the
 * common case of a `lazy()` chunk failing to fetch after a deploy raced the
 * navigation.
 *
 * For 404s from inside the router (path-not-matched returns an
 * ErrorResponse), we render the same "this page doesn't exist" body as
 * NotFound so the experience is identical regardless of how we got here.
 */
export function RouteError() {
  const err = useRouteError()
  const loc = useLocation()
  const lang: Lang = loc.pathname === '/en' || loc.pathname.startsWith('/en/') ? 'en' : 'fr'
  const isNotFound = isRouteErrorResponse(err) && err.status === 404
  const t = DICT[lang][isNotFound ? 'notFound' : 'errorBoundary']

  useEffect(() => {
    document.title = `${t.title} — Marc`
    if (!isNotFound) {
      console.error('route error boundary caught:', err)
      // Forward to Sentry. 404s aren't reported (expected user behavior); a
      // genuine throw from a route or its lazy() loader is.
      captureException(err, { path: loc.pathname })
    }
  }, [t, isNotFound, err, loc.pathname])

  return (
    <div className="app">
      <Header lang={lang} />
      <main id="main-content" className="page">
        <section className="page__panel page__panel--centered">
          <div className="mono section__eyebrow">{isNotFound ? '404' : '500'}</div>
          <h1>{t.title}</h1>
          <p>{t.body}</p>
          <div className="not-found__actions">
            {!isNotFound && (
              <button type="button" className="hero__cta" onClick={() => window.location.reload()}>
                {DICT[lang].errorBoundary.refreshCta}
              </button>
            )}
            <a
              className={isNotFound ? 'hero__cta' : 'not-found__intake-link mono'}
              href={lang === 'en' ? '/en' : '/'}
            >
              {t.homeCta}
            </a>
          </div>
        </section>
      </main>
      <Footer lang={lang} />
    </div>
  )
}
