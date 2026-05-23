import { defineConfig, devices } from '@playwright/test'
import { E2E_BASE_URL, E2E_BINDINGS, E2E_PERSIST_DIR, E2E_PORT } from './e2e/backend/constants'

/**
 * Playwright config — BACKEND e2e for the portal.
 *
 * This is a separate config from playwright.config.ts (screenshot suite).
 * That one boots `vite preview` (static SPA, mocked public reads); this one
 * boots `wrangler pages dev` against an ephemeral D1 so the Pages Functions
 * actually execute. The goal: close the integration loop the manual RUNBOOK
 * smoke test covers — checkout → Stripe → webhook → DB → /me — under one
 * automated run.
 *
 * Stripe itself is short-circuited by a sentinel STRIPE_SECRET_KEY value
 * (see functions/_lib/stripe.ts E2E_STUB_API_KEY) so no network call ever
 * leaves the harness, no Stripe test dashboard pollution, no STRIPE secrets
 * needed in CI. Webhooks are synthetic — HMAC-signed by the helper using
 * the same deterministic STRIPE_WEBHOOK_SECRET the running server verifies
 * against.
 *
 * Why npm run build then wrangler pages dev: wrangler pages dev serves the
 * compiled SPA from dist/, then proxies anything matching the Functions
 * router (functions/api/**, functions/_middleware.ts, …) to the local
 * Workers runtime. Without dist/ it 404s the SPA shell.
 */

const isCI = !!process.env.CI

// Spread the bindings into discrete -b flags. Each becomes an env binding
// inside the Pages Function (read via the typed Env interface in
// functions/_lib/env.ts). This is the cleanest way to inject test
// configuration without touching .dev.vars (which has Marc's real keys).
const bindingFlags = Object.entries(E2E_BINDINGS)
  .map(([k, v]) => `-b ${k}=${v}`)
  .join(' ')

export default defineConfig({
  testDir: './e2e/backend',
  testMatch: /\.spec\.ts$/,
  fullyParallel: false, // shared D1 — serial runs avoid seed/teardown races
  workers: 1,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  globalTeardown: './e2e/backend/teardown.mjs',
  use: {
    baseURL: E2E_BASE_URL,
    trace: 'on-first-retry',
    ...devices['Desktop Chrome'],
    viewport: { width: 1000, height: 900 },
  },
  webServer: {
    // Two-phase: rebuild the SPA so dist/ is current, then boot wrangler
    // against the persist dir setup.mjs already populated with applied
    // migrations. wrangler.toml itself was swapped in by setup.mjs to a
    // variant that omits the [ai] binding (which would otherwise force
    // pages dev to start a remote proxy session and hard-fail without
    // valid CF auth). Teardown restores the prod config.
    // See e2e/backend/wrangler.e2e.toml for the full rationale.
    command: `npm run build && npx wrangler pages dev dist --persist-to=${E2E_PERSIST_DIR} --port=${E2E_PORT} --log-level=warn ${bindingFlags}`,
    url: E2E_BASE_URL,
    // wrangler pages dev cold-boots Miniflare on first request — be generous.
    timeout: 180_000,
    // Always reuse: the local persist dir already has migrations applied by
    // the e2e:backend:setup script; killing wrangler between specs would
    // re-trigger the full build.
    reuseExistingServer: !isCI,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
