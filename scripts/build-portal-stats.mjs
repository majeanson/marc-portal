// Emit src/data/portal-stats.json — the build-time half of the /meta
// scorecard. The portal grades itself in public, so these numbers are
// captured at deploy time and shipped as a static import:
//
//   { testCount, commit, builtAt }
//
// testCount  — automated test cases counted statically across *.test.ts(x)
// commit     — short git SHA of the deployed build (Cloudflare provides
//              CF_PAGES_COMMIT_SHA; git is the local fallback)
// builtAt    — ISO timestamp of this build
//
// The live half of the scorecard (service health, intake-response median,
// shipped count) is fetched at runtime from /api/health and /api/meta/stats.

import { execSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const portalRoot = dirname(dirname(__filename))

const SCAN_ROOTS = ['src', 'functions', 'e2e']
// Matches it(...), test(...), and their .skip/.only/.todo/.each variants.
const TEST_CASE_RE = /\b(?:it|test)\b\s*(?:\.\s*\w+\s*)?\(/g

function collectTestFiles(dir, acc) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return acc
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue
      collectTestFiles(full, acc)
    } else if (entry.isFile() && /\.test\.(ts|tsx)$/.test(entry.name)) {
      acc.push(full)
    }
  }
  return acc
}

function countTestCases() {
  const files = SCAN_ROOTS.flatMap((root) => collectTestFiles(join(portalRoot, root), []))
  let n = 0
  for (const f of files) {
    const matches = readFileSync(f, 'utf8').match(TEST_CASE_RE)
    if (matches) n += matches.length
  }
  return n
}

function resolveCommit() {
  if (process.env.CF_PAGES_COMMIT_SHA) return process.env.CF_PAGES_COMMIT_SHA.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD', { cwd: portalRoot }).toString().trim()
  } catch {
    return 'unknown'
  }
}

const stats = {
  testCount: countTestCases(),
  commit: resolveCommit(),
  builtAt: new Date().toISOString(),
}

const outDir = join(portalRoot, 'src', 'data')
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'portal-stats.json'), JSON.stringify(stats, null, 2) + '\n')

console.log(
  `build-portal-stats: ${stats.testCount} tests · ${stats.commit} → src/data/portal-stats.json`,
)
