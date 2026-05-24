// Session row helpers. Keeps the session model consistent across endpoints —
// shape, access checks, status transitions. Raw SQL kept in handlers; this
// file only owns the type and the small predicates.

import { badRequest, forbidden, notFound } from './json'

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
  /** Tier classification (0/1/2/3/4) matching the public Pricing copy. NULL =
   * not yet classified by admin. Used to badge the public gallery card. */
  tier: number | null
  /** Tier 4 only: admin-quoted amount in cents. NULL when the admin hasn't
   * yet set a quote — visitor's "Pay (quoted)" button is then disabled
   * client-side. Used by /api/payments/checkout for tier4 visitor-self pays. */
  tier4_amount_cents: number | null
  /** Tier 3 only: which installment split the admin picked for this project —
   * '50-50' (two legs) or '40-40-20' (three legs). NULL = not chosen yet;
   * checkout.ts defaults to '50-50'. */
  tier3_split: string | null
  /** Custodian-subscription state (one of: 'none' | 'active' | 'past_due' |
   *  'canceled' | 'switched_to_tout_a_toi'). Mirrored on the row so admin
   *  listings and the AdminCustodians page can filter without joining the
   *  payments summary per row. NULL is treated as 'none' downstream. */
  custodian_status: string | null
  /** Which custodian plan an active subscription is on — 'watch' | 'care' |
   *  NULL. Denormalized from the payments row by the checkout webhook so
   *  AdminCustodians can sum an exact MRR without a per-session join.
   *  Reflects the plan at subscribe time (a portal-side switch isn't synced). */
  custodian_plan: string | null
  /** Unix seconds when the visitor explicitly acknowledged opting OUT of
   *  Custodian mode (i.e. they confirmed "Tout à toi" / "All yours" with
   *  the skills checklist on /session/:id). NULL = no explicit ack. Set
   *  via PATCH `acknowledgeAllYours`; persisted forever — the live mode is
   *  always custodian_status, this is a historical-decision marker. */
  all_yours_acknowledged_at: number | null
  /** Operator-written note shown to the visitor when the session is
   *  `rejected` — a tailored "here's what I'd do instead" rather than a
   *  bare no. NULL = no note (the visitor sees only the standing pointers).
   *  Set via PATCH `declineNote`; admin-only. */
  decline_note: string | null
  /** Operator-applied community pricing flag (0/1; SQLite has no real BOOL).
   *  When 1, every build-tier installment is computed against COMMUNITY_DISCOUNT_PCT
   *  (see functions/_lib/pricing.ts). Scoping + custodian unaffected. Once any
   *  build leg is `paid`, the flag is frozen — PATCH /api/sessions/:id rejects
   *  a toggle with 409, same atomic-guard shape as the capacity cap. */
  community_discount: number
  /** Derived: id of the (single) attachments row with kind='napkin' for this
   *  session, NULL when no napkin was uploaded. Populated by a correlated
   *  subquery in every session SELECT so the session view can build the PNG
   *  URL without a second round-trip. Not stored in the `sessions` table —
   *  the source of truth is the attachments row. See P1.8 in AUDIT.md. */
  napkin_attachment_id: string | null
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
 * Soft-delete policy for `requireSessionAccess`. Three real-world variants:
 *  - `'hide-from-all'`     — 404 even to admin. Use for write paths that don't
 *                            make sense on a deleted session (POST messages,
 *                            new attachments, payment checkout / portal).
 *  - `'hide-from-non-admin'` (default) — 404 to visitor, admin can still load.
 *                            Use for read paths so admin trash recovery works.
 *  - `'include'`           — return the row regardless. Use when the handler
 *                            needs to decide its own response (e.g. DELETE
 *                            handler that's idempotent — re-delete = 200 ok).
 */
export type SoftDeletedPolicy = 'hide-from-all' | 'hide-from-non-admin' | 'include'

/**
 * Resolve a per-session handler's auth + load + access dance in one call.
 * Returns the SessionRow on success, or a Response (400 / 404 / 403) the
 * handler can early-out with. Mirrors the `requireSignedIn` / `requireTenant`
 * shape elsewhere in `_lib/`. The viewer's email + admin flag are passed in
 * because every handler computes them anyway — keeps the helper from
 * importing the Env type and avoids a second cookie check inside this call.
 *
 *   const access = await requireSessionAccess(env.DB, params.id, {
 *     email, isAdmin: isAdmin(env, email)
 *   })
 *   if (access instanceof Response) return access
 *   const session = access
 */
export async function requireSessionAccess(
  db: D1Database,
  sessionId: unknown,
  viewer: { email: string; isAdmin: boolean },
  options: { softDeleted?: SoftDeletedPolicy } = {},
): Promise<SessionRow | Response> {
  const id = typeof sessionId === 'string' ? sessionId : String(sessionId ?? '')
  if (!id) return badRequest('missing id')
  const session = await loadSession(db, id)
  if (!session) return notFound()
  const policy = options.softDeleted ?? 'hide-from-non-admin'
  if (session.deleted_at) {
    if (policy === 'hide-from-all') return notFound()
    if (policy === 'hide-from-non-admin' && !viewer.isAdmin) return notFound()
    // 'include' — fall through; handler decides what to do with a deleted row.
  }
  if (!canAccessSession(viewer.email, viewer.isAdmin, session)) return forbidden()
  return session
}

/**
 * One-row session lookup used by every per-session handler. Centralized so the
 * SELECT shape stays in lockstep with SessionRow (4 handlers used to inline
 * this same SQL).
 */
/** Shared session-row SELECT projection. `napkin_attachment_id` is a derived
 *  correlated subquery rather than a stored column — see SessionRow's comment. */
export const SESSION_SELECT_COLUMNS = `id, email, intake_json, status, created_at, updated_at,
        deleted_at, status_history,
        showcased_at, showcase_title, showcase_tagline, tier,
        tier4_amount_cents, tier3_split, custodian_status, custodian_plan,
        all_yours_acknowledged_at, decline_note, community_discount,
        (SELECT id FROM attachments
         WHERE session_id = sessions.id AND kind = 'napkin'
         LIMIT 1) AS napkin_attachment_id`

export async function loadSession(db: D1Database, id: string): Promise<SessionRow | null> {
  return db
    .prepare(`SELECT ${SESSION_SELECT_COLUMNS} FROM sessions WHERE id = ?`)
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
