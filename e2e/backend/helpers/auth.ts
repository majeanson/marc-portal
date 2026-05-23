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

function signSessionCookieValue(email: string): string {
  const payload = JSON.stringify({
    e: email.toLowerCase(),
    x: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS,
  })
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

// Re-export for specs that want to drive port-aware URLs without importing
// constants directly (the spec already imports plenty).
export { E2E_PORT }
