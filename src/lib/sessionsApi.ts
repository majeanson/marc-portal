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

export interface SessionRow {
  id: string
  email: string
  intake_json: string | null
  status: SessionStatus
  created_at: number
  updated_at: number
  deleted_at: number | null
  status_history: string | null
}

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

export function patchSession(
  id: string,
  patch: {
    status?: SessionStatus
    intakeJson?: unknown
    /** Optimistic concurrency: server returns 409 if updated_at differs. */
    ifUpdatedAt?: number
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
