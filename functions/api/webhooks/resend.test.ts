/**
 * Handler-level tests for /api/webhooks/resend. Pairs with the unit tests
 * in functions/_lib/resendWebhook.test.ts (those exercise the verifier in
 * isolation). Here we check the handler's response-shape decisions:
 * unconfigured → 503, bad signature → 401, valid + ingestable → row
 * written + 200, duplicate event id → idempotent skip.
 */

import { describe, expect, it } from 'vitest'
import type { D1Database } from '@cloudflare/workers-types'
import { D1Mock } from '../../../tests/d1-mock'
import { onRequestPost } from './resend'
import type { Env } from '../../_lib/env'

const KNOWN_KEY = 'c2VjcmV0LWZvci10ZXN0LWVtYWlsLWV2ZW50cy12ZXJpZmllcg=='
const WHSEC_KEY = `whsec_${KNOWN_KEY}`

async function signFixture(
  id: string,
  timestamp: number,
  body: string,
  secret: string,
): Promise<string> {
  const rawSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret
  const keyBytes = Uint8Array.from(atob(rawSecret), (c) => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    new TextEncoder().encode(`${id}.${timestamp}.${body}`),
  )
  let binary = ''
  const bytes = new Uint8Array(sig)
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return `v1,${btoa(binary)}`
}

function makeRequest(body: string, headers: Record<string, string>): Request {
  return new Request('https://x.test/api/webhooks/resend', {
    method: 'POST',
    headers,
    body,
  })
}

function makeCtx(env: Partial<Env>, request: Request) {
  return {
    request,
    env: env as Env,
    params: {},
    data: {},
    next: async () => new Response(),
    waitUntil: () => {},
    passThroughOnException: () => {},
    functionPath: '/api/webhooks/resend',
  } as never
}

describe('POST /api/webhooks/resend', () => {
  it('503 when RESEND_WEBHOOK_SECRET is unset', async () => {
    const db = new D1Mock()
    const req = makeRequest('{}', {})
    const res = await onRequestPost(makeCtx({ DB: db as unknown as D1Database }, req))
    expect(res.status).toBe(503)
  })

  it('401 on signature mismatch', async () => {
    const db = new D1Mock()
    const req = makeRequest('{}', {
      'svix-id': 'msg_x',
      'svix-timestamp': String(Math.floor(Date.now() / 1000)),
      'svix-signature': 'v1,not-a-real-sig',
    })
    const res = await onRequestPost(
      makeCtx({ DB: db as unknown as D1Database, RESEND_WEBHOOK_SECRET: WHSEC_KEY }, req),
    )
    expect(res.status).toBe(401)
  })

  it('200 + writes an email_events row on email.bounced', async () => {
    const db = new D1Mock()
    const ts = Math.floor(Date.now() / 1000)
    const id = 'msg_bounce_1'
    const body = JSON.stringify({
      type: 'email.bounced',
      data: { to: 'v@x.com', bounce_type: 'hard' },
    })
    const sig = await signFixture(id, ts, body, WHSEC_KEY)
    const req = makeRequest(body, {
      'svix-id': id,
      'svix-timestamp': String(ts),
      'svix-signature': sig,
    })
    const res = await onRequestPost(
      makeCtx({ DB: db as unknown as D1Database, RESEND_WEBHOOK_SECRET: WHSEC_KEY }, req),
    )
    expect(res.status).toBe(200)
    const row = db.email_events.get(id)
    expect(row?.to_email).toBe('v@x.com')
    expect(row?.type).toBe('email.bounced')
    expect(row?.subtype).toBe('hard')
  })

  it('200 + duplicate flag on a re-delivered event id (idempotent)', async () => {
    const db = new D1Mock()
    const ts = Math.floor(Date.now() / 1000)
    const id = 'msg_dupe'
    const body = JSON.stringify({ type: 'email.complained', data: { to: 'v@x.com' } })
    const sig = await signFixture(id, ts, body, WHSEC_KEY)
    const headers = {
      'svix-id': id,
      'svix-timestamp': String(ts),
      'svix-signature': sig,
    }
    const first = await onRequestPost(
      makeCtx(
        { DB: db as unknown as D1Database, RESEND_WEBHOOK_SECRET: WHSEC_KEY },
        makeRequest(body, headers),
      ),
    )
    expect(first.status).toBe(200)
    expect(db.email_events.size).toBe(1)

    // Resend retries the exact same event id → dedupe via webhook_events.
    const second = await onRequestPost(
      makeCtx(
        { DB: db as unknown as D1Database, RESEND_WEBHOOK_SECRET: WHSEC_KEY },
        makeRequest(body, headers),
      ),
    )
    expect(second.status).toBe(200)
    const body2 = (await second.json()) as { duplicate?: boolean }
    expect(body2.duplicate).toBe(true)
    // Still only one row.
    expect(db.email_events.size).toBe(1)
  })

  it('200 + ignored=true for informational types (email.sent)', async () => {
    const db = new D1Mock()
    const ts = Math.floor(Date.now() / 1000)
    const id = 'msg_sent_info'
    const body = JSON.stringify({ type: 'email.sent', data: { to: 'v@x.com' } })
    const sig = await signFixture(id, ts, body, WHSEC_KEY)
    const req = makeRequest(body, {
      'svix-id': id,
      'svix-timestamp': String(ts),
      'svix-signature': sig,
    })
    const res = await onRequestPost(
      makeCtx({ DB: db as unknown as D1Database, RESEND_WEBHOOK_SECRET: WHSEC_KEY }, req),
    )
    expect(res.status).toBe(200)
    const j = (await res.json()) as { ignored?: boolean }
    expect(j.ignored).toBe(true)
    // No row written for purely informational events.
    expect(db.email_events.size).toBe(0)
  })
})
