// Post-run hook for the backend e2e suite. Restores the prod wrangler.toml
// that setup.mjs swapped out, so a normal `wrangler pages dev` outside the
// e2e harness keeps seeing the production config.
//
// Wired in as Playwright's globalTeardown. Setup.mjs also self-heals at
// the top of the next run if this teardown is skipped (interrupted run,
// process killed) — that recovery path is the durable safety net; this
// teardown is the happy-path cleanup.

import { existsSync, renameSync } from 'node:fs'

const WRANGLER_TOML = 'wrangler.toml'
const WRANGLER_TOML_BAK = 'wrangler.toml.bak'

export default async function globalTeardown() {
  if (!existsSync(WRANGLER_TOML_BAK)) {
    // Either setup never ran, or a prior teardown already restored.
    // Either way, nothing to do — don't trip the suite over it.
    return
  }
  renameSync(WRANGLER_TOML_BAK, WRANGLER_TOML)
  console.log(`e2e:backend:teardown → restored wrangler.toml from ${WRANGLER_TOML_BAK}`)
}
