/**
 * Sentry init for the browser SPA.
 *
 * DSN comes from `VITE_SENTRY_DSN` (Vite exposes anything prefixed VITE_*).
 * When the env var is unset (dev with no DSN, preview deploys, opt-out), we
 * silently no-op — every call to `Sentry.*` becomes a noop client, and
 * nothing reports.
 *
 * Sample rates are intentionally low — this is a low-traffic site and we
 * want the free tier to last. Errors are 100% (you want every one); traces
 * are off by default (turn on later if perf is an investigation focus).
 */

import * as Sentry from '@sentry/react'

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined
// Tag events with the deployment environment so prod and preview don't mix
// in the same issue stream. CF Pages exposes the deploy URL via
// `CF_PAGES_URL` at build time — we forward it under VITE_CF_PAGES_URL in
// the build pipeline if needed. For now, infer from the runtime host.
const environment =
  typeof window !== 'undefined' && window.location.hostname.endsWith('.pages.dev')
    ? window.location.hostname.includes('preview') ||
      /^[a-f0-9]{8}\.marc-portal/.test(window.location.hostname)
      ? 'preview'
      : 'production'
    : 'development'

export function initSentry(): void {
  if (!DSN) {
    // No DSN — Sentry stays uninitialized. The exported helpers below all
    // call into the SDK, which is a no-op when init was never called.
    return
  }
  Sentry.init({
    dsn: DSN,
    environment,
    // 100% of errors. This is a 1-active-user app; volume is fine.
    sampleRate: 1.0,
    // Performance traces disabled by default. Flip on when investigating.
    tracesSampleRate: 0,
    // Don't capture session replays by default — privacy + bytes.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
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
      // Strip cookies and auth headers from any captured request frames.
      if (event.request?.headers) {
        delete event.request.headers.Cookie
        delete event.request.headers.cookie
        delete event.request.headers.Authorization
        delete event.request.headers['X-CSRF-Token']
      }
      return event
    },
  })
}

/**
 * Attach the signed-in user's email as a Sentry user context. Called from
 * AuthProvider on email change. Anonymize by passing null on logout.
 */
export function setSentryUser(email: string | null): void {
  if (!DSN) return
  if (email) {
    Sentry.setUser({ email })
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
  if (!DSN) return
  Sentry.captureException(err, context ? { extra: context } : undefined)
}
