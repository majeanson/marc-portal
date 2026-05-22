/**
 * Frontend bindings for the sessions + messages API. Mirrors functions/api/*.
 * Types kept in lockstep with functions/_lib/sessions.ts; if the server schema
 * changes, the source of truth is the functions side and this file follows.
 */

import { api } from './api'

export type SessionStatus = 'draft' | 'triage' | 'active' | 'shipped' | 'rejected'

export interface StatusHistoryEntry {
  from: SessionStatus
  to: SessionStatus
  by: string
  at: number
}

/** Tier classification (0/1/2/3/4) matching the public Pricing copy. NULL =
 * not yet classified by admin. */
export type SessionTier = 0 | 1 | 2 | 3 | 4

/** Tier-3 installment split — '50-50' (two legs) or '40-40-20' (three legs).
 * Admin-set per project; NULL until chosen (checkout defaults to '50-50'). */
export type Tier3Split = '50-50' | '40-40-20'

export interface SessionRow {
  id: string
  email: string
  intake_json: string | null
  status: SessionStatus
  created_at: number
  updated_at: number
  deleted_at: number | null
  status_history: string | null
  showcased_at: number | null
  showcase_title: string | null
  showcase_tagline: string | null
  tier: SessionTier | null
  /** Tier-4 admin-quoted amount in CAD cents. NULL when the admin hasn't
   * yet set a quote. PaymentActions disables the "Pay (quoted)" button
   * client-side when this is NULL on a tier-4 session. */
  tier4_amount_cents: number | null
  /** Tier-3 installment split ('50-50' | '40-40-20'). NULL = not chosen yet;
   * checkout defaults to '50-50'. */
  tier3_split: string | null
  /** Custodian-subscription state, mirrored from the canonical source (the
   *  payments summary). Values match CustodianStatus in paymentsApi.ts; NULL
   *  is treated as 'none' downstream. Surfaced on the row so admin filters
   *  don't need a per-session summary fetch. */
  custodian_status: string | null
  /** Which custodian plan an active subscription is on — 'watch' | 'care' |
   *  NULL. Lets AdminCustodians sum an exact MRR. Reflects the plan at
   *  subscribe time. */
  custodian_plan: string | null
  /** Unix seconds when the visitor explicitly confirmed "Tout à toi" /
   *  "All yours" (opted out of Custodian). NULL = no explicit ack yet.
   *  Set via PATCH `acknowledgeAllYours: true`. Historical signal — the
   *  *current* mode is always read from custodian_status. */
  all_yours_acknowledged_at: number | null
  /** Operator-written "generous no" note, shown to the visitor when the
   *  session is `rejected`. NULL = no note. Admin-only to set, via PATCH
   *  `declineNote`. */
  decline_note: string | null
}

/** What an attachment is — mirrors AttachmentKind in functions/_lib/attachments.ts.
 *  'file' = a picked document, 'voice' = an audio recording (carries a
 *  transcript), 'sketch' = an Excalidraw scene. */
export type AttachmentKind = 'file' | 'voice' | 'sketch'

export interface AttachmentRow {
  id: string
  session_id: string
  message_id: string | null
  uploaded_by: string
  filename: string
  content_type: string
  size: number
  r2_key: string
  created_at: number
  /** 'file' | 'voice' | 'sketch'. */
  kind: AttachmentKind
  /** Voice notes only: the edge-transcribed text. NULL otherwise. */
  transcript: string | null
}

export interface MessageRow {
  id: string
  session_id: string
  author: 'visitor' | 'marc'
  body: string
  created_at: number
  /** Always present (empty array if none). Server populates from
   * attachments.message_id = this.id. */
  attachments?: AttachmentRow[]
}

export function listSessions(opts: { deleted?: boolean } = {}): Promise<{
  sessions: SessionRow[]
}> {
  const qs = opts.deleted ? '?deleted=true' : ''
  return api(`/api/sessions${qs}`)
}

