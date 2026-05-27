/**
 * Frontend types + bindings for /api/admin/today and the operator-notes
 * CRUD endpoints. Types mirror the server (functions/api/admin/today.ts
 * and …/admin/sessions/[id]/notes.ts) — when the server schema shifts,
 * the source of truth is the functions side and this file follows.
 */

import { api } from './api'
import type { SessionRow } from './sessionsApi'

export type NextActionCode =
  | 'rejected'
  | 'shipped_done'
  | 'shipped_handoff_pending'
  | 'custodian_past_due'
  | 'reply_overdue'
  | 'tier_missing'
  | 'tier4_quote_missing'
  | 'installment_unpaid'
  | 'check_in_due'
  | 'triage_overdue'
  | 'triage_pending'
  | 'draft_stalled'
  | 'ok'

export type NextActionSeverity = 'urgent' | 'warn' | 'info' | 'muted'

export interface NextAction {
  code: NextActionCode
  severity: NextActionSeverity
  label_fr: string
  label_en: string
  hint_fr: string
  hint_en: string
}

export interface TodaySessionEntry {
  session: SessionRow
  nextAction: NextAction
  lastVisitorMessageAt: number | null
  lastMarcMessageAt: number | null
  paidBuildLegs: number
  pendingBuildLegs: number
  failedBuildLegs: number
  noteSnippet: string | null
  noteUpdatedAt: number | null
}

export interface OverduePaymentEntry {
  sessionId: string
  email: string
  paymentId: string
  amountCents: number
  ageSeconds: number
  installmentLabel: string | null
}

export interface SlaBreachEntry {
  sessionId: string
  email: string
  status: 'draft' | 'triage'
  ageSeconds: number
}

export interface UnansweredMessageEntry {
  sessionId: string
  email: string
  lastVisitorMessageAt: number
  ageSeconds: number
}

export interface SystemHealthEntry {
  outboxPending: number
  outboxStuck: number
  emailBouncesLast7d: number
  emailComplaintsLast7d: number
  openAdminAlerts: number
  capacity: {
    active: number
    triage: number
    activeCap: number
    triageCap: number
  }
  /** Unix seconds of the last successful digest-cron firing, or null when
   *  the heartbeat has never been written (pre-migration env, fresh deploy
   *  before the first cron tick). */
  lastDigestAtS: number | null
  /** True when the heartbeat is missing OR older than 36h. The dashboard
   *  surfaces this as a stale-cron warning. */
  digestStale: boolean
}

export interface CustodianAlertsEntry {
  pastDue: Array<{ sessionId: string; email: string; updatedAt: number }>
  recentSwitches: Array<{ sessionId: string; email: string; updatedAt: number }>
}

export interface TodayResponse {
  sessions: TodaySessionEntry[]
  overduePayments: OverduePaymentEntry[]
  slaBreaches: SlaBreachEntry[]
  unansweredMessages: UnansweredMessageEntry[]
  systemHealth: SystemHealthEntry
  custodianAlerts: CustodianAlertsEntry
  generatedAtS: number
}

export function getToday(): Promise<TodayResponse> {
  return api('/api/admin/today')
}

export interface OperatorNote {
  sessionId: string
  body: string
  updatedAt: number
  updatedBy: string
}

export interface OperatorNoteResponse {
  note: OperatorNote | null
}

export function getOperatorNote(sessionId: string): Promise<OperatorNoteResponse> {
  return api(`/api/admin/sessions/${encodeURIComponent(sessionId)}/notes`)
}

export function putOperatorNote(sessionId: string, body: string): Promise<OperatorNoteResponse> {
  return api(`/api/admin/sessions/${encodeURIComponent(sessionId)}/notes`, {
    method: 'PUT',
    body: { body },
  })
}

export function deleteOperatorNote(sessionId: string): Promise<OperatorNoteResponse> {
  return api(`/api/admin/sessions/${encodeURIComponent(sessionId)}/notes`, {
    method: 'DELETE',
  })
}
