// Session row helpers. Keeps the session model consistent across endpoints —
// shape, access checks, status transitions. Raw SQL kept in handlers; this
// file only owns the type and the small predicates.

export type SessionStatus = 'draft' | 'triage' | 'active' | 'shipped' | 'rejected'

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
