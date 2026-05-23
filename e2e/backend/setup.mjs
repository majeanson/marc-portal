// Pre-run hook for the backend e2e suite. Wipes the ephemeral persist dir
// and re-applies every D1 migration so every run starts from a known schema
// with no leftover rows. Invoked by `npm run e2e:backend:setup` before
// playwright touches the webServer.
//
// Why this is a separate step instead of Playwright's globalSetup: Playwright
// starts the webServer in parallel with globalSetup, so wrangler can open the
// D1 file before migrations land — first-request races against an empty
// schema. Running this synchronously first guarantees the DB has tables
// before wrangler boots.

import { rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const PERSIST_DIR = '.wrangler-e2e'
const DB_NAME = 'marc-portal-db'

const persistPath = resolve(PERSIST_DIR)
console.log(`e2e:backend:setup → wiping ${PERSIST_DIR}/`)
// Windows holds file handles open briefly after a process exits; without
// `maxRetries` the rmdir trips EBUSY whenever a previous wrangler hasn't
// fully released the cache dir yet. The retry loop sleeps 100ms between
// attempts (default backoff).
rmSync(persistPath, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 })

console.log(`e2e:backend:setup → applying D1 migrations to ${PERSIST_DIR}/…`)
const args = [
  'wrangler',
  'd1',
  'migrations',
  'apply',
  DB_NAME,
  '--local',
  `--persist-to=${PERSIST_DIR}`,
]
// Force non-interactive mode — wrangler otherwise tries to prompt for
// confirmation and crashes on a non-TTY stdin (observed on Windows with
// spawnSync + stdio: 'inherit'). CI=1 makes it skip the prompt and apply
// every migration on sight.
const r = spawnSync('npx', args, {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, CI: '1' },
})
if (r.status !== 0) {
  console.error(`e2e:backend:setup → wrangler exited with ${r.status}`)
  process.exit(r.status ?? 1)
}
console.log('e2e:backend:setup → ready')
