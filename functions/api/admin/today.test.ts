import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type D1Mock, makeMockEnv } from '../../../tests/d1-mock'

vi.mock('../../_lib/auth', () => ({
  currentEmail: vi.fn(),
}))

import { currentEmail } from '../../_lib/auth'
import { onRequestGet } from './today'
import type { TodayResponse } from './today'

const mockedCurrentEmail = vi.mocked(currentEmail)

function makeCtx(asEmail: string | null) {
  const env = makeMockEnv()
  mockedCurrentEmail.mockResolvedValue(asEmail)
  return {
    request: new Request('https://x.test/api/admin/today'),
    env,
    params: {},
  } as Parameters<typeof onRequestGet>[0]
}

function seedSession(db: D1Mock, over: Record<string, unknown> = {}) {
  const id = (over.id as string) ?? 's1'
  db.sessions.set(id, {
    id,
    email: 'visitor@x.com',
    intake_json: null,
    status: 'active',
    created_at: 1_700_000_000,
    updated_at: 1_700_000_000,
    deleted_at: null,
    status_history: null,
    showcased_at: null,
    showcase_title: null,
    showcase_tagline: null,
    tier: 1,
    tier4_amount_cents: null,
    tier3_split: null,
    custodian_status: null,
    custodian_plan: null,
    all_yours_acknowledged_at: null,
    community_discount: 0,
    ...over,
  })
}

beforeEach(() => {
  mockedCurrentEmail.mockReset()
})

describe('GET /api/admin/today — auth', () => {
  it('returns 401 when not signed in', async () => {
    const ctx = makeCtx(null)
    const res = await onRequestGet(ctx)
    expect(res.status).toBe(401)
  })

  it('returns 403 for a non-admin', async () => {
    const ctx = makeCtx('visitor@x.com')
    const res = await onRequestGet(ctx)
    expect(res.status).toBe(403)
  })
})

describe('GET /api/admin/today — shape', () => {
  it('returns all sections with empty defaults', async () => {
    const ctx = makeCtx('marc@x.com')
    const res = await onRequestGet(ctx)
    expect(res.status).toBe(200)
    const body = (await res.json()) as TodayResponse
    expect(body.sessions).toEqual([])
    expect(body.overduePayments).toEqual([])
    expect(body.slaBreaches).toEqual([])
    expect(body.unansweredMessages).toEqual([])
    expect(body.systemHealth.capacity).toEqual({
      active: 0,
      triage: 0,
      activeCap: 1,
      triageCap: 1,
    })
    expect(body.custodianAlerts.pastDue).toEqual([])
    expect(body.custodianAlerts.recentSwitches).toEqual([])
    expect(typeof body.generatedAtS).toBe('number')
  })

  it('excludes rejected and soft-deleted sessions from the live list', async () => {
    const ctx = makeCtx('marc@x.com')
    const db = ctx.env._db as D1Mock
    seedSession(db, { id: 'live', status: 'active' })
    seedSession(db, { id: 'rej', status: 'rejected' })
    seedSession(db, { id: 'del', status: 'active', deleted_at: 100 })
    const res = await onRequestGet(ctx)
    const body = (await res.json()) as TodayResponse
    expect(body.sessions.map((e) => e.session.id)).toEqual(['live'])
  })

  it('computes capacity from the live sessions', async () => {
    const ctx = makeCtx('marc@x.com')
    const db = ctx.env._db as D1Mock
    seedSession(db, { id: 'a', status: 'active' })
    seedSession(db, { id: 't', status: 'triage' })
    const res = await onRequestGet(ctx)
    const body = (await res.json()) as TodayResponse
    expect(body.systemHealth.capacity.active).toBe(1)
    expect(body.systemHealth.capacity.triage).toBe(1)
  })

  it('surfaces tier_missing as the next action when an active session has no tier', async () => {
    const ctx = makeCtx('marc@x.com')
    const db = ctx.env._db as D1Mock
    seedSession(db, { id: 'a', status: 'active', tier: null })
    const res = await onRequestGet(ctx)
    const body = (await res.json()) as TodayResponse
    expect(body.sessions[0].nextAction.code).toBe('tier_missing')
  })

  it('flags an SLA breach for a triage session older than 72h', async () => {
    const ctx = makeCtx('marc@x.com')
    const db = ctx.env._db as D1Mock
    const fourDaysAgo = Math.floor(Date.now() / 1000) - 4 * 24 * 3600
    seedSession(db, {
      id: 't',
      status: 'triage',
      created_at: fourDaysAgo,
      updated_at: fourDaysAgo,
    })
    const res = await onRequestGet(ctx)
    const body = (await res.json()) as TodayResponse
    expect(body.slaBreaches).toHaveLength(1)
    expect(body.slaBreaches[0].sessionId).toBe('t')
    expect(body.slaBreaches[0].status).toBe('triage')
  })

  it('surfaces a past-due custodian in custodianAlerts', async () => {
    const ctx = makeCtx('marc@x.com')
    const db = ctx.env._db as D1Mock
    seedSession(db, {
      id: 'p',
      status: 'shipped',
      custodian_status: 'past_due',
    })
    const res = await onRequestGet(ctx)
    const body = (await res.json()) as TodayResponse
    expect(body.custodianAlerts.pastDue).toHaveLength(1)
    expect(body.custodianAlerts.pastDue[0].sessionId).toBe('p')
  })

  it('lists overdue build-payments >7 days old', async () => {
    const ctx = makeCtx('marc@x.com')
    const db = ctx.env._db as D1Mock
    const eightDaysAgo = Math.floor(Date.now() / 1000) - 8 * 24 * 3600
    seedSession(db, { id: 's1', status: 'active', tier: 2 })
    db.payments.set('p1', {
      id: 'p1',
      session_id: 's1',
      kind: 'build',
      tier: 2,
      installment_index: 1,
      installment_of: 2,
      custodian_plan: null,
      amount_cents: 90_000,
      currency: 'cad',
      status: 'pending',
      stripe_checkout_session_id: null,
      stripe_payment_intent_id: null,
      stripe_subscription_id: null,
      stripe_invoice_id: null,
      stripe_customer_id: null,
      created_at: eightDaysAgo,
      paid_at: null,
    })
    const res = await onRequestGet(ctx)
    const body = (await res.json()) as TodayResponse
    expect(body.overduePayments).toHaveLength(1)
    expect(body.overduePayments[0].installmentLabel).toBe('1/2')
  })
})
