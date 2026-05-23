/**
 * Single source of truth for the backend e2e harness.
 *
 * These values are passed to `wrangler pages dev` via `-b BINDING=VALUE`
 * flags (so the Pages Functions read them as env bindings), AND consumed
 * directly by the test helpers (so signed cookies + HMAC webhooks line up
 * with what the running server will verify).
 *
 * None of these are real secrets — they are deterministic constants. The
 * STRIPE_SECRET_KEY value is the magic sentinel recognised by
 * functions/_lib/stripe.ts to short-circuit Stripe entirely.
 */

export const E2E_BINDINGS = {
  ADMIN_EMAILS: 'admin@e2e.test',
  // SESSION_SECRET must be ≥ 32 chars (see requireSessionSecret in
  // functions/_lib/auth.ts) — the padding below brings the deterministic
  // value over the floor.
  SESSION_SECRET: 'e2e_session_secret_at_least_32_chars_long_padding',
  STRIPE_SECRET_KEY: 'sk_test_e2e_stub',
  STRIPE_WEBHOOK_SECRET: 'whsec_e2e_deterministic_webhook_secret',
  // Resend stub key. Unset would degrade email side-effects to no-ops; the
  // stub is here so the code paths that gate on `env.RESEND_API_KEY` run.
  RESEND_API_KEY: 're_e2e_stub',
} as const

export const E2E_PORT = 8788
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`
export const E2E_PERSIST_DIR = '.wrangler-e2e'

/**
 * URL prefix the Stripe stub returns from createOneTimeCheckoutSession.
 * Specs install a page.route abort on this so the browser never tries to
 * resolve the (non-existent) host.
 */
export const E2E_STRIPE_STUB_URL_PREFIX = 'https://e2e-stub.local/'
