/**
 * Tests for the digest cron's heartbeat stamp — the operator-facing signal
 * that cron-job.org is still firing. Anything else the digest does
 * (housekeeping sweeps, the email itself) is exercised end-to-end by the
 * e2e backend suite; here we just pin the heartbeat contract.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { makeMockEnv } from '../../../tests/d1-mock'
import { onRequestPost } from './digest'

function makeCtx(opts: { token?: string; digestToken?: string } = {}) {
  const env = makeMockEnv({ DIGEST_TOKEN: opts.digestToken ?? 'good-token' })
  const headers = new Headers()
  if (opts.token !== undefined) headers.set('X-Digest-Token', opts.token)
  return {
    request: new Request('https://x.test/api/admin/digest', {
      method: 'POST',
      headers,
    }),
    env,
    params: {},
  } as Parameters<typeof onRequestPost>[0]
}

beforeEach(() => {
  // Empty default DB — heartbeat is the only thing under test, the rest of
  // the digest path bails on empty queries.
})

describe('POST /api/admin/digest — heartbeat', () => {
  it('stamps last_digest_at in system_kv on a valid token', async () => {
    const ctx = makeCtx({ token: 'good-token' })
    const before = Math.floor(Date.now() / 1000)
    const res = await onRequestPost(ctx)
    expect(res.status).toBe(200)
    const row = ctx.env._db.system_kv.get('last_digest_at')
    expect(row).toBeDefined()
    const stampedAt = Number.parseInt(row?.value ?? '', 10)
    expect(stampedAt).toBeGreaterThanOrEqual(before)
  })

  it('does NOT stamp the heartbeat on a bad token (401)', async () => {
    const ctx = makeCtx({ token: 'wrong' })
    const res = await onRequestPost(ctx)
    expect(res.status).toBe(401)
    expect(ctx.env._db.system_kv.has('last_digest_at')).toBe(false)
  })

  it('does NOT stamp the heartbeat when DIGEST_TOKEN is unset on the worker', async () => {
    const ctx = makeCtx({ token: 'anything', digestToken: '' })
    const res = await onRequestPost(ctx)
    expect(res.status).toBe(401)
    expect(ctx.env._db.system_kv.has('last_digest_at')).toBe(false)
  })

  it('upserts (replaces) on the second firing rather than inserting a duplicate', async () => {
    const ctx1 = makeCtx({ token: 'good-token' })
    await onRequestPost(ctx1)
    const firstStamp = ctx1.env._db.system_kv.get('last_digest_at')?.value

    // Same env across two calls would also work; using a fresh ctx is closer
    // to the real cron pattern (each firing is a new request).
    const ctx2 = makeCtx({ token: 'good-token' })
    // Reuse env1's db so we see the replace behavior.
    ctx2.env = ctx1.env
    await onRequestPost(ctx2)

    // Exactly one row keyed by 'last_digest_at'.
    expect(ctx2.env._db.system_kv.size).toBe(1)
    const secondStamp = ctx2.env._db.system_kv.get('last_digest_at')?.value
    // Values may or may not differ depending on clock granularity; what
    // matters is the row count.
    expect(secondStamp).toBeDefined()
    expect(typeof firstStamp).toBe('string')
  })
})
