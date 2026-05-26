// Forge the session + CSRF cookies the running server will accept, without
// going through the magic-link email loop. The cookie format mirrors
// functions/_lib/auth.ts exactly — payload is JSON { e: email, x: expSec },
// signed HMAC-SHA256(payload, SESSION_SECRET), both halves base64url-encoded
// and joined with a dot. Any drift from the production format means the
// server rejects the cookie and the spec sees a 401 instead of a 200.

import { createHash, createHmac, randomBytes } from 'node:crypto'
import type { BrowserContext } from '@playwright/test'
import { E2E_BINDINGS, E2E_PORT } from '../constants'
import { openD1 } from './db'

const SECRET = E2E_BINDINGS.SESSION_SECRET
const COOKIE_NAME = 'mp_session'
const CSRF_COOKIE_NAME = 'mp_csrf'
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60

function b64url(buf: Buffer | Uint8Array): string {
  return Buffer.from(buf).toString('base64url')
}

/**
 * Produce a valid HMAC-signed session cookie value. Exported for raw-fetch
 * specs that want to override the expiry (forging an already-expired cookie
 * to drive the auth.ts expiry check) or otherwise side-step
 * BrowserContext.addCookies.
 */
export function signSessionCookieValue(email: string, expSecondsOverride?: number): string {
  const exp = expSecondsOverride ?? Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS
  const payload = JSON.stringify({ e: email.toLowerCase(), x: exp })
  const sig = createHmac('sha256', SECRET).update(payload).digest()
  return `${b64url(Buffer.from(payload, 'utf8'))}.${b64url(sig)}`
}

function newCsrfTokenValue(): string {
  return b64url(randomBytes(24))
}

/**
 * Sign the visitor in by attaching the same two cookies a successful magic-
 * link verification would set. The SPA reads mp_csrf out of document.cookie
 * and echoes it into X-CSRF-Token on every state-changing fetch; both cookies
 * are required for the writes the spec performs.
 *
 * Secure + SameSite=Lax on the real responses; we relax `secure` here so the
 * http://localhost:8788 harness accepts the cookies (Playwright won't attach
 * a Secure cookie over http).
 */
