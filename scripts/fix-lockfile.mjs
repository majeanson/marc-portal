// One-shot script. Merges Linux-only optional-dep entries (@emnapi/core,
// @emnapi/runtime) from a prior lockfile into the current one. npm install
// on Windows will not add these because they are platform-conditional
// optionalDependencies; npm ci on Linux runners then refuses to start.
//
// Usage:
//   node scripts/fix-lockfile.mjs                  # auto-fetches origin/main
//   node scripts/fix-lockfile.mjs <prev-lockfile>  # explicit prior version
//
// Idempotent. Exits 0 if no merge needed.

import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { argv, exit } from 'node:process'

const NEEDED = ['node_modules/@emnapi/core', 'node_modules/@emnapi/runtime']

function loadPrev(prevPath) {
  if (prevPath) return JSON.parse(readFileSync(prevPath, 'utf8'))
  // No arg → pull origin/main's lockfile via git. This is the common case
  // when a Windows dev just ran `npm install` and needs to re-sync the
  // Linux-only entries before pushing. Falls back to HEAD if origin/main is
  // unreachable (offline / fresh repo).
  for (const ref of ['origin/main', 'HEAD']) {
    try {
      const out = execSync(`git show ${ref}:package-lock.json`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      console.log(`fix-lockfile: using ${ref}:package-lock.json as the source`)
      return JSON.parse(out)
    } catch {
      // try next ref
    }
  }
  console.error(
    'fix-lockfile: could not auto-fetch a prior lockfile (no origin/main or HEAD). Pass an explicit path.',
  )
  exit(1)
}

const curr = JSON.parse(readFileSync('package-lock.json', 'utf8'))
const prev = loadPrev(argv[2])

let added = 0
for (const key of NEEDED) {
  if (curr.packages[key]) continue
  if (!prev.packages[key]) {
    console.error(`prev lockfile has no entry for ${key}`)
    exit(1)
  }
  curr.packages[key] = prev.packages[key]
  added++
}

if (added === 0) {
  console.log('lockfile already has all needed entries')
  exit(0)
}

// Resort the packages object alphabetically so the diff stays clean.
const sortedKeys = Object.keys(curr.packages).sort((a, b) => {
  if (a === '') return -1
  if (b === '') return 1
  return a.localeCompare(b)
})
const sortedPackages = {}
for (const k of sortedKeys) sortedPackages[k] = curr.packages[k]
curr.packages = sortedPackages

writeFileSync('package-lock.json', JSON.stringify(curr, null, 2) + '\n')
console.log(`merged ${added} entries into lockfile`)
