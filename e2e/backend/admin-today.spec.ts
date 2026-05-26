// End-to-end coverage of GET /api/admin/today — the single-round-trip
// dashboard payload that powers the /admin/today operator surface. The
// vitest-side unit tests (functions/api/admin/today.test.ts) cover the
// composition logic against a mock D1; this spec runs the real handler
// through wrangler pages dev + ephemeral D1 with migration 0028 applied,
// so it asserts the wire format + auth wall + the structural invariants
// that only show up against a real driver:
//
//   - admin-only gate (401 unauthenticated, 403 visitor)
//   - empty payload shape (every section present, even with no rows)
//   - a live session shows in `sessions` with a computed nextAction
//   - a draft >72h triggers the slaBreaches branch
//   - a build-payment >7d old triggers the overduePayments branch
//   - capacity counts in systemHealth agree with the rows the spec seeded
//
// The dashboard is read-only — no CSRF gate (GET), no state writes — so
// every case here is a single fetch.

import { test, expect } from '@playwright/test'
import { randomBytes } from 'node:crypto'
import { E2E_BASE_URL, E2E_BINDINGS } from './constants'
import { forgeAuthHeaders } from './helpers/auth'
import { clearTestRows, seedMessage, seedPendingPayment, seedSession } from './helpers/db'

const ADMIN_EMAIL = E2E_BINDINGS.ADMIN_EMAILS // 'admin@e2e.test'
const VISITOR_EMAIL = 'visitor-today@e2e.test'

interface TodayResponseShape {
  sessions: Array<{
    session: { id: string; email: string; status: string }
    nextAction: {
      code: string
      severity: 'urgent' | 'warn' | 'info' | 'muted'
      label_fr: string
      label_en: string
    }
    lastVisitorMessageAt: number | null
    lastMarcMessageAt: number | null
    paidBuildLegs: number
    pendingBuildLegs: number
    failedBuildLegs: number
    noteSnippet: string | null
    noteUpdatedAt: number | null
  }>
  overduePayments: Array<{
    sessionId: string
    email: string
    amountCents: number
    ageSeconds: number
  }>
  slaBreaches: Array<{ sessionId: string; email: string; status: string; ageSeconds: number }>
  unansweredMessages: Array<{ sessionId: string; email: string; ageSeconds: number }>
  systemHealth: {
    outboxPending: number
    outboxStuck: number
    emailBouncesLast7d: number
    emailComplaintsLast7d: number
    openAdminAlerts: number
    capacity: { active: number; triage: number; activeCap: number; triageCap: number }
  }
  custodianAlerts: {
    pastDue: Array<{ sessionId: string; email: string }>
    recentSwitches: Array<{ sessionId: string; email: string }>
  }
  generatedAtS: number
}

async function getToday(headers: Record<string, string>): Promise<Response> {
  return await fetch(`${E2E_BASE_URL}/api/admin/today`, {
    method: 'GET',
    headers,
  })
}

test.describe('GET /api/admin/today — auth wall', () => {
  test.beforeEach(() => clearTestRows())

  test('no cookie → 401', async () => {
    const res = await getToday({})
    expect(res.status).toBe(401)
  })

  test('visitor cookie → 403', async () => {
    const headers = forgeAuthHeaders(VISITOR_EMAIL)
    const res = await getToday(headers)
    expect(res.status).toBe(403)
  })
})

test.describe('GET /api/admin/today — empty state', () => {
  test.beforeEach(() => clearTestRows())

  test('admin, no seeded rows → 200 with every section empty', async () => {
    const headers = forgeAuthHeaders(ADMIN_EMAIL)
    const res = await getToday(headers)
    expect(res.status).toBe(200)
    const body = (await res.json()) as TodayResponseShape

    expect(body.sessions).toEqual([])
    expect(body.overduePayments).toEqual([])
    expect(body.slaBreaches).toEqual([])
    expect(body.unansweredMessages).toEqual([])
    expect(body.custodianAlerts.pastDue).toEqual([])
    expect(body.custodianAlerts.recentSwitches).toEqual([])
    // Caps are structural — see CLAUDE.md "capacity cap is structural".
    expect(body.systemHealth.capacity.activeCap).toBe(1)
    expect(body.systemHealth.capacity.triageCap).toBe(1)
    expect(body.systemHealth.capacity.active).toBe(0)
    expect(body.systemHealth.capacity.triage).toBe(0)
    // generatedAtS is the server's clock — within a few seconds of ours.
    const nowS = Math.floor(Date.now() / 1000)
    expect(body.generatedAtS).toBeGreaterThan(nowS - 60)
    expect(body.generatedAtS).toBeLessThanOrEqual(nowS + 5)
  })
})