export async function signInAs(context: BrowserContext, email: string): Promise<void> {
  const sessionValue = signSessionCookieValue(email)
  const csrfValue = newCsrfTokenValue()
  await context.addCookies([
    {
      name: COOKIE_NAME,
      value: sessionValue,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
    {
      name: CSRF_COOKIE_NAME,
      value: csrfValue,
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    },
  ])
}

interface ForgeOpts {
  /** Override the cookie expiry (unix seconds). Use a past value to drive
   *  the expired-cookie 401 path; omit for a fresh 30-day cookie. */
  expSeconds?: number
  /** Replace the X-CSRF-Token header value with something other than the
   *  mp_csrf cookie value. Use to drive the CSRF-mismatch 403 path. */
  csrfHeaderOverride?: string
  /** Omit both the mp_csrf cookie and the X-CSRF-Token header entirely.
   *  Drives the missing-CSRF 403 path. The mp_session cookie still rides
   *  along — the goal is to fail at the CSRF gate, not the auth gate. */
  omitCsrf?: boolean
}

interface ForgedHeaders {
  Cookie: string
  'X-CSRF-Token'?: string
  'Content-Type': string
}

/**
 * Build a header bag for raw fetch tests. Returns the Cookie + CSRF header a
 * signed-in visitor would carry, plus a JSON content-type for POST bodies. The
 * BrowserContext.addCookies path (`signInAs`) stays the canonical helper for
 * tests that actually drive the SPA; this is the lower-level escape hatch for
 * tests that only assert on /api/* response shapes.
 */
export function forgeAuthHeaders(email: string, opts: ForgeOpts = {}): ForgedHeaders {
  const sessionValue = signSessionCookieValue(email, opts.expSeconds)
  const cookies: string[] = [`mp_session=${sessionValue}`]
  const headers: ForgedHeaders = {
    Cookie: '',
    'Content-Type': 'application/json',
  }
  if (!opts.omitCsrf) {
    const csrfValue = newCsrfTokenValue()
    cookies.push(`mp_csrf=${csrfValue}`)
    headers['X-CSRF-Token'] = opts.csrfHeaderOverride ?? csrfValue
  } else if (opts.csrfHeaderOverride) {
    // Explicit override even when the cookie is omitted (e.g. attacker sends
    // a guessed header value with no cookie to mirror).
    headers['X-CSRF-Token'] = opts.csrfHeaderOverride
  }
  headers.Cookie = cookies.join('; ')
  return headers
}

// Re-export for specs that want to drive port-aware URLs without importing
// constants directly (the spec already imports plenty).
export { E2E_PORT }

interface MintTokenOpts {
  /** unix seconds when the token expires. Defaults to now + 30 minutes
   *  (matching request-link.ts TOKEN_TTL_SECONDS). Pass a past value to
   *  drive the expired-token redirect in /api/auth/verify. */
  expiresAt?: number
  /** unix seconds when the token was created. Defaults to now. Mostly only
   *  matters for the rate-limit count window in request-link.ts. */
  createdAt?: number
  /** unix seconds when the token was consumed. Default null (still valid).
   *  Pass a non-null value to drive the replay redirect (`reason=token-used`). */
  usedAt?: number | null
  /** Source IP recorded on the row. Defaults to a sentinel value so the
   *  rate-limit counts produced by these tokens don't interfere with the
   *  per-IP ceiling in request-link.ts (which counts within a rolling
   *  hour). */
  ip?: string
}

/**
 * Mint a magic-link token directly into D1, returning the plaintext the
 * /api/auth/verify endpoint accepts. The server stores only the SHA-256
 * hash (see functions/_lib/bytes.ts sha256B64url + request-link.ts), so we
 * pick a plaintext, hash it the same way, INSERT the hash. The spec gets
 * back the plaintext to drive the verify URL.
 *
 * Returns the plaintext token. The spec composes `?token=${plaintext}`
 * exactly as the email link would.
 */
export function mintMagicLinkToken(email: string, opts: MintTokenOpts = {}): string {
  const plaintext = `e2e_token_${randomBytes(16).toString('hex')}`
  const tokenHash = createHash('sha256').update(plaintext, 'utf8').digest('base64url')
  const now = Math.floor(Date.now() / 1000)
  const createdAt = opts.createdAt ?? now
  const expiresAt = opts.expiresAt ?? now + 30 * 60
  const usedAt = opts.usedAt ?? null
  const ip = opts.ip ?? 'e2e-mint'

  const db = openD1()
  try {
    db.prepare(
      `INSERT INTO magic_link_tokens (token, email, expires_at, created_at, ip, used_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(tokenHash, email.toLowerCase(), expiresAt, createdAt, ip, usedAt)
  } finally {
    db.close()
  }
  return plaintext
}

/**
 * Read the latest magic_link_tokens row for an email. Used by the journey
 * spec to confirm POST /api/auth/request-link actually wrote one (the
 * endpoint returns 200 either way, so the only way to prove it landed is
 * to inspect D1).
 */
export interface MagicLinkRow {
  token: string
  email: string
  expires_at: number
  created_at: number
  used_at: number | null
  ip: string | null
}
export function latestMagicLinkRow(email: string): MagicLinkRow | undefined {
  const db = openD1()
  try {
    return db
      .prepare(
        `SELECT token, email, expires_at, created_at, used_at, ip
           FROM magic_link_tokens
          WHERE email = ?
          ORDER BY created_at DESC
          LIMIT 1`,
      )
      .get(email.toLowerCase()) as MagicLinkRow | undefined
  } finally {
    db.close()
  }
}

/**
 * Parse the Set-Cookie headers a 302 redirect from /api/auth/verify returns
 * into a `Cookie: a=…; b=…` string the next fetch can carry forward. We
 * keep mp_session, mp_csrf, mp_lang — every cookie the verify endpoint
 * sets is something the SPA's fetch wrapper will echo, so the spec carries
 * them all.
 */
export function cookieHeaderFromVerifyResponse(res: Response): string {
  // Fetch in Node 18+ exposes getSetCookie() for multi-value Set-Cookie.
  const cookies =
    (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? []
  const pairs: string[] = []
  for (const sc of cookies) {
    const namevalue = sc.split(';', 1)[0]?.trim()
    if (namevalue) pairs.push(namevalue)
  }
  return pairs.join('; ')
}

/**
 * Extract the value of a single Set-Cookie by name from a verify response.
 * The journey spec uses this to grab mp_csrf for the X-CSRF-Token header
 * on subsequent state-changing fetches.
 */
export function csrfTokenFromVerifyResponse(res: Response): string | null {
  const cookies =
    (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? []
  for (const sc of cookies) {
    const m = /^\s*mp_csrf=([^;]+)/.exec(sc)
    if (m) return m[1]
  }
  return null
}
