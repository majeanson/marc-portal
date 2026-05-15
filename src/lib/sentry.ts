/**
 * Sentry init for the browser SPA.
 *
 * Loi 25 posture (see docs/loi-25-pia.md for the full PIA):
 *   - DSN is hardcoded; the DSN is public-by-design (authorizes writes to
 *     one Sentry project, nothing else, and is already shipped to every
 *     visitor in this very bundle). Rotation: Sentry UI → Settings →
 *     Client Keys (DSN) → Rotate, then update the literal below.
 *   - We send the absolute minimum: error, stack, browser/OS, environment,
 *     path-only URL (query strings stripped — magic-link tokens, session
 *     ids must never leak to a US processor).
 *   - We DO NOT attach the visitor's email to events. Only the operator's
 *     own email (Marc — same person, same Sentry org) gets attached; for
 *     everyone else, Sentry events are anonymous and cannot be tied back
 *     to a specific Quebec resident. This collapses our Loi 25 "right of
 *     access on Sentry events" exposure to ~zero.
 *   - No session replay, no perf traces (each would carry richer PI).
 *   - 30-day retention configured in Sentry's dashboard (Marc's action).
 *
 * Sample rates are intentionally low — this is a low-traffic site and we
 * want the free tier to last. Errors are 100%; traces off by default.
 */

import * as Sentry from '@sentry/react'

const DSN = 'https://27bdc4debd1f4925a9d379a6936e0786@o4510241708244992.ingest.us.sentry.io/4511395627008001'
const ENABLED = DSN.length > 0

// Tag events with the deployment environment so prod and preview don't mix
// in the same issue stream. Inferred at call time from the runtime host so
// preview deploys (with their hashed subdomain) tag correctly without any
// build-time CF env-var plumbing.
function inferEnvironment(): 'production' | 'preview' | 'development' {
  if (typeof window === 'undefined') return 'production'
  const host = window.location.hostname
  if (host === 'localhost' || host.startsWith('127.0.0.1')) return 'development'
  if (host.endsWith('.pages.dev') && /^[a-f0-9]{8}\./.test(host)) return 'preview'
  return 'production'
}

/** Strip the query string from a URL. Magic-link verify URLs carry the
 * single-use token in `?token=...`; share/session URLs may carry capability
 * IDs; the lang param itself isn't PI but it's noise we don't need either.
 * Path-only is always enough for "where did this error happen". */
function stripQueryString(url: string | undefined): string | undefined {
  if (!url || typeof url !== 'string') return url
  const i = url.indexOf('?')
  return i === -1 ? url : url.slice(0, i)
}

export function initSentry(): void {
  Sentry.init({
    dsn: DSN ?? '',
    enabled: ENABLED,
    environment: inferEnvironment(),
    // 100% of errors. This is a 1-active-user app; volume is fine.
    sampleRate: 1.0,
    // Performance traces disabled by default. Flip on when investigating.
    tracesSampleRate: 0,
    // Don't capture session replays by default — privacy + bytes.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    // Disable auto-IP collection at the SDK level. Sentry server-side
    // also has a "Prevent Storing of IP Addresses" toggle (Marc's action;
    // see docs/loi-25-pia.md).
    sendDefaultPii: false,
    // Common noise we don't care about.
    ignoreErrors: [
      // Browser extensions / content-blockers
      'top.GLOBALS',
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      // Network blips on lazy chunk fetches — covered by the route error
      // boundary, which prompts a refresh.
      'ChunkLoadError',
      // User cancelled navigation mid-fetch
      'AbortError: The user aborted a request.',
    ],
    beforeSend(event) {
      // 1. Strip auth-bearing headers from any captured request frame.
      //    `X-CSRF-Token` isn't a secret (the cookie can also be read by
      //    the SPA) but it's not useful to Sentry and removing it shrinks
      //    the surface.
      if (event.request?.headers) {
        delete event.request.headers.Cookie
        delete event.request.headers.cookie
        delete event.request.headers.Authorization
        delete event.request.headers['X-CSRF-Token']
      }
      // 2. Strip query string from event.request.url. Magic-link tokens
      //    in /api/auth/verify?token=... must never reach a third party.
      if (event.request?.url) {
        event.request.url = stripQueryString(event.request.url) ?? event.request.url
        // Also drop query_string explicitly if Sentry parsed it out.
        if ('query_string' in event.request) delete event.request.query_string
      }
      // 3. Defensively nullify IP (sendDefaultPii: false should already
      //    prevent this; belt-and-suspenders for Loi 25 minimization).
      if (event.user) {
        event.user.ip_address = undefined
      }
      // 4. Strip query strings from breadcrumb URLs (fetch breadcrumbs
      //    auto-capture full URLs — same /api/auth/verify?token risk).
      if (event.breadcrumbs) {
        for (const b of event.breadcrumbs) {
          const d = b.data as { url?: string; to?: string; from?: string } | undefined
          if (d?.url) d.url = stripQueryString(d.url) ?? d.url
          if (d?.to) d.to = stripQueryString(d.to) ?? d.to
          if (d?.from) d.from = stripQueryString(d.from) ?? d.from
        }
      }
      return event
    },
  })
}

/**
 * Attach the signed-in user's email as a Sentry user context. Loi 25:
 * only the operator (Marc himself) is exposed. For regular visitors we
 * call setUser(null) so Sentry events stay anonymous and cannot be tied
 * back to a specific Quebec resident.
 *
 * Admin events are tagged with the operator's email so Marc can filter
 * "errors I hit while QA'ing" in Sentry's UI. Marc's email going to
 * Marc's own Sentry account is not a third-party transfer of someone
 * else's PI.
 */
export function setSentryUser(opts: { email: string | null; isAdmin: boolean }): void {
  if (opts.isAdmin && opts.email) {
    Sentry.setUser({ email: opts.email })
  } else {
    Sentry.setUser(null)
  }
}

/**
 * Re-export the React ErrorBoundary so callers don't need their own Sentry
 * import. Used in router.tsx to forward route-level errors.
 */
export const SentryErrorBoundary = Sentry.ErrorBoundary

/**
 * Manually report something interesting (warn, info). Mostly unused — we
 * rely on uncaught errors and the route boundary — but useful for the
 * intentional `console.error` sites we want amplified.
 */
export function captureException(err: unknown, context?: Record<string, unknown>): void {
  Sentry.captureException(err, context ? { extra: context } : undefined)
}
