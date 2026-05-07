// Shape of the env bag Cloudflare Pages Functions inject into every handler.
// Bindings come from wrangler.toml; secrets/vars come from the Pages dashboard.

export interface Env {
  DB: D1Database
  RESEND_API_KEY: string
  ADMIN_EMAILS: string
  SESSION_SECRET: string
}

export function isAdmin(env: Env, email: string): boolean {
  return env.ADMIN_EMAILS.split(',')
    .map((e) => e.trim().toLowerCase())
    .includes(email.toLowerCase())
}
