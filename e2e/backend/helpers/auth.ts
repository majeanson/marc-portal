// Forge the session + CSRF cookies the running server will accept, without
// going through the magic-link email loop. The cookie format mirrors
// functions/_lib/auth.ts exactly — payload is JSON { e: email, x: expSec },
// signed HMAC-SHA256(payload, SESSION_SECRET), both halves base64url-encoded
// and joined with a dot. Any drift from the production format means the
// server rejects the cookie and the spec sees a 401 instead of a 200.

import { createHmac, randomBytes } from 'node:crypto'
import type { BrowserContext } from '@playwright/test'
import { E2E_BINDINGS, E2E_PORT } from '../constants'

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
