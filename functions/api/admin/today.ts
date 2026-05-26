// GET /api/admin/today — single-shot dashboard payload for /admin/today.
//
// Pulls just enough state across sessions / messages / payments / email
// signals to answer "what do I need to do today as a solo operator?" in
// one round-trip. The capacity cap (1 active + 1 triage) keeps the
// session list tiny by construction, so the queries stay cheap.
//
// Each section corresponds to a panel on the client:
//   - sessions       : the live (non-rejected) session rows + next-action
//                      label + per-session last-message + payment summary.
//   - overduePayments: build-kind 'pending' rows >7d old, scoping not
//                      counted (one-shot, no notion of overdue).
//   - slaBreaches    : draft/triage sessions older than the 72h SLA.
//   - unansweredMessages: visitor wrote, Marc hasn't replied, >24h.
//   - systemHealth   : outbox stuck/pending, bounce/complaint volume,
//                      open admin_alerts, capacity occupancy.
//   - custodianAlerts: past-due + recent switches (last 30 days).
//
// Admin-only. No CSRF gate (GET). No tenant gate (the dashboard is
// operator-internal; the response is admin-scoped already).

import { currentEmail } from '../../_lib/auth'
import type { Env } from '../../_lib/env'
import { isAdmin } from '../../_lib/env'
import { forbidden, ok, unauthorized } from '../../_lib/json'
import { inferNextAction, type NextAction } from '../../_lib/nextAction'
import { parseStatusHistory, SESSION_SELECT_COLUMNS, type SessionRow } from '../../_lib/sessions'

interface MessageStatRow {
  session_id: string
  author: 'visitor' | 'marc'
  last_at: number
}

interface PaymentStatRow {
  session_id: string
  kind: string
  status: string
  amount_cents: number
  installment_index: number | null
  installment_of: number | null
  created_at: number
}

interface OutboxCountRow {
  pending: number
  stuck: number
}

interface EmailEventCountRow {
  bounces: number
  complaints: number
}

interface NoteRow {
  session_id: string
  body: string
  updated_at: number
  updated_by: string
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

// Thresholds — same vocabulary as nextAction.ts uses, kept here for the
// section-level filtering. Reads as a single number-line per section.
const SLA_S = 72 * 3600
const REPLY_OVERDUE_S = 24 * 3600
const OVERDUE_PAYMENT_S = 7 * 24 * 3600
const RECENT_SWITCH_S = 30 * 24 * 3600
const EMAIL_LOOKBACK_S = 7 * 24 * 3600
// Mirror sweepEmailOutbox's default — keeping the numbers in lockstep.
const OUTBOX_MAX_ATTEMPTS = 5

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()
  if (!isAdmin(env, email)) return forbidden()

  const nowS = Math.floor(Date.now() / 1000)

  // ── Sessions (live, non-rejected). The capacity cap keeps this list
  // small but we don't bake "non-rejected" into the index — explicit so
  // a future bump in cap stays correct.
  const sessionsRes = await env.DB.prepare(
    `SELECT ${SESSION_SELECT_COLUMNS}
       FROM sessions
      WHERE deleted_at IS NULL AND status != 'rejected'
      ORDER BY
        CASE status
          WHEN 'triage' THEN 0
          WHEN 'active' THEN 1
          WHEN 'draft'  THEN 2
          WHEN 'shipped' THEN 3
          ELSE 4
        END,
        updated_at DESC`,
  ).all<SessionRow>()
  const sessions = sessionsRes.results ?? []

  const sessionIds = sessions.map((s) => s.id)
  const placeholders = sessionIds.map(() => '?').join(',')

  // ── Last-message-per-author-per-session in one query. SQLite's
  // MAX-with-GROUP-BY trick: select MAX(created_at) per (session, author),
  // walk the rows on the JS side to compose per-session lastVisitor /
  // lastMarc timestamps.
  let messageStats: MessageStatRow[] = []
  if (sessionIds.length > 0) {
    const r = await env.DB.prepare(
      `SELECT session_id, author, MAX(created_at) AS last_at
         FROM messages
        WHERE session_id IN (${placeholders})
        GROUP BY session_id, author`,
    )
      .bind(...sessionIds)
      .all<MessageStatRow>()
    messageStats = r.results ?? []
  }
  const lastVisitor = new Map<string, number>()
  const lastMarc = new Map<string, number>()
  for (const r of messageStats) {
    if (r.author === 'visitor') lastVisitor.set(r.session_id, r.last_at)
    else if (r.author === 'marc') lastMarc.set(r.session_id, r.last_at)
  }

