import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { D1Database } from '@cloudflare/workers-types'
import { D1Mock } from '../../tests/d1-mock'
import { checkSentryQuota, evaluateQuota, sumErrorQuantity } from './sentryQuota'
import type { Env } from './env'

describe('evaluateQuota', () => {
  it('is not over below the threshold', () => {
    expect(evaluateQuota(3999, 5000).over).toBe(false)
  })

  it('is over at exactly the threshold', () => {
    const e = evaluateQuota(4000, 5000)
    expect(e.over).toBe(true)
    expect(e.pct).toBeCloseTo(0.8)
  })

  it('is over past the threshold', () => {
    expect(evaluateQuota(6000, 5000).over).toBe(true)
  })

  it('honours a custom threshold', () => {
    expect(evaluateQuota(500, 1000, 0.5).over).toBe(true)
    expect(evaluateQuota(499, 1000, 0.5).over).toBe(false)
  })

  it('never reports over when quota is non-positive (misconfig guard)', () => {
    expect(evaluateQuota(9999, 0).over).toBe(false)
  })
})

describe('sumErrorQuantity', () => {
  it('sums sum(quantity) across groups', () => {
    const json = {
      groups: [{ totals: { 'sum(quantity)': 120 } }, { totals: { 'sum(quantity)': 80 } }],
    }
    expect(sumErrorQuantity(json)).toBe(200)
  })

  it('returns 0 for a missing or malformed shape', () => {
    expect(sumErrorQuantity({})).toBe(0)
    expect(sumErrorQuantity(null)).toBe(0)
    expect(sumErrorQuantity({ groups: 'nope' })).toBe(0)
    expect(sumErrorQuantity({ groups: [{ totals: { 'sum(quantity)': 'x' } }] })).toBe(0)
  })
})

describe('checkSentryQuota', () => {
  let db: D1Mock
  let env: Env

  beforeEach(() => {
    db = new D1Mock()
    env = {
      DB: db as unknown as D1Database,
      SENTRY_AUTH_TOKEN: 'tok',
      SENTRY_ORG: 'marc',
      SENTRY_MONTHLY_ERROR_QUOTA: '5000',
    } as Env
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubFetch(quantity: number) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        async json() {
          return { groups: [{ totals: { 'sum(quantity)': quantity } }] }
        },
      })),
    )
  }

  it('skips when the token or org is unset', async () => {
    env = { ...env, SENTRY_AUTH_TOKEN: undefined } as Env
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const res = await checkSentryQuota(env)
    expect(res.skipped).toBe('unconfigured')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('alerts when usage is over the threshold', async () => {
    stubFetch(4200) // 84% of 5000
    const res = await checkSentryQuota(env)
    expect(res.evaluation?.over).toBe(true)
    expect(res.alerted).toBe(true)
    const alerts = [...db.admin_alerts.values()].filter((a) => a.kind === 'sentry-quota')
    expect(alerts).toHaveLength(1)
    expect(alerts[0]!.body).toContain('84%')
  })

  it('does not alert when usage is under the threshold', async () => {
    stubFetch(1000) // 20%
    const res = await checkSentryQuota(env)
    expect(res.evaluation?.over).toBe(false)
    expect(res.alerted).toBe(false)
    expect([...db.admin_alerts.values()]).toHaveLength(0)
  })

  it('does not stack a second alert while an open one exists', async () => {
    stubFetch(4800)
    db.admin_alerts.set('alrt_existing', {
      id: 'alrt_existing',
      kind: 'sentry-quota',
      body: 'prior',
      created_at: 1,
      resolved_at: null,
    })
    const res = await checkSentryQuota(env)
    expect(res.evaluation?.over).toBe(true)
    expect(res.alerted).toBe(false)
    expect([...db.admin_alerts.values()].filter((a) => a.kind === 'sentry-quota')).toHaveLength(1)
  })
})
