/**
 * Handler tests for GET + POST /api/unsubscribe. Pairs with the verifier
 * tests in functions/_lib/unsubscribe.test.ts.
 */

import { describe, expect, it } from 'vitest'
import type { D1Database } from '@cloudflare/workers-types'
import { D1Mock } from '../../tests/d1-mock'
import { onRequestGet, onRequestPost } from './unsubscribe'
import { signUnsubscribeToken } from '../_lib/unsubscribe'
import type { Env } from '../_lib/env'

const SECRET = '0'.repeat(64)

function makeEnv(db: D1Mock): Env {
  return {
    DB: db as unknown as D1Database,
    RESEND_API_KEY: 'rk',
    ADMIN_EMAILS: 'marc@x.com',
    SESSION_SECRET: SECRET,
  } as Env
}

function makeCtx(env: Env, request: Request) {
  return {
    request,
    env,
    params: {},
    data: {},
    next: async () => new Response(),
    waitUntil: () => {},
    passThroughOnException: () => {},
    functionPath: '/api/unsubscribe',
  } as never
}

describe('POST /api/unsubscribe (one-click)', () => {
  it('writes an email_events row on a valid token', async () => {
    const db = new D1Mock()
    const token = await signUnsubscribeToken(SECRET, 'v@x.com')
    const req = new Request(
      `https://x.test/api/unsubscribe?email=${encodeURIComponent('v@x.com')}&token=${token}`,
      { method: 'POST' },
    )
    const res = await onRequestPost(makeCtx(makeEnv(db), req))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { unsubscribed: boolean; email: string }
    expect(body.unsubscribed).toBe(true)
    expect(body.email).toBe('v@x.com')

    const rows = [...db.email_events.values()]
    expect(rows).toHaveLength(1)
    expect(rows[0]?.to_email).toBe('v@x.com')
    expect(rows[0]?.type).toBe('email.unsubscribed')
    expect(rows[0]?.subtype).toBe('one-click')
  })

  it('401 on a bad token', async () => {
    const db = new D1Mock()
    const req = new Request(`https://x.test/api/unsubscribe?email=v@x.com&token=not-a-real-token`, {
      method: 'POST',
    })
    const res = await onRequestPost(makeCtx(makeEnv(db), req))
    expect(res.status).toBe(401)
    expect(db.email_events.size).toBe(0)
  })

  it('400 when email or token is missing', async () => {
    const db = new D1Mock()
    const req = new Request(`https://x.test/api/unsubscribe`, { method: 'POST' })
    const res = await onRequestPost(makeCtx(makeEnv(db), req))
    expect(res.status).toBe(400)
  })
})

describe('GET /api/unsubscribe (browser click)', () => {
  it('writes an email_events row + serves the confirmation HTML on a valid token', async () => {
    const db = new D1Mock()
    const token = await signUnsubscribeToken(SECRET, 'v@x.com')
    const req = new Request(
      `https://x.test/api/unsubscribe?email=${encodeURIComponent('v@x.com')}&token=${token}&lang=fr`,
      { method: 'GET' },
    )
    const res = await onRequestGet(makeCtx(makeEnv(db), req))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/text\/html/)
    const html = await res.text()
    expect(html).toContain('v@x.com')
    expect(html).toContain('C’est fait')

    const rows = [...db.email_events.values()]
    expect(rows).toHaveLength(1)
    expect(rows[0]?.subtype).toBe('browser-click')
  })

  it('serves the invalid-token HTML page on a bad token (no row written)', async () => {
    const db = new D1Mock()
    const req = new Request(`https://x.test/api/unsubscribe?email=v@x.com&token=bad`, {
      method: 'GET',
    })
    const res = await onRequestGet(makeCtx(makeEnv(db), req))
    expect(res.status).toBe(401)
    expect(res.headers.get('content-type')).toMatch(/text\/html/)
    expect(db.email_events.size).toBe(0)
  })

  it('serves the missing-args HTML page when params are absent', async () => {
    const db = new D1Mock()
    const req = new Request(`https://x.test/api/unsubscribe?lang=en`, { method: 'GET' })
    const res = await onRequestGet(makeCtx(makeEnv(db), req))
    expect(res.status).toBe(400)
    const html = await res.text()
    expect(html).toContain('incomplete')
  })

  it('handles a second click on the same link without crashing (multi-row state is fine)', async () => {
    const db = new D1Mock()
    const token = await signUnsubscribeToken(SECRET, 'v@x.com')
    const url = `https://x.test/api/unsubscribe?email=${encodeURIComponent('v@x.com')}&token=${token}`
    await onRequestGet(makeCtx(makeEnv(db), new Request(url, { method: 'GET' })))
    const res2 = await onRequestGet(makeCtx(makeEnv(db), new Request(url, { method: 'GET' })))
    expect(res2.status).toBe(200)
    expect(db.email_events.size).toBe(2)
  })
})
