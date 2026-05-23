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

import { rmSync, copyFileSync, renameSync, existsSync } from 'node:fs'
import { platform } from 'node:os'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const PERSIST_DIR = '.wrangler-e2e'
const DB_NAME = 'marc-portal-db'
const WRANGLER_TOML = 'wrangler.toml'
const WRANGLER_TOML_BAK = 'wrangler.toml.bak'
const WRANGLER_TOML_E2E = 'e2e/backend/wrangler.e2e.toml'

// Swap in the e2e-only wrangler config. The prod config declares the [ai]
// (Workers AI) binding, which has no local Miniflare emulator — wrangler 4.x
// pages dev hard-fails the boot trying to start a remote proxy session for
// it whenever the OAuth token is missing or expired. The e2e variant omits
// that binding so the harness boots cleanly with no CF auth required.
//
// `wrangler pages dev` rejects --config and forces `./wrangler.toml`, so the
// only way to use a different config is to swap the file in place. Teardown
// (playwright globalTeardown) restores it. If a prior run was interrupted
// before teardown ran, `wrangler.toml.bak` survives — we detect that here
// and restore first to keep the prod config from being silently lost.
function swapInE2EWranglerToml() {
  if (existsSync(WRANGLER_TOML_BAK)) {
    // Prior run was interrupted before teardown. Restore prod config, then
    // proceed with a fresh swap. If wrangler.toml currently holds the e2e
    // variant (from that interrupted run), the rename overwrites it.
    console.log('e2e:backend:setup → recovering wrangler.toml from prior interrupted run')
    renameSync(WRANGLER_TOML_BAK, WRANGLER_TOML)
  }
  if (!existsSync(WRANGLER_TOML_E2E)) {
    console.error(`e2e:backend:setup → missing ${WRANGLER_TOML_E2E}`)
    process.exit(1)
  }
  renameSync(WRANGLER_TOML, WRANGLER_TOML_BAK)
  copyFileSync(WRANGLER_TOML_E2E, WRANGLER_TOML)
  console.log(
    `e2e:backend:setup → swapped wrangler.toml ← ${WRANGLER_TOML_E2E} (backup: ${WRANGLER_TOML_BAK})`,
  )
}

// Kill any lingering workerd from a previous run BEFORE wiping the persist
// dir. wrangler pages dev spawns workerd child processes that hold open file
// handles inside .wrangler-e2e/v3/cache/; on Windows those handles cause
// `rmSync` to trip EBUSY even with retries because the orphan workerd never
// releases them. Killing first is the only reliable fix.
function killLingeringWorkerd() {
  if (platform() === 'win32') {
    spawnSync('taskkill', ['/F', '/IM', 'workerd.exe', '/T'], { stdio: 'ignore', shell: true })
  } else {
    spawnSync('pkill', ['-f', 'workerd'], { stdio: 'ignore' })
  }
}
killLingeringWorkerd()
swapInE2EWranglerToml()

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
