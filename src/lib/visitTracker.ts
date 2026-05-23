/**
 * Tiny session-scoped visit tracker. Records the routes a visitor walks
 * through during a single tab session, plus the page-level dwell time
 * (best-effort: time-between-route-changes), for the /passage receipt to
 * read back at the end.
 *
 * Storage: window.sessionStorage under a single key, capped to 64 entries
 * (oldest dropped). Cleared automatically when the tab closes — same
 * lifecycle as the visit itself. Never written server-side; never sent
 * over the network. The whole point is: the visitor is the only one with
 * this record, and even *they* lose it when they close the tab.
 *
 * Why sessionStorage instead of an in-memory module-level array:
 *   - survives soft route changes (React Router doesn't re-mount this lib)
 *   - survives accidental full reloads inside the same tab
 *   - vanishes naturally when the tab closes — no cleanup needed
 *
 * Why not localStorage: cross-visit accumulation would creep toward a
 * per-visitor history, which is exactly the thing the /me/dossier page
 * argues the portal *doesn't* keep.
 */

const KEY = 'mp_visit_log'
const MAX_ENTRIES = 64

export interface VisitEntry {
  /** Pathname at entry (no origin, no search). */
  path: string
  /** Wall-clock time at entry, ISO 8601. */
  enteredAt: string
  /** Dwell time on the *previous* entry, ms. Filled retroactively when the
   *  next entry lands; the most-recent entry leaves this undefined. */
  dwellMs?: number
}

function readLog(): VisitEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.sessionStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (e): e is VisitEntry =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as VisitEntry).path === 'string' &&
        typeof (e as VisitEntry).enteredAt === 'string',
    )
  } catch {
    return []
  }
}

function writeLog(log: VisitEntry[]): void {
  if (typeof window === 'undefined') return
  try {
    const trimmed = log.length > MAX_ENTRIES ? log.slice(-MAX_ENTRIES) : log
    window.sessionStorage.setItem(KEY, JSON.stringify(trimmed))
  } catch {
    // Private-browsing storage block — drop silently. The receipt just
    // shows fewer entries; nothing functional breaks.
  }
}

/**
 * Record arriving on a new path. Backfills `dwellMs` on the prior entry
 * (since now we know how long the visitor stayed there). De-duplicates
 * consecutive identical pushes — refreshes, hash-only changes, and
 * StrictMode double-invocations don't pollute the log.
 */
export function trackVisit(path: string): void {
  const log = readLog()
  const last = log[log.length - 1]
  if (last && last.path === path) return
  const now = new Date()
  if (last) {
    const lastTime = new Date(last.enteredAt).getTime()
    if (!Number.isNaN(lastTime)) {
      last.dwellMs = now.getTime() - lastTime
    }
  }
  log.push({ path, enteredAt: now.toISOString() })
  writeLog(log)
}

/** Read the log as-of right now. Mostly for the receipt page to render. */
export function readVisits(): VisitEntry[] {
  return readLog()
}

/** Wipe the log. Used by the /au-revoir erasure path so a deleted visitor
 *  doesn't carry forward a trail of routes from before they pulled the
 *  plug. */
export function clearVisits(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(KEY)
  } catch {
    // see writeLog — quietly degrade.
  }
}