test.describe('GET /api/admin/today — populated', () => {
  test.beforeEach(() => clearTestRows())

  test('live session lands in sessions with a computed nextAction', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionId, email: VISITOR_EMAIL, status: 'active', tier: 1 })

    const headers = forgeAuthHeaders(ADMIN_EMAIL)
    const res = await getToday(headers)
    expect(res.status).toBe(200)
    const body = (await res.json()) as TodayResponseShape

    expect(body.sessions).toHaveLength(1)
    const entry = body.sessions[0]
    expect(entry.session.id).toBe(sessionId)
    expect(entry.session.email).toBe(VISITOR_EMAIL)
    expect(entry.session.status).toBe('active')
    // Every entry must carry a nextAction with FR + EN copy.
    expect(typeof entry.nextAction.code).toBe('string')
    expect(['urgent', 'warn', 'info', 'muted']).toContain(entry.nextAction.severity)
    expect(entry.nextAction.label_fr.length).toBeGreaterThan(0)
    expect(entry.nextAction.label_en.length).toBeGreaterThan(0)
    // No messages or payments seeded → counters all zero.
    expect(entry.lastVisitorMessageAt).toBeNull()
    expect(entry.lastMarcMessageAt).toBeNull()
    expect(entry.paidBuildLegs).toBe(0)
    expect(entry.pendingBuildLegs).toBe(0)
    expect(entry.noteSnippet).toBeNull()
    // Capacity reflects the one active session — same source as /api/capacity.
    expect(body.systemHealth.capacity.active).toBe(1)
    expect(body.systemHealth.capacity.triage).toBe(0)
  })

  test('draft session >72h old lands in slaBreaches', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    const fourDaysAgo = Math.floor(Date.now() / 1000) - 4 * 24 * 3600
    seedSession({
      id: sessionId,
      email: 'sla-victim@e2e.test',
      status: 'draft',
      tier: 1,
      createdAt: fourDaysAgo,
    })

    const headers = forgeAuthHeaders(ADMIN_EMAIL)
    const res = await getToday(headers)
    expect(res.status).toBe(200)
    const body = (await res.json()) as TodayResponseShape

    expect(body.slaBreaches).toHaveLength(1)
    expect(body.slaBreaches[0].sessionId).toBe(sessionId)
    expect(body.slaBreaches[0].status).toBe('draft')
    // Age >72h. Allow a few seconds of slack for clock drift / test latency.
    expect(body.slaBreaches[0].ageSeconds).toBeGreaterThanOrEqual(72 * 3600 - 60)
  })

  test('build-payment >7d old lands in overduePayments', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    const paymentId = `pay_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionId, email: 'overdue-buyer@e2e.test', status: 'active', tier: 1 })
    seedPendingPayment({
      paymentId,
      sessionId,
      kind: 'build',
      amountCents: 75_000,
      createdAt: Math.floor(Date.now() / 1000) - 9 * 24 * 3600,
    })

    const headers = forgeAuthHeaders(ADMIN_EMAIL)
    const res = await getToday(headers)
    expect(res.status).toBe(200)
    const body = (await res.json()) as TodayResponseShape

    expect(body.overduePayments).toHaveLength(1)
    expect(body.overduePayments[0].sessionId).toBe(sessionId)
    expect(body.overduePayments[0].email).toBe('overdue-buyer@e2e.test')
    expect(body.overduePayments[0].amountCents).toBe(75_000)
    expect(body.overduePayments[0].ageSeconds).toBeGreaterThanOrEqual(7 * 24 * 3600)
    // The session entry also reports the pending leg.
    expect(body.sessions[0].pendingBuildLegs).toBe(1)
  })

  test('visitor message >24h with no operator reply lands in unansweredMessages', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionId, email: 'waiting@e2e.test', status: 'active', tier: 1 })
    seedMessage({
      sessionId,
      author: 'visitor',
      body: 'hi marc',
      createdAt: Math.floor(Date.now() / 1000) - 36 * 3600,
    })

    const headers = forgeAuthHeaders(ADMIN_EMAIL)
    const res = await getToday(headers)
    expect(res.status).toBe(200)
    const body = (await res.json()) as TodayResponseShape

    expect(body.unansweredMessages).toHaveLength(1)
    expect(body.unansweredMessages[0].sessionId).toBe(sessionId)
    expect(body.unansweredMessages[0].ageSeconds).toBeGreaterThanOrEqual(24 * 3600)
    // And the per-session entry reflects the same timestamp.
    expect(body.sessions[0].lastVisitorMessageAt).not.toBeNull()
    expect(body.sessions[0].lastMarcMessageAt).toBeNull()
  })

  test('operator reply after visitor message → not in unansweredMessages', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionId, email: 'replied@e2e.test', status: 'active', tier: 1 })
    const visitorAt = Math.floor(Date.now() / 1000) - 36 * 3600
    const marcAt = visitorAt + 3600 // marc replied an hour later
    seedMessage({ sessionId, author: 'visitor', createdAt: visitorAt })
    seedMessage({ sessionId, author: 'marc', createdAt: marcAt })

    const headers = forgeAuthHeaders(ADMIN_EMAIL)
    const res = await getToday(headers)
    expect(res.status).toBe(200)
    const body = (await res.json()) as TodayResponseShape

    expect(body.unansweredMessages).toHaveLength(0)
    expect(body.sessions[0].lastVisitorMessageAt).toBe(visitorAt)
    expect(body.sessions[0].lastMarcMessageAt).toBe(marcAt)
  })

  test('rejected sessions are excluded from the live session list', async () => {
    const liveId = `sess_e2e_${randomBytes(6).toString('hex')}`
    const rejectedId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: liveId, email: 'live@e2e.test', status: 'active', tier: 1 })
    seedSession({ id: rejectedId, email: 'rejected@e2e.test', status: 'rejected', tier: 1 })

    const headers = forgeAuthHeaders(ADMIN_EMAIL)
    const res = await getToday(headers)
    expect(res.status).toBe(200)
    const body = (await res.json()) as TodayResponseShape

    const ids = body.sessions.map((s) => s.session.id)
    expect(ids).toContain(liveId)
    expect(ids).not.toContain(rejectedId)
  })
})
