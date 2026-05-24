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
  // feat-message-media: optional Workers AI binding (Cloudflare's in-network
  // inference). Used by functions/_lib/transcribe.ts to turn a voice note
  // into text with Whisper. When unset, voice notes still upload and play —
  // they just carry a null transcript (graceful degrade, like MEDIA above).
  AI?: Ai
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
  // Stripe — server-side key for creating Checkout sessions + Portal sessions.
  // Secret: rotates via `wrangler secret put STRIPE_SECRET_KEY`. Unset = the
  // payments endpoints return 503 (graceful degrade, like MEDIA above).
  STRIPE_SECRET_KEY?: string
  // Webhook signing secret. Different per environment (test mode vs live).
  // Required for /api/payments/webhook signature verification; unset = the
  // webhook handler rejects every event with 401.
  STRIPE_WEBHOOK_SECRET?: string
  // Resend webhook signing secret (Svix-style, prefixed with `whsec_`).
  // Required for /api/webhooks/resend signature verification. Unset = the
  // bounce/complaint webhook returns 503 and the email_events ingestion
  // is dormant. P1.2 in AUDIT.md — code paths land before DNS for P1.1 is
  // live, so an unset secret stays a non-event.
  RESEND_WEBHOOK_SECRET?: string
  // Plaintext (wrangler.toml [vars]): the Stripe Price IDs for the two annual
  // custodian plans — Watch ($120/yr) and Care ($400/yr). Each is created once
  // in the Stripe Dashboard as a recurring CAD price. Unset = custodian
  // Checkout for that plan returns 503 with a clear message.
  STRIPE_CUSTODIAN_WATCH_PRICE_ID?: string
  STRIPE_CUSTODIAN_CARE_PRICE_ID?: string
  // Sentry DSN is hardcoded (see functions/_lib/sentry.ts) — no env var.
}

export function isAdmin(env: Env, email: string): boolean {
  return env.ADMIN_EMAILS.split(',')
    .map((e) => e.trim().toLowerCase())
    .includes(email.toLowerCase())
}
