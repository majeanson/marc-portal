// Append one Lighthouse run to src/data/lighthouse-history.json.
//
// Run by .github/workflows/lighthouse.yml after a Lighthouse pass:
//   node scripts/append-lighthouse.mjs <path-to-lighthouse-report.json>
//
// It pulls the four category scores (0-100), tags them with the commit SHA
// and date, appends to the history, and caps the list at the last MAX_RUNS
// entries. The history file is committed back, so its git log IS the score
// timeline; the /meta scorecard imports it and shows the latest run.

import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const MAX_RUNS = 60

const reportPath = process.argv[2]
if (!reportPath) {
  console.error('append-lighthouse: usage: node append-lighthouse.mjs <report.json>')
  process.exit(1)
}

const __filename = fileURLToPath(import.meta.url)
const portalRoot = dirname(dirname(__filename))
const historyPath = join(portalRoot, 'src', 'data', 'lighthouse-history.json')

// Lighthouse category scores are 0-1; surface them as 0-100 integers.
function pct(score) {
  return typeof score === 'number' ? Math.round(score * 100) : null
}

function resolveCommit() {
  // LH_COMMIT is set by the workflow to the commit that was actually
  // deployed; GITHUB_SHA is the runner fallback; git is the local fallback.
  const sha = process.env.LH_COMMIT || process.env.GITHUB_SHA
  if (sha) return sha.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD', { cwd: portalRoot }).toString().trim()
  } catch {
    return 'unknown'
  }
}

const report = JSON.parse(readFileSync(reportPath, 'utf8'))
const cats = report.categories ?? {}
const run = {
  commit: resolveCommit(),
  date: new Date().toISOString(),
  performance: pct(cats.performance?.score),
  accessibility: pct(cats.accessibility?.score),
  bestPractices: pct(cats['best-practices']?.score),
  seo: pct(cats.seo?.score),
}

let history
try {
  history = JSON.parse(readFileSync(historyPath, 'utf8'))
} catch {
  history = { runs: [] }
}
if (!Array.isArray(history.runs)) history.runs = []

history.runs.push(run)
if (history.runs.length > MAX_RUNS) history.runs = history.runs.slice(-MAX_RUNS)

writeFileSync(historyPath, JSON.stringify(history, null, 2) + '\n')
console.log(
  `append-lighthouse: ${run.commit} → perf ${run.performance} · a11y ${run.accessibility} · bp ${run.bestPractices} · seo ${run.seo}`,
)
