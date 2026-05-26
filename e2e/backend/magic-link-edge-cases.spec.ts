// Negative-space coverage of /api/auth/verify. The verify handler is the
// single point where a friendly login error vs a 500 is the difference
// between "I'll try again later" and "this thing is broken." Each failure
// mode must redirect to /login (or /en/login) with a `reason=` query param
// the SPA can render — never throw, never 4xx/5xx, never expose D1 errors.
//
// Failure modes covered:
//   - missing token            → reason=missing-token
//   - unknown token (no row)   → reason=unknown-token
//   - already-claimed token    → reason=token-used   (covered separately
//                                in full-visitor-journey.spec.ts — kept
//                                as a sanity case here too)
//   - expired token            → reason=token-expired
//   - admin email lands on /admin/inbox, not /me
//   - lang=en routes to /en/login (and /en/admin/inbox)
//
// Each case is a single GET — verify is read+small-write, no CSRF gate.
// All responses are 302; the SPA renders the message from the search param.

import { test, expect } from '@playwright/test'
import { randomBytes } from 'node:crypto'
import { E2E_BASE_URL, E2E_BINDINGS } from './constants'
import { mintMagicLinkToken } from './helpers/auth'
import { clearTestRows } from './helpers/db'

const ADMIN_EMAIL = E2E_BINDINGS.ADMIN_EMAILS
const VISITOR_EMAIL = `verify-${randomBytes(3).toString('hex')}@e2e.test`

function verifyUrl(token: string, lang: 'fr' | 'en' = 'fr'): string {
  return `${E2E_BASE_URL}/api/auth/verify?token=${encodeURIComponent(token)}&lang=${lang}`
}

test.describe('/api/auth/verify — failure modes redirect to /login', () => {
  test.beforeEach(() => clearTestRows())

  test('no token param → /login?reason=missing-token', async () => {
    const res = await fetch(`${E2E_BASE_URL}/api/auth/verify`, { redirect: 'manual' })
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/login?reason=missing-token')
  })

  test('empty token param → /login?reason=missing-token', async () => {
    const res = await fetch(`${E2E_BASE_URL}/api/auth/verify?token=`, { redirect: 'manual' })
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/login?reason=missing-token')
  })

  test('token plaintext with no matching row → /login?reason=unknown-token', async () => {
    // Deliberately not minted. SHA-256 of "never-issued" doesn't match any
    // row in D1, so the handler hits the `!row` branch.
    const res = await fetch(verifyUrl('never-issued-plaintext-zzzz'), { redirect: 'manual' })
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/login?reason=unknown-token')
  })

  test('already-claimed token → /login?reason=token-used (replay defense)', async () => {
    // Mint a row with used_at already populated. Simulates the "user clicked
    // the link, then clicked again from their browser history" replay.
    const plaintext = mintMagicLinkToken(VISITOR_EMAIL, {
      usedAt: Math.floor(Date.now() / 1000) - 60,
    })
    const res = await fetch(verifyUrl(plaintext), { redirect: 'manual' })
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/login?reason=token-used')
  })

  test('expired token → /login?reason=token-expired', async () => {
    const plaintext = mintMagicLinkToken(VISITOR_EMAIL, {
      expiresAt: Math.floor(Date.now() / 1000) - 60,
    })
    const res = await fetch(verifyUrl(plaintext), { redirect: 'manual' })
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/login?reason=token-expired')
  })

  test('expired AND used → token-used wins (the used_at check runs first)', async () => {
    // Precedence matters: an attacker who replays a stolen, expired link
    // gets the same surface as a benign double-click. We don't want a
    // distinguishing signal here.
    const plaintext = mintMagicLinkToken(VISITOR_EMAIL, {
      expiresAt: Math.floor(Date.now() / 1000) - 3600,
      usedAt: Math.floor(Date.now() / 1000) - 1800,
    })
    const res = await fetch(verifyUrl(plaintext), { redirect: 'manual' })
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/login?reason=token-used')
  })

  test('expired (lang=en) → /en/login?reason=token-expired', async () => {
    const plaintext = mintMagicLinkToken(VISITOR_EMAIL, {
      expiresAt: Math.floor(Date.now() / 1000) - 60,
    })
    const res = await fetch(verifyUrl(plaintext, 'en'), { redirect: 'manual' })
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/en/login?reason=token-expired')
  })

  test('admin success → 302 to /admin/inbox (not /me)', async () => {
    const plaintext = mintMagicLinkToken(ADMIN_EMAIL)
    const res = await fetch(verifyUrl(plaintext), { redirect: 'manual' })
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/admin/inbox')
  })

  test('admin success (lang=en) → /en/admin/inbox', async () => {
    const plaintext = mintMagicLinkToken(ADMIN_EMAIL)
    const res = await fetch(verifyUrl(plaintext, 'en'), { redirect: 'manual' })
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/en/admin/inbox')
  })

  test('successful verify sets mp_session, mp_csrf, mp_lang cookies', async () => {
    const plaintext = mintMagicLinkToken(VISITOR_EMAIL)
    const res = await fetch(verifyUrl(plaintext), { redirect: 'manual' })
    expect(res.status).toBe(302)

    const setCookies =
      (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? []
    const names = setCookies.map((c) => c.split('=', 1)[0].trim())
    expect(names).toContain('mp_session')
    expect(names).toContain('mp_csrf')
    expect(names).toContain('mp_lang')

    // mp_session must be HttpOnly (defense vs XSS-driven cookie exfil) and
    // mp_csrf must NOT be (the SPA reads it via document.cookie to echo into
    // the X-CSRF-Token header).
    const mpSession = setCookies.find((c) => c.startsWith('mp_session='))
    const mpCsrf = setCookies.find((c) => c.startsWith('mp_csrf='))
    expect(mpSession?.toLowerCase()).toContain('httponly')
    expect(mpCsrf?.toLowerCase()).not.toContain('httponly')
  })
})
