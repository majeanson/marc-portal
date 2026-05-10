// Session row helpers. Keeps the session model consistent across endpoints —
// shape, access checks, status transitions. Raw SQL kept in handlers; this
// file only owns the type and the small predicates.

export type SessionStatus = 'draft' | 'triage' | 'active' | 'shipped' | 'rejected'

/**
 * The single load-bearing rule of the practice: no more than ACTIVE_CAP
 * sessions in `active` and no more than TRIAGE_CAP in `triage` at any time.
 * Insight #39 from the brainstorm — if this gets raised, family-time stops
 * being protected. Server enforces it; UI mirrors it.
 */
export const ACTIVE_CAP = 1
export const TRIAGE_CAP = 1

export interface StatusHistoryEntry {
  from: SessionStatus
  to: SessionStatus
  by: string // email of actor
  at: number // unix seconds
}

export interface SessionRow {
  id: string
  email: string
  intake_json: string | null
  status: SessionStatus
  created_at: number
  updated_at: number
  /** Unix seconds when soft-deleted by visitor or admin. NULL = live. */
  deleted_at: number | null
  /** JSON-encoded StatusHistoryEntry[] or null. Parse defensively. */
  status_history: string | null
  /** Unix seconds when admin opted this session into the public /projects
   * gallery. NULL = not showcased. */
  showcased_at: number | null
  /** Admin-set display name on the public card. NULL = fall back to intake. */
  showcase_title: string | null
  /** Admin-set short blurb on the public card. NULL = no tagline. */
  showcase_tagline: string | null
  /** Tier classification (0/1/2/3) matching the public Pricing copy. NULL =
   * not yet classified by admin. Used to badge the public gallery card. */
  tier: number | null
}

export interface MessageRow {
  id: string
  session_id: string
  author: 'visitor' | 'marc'
  body: string
  created_at: number
}

const VALID_STATUSES: ReadonlySet<SessionStatus> = new Set([
  'draft',
  'triage',
  'active',
  'shipped',
  'rejected',
])

export function isValidStatus(s: unknown): s is SessionStatus {
  return typeof s === 'string' && VALID_STATUSES.has(s as SessionStatus)
}

export function canAccessSession(
  viewerEmail: string,
  viewerIsAdmin: boolean,
  session: SessionRow,
): boolean {
  return viewerIsAdmin || session.email === viewerEmail
}

// Marc's notification address: the first entry in ADMIN_EMAILS. If a future
// co-admin is added, we still notify the primary so visitor-posted messages
// land in one inbox, not two.
export function primaryAdminEmail(adminEmails: string): string | null {
  const first = adminEmails.split(',')[0]?.trim()
  return first && first.length > 0 ? first : null
}

export function parseStatusHistory(raw: string | null): StatusHistoryEntry[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed as StatusHistoryEntry[]
  } catch {
    // fall through
  }
  return []
}

export function appendStatusHistory(raw: string | null, entry: StatusHistoryEntry): string {
  return JSON.stringify([...parseStatusHistory(raw), entry])
}

/**
 * One-row session lookup used by every per-session handler. Centralized so the
 * SELECT shape stays in lockstep with SessionRow (4 handlers used to inline
 * this same SQL).
 */
export async function loadSession(db: D1Database, id: string): Promise<SessionRow | null> {
  return db
    .prepare(
      `SELECT id, email, intake_json, status, created_at, updated_at,
              deleted_at, status_history,
              showcased_at, showcase_title, showcase_tagline, tier
       FROM sessions WHERE id = ?`,
    )
    .bind(id)
    .first<SessionRow>()
}

/**
 * Live counts of `active` and `triage` sessions (excludes soft-deleted rows).
 * The capacity endpoint reads this; POST /sessions and PATCH status->{triage,
 * active} call it before mutating to enforce the cap.
 */
export interface CapacityCounts {
  active: number
  triage: number
}

export async function countActiveAndTriage(
  db: D1Database,
  excludeSessionId?: string,
): Promise<CapacityCounts> {
  interface Row {
    status: 'active' | 'triage'
    n: number
  }
  // Excluding a session is needed when checking a status transition: the row
  // being moved already counts toward its current bucket, and we want the post-
  // move state. SQL stays parameterized either way.
  const stmt =
    excludeSessionId === undefined
      ? db.prepare(
          `SELECT status, COUNT(*) AS n FROM sessions
           WHERE status IN ('active', 'triage') AND deleted_at IS NULL
           GROUP BY status`,
        )
      : db
          .prepare(
            `SELECT status, COUNT(*) AS n FROM sessions
             WHERE status IN ('active', 'triage') AND deleted_at IS NULL AND id != ?
             GROUP BY status`,
          )
          .bind(excludeSessionId)
  const res = await stmt.all<Row>()
  let active = 0
  let triage = 0
  for (const r of res.results ?? []) {
    if (r.status === 'active') active = r.n
    else if (r.status === 'triage') triage = r.n
  }
  return { active, triage }
}

/**
 * True when a *new* triage entry would overflow the bedrock rule. Used at
 * POST /sessions and at PATCH status->triage. (`shipped`/`rejected` and
 * intake `draft` don't count against the cap.)
 */
export function isTriageAtCap(c: CapacityCounts): boolean {
  return c.triage >= TRIAGE_CAP
}

/**
 * True when a transition into `active` would overflow the active cap. Used at
 * PATCH status->active.
 */
export function isActiveAtCap(c: CapacityCounts): boolean {
  return c.active >= ACTIVE_CAP
}

/**
 * Best-effort lookup of the visitor's preferred language from the stored
 * intake payload. Falls back to 'fr' (the canonical language of the app)
 * when the row was created without intake_json or it is malformed.
 */
export function visitorLang(session: SessionRow): 'fr' | 'en' {
  if (!session.intake_json) return 'fr'
  try {
    const obj = JSON.parse(session.intake_json) as { lang?: unknown }
    if (obj.lang === 'en' || obj.lang === 'fr') return obj.lang
  } catch {
    // fall through
  }
  return 'fr'
}
