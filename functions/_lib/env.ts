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
}

export function isAdmin(env: Env, email: string): boolean {
  return env.ADMIN_EMAILS.split(',')
    .map((e) => e.trim().toLowerCase())
    .includes(email.toLowerCase())
}
