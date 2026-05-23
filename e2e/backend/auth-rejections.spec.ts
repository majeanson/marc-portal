// Negative-space coverage of the auth + CSRF gates that sit in front of
// POST /api/payments/checkout. The happy-path specs only show the gate
// passes; these prove it actually rejects the right things.
//
//   1. Expired mp_session cookie → 401 from currentEmail() (the `x` claim
//      compared against now). Cookie HMAC is still valid; only the expiry
//      drives the rejection.
//   2. Missing X-CSRF-Token header → 403 from the centralized middleware
//      gate (functions/_middleware.ts), before the checkout handler runs.
//   3. Mismatched X-CSRF-Token header (cookie present but header value
//      doesn't match) → 403 from the same gate.
//
// All three drive raw fetch instead of the Playwright browser — the SPA's
// fetch wrapper auto-echoes the CSRF cookie, so we'd never reach these
// states through the UI.

import { test, expect } from '@playwright/test'
import { randomBytes } from 'node:crypto'
import { E2E_BASE_URL } from './constants'
import { forgeAuthHeaders } from './helpers/auth'
import { clearTestRows, seedSession } from './helpers/db'

const VISITOR_EMAIL = 'visitor-auth@e2e.test'

async function postCheckout(headers: Record<string, string>, body: object): Promise<Response> {
  return await fetch(`${E2E_BASE_URL}/api/payments/checkout`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

test.describe('auth + CSRF rejections', () => {
  test.beforeEach(() => clearTestRows())

  test('expired session cookie → 401', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionId, email: VISITOR_EMAIL, tier: 1 })

    // Sign a cookie whose `x` claim is in the past. The HMAC is still valid —
    // verifySessionCookie passes the crypto check and then trips the explicit
    // `if (p.x < now) return null` branch.
    const expiredAt = Math.floor(Date.now() / 1000) - 3600
    const headers = forgeAuthHeaders(VISITOR_EMAIL, { expSeconds: expiredAt })

    const res = await postCheckout(headers, { sessionId, kind: 'build' })
    expect(res.status).toBe(401)
  })

  test('missing X-CSRF-Token header → 403 at middleware', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionId, email: VISITOR_EMAIL, tier: 1 })

    // No CSRF cookie and no header — middleware gate trips before the
    // checkout handler runs. Status MUST be 403 (not 401) so a regression
    // that moves the auth check ahead of the CSRF gate would surface here.
    const headers = forgeAuthHeaders(VISITOR_EMAIL, { omitCsrf: true })

    const res = await postCheckout(headers, { sessionId, kind: 'build' })
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('csrf check failed')
  })

  test('mismatched X-CSRF-Token header → 403 at middleware', async () => {
    const sessionId = `sess_e2e_${randomBytes(6).toString('hex')}`
    seedSession({ id: sessionId, email: VISITOR_EMAIL, tier: 1 })

    // Cookie present, but the header value differs. The double-submit pattern
    // exists exactly to catch this — a foreign origin can drive the browser
    // to send the cookie, but cannot read it cross-origin to populate the
    // matching header.
    const headers = forgeAuthHeaders(VISITOR_EMAIL, {
      csrfHeaderOverride: 'not-the-cookie-value-zzzz',
    })

    const res = await postCheckout(headers, { sessionId, kind: 'build' })
    expect(res.status).toBe(403)
  })
})
