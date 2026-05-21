// Scan every co-located *.feature.json under src/ and functions/ and emit a
// compact JSON manifest at src/data/lac-features.json. The /meta page imports
// that manifest directly so render is zero-cost at runtime and the page works
// offline / in CF Pages' static-asset path.
//
// Why a build-time script rather than a Functions endpoint or a Vite
// import.meta.glob: (a) the page should load without N runtime JSON fetches;
// (b) the projection done here is the single place that decides what the
// public /meta page may show; (c) it works in the static-asset path.
//
// Co-location: each feature.json lives next to the code it documents and is
// named <Component>.feature.json (e.g. src/pages/Intake.feature.json). There
// are no more feat-*/ folders at the portal root, and the manifest carries no
// GitHub source URL — the /meta page expands each card inline instead.
//
// Schema written: { features: Array<{
//   featureKey, title, status, domain, tags[], componentFile, liveUrl,
//   problem, analysis, decisions[{decision,rationale,recommendation,
//   alternativesConsidered?}], successCriteria, knownLimitations[],
//   statusHistory[{from,to,date,reason?}], lastTransitionDate
// }>, generatedAt }
//
// Sort: status priority (active > draft > frozen > rejected), then
// lastTransitionDate desc.

import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const portalRoot = dirname(dirname(__filename))

const STATUS_ORDER = { active: 0, draft: 1, frozen: 2, rejected: 3 }
// Roots to scan. The root portal/feature.json is deliberately excluded — it is
// the project-level umbrella artifact, not a /meta grid card.
const SCAN_ROOTS = ['src', 'functions']

// Recursively collect every *.feature.json path under a directory.
function collectFeatureFiles(dir, acc) {
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
      collectFeatureFiles(full, acc)
    } else if (entry.isFile() && entry.name.endsWith('.feature.json')) {
      acc.push(full)
    }
  }
  return acc
}

function readFeature(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (err) {
    console.warn(`build-lac-meta: skipping ${path} — ${err.message}`)
    return null
  }
}

function projectDecision(d) {
  return {
    decision: typeof d.decision === 'string' ? d.decision : '',
    rationale: typeof d.rationale === 'string' ? d.rationale : '',
    recommendation: typeof d.recommendation === 'string' ? d.recommendation : '',
    ...(Array.isArray(d.alternativesConsidered) && d.alternativesConsidered.length > 0
      ? { alternativesConsidered: d.alternativesConsidered }
      : {}),
  }
}

function projectFeature(raw) {
  const status = typeof raw.status === 'string' ? raw.status : 'draft'
  const history = Array.isArray(raw.statusHistory) ? raw.statusHistory : []
  const lastTransitionDate =
    history.length > 0 && history[history.length - 1].date ? history[history.length - 1].date : null
  return {
    featureKey: raw.featureKey ?? '',
    title: raw.title ?? raw.featureKey ?? 'Untitled',
    status,
    domain: typeof raw.domain === 'string' ? raw.domain : null,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    componentFile: typeof raw.componentFile === 'string' ? raw.componentFile : null,
    liveUrl: typeof raw.liveUrl === 'string' ? raw.liveUrl : null,
    problem: typeof raw.problem === 'string' ? raw.problem.trim() : '',
    analysis: typeof raw.analysis === 'string' ? raw.analysis.trim() : '',
    decisions: Array.isArray(raw.decisions) ? raw.decisions.map(projectDecision) : [],
    successCriteria: typeof raw.successCriteria === 'string' ? raw.successCriteria : '',
    knownLimitations: Array.isArray(raw.knownLimitations) ? raw.knownLimitations : [],
    statusHistory: history,
    lastTransitionDate,
  }
}

const files = SCAN_ROOTS.flatMap((root) => collectFeatureFiles(join(portalRoot, root), []))
const features = files
  .map((f) => {
    const raw = readFeature(f)
    return raw ? projectFeature(raw) : null
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