  // ── Build-payment stats per session. We don't need every payment row —
  // just status counts + the timestamps that drive "overdue" elsewhere.
  // Pulling the rows once and bucketing in JS is simpler than three
  // separate aggregates.
  let payments: PaymentStatRow[] = []
  if (sessionIds.length > 0) {
    const r = await env.DB.prepare(
      `SELECT session_id, kind, status, amount_cents,
              installment_index, installment_of, created_at
         FROM payments
        WHERE session_id IN (${placeholders})`,
    )
      .bind(...sessionIds)
      .all<PaymentStatRow>()
    payments = r.results ?? []
  }
  const buildStats = new Map<string, { paid: number; pending: number; failed: number }>()
  for (const p of payments) {
    if (p.kind !== 'build') continue
    const cur = buildStats.get(p.session_id) ?? { paid: 0, pending: 0, failed: 0 }
    if (p.status === 'paid') cur.paid++
    else if (p.status === 'pending') cur.pending++
    else if (p.status === 'failed') cur.failed++
    buildStats.set(p.session_id, cur)
  }

  // ── Operator notes preview (200-char snippet, plus last updated). The
  // CRUD endpoint owns the full body; the dashboard just hints "there's
  // context to read."
  let notes: NoteRow[] = []
  if (sessionIds.length > 0) {
    try {
      const r = await env.DB.prepare(
        `SELECT session_id, body, updated_at, updated_by
           FROM operator_notes
          WHERE session_id IN (${placeholders})`,
      )
        .bind(...sessionIds)
        .all<NoteRow>()
      notes = r.results ?? []
    } catch (err) {
      // Operator_notes is in migration 0028 — gracefully degrade if a
      // deploy lands the handler before the migration. Pattern mirrors the
      // tenants pre-migration fallback in _middleware.ts.
      const msg = err instanceof Error ? err.message : String(err)
      if (!/no such table/.test(msg)) throw err
    }
  }
  const noteBySession = new Map<string, NoteRow>()
  for (const n of notes) noteBySession.set(n.session_id, n)

  // ── Compose the per-session entries.
  const entries: TodaySessionEntry[] = sessions.map((s) => {
    const history = parseStatusHistory(s.status_history)
    const enteredAt = history.length > 0 ? history[history.length - 1].at : null
    const stats = buildStats.get(s.id) ?? { paid: 0, pending: 0, failed: 0 }
    const lastV = lastVisitor.get(s.id) ?? null
    const lastM = lastMarc.get(s.id) ?? null
    const note = noteBySession.get(s.id) ?? null
    const action = inferNextAction(s, {
      nowS,
      lastVisitorMessageAtS: lastV,
      lastMarcMessageAtS: lastM,
      paidBuildLegs: stats.paid,
      stalePendingBuildLegs: 0, // not surfaced through nextAction today
      statusEnteredAtS: enteredAt,
    })
    return {
      session: s,
      nextAction: action,
      lastVisitorMessageAt: lastV,
      lastMarcMessageAt: lastM,
      paidBuildLegs: stats.paid,
      pendingBuildLegs: stats.pending,
      failedBuildLegs: stats.failed,
      noteSnippet: note ? note.body.slice(0, 200) : null,
      noteUpdatedAt: note ? note.updated_at : null,
    }
  })

  // ── Overdue payments. Build-kind 'pending' >7d old. Scoping is a
  // one-shot self-pay (no nudging needed); custodian is Stripe-managed.
  const sessionEmailById = new Map(sessions.map((s) => [s.id, s.email]))
  const overduePayments: OverduePaymentEntry[] = []
  for (const p of payments) {
    if (p.kind !== 'build') continue
    if (p.status !== 'pending') continue
    const age = nowS - p.created_at
    if (age < OVERDUE_PAYMENT_S) continue
    const email = sessionEmailById.get(p.session_id)
    if (!email) continue
    overduePayments.push({
      sessionId: p.session_id,
      email,
      paymentId: '', // legacy: not selected; payment rows have no exposed id here
      amountCents: p.amount_cents,
      ageSeconds: age,
      installmentLabel:
        p.installment_index !== null && p.installment_of !== null
          ? `${p.installment_index}/${p.installment_of}`
          : null,
    })
  }
  overduePayments.sort((a, b) => b.ageSeconds - a.ageSeconds)

  // ── SLA breaches: draft or triage sessions older than 72h. We use
  // created_at as the SLA clock (matches src/lib/format.ts computeSla).
  const slaBreaches: SlaBreachEntry[] = sessions
    .filter((s) => (s.status === 'draft' || s.status === 'triage') && nowS - s.created_at > SLA_S)
    .map((s) => ({
      sessionId: s.id,
      email: s.email,
      status: s.status as 'draft' | 'triage',
      ageSeconds: nowS - s.created_at,
    }))
    .sort((a, b) => b.ageSeconds - a.ageSeconds)

