// Append one Lighthouse result to src/data/lighthouse-history.json.
//
// Run by .github/workflows/lighthouse.yml after a Lighthouse pass:
//   node scripts/append-lighthouse.mjs <report-1.json> [report-2.json ...]
//
// Pass MULTIPLE report files — one per Lighthouse run of the same commit —
// and each of the four category scores is recorded as the MEDIAN across the
// runs. Lighthouse's simulated mobile throttling amplifies the runner's CPU
// speed ~4x, so a single run on a shared CI runner swings wildly (we have
// seen the same site score 44 and 81); the median of 3 is the stable signal.
//
// It tags the scores with the commit SHA and date, appends to the history,
// and caps the list at the last MAX_RUNS entries. The history file is
// committed back, so its git log IS the score timeline; the /meta scorecard
// imports it and shows the latest run.

import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const MAX_RUNS = 60

const reportPaths = process.argv.slice(2)
if (reportPaths.length === 0) {
  console.error(
    'append-lighthouse: usage: node append-lighthouse.mjs <report-1.json> [report-2.json ...]',
  )
  process.exit(1)
}

const __filename = fileURLToPath(import.meta.url)
const portalRoot = dirname(dirname(__filename))
const historyPath = join(portalRoot, 'src', 'data', 'lighthouse-history.json')

// Lighthouse category scores are 0-1; surface them as 0-100 integers.
function pct(score) {
  return typeof score === 'number' ? Math.round(score * 100) : null
}

// Median of the runs for one category. Nulls (a category Lighthouse failed
// to score) are dropped first; an all-null category stays null. Even counts
// take the lower-middle value — a conservative score beats an optimistic one.
function median(values) {
  const nums = values.filter((v) => typeof v === 'number').sort((a, b) => a - b)
  if (nums.length === 0) return null
  return nums[Math.floor((nums.length - 1) / 2)]
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

// Each report → its four category scores; then median each column.
const scored = reportPaths.map((p) => {
  const cats = JSON.parse(readFileSync(p, 'utf8')).categories ?? {}
  return {
    performance: pct(cats.performance?.score),
    accessibility: pct(cats.accessibility?.score),
    bestPractices: pct(cats['best-practices']?.score),
    seo: pct(cats.seo?.score),
  }
})

const run = {
  commit: resolveCommit(),
  date: new Date().toISOString(),
  performance: median(scored.map((s) => s.performance)),
  accessibility: median(scored.map((s) => s.accessibility)),
  bestPractices: median(scored.map((s) => s.bestPractices)),
  seo: median(scored.map((s) => s.seo)),
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
  `append-lighthouse: ${run.commit} (median of ${reportPaths.length}) → ` +
    `perf ${run.performance} · a11y ${run.accessibility} · bp ${run.bestPractices} · seo ${run.seo}`,
)
