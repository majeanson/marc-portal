// /api/unsubscribe — one-click + browser-click flows. Both paths verify a
// stateless HMAC over the lowercased recipient email; success writes an
// `email.unsubscribed` row to email_events that the send-time suppression
// check (functions/_lib/emailSuppression.ts) reads on the next outbound
// magic link. A broken unsubscribe is both a CAN-SPAM compliance issue
// (Gmail's "Unsubscribe" button MUST 200) and a UX trap (a visitor who
// clicked unsubscribe shouldn't get one more email).
//
// What's covered:
//   POST /api/unsubscribe
//     - missing args (no email, no token) → 400
//     - invalid token (right shape, wrong secret) → 401
//     - valid token (query-string form) → 200 + row in email_events
//     - valid token (form body, like Gmail's RFC 8058 one-click POST) → 200
//   GET /api/unsubscribe
//     - missing args → 400 HTML page (no JSON)
//     - invalid token → 401 HTML page
//     - valid token → 200 HTML page + row in email_events
//   Idempotency
//     - second unsubscribe of the same address → still 200, second row
//       added (operator can see the history)

import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { E2E_BASE_URL } from './constants'
import { signUnsubscribeTokenForEmail } from './helpers/auth'
import { clearTestRows, readEmailEvents } from './helpers/db'

const TARGET_EMAIL = `unsub-${randomUUID().slice(0, 6)}@e2e.test`

function unsubUrl(qs?: string): string {
  return `${E2E_BASE_URL}/api/unsubscribe${qs ? `?${qs}` : ''}`
}

test.describe('POST /api/unsubscribe — one-click', () => {
  test.beforeEach(() => clearTestRows())

  test('missing email + token → 400', async () => {
    const res = await fetch(unsubUrl(), { method: 'POST' })
    expect(res.status).toBe(400)
  })

  test('invalid token → 401', async () => {
    const url = unsubUrl(`email=${encodeURIComponent(TARGET_EMAIL)}&token=garbage`)
    const res = await fetch(url, { method: 'POST' })
    expect(res.status).toBe(401)
  })

  test('valid token (query string) → 200 + email_events row', async () => {
    const token = signUnsubscribeTokenForEmail(TARGET_EMAIL)
    const url = unsubUrl(
      `email=${encodeURIComponent(TARGET_EMAIL)}&token=${encodeURIComponent(token)}`,
    )
    const res = await fetch(url, { method: 'POST' })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { unsubscribed: boolean; email: string }
    expect(body.unsubscribed).toBe(true)
    expect(body.email).toBe(TARGET_EMAIL)

    const rows = readEmailEvents(TARGET_EMAIL)
    expect(rows).toHaveLength(1)
    expect(rows[0].type).toBe('email.unsubscribed')
    expect(rows[0].subtype).toBe('one-click')
  })

  test('valid token (form body, RFC 8058 shape) → 200', async () => {
    // Gmail / Outlook send the one-click POST with the parameters in the
    // application/x-www-form-urlencoded body, not the query string. The
    // handler accepts both shapes; this case proves the form-body path.
    const token = signUnsubscribeTokenForEmail(TARGET_EMAIL)
    const form = new URLSearchParams({
      email: TARGET_EMAIL,
      token,
      'List-Unsubscribe': 'One-Click',
    })
    const res = await fetch(unsubUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })
    expect(res.status).toBe(200)

    const rows = readEmailEvents(TARGET_EMAIL)
    expect(rows).toHaveLength(1)
    expect(rows[0].subtype).toBe('one-click')
  })
})

test.describe('GET /api/unsubscribe — browser-click', () => {
  test.beforeEach(() => clearTestRows())

  test('missing args → 400 HTML page (no JSON)', async () => {
    const res = await fetch(unsubUrl(), { method: 'GET' })
    expect(res.status).toBe(400)
    expect(res.headers.get('content-type') ?? '').toMatch(/text\/html/)
    const body = await res.text()
    expect(body).toMatch(/<html/i)
  })

  test('invalid token → 401 HTML page', async () => {
    const url = unsubUrl(`email=${encodeURIComponent(TARGET_EMAIL)}&token=garbage`)
    const res = await fetch(url, { method: 'GET' })
    expect(res.status).toBe(401)
    expect(res.headers.get('content-type') ?? '').toMatch(/text\/html/)
  })

  test('valid token → 200 HTML page + email_events row (subtype=browser-click)', async () => {
    const token = signUnsubscribeTokenForEmail(TARGET_EMAIL)
    const url = unsubUrl(
      `email=${encodeURIComponent(TARGET_EMAIL)}&token=${encodeURIComponent(token)}`,
    )
    const res = await fetch(url, { method: 'GET' })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type') ?? '').toMatch(/text\/html/)
    const body = await res.text()
    // The success page in unsubscribe.ts renders the visitor's email
    // verbatim inside a <code> tag.
    expect(body).toContain(TARGET_EMAIL)

    const rows = readEmailEvents(TARGET_EMAIL)
    expect(rows).toHaveLength(1)
    expect(rows[0].type).toBe('email.unsubscribed')
    expect(rows[0].subtype).toBe('browser-click')
  })

  test('lang=en serves the English page', async () => {
    const token = signUnsubscribeTokenForEmail(TARGET_EMAIL)
    const url = unsubUrl(
      `email=${encodeURIComponent(TARGET_EMAIL)}&token=${encodeURIComponent(token)}&lang=en`,
    )
    const res = await fetch(url, { method: 'GET' })
    expect(res.status).toBe(200)
    const body = await res.text()
    // EN page declares the doctype with lang="en".
    expect(body).toMatch(/<html lang="en"/)
    // EN copy uses 'Done.' as the heading on success.
    expect(body).toContain('Done.')
  })
})

test.describe('/api/unsubscribe — idempotency', () => {
  test.beforeEach(() => clearTestRows())

  test('second unsubscribe of the same address → still 200, history accumulates', async () => {
    const token = signUnsubscribeTokenForEmail(TARGET_EMAIL)
    const url = unsubUrl(
      `email=${encodeURIComponent(TARGET_EMAIL)}&token=${encodeURIComponent(token)}`,
    )

    const first = await fetch(url, { method: 'POST' })
    expect(first.status).toBe(200)

    const second = await fetch(url, { method: 'POST' })
    expect(second.status).toBe(200)

    // Two events on file — the operator can see the click history. The
    // suppression check downstream treats one or many identically; it's
    // an existence check, not a counter.
    const rows = readEmailEvents(TARGET_EMAIL)
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.type === 'email.unsubscribed')).toBe(true)
  })
})