  // ── Unanswered messages: visitor wrote, Marc hasn't replied since,
  // and it's been >24h. The order matches the urgency: oldest first.
  const unansweredMessages: UnansweredMessageEntry[] = entries
    .filter((e) => {
      const v = e.lastVisitorMessageAt
      const m = e.lastMarcMessageAt
      return v !== null && (m === null || m < v) && nowS - v > REPLY_OVERDUE_S
    })
    .map((e) => ({
      sessionId: e.session.id,
      email: e.session.email,
      lastVisitorMessageAt: e.lastVisitorMessageAt!,
      ageSeconds: nowS - e.lastVisitorMessageAt!,
    }))
    .sort((a, b) => b.ageSeconds - a.ageSeconds)

  // ── System health rollup. Each sub-query is wrapped so a missing
  // table (e.g. on a half-migrated env) doesn't kill the whole response.
  let outboxPending = 0
  let outboxStuck = 0
  try {
    const r = await env.DB.prepare(
      `SELECT
         COUNT(CASE WHEN sent_at IS NULL AND attempts < ? THEN 1 END) AS pending,
         COUNT(CASE WHEN sent_at IS NULL AND attempts >= ? THEN 1 END) AS stuck
       FROM email_outbox`,
    )
      .bind(OUTBOX_MAX_ATTEMPTS, OUTBOX_MAX_ATTEMPTS)
      .first<OutboxCountRow>()
    outboxPending = r?.pending ?? 0
    outboxStuck = r?.stuck ?? 0
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (!/no such table/.test(msg)) throw err
  }

  let bouncesLast7d = 0
  let complaintsLast7d = 0
  try {
    const r = await env.DB.prepare(
      `SELECT
         COUNT(CASE WHEN type = 'email.bounced' THEN 1 END) AS bounces,
         COUNT(CASE WHEN type IN ('email.complained', 'email.unsubscribed') THEN 1 END) AS complaints
       FROM email_events
      WHERE received_at > ?`,
    )
      .bind(nowS - EMAIL_LOOKBACK_S)
      .first<EmailEventCountRow>()
    bouncesLast7d = r?.bounces ?? 0
    complaintsLast7d = r?.complaints ?? 0
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (!/no such table/.test(msg)) throw err
  }

  let openAdminAlerts = 0
  try {
    const r = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM admin_alerts WHERE resolved_at IS NULL`,
    ).first<{ n: number }>()
    openAdminAlerts = r?.n ?? 0
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (!/no such table/.test(msg)) throw err
  }

  // Capacity occupancy — pulled from the same sessions list we already have
  // in memory rather than a second round-trip to countActiveAndTriage.
  let activeCount = 0
  let triageCount = 0
  for (const s of sessions) {
    if (s.status === 'active') activeCount++
    else if (s.status === 'triage') triageCount++
  }

  const systemHealth: SystemHealthEntry = {
    outboxPending,
    outboxStuck,
    emailBouncesLast7d: bouncesLast7d,
    emailComplaintsLast7d: complaintsLast7d,
    openAdminAlerts,
    capacity: { active: activeCount, triage: triageCount, activeCap: 1, triageCap: 1 },
  }

  // ── Custodian alerts. Past-due first, then recent switches (the
  // visitor's account was just downgraded to "all yours" — Marc might
  // want to follow up). Recent = last 30 days, matched to the
  // shipped-handoff window in nextAction.
  //
  // Includes ALL live sessions (not the curated `sessions` list above),
  // because custodian state can persist after rejected/shipped — we want
  // to see every past-due regardless of session status.
  let custodianRows: SessionRow[] = []
  {
    const r = await env.DB.prepare(
      `SELECT ${SESSION_SELECT_COLUMNS}
         FROM sessions
        WHERE deleted_at IS NULL
          AND (custodian_status = 'past_due' OR
               (custodian_status = 'switched_to_tout_a_toi' AND updated_at > ?))
        ORDER BY updated_at DESC`,
    )
      .bind(nowS - RECENT_SWITCH_S)
      .all<SessionRow>()
    custodianRows = r.results ?? []
  }
  const pastDue = custodianRows
    .filter((s) => s.custodian_status === 'past_due')
    .map((s) => ({ sessionId: s.id, email: s.email, updatedAt: s.updated_at }))
  const recentSwitches = custodianRows
    .filter((s) => s.custodian_status === 'switched_to_tout_a_toi')
    .map((s) => ({ sessionId: s.id, email: s.email, updatedAt: s.updated_at }))
  const custodianAlerts: CustodianAlertsEntry = { pastDue, recentSwitches }

  const response: TodayResponse = {
    sessions: entries,
    overduePayments,
    slaBreaches,
    unansweredMessages,
    systemHealth,
    custodianAlerts,
    generatedAtS: nowS,
  }
  return ok(response)
}
