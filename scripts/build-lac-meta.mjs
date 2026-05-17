// Scan every feat-*/feature.json at the portal root and emit a compact
// JSON manifest at src/data/lac-features.json. The /meta page imports
// that manifest directly so render is zero-cost at runtime and the page
// works offline / in CF Pages' static-asset path.
//
// Why a build-time script rather than a Functions endpoint or a Vite
// import.meta.glob: (a) the feature.json files live OUTSIDE src/, so
// Vite's glob doesn't reach them; (b) we want the page to load without
// pulling 25 ~10 KB JSON files at runtime; (c) the projection done here
// drops the heavy `analysis` / `decisions[*].rationale` blocks that the
// public page doesn't need — payload stays ~5-8 KB total.
//
// Schema written: { features: Array<{
//   featureKey, dirSlug, title, status, domain, tags[], problem (trimmed),
//   decisionsCount, lastTransitionDate
// }> }
//
// dirSlug is the on-disk folder name ("feat-app-shell") — needed because
// the dir slugs are word-form while featureKey is `feat-YYYY-NNN`, so the
// page can't derive the GitHub source URL from the key alone.
//
// Sort: status priority (active > draft > frozen > rejected), then
// lastTransitionDate desc.

import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const portalRoot = dirname(dirname(__filename))

const STATUS_ORDER = { active: 0, draft: 1, frozen: 2, rejected: 3 }
const PROBLEM_TRIM = 320 // chars; long enough to read as a paragraph, short
//                          enough to keep the manifest lean

function listFeatureDirs() {
  return readdirSync(portalRoot)
    .filter((name) => name.startsWith('feat-'))
    .filter((name) => {
      const path = join(portalRoot, name)
      try {
        return statSync(path).isDirectory()
      } catch {
        return false
      }
    })
}

function readFeature(dir) {
  const path = join(portalRoot, dir, 'feature.json')
  try {
    const raw = readFileSync(path, 'utf8')
    return JSON.parse(raw)
  } catch (err) {
    console.warn(`build-lac-meta: skipping ${dir} — ${err.message}`)
    return null
  }
}

function projectFeature(raw, dirSlug) {
  const status = typeof raw.status === 'string' ? raw.status : 'draft'
  const history = Array.isArray(raw.statusHistory) ? raw.statusHistory : []
  const lastTransitionDate =
    history.length > 0 && history[history.length - 1].date
      ? history[history.length - 1].date
      : null
  const problem = typeof raw.problem === 'string' ? raw.problem.trim() : ''
  const trimmed =
    problem.length > PROBLEM_TRIM ? problem.slice(0, PROBLEM_TRIM - 1).trimEnd() + '…' : problem
  return {
    featureKey: raw.featureKey ?? '',
    dirSlug,
    title: raw.title ?? raw.featureKey ?? 'Untitled',
    status,
    domain: typeof raw.domain === 'string' ? raw.domain : null,
    tags: Array.isArray(raw.tags) ? raw.tags.slice(0, 6) : [],
    problem: trimmed,
    decisionsCount: Array.isArray(raw.decisions) ? raw.decisions.length : 0,
    lastTransitionDate,
  }
}

const dirs = listFeatureDirs()
const features = dirs
  .map((d) => {
    const raw = readFeature(d)
    return raw ? projectFeature(raw, d) : null
  })
  .filter(Boolean)

features.sort((a, b) => {
  const sa = STATUS_ORDER[a.status] ?? 99
  const sb = STATUS_ORDER[b.status] ?? 99
  if (sa !== sb) return sa - sb
  // Newer transitions first inside the same status.
  const da = a.lastTransitionDate ? new Date(a.lastTransitionDate).getTime() : 0
  const db = b.lastTransitionDate ? new Date(b.lastTransitionDate).getTime() : 0
  return db - da
})

const outDir = join(portalRoot, 'src', 'data')
const outPath = join(outDir, 'lac-features.json')
mkdirSync(outDir, { recursive: true })
writeFileSync(outPath, JSON.stringify({ features, generatedAt: new Date().toISOString() }, null, 2))

console.log(`build-lac-meta: ${features.length} features → src/data/lac-features.json`)
