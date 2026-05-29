import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { D1Database } from '@cloudflare/workers-types'
import { D1Mock } from '../../tests/d1-mock'
import {
  computeCustodianDrift,
  reconcileCustodians,
  type CustodianDbRow,
} from './custodianReconcile'
import type { Env } from './env'
import * as stripe from './stripe'

function row(over: Partial<CustodianDbRow> = {}): CustodianDbRow {
  return {
    id: 'sess_1',
    custodian_subscription_id: 'sub_1',
    custodian_status: 'active',
    ...over,
  }
}

describe('computeCustodianDrift', () => {
  it('reports no drift when an active row matches an active Stripe sub', () => {
    expect(computeCustodianDrift([row()], new Set(['sub_1']))).toEqual([])
  })

  it('flags an active row whose sub is not active in Stripe (missed lapse)', () => {
    const drift = computeCustodianDrift([row({ custodian_status: 'active' })], new Set())
    expect(drift).toHaveLength(1)
    expect(drift[0]!.kind).toBe('db_active_not_in_stripe')
    expect(drift[0]!.subscriptionId).toBe('sub_1')
  })

  it('flags a past_due row whose sub is active again in Stripe (missed invoice.paid)', () => {
    const drift = computeCustodianDrift([row({ custodian_status: 'past_due' })], new Set(['sub_1']))
    expect(drift).toHaveLength(1)
    expect(drift[0]!.kind).toBe('db_past_due_active_in_stripe')
  })

  it('treats a past_due row absent from Stripe as consistent (no drift)', () => {
    expect(computeCustodianDrift([row({ custodian_status: 'past_due' })], new Set())).toEqual([])
  })

  it('skips rows without a subscription id', () => {
    expect(computeCustodianDrift([row({ custodian_subscription_id: '' })], new Set())).toEqual([])
  })

  it('handles a mixed batch, returning one finding per drifting row', () => {
    const rows = [
      row({ id: 's_ok', custodian_subscription_id: 'sub_ok', custodian_status: 'active' }),
      row({ id: 's_lapsed', custodian_subscription_id: 'sub_lapsed', custodian_status: 'active' }),
      row({
        id: 's_recovered',
        custodian_subscription_id: 'sub_rec',
        custodian_status: 'past_due',
      }),
    ]
    const drift = computeCustodianDrift(rows, new Set(['sub_ok', 'sub_rec']))
    expect(drift.map((d) => d.sessionId).sort()).toEqual(['s_lapsed', 's_recovered'])
  })
})

describe('reconcileCustodians', () => {
  let db: D1Mock
  let env: Env
  const listSpy = vi.spyOn(stripe, 'listActiveSubscriptions')

  beforeEach(() => {
    db = new D1Mock()
    listSpy.mockReset()
    env = { DB: db as unknown as D1Database, STRIPE_SECRET_KEY: 'sk_test_x' } as Env
  })

  function seedCustodian(id: string, subId: string, status: string): void {
    db.sessions.set(id, {
      id,
      email: `${id}@x.com`,
      intake_json: null,
      status: 'shipped',
      created_at: 1,
      updated_at: 1,
      deleted_at: null,
      status_history: null,
      showcased_at: null,
      showcase_title: null,
      showcase_tagline: null,
      custodian_status: status,
      custodian_subscription_id: subId,
    })
  }

  function sub(id: string): stripe.StripeSubscriptionSummary {
    return { id, status: 'active', current_period_end: 9_999_999_999, customer: 'cus_x' }
  }

  it('skips cleanly when STRIPE_SECRET_KEY is unset', async () => {
    env = { ...env, STRIPE_SECRET_KEY: undefined } as Env
    const res = await reconcileCustodians(env)
    expect(res.skipped).toBe('no_stripe_key')
    expect(listSpy).not.toHaveBeenCalled()
  })

  it('writes one admin alert when drift is found', async () => {
    seedCustodian('s_lapsed', 'sub_lapsed', 'active') // active here, absent in Stripe
    listSpy.mockResolvedValue([]) // Stripe reports no active subs
    const res = await reconcileCustodians(env)
    expect(res.checked).toBe(1)
    expect(res.drift).toHaveLength(1)
    expect(res.alerted).toBe(true)
    const alerts = [...db.admin_alerts.values()].filter((a) => a.kind === 'custodian-reconcile')
    expect(alerts).toHaveLength(1)
    expect(alerts[0]!.body).toContain('sub_lapsed')
  })

  it('does not stack a second alert while an open one already exists', async () => {
    seedCustodian('s_lapsed', 'sub_lapsed', 'active')
    listSpy.mockResolvedValue([])
    db.admin_alerts.set('alrt_existing', {
      id: 'alrt_existing',
      kind: 'custodian-reconcile',
      body: 'prior',
      created_at: 1,
      resolved_at: null,
    })
    const res = await reconcileCustodians(env)
    expect(res.drift).toHaveLength(1)
    expect(res.alerted).toBe(false)
    expect(
      [...db.admin_alerts.values()].filter((a) => a.kind === 'custodian-reconcile'),
    ).toHaveLength(1)
  })

  it('writes no alert when records and Stripe agree', async () => {
    seedCustodian('s_ok', 'sub_ok', 'active')
    listSpy.mockResolvedValue([sub('sub_ok')])
    const res = await reconcileCustodians(env)
    expect(res.drift).toEqual([])
    expect(res.alerted).toBe(false)
    expect([...db.admin_alerts.values()]).toHaveLength(0)
  })
})
