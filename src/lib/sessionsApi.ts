/**
 * Frontend bindings for the sessions + messages API. Mirrors functions/api/*.
 * Types kept in lockstep with functions/_lib/sessions.ts; if the server schema
 * changes, the source of truth is the functions side and this file follows.
 */

import { api } from './api'

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

export function listSessions(): Promise<{ sessions: SessionRow[] }> {
  return api('/api/sessions')
}

export function createSession(intakeJson?: unknown): Promise<{ session: SessionRow }> {
  return api('/api/sessions', { method: 'POST', body: { intakeJson } })
}

export function getSession(id: string): Promise<{ session: SessionRow }> {
  return api(`/api/sessions/${encodeURIComponent(id)}`)
}

export function patchSession(
  id: string,
  patch: { status?: SessionStatus; intakeJson?: unknown },
): Promise<{ session: SessionRow }> {
  return api(`/api/sessions/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch })
}

export function listMessages(sessionId: string): Promise<{ messages: MessageRow[] }> {
  return api(`/api/sessions/${encodeURIComponent(sessionId)}/messages`)
}

export function postMessage(sessionId: string, body: string): Promise<{ message: MessageRow }> {
  return api(`/api/sessions/${encodeURIComponent(sessionId)}/messages`, {
    method: 'POST',
    body: { body },
  })
}

export function getCapacityLive(): Promise<{ active: number; triage: number; cap: number }> {
  return api('/api/capacity')
}