export function createSession(intakeJson?: unknown): Promise<{ session: SessionRow }> {
  return api('/api/sessions', { method: 'POST', body: { intakeJson } })
}

export function getSession(id: string): Promise<{ session: SessionRow }> {
  return api(`/api/sessions/${encodeURIComponent(id)}`)
}

export interface ShowcasePatch {
  enabled?: boolean
  title?: string | null
  tagline?: string | null
}

export function patchSession(
  id: string,
  patch: {
    status?: SessionStatus
    intakeJson?: unknown
    /** Optimistic concurrency: server returns 409 if updated_at differs. */
    ifUpdatedAt?: number
    showcase?: ShowcasePatch
    /** Admin-only tier classification. Pass null to clear. */
    tier?: SessionTier | null
    /** Admin-only tier-4 quoted amount in CAD cents. Pass null to clear. */
    tier4AmountCents?: number | null
    /** Admin-only tier-3 installment split. Pass null to clear. */
    tier3Split?: Tier3Split | null
    /** Visitor-self or admin: explicit Tout-à-toi confirmation (the visitor
     *  opts out of Custodian). true sets the timestamp; false clears. */
    acknowledgeAllYours?: boolean
    /** Admin-only: the "generous no" note shown on a rejected session.
     *  Pass null or '' to clear. */
    declineNote?: string | null
  },
): Promise<{ session: SessionRow }> {
  return api(`/api/sessions/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch })
}

export function deleteSession(id: string): Promise<{ ok: true }> {
  return api(`/api/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function undeleteSession(id: string): Promise<{ session: SessionRow }> {
  return api(`/api/sessions/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: { undelete: true },
  })
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

export function listMessages(sessionId: string): Promise<{ messages: MessageRow[] }> {
  return api(`/api/sessions/${encodeURIComponent(sessionId)}/messages`)
}

export function postMessage(
  sessionId: string,
  body: string,
  attachmentIds: string[] = [],
): Promise<{ message: MessageRow }> {
  return api(`/api/sessions/${encodeURIComponent(sessionId)}/messages`, {
    method: 'POST',
    body: { body, attachmentIds },
  })
}

/**
 * Loi 25 self-serve erasure. Deletes all of the signed-in visitor's data on the
 * server (sessions, messages, attachments, magic-link tokens) and clears the
 * session cookie. The caller should redirect to the home page after success.
 */
export function deleteMyAccount(): Promise<{ ok: true }> {
  return api('/api/me', { method: 'DELETE' })
}

/**
 * Server-side intake draft (cross-device resume). Keyed by the signed-in
 * email. Returns null until the visitor signs in or has never autosaved.
 */
export interface IntakeDraftResponse<T = unknown> {
  draft: { payload: T; createdAt: number; updatedAt: number } | null
}

export function getIntakeDraft<T = unknown>(): Promise<IntakeDraftResponse<T>> {
  return api('/api/intake-drafts')
}

export function saveIntakeDraft(payload: unknown): Promise<{ saved: true; updatedAt: number }> {
  return api('/api/intake-drafts', { method: 'POST', body: { payload } })
}

export function clearIntakeDraft(): Promise<{ ok: true }> {
  return api('/api/intake-drafts', { method: 'DELETE' })
}

export interface CapacityLive {
  active: number
  triage: number
  /** Legacy single-cap (== activeCap). Newer callers prefer activeCap/triageCap. */
  cap: number
  activeCap: number
  triageCap: number
  atCap: boolean
}

export function getCapacityLive(): Promise<CapacityLive> {
  return api('/api/capacity')
}

/** Public-facing project gallery row. Returned by /api/public/projects. */
export interface PublicProject {
  id: string
  showcasedAt: number
  title: string | null
  tagline: string | null
  status: string
  tier: SessionTier | null
  currentBuild: {
    label: string
    body: string
    buildUrl: string | null
    iframePath: string | null
    date: number
  } | null
}

export function listPublicProjects(): Promise<{ projects: PublicProject[] }> {
  return api('/api/public/projects')
}
