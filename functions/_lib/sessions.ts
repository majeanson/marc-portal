// Session row helpers. Keeps the session model consistent across endpoints —
// shape, access checks, status transitions. Raw SQL kept in handlers; this
// file only owns the type and the small predicates.

export type SessionStatus = 'draft' | 'triage' | 'active' | 'shipped' | 'rejected'

export interface SessionRow {
  id: string
  email: string
  intake_json: string | null
  status: SessionStatus
  created_at: number
  updated_at: number
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
