/**
 * Sentry init for the browser SPA.
 *
 * DSN comes from `VITE_SENTRY_DSN` (Vite exposes anything prefixed VITE_*).
 * When the env var is unset (dev with no DSN, preview deploys, opt-out), the
 * SDK still ships in the bundle but is disabled via `enabled: false`, so no
 * events leave the browser.
 *
 * Why not early-return on missing DSN: Vite statically replaces
 * `import.meta.env.VITE_*` at build time. Combined with Rolldown's
 * dead-code elimination, an `if (!DSN) return` before any `Sentry.*` call
 * makes the whole `@sentry/react` import tree-shakable when the env var is
 * empty at build time. Setting the env var later doesn't help — the live
 * bundle has no SDK to wake up. We learned this the hard way (commit
 * dba587f / rebuild loop). Pattern below keeps Sentry.init() statically
 * reachable so the SDK is always bundled; runtime decides whether it
 * actually transmits.
 *
 * Sample rates are intentionally low — this is a low-traffic site and we
 * want the free tier to last. Errors are 100%; traces off by default.
 */

import * as Sentry from '@sentry/react'

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined
const ENABLED = typeof DSN === 'string' && DSN.length > 0

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
 * No-op when SDK is disabled (init received enabled: false).
 */
export function setSentryUser(email: string | null): void {
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
  Sentry.captureException(err, context ? { extra: context } : undefined)
}
