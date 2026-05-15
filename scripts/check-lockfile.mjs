// Read-only lockfile sanity check. Refuses to pass when the Linux-only
// optional-dep entries (@emnapi/core, @emnapi/runtime) have been pruned out
// of package-lock.json by an npm install run on Windows. Used as a
// pre-push gate (see .githooks/pre-push) so we never re-ship a broken
// lockfile that fails `npm ci` on CI's Linux runners.
//
// Exit codes:
//   0 — lockfile is healthy, push is OK
//   1 — entries missing, push must be blocked
//   2 — lockfile missing or malformed (unusual; don't block on this)

import { readFileSync, existsSync } from 'node:fs'

const REQUIRED = ['node_modules/@emnapi/core', 'node_modules/@emnapi/runtime']

if (!existsSync('package-lock.json')) {
  // Pre-clone state or pure-yarn project — neither applies here, but don't
  // wedge the push on a runtime that can't run the check.
  console.warn('check-lockfile: no package-lock.json found — skipping.')
  process.exit(2)
}

let lock
try {
  lock = JSON.parse(readFileSync('package-lock.json', 'utf8'))
} catch (err) {
  console.error('check-lockfile: package-lock.json is not valid JSON:', err)
  process.exit(2)
}

const missing = REQUIRED.filter((k) => !lock.packages?.[k])
if (missing.length === 0) {
  console.log('check-lockfile: lockfile has all required @emnapi entries.')
  process.exit(0)
}

console.error('')
console.error('  ✗ package-lock.json is missing Linux-only optional-dep entries:')
for (const k of missing) console.error(`      ${k}`)
console.error('')
console.error('  This happens when npm install runs on Windows and prunes')
console.error("  platform-conditional optionalDependencies that CI's Linux")
console.error('  runner then refuses to ignore (the npm ci EUSAGE error).')
console.error('')
console.error('  Fix:')
console.error('      node scripts/fix-lockfile.mjs')
console.error('      git add package-lock.json')
console.error('      git commit -m "chore: restore @emnapi lockfile entries"')
console.error('      git push')
console.error('')
process.exit(1)
