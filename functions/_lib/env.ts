// Shape of the env bag Cloudflare Pages Functions inject into every handler.
// Bindings come from wrangler.toml; secrets/vars come from the Pages dashboard.

export interface Env {
  DB: D1Database
  RESEND_API_KEY: string
  ADMIN_EMAILS: string
  SESSION_SECRET: string
  // feat-message-attachments: optional R2 bucket for file uploads on session
  // threads. When unset, attachment endpoints return 503 and the UI hides
  // the file picker. The rest of the app works unchanged.
  MEDIA?: R2Bucket
  // feat-custom-domain-onboarding: optional CF API credentials. When set, the
  // operator's new-tenant wizard auto-attaches the buyer's domain to this CF
  // Pages project. When unset (dev or pre-config), wizard falls back to the
  // manual instructions UX.
  CF_API_TOKEN?: string
  CF_ACCOUNT_ID?: string
  CF_PAGES_PROJECT_NAME?: string
  // Optional: shared secret guarding /api/admin/digest. Set to a long random
  // string in the Pages dashboard, then point a free cron service (cron-job.org
  // etc.) at the endpoint with the X-Digest-Token header. Unset = endpoint is
  // unreachable (the rare case Marc opens it manually).
  DIGEST_TOKEN?: string
  // Optional: Sentry DSN for the Functions side. When set, the middleware
  // forwards any unhandled handler throw to Sentry with request context
  // (URL, method, sanitized headers, signed-in email). Frontend Sentry uses
  // a separate VITE_SENTRY_DSN at build time. Unset = silent no-op.
  SENTRY_DSN?: string
}

export function isAdmin(env: Env, email: string): boolean {
  return env.ADMIN_EMAILS.split(',')
    .map((e) => e.trim().toLowerCase())
    .includes(email.toLowerCase())
}
