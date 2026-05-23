// HMAC-signed session cookies. Workers WebCrypto has SHA-256 HMAC built in;
// no jsonwebtoken / lucia / etc. Format: base64url(payload).base64url(sig).
// Payload is JSON {e: email, x: expSeconds}. Compact field names because the
// payload travels in a Cookie header on every request.

import { b64urlToBytes, bytesToB64url, bytesToUtf8, utf8ToBytes } from './bytes'

const COOKIE_NAME = 'mp_session'
const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

/** Companion cookie carrying the CSRF token. NOT HttpOnly — the SPA reads it
 * via document.cookie to echo into X-CSRF-Token on state-changing requests
 * (double-submit pattern). Lives as long as the session. */
const CSRF_COOKIE_NAME = 'mp_csrf'
const CSRF_HEADER_NAME = 'x-csrf-token'

export interface SessionPayload {
  e: string
  x: number
}

/**
 * Reject early when SESSION_SECRET is missing, empty, or trivially short.
 * Without this guard, `TextEncoder().encode(undefined)` produces the bytes for
 * the literal string `"undefined"` — a publicly-known HMAC key that would
 * silently downgrade every cookie to forgeable. Type signature of `string`
 * doesn't catch this; only runtime does.
 *
 * Threshold: 32 chars (≈ 192 bits at base64). Real secrets are much longer
 * (we generate 64 hex chars in tests). The threshold is the floor, not a
 * recommended length.
 */
const SESSION_SECRET_MIN_LENGTH = 32

export class SessionSecretMisconfiguredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SessionSecretMisconfiguredError'
  }
}

export function requireSessionSecret(secret: string | undefined | null): string {
  if (typeof secret !== 'string' || secret.length === 0) {
    throw new SessionSecretMisconfiguredError(
      'SESSION_SECRET is missing. Set it on the Pages project (Settings → Environment variables) before any auth-touching request runs.',
    )
  }
  if (secret.length < SESSION_SECRET_MIN_LENGTH) {
    throw new SessionSecretMisconfiguredError(
      `SESSION_SECRET is too short (got ${secret.length} chars, need >= ${SESSION_SECRET_MIN_LENGTH}). Regenerate a long random value.`,
    )
  }
  return secret
}

async function importHmacKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  requireSessionSecret(secret)
  return crypto.subtle.importKey(
    'raw',
    utf8ToBytes(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage],
  )
}

export async function signSessionCookie(secret: string, email: string): Promise<string> {
  const payload: SessionPayload = {
    e: email.toLowerCase(),
    x: Math.floor(Date.now() / 1000) + COOKIE_MAX_AGE_SECONDS,
  }
  const data = utf8ToBytes(JSON.stringify(payload))
  const key = await importHmacKey(secret, 'sign')
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, data))
  return `${bytesToB64url(data)}.${bytesToB64url(sig)}`
}

export async function verifySessionCookie(
  secret: string,
  cookie: string,
): Promise<SessionPayload | null> {
  const [payloadB64, sigB64] = cookie.split('.')
  if (!payloadB64 || !sigB64) return null
  let payload: Uint8Array
  let sig: Uint8Array
  try {
    payload = b64urlToBytes(payloadB64)
    sig = b64urlToBytes(sigB64)
  } catch {
    return null
  }
  const key = await importHmacKey(secret, 'verify')
  const ok = await crypto.subtle.verify('HMAC', key, sig, payload)
  if (!ok) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(bytesToUtf8(payload))
  } catch {
    return null
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    typeof (parsed as { e?: unknown }).e !== 'string' ||
    typeof (parsed as { x?: unknown }).x !== 'number'
  ) {
    return null
  }
  const p = parsed as SessionPayload
  if (p.x < Math.floor(Date.now() / 1000)) return null
  return p
}

export function setSessionCookieHeader(value: string): string {
  const attrs = [
    `${COOKIE_NAME}=${value}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
  ]
  return attrs.join('; ')
}

export function clearSessionCookieHeader(): string {
  return [`${COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax', 'Max-Age=0'].join('; ')
}

/** Generate a fresh CSRF token. Base64url-encoded random bytes. */
export function newCsrfToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return bytesToB64url(bytes)
}

/** Cookie header for the CSRF token. NOT HttpOnly — the SPA needs to read it. */
export function setCsrfCookieHeader(token: string): string {
  return [
    `${CSRF_COOKIE_NAME}=${token}`,
    'Path=/',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
  ].join('; ')
}

export function clearCsrfCookieHeader(): string {
  return [`${CSRF_COOKIE_NAME}=`, 'Path=/', 'Secure', 'SameSite=Lax', 'Max-Age=0'].join('; ')
}

/**
 * Cookie header for the visitor's chosen language. NOT HttpOnly — the
 * SPA writes the same cookie client-side via useLangSwitch (header
 * lang toggle), so both halves must read/write the same shape. Read by
 * the bare-`/` redirect in functions/_middleware.ts to honor the
 * visitor's preference on future cold hits.
 *
 * Lifetime: 1 year. The cookie is a UX preference, not a security
 * token — long lifetime = fewer surprise re-redirects on a shared
 * device that has been quiet for a while.
 */
const LANG_COOKIE_NAME = 'mp_lang'
const LANG_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60

export function setLangCookieHeader(lang: 'fr' | 'en'): string {
  return [
    `${LANG_COOKIE_NAME}=${lang}`,
    'Path=/',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${LANG_COOKIE_MAX_AGE_SECONDS}`,
  ].join('; ')
}

function readCsrfCookie(request: Request): string | null {
  const header = request.headers.get('Cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k === CSRF_COOKIE_NAME) return rest.join('=')
  }
  return null
}

/**
 * Constant-time-ish CSRF check (double-submit cookie). Reads the token from
 * the request cookie + the X-CSRF-Token header; both must be present and
 * equal. Returns true when the check passes. Safe-method requests (GET,
 * HEAD, OPTIONS) skip the check at the caller.
 *
 * A foreign origin can drive the browser to send the cookie (that's the CSRF
 * attack), but can't read it cross-origin to put it in the header. The
 * matching requirement closes the loop.
 */
export function verifyCsrf(request: Request): boolean {
  const cookieToken = readCsrfCookie(request)
  const headerToken = request.headers.get(CSRF_HEADER_NAME)
  if (!cookieToken || !headerToken) return false
  if (cookieToken.length !== headerToken.length) return false
  // Length-leak resistant compare. Workers WebCrypto doesn't expose a
  // timing-safe compare, but the inputs are short and same-length here.
  let mismatch = 0
  for (let i = 0; i < cookieToken.length; i++) {
    mismatch |= cookieToken.charCodeAt(i) ^ headerToken.charCodeAt(i)
  }
  return mismatch === 0
}

/** Convenience: 403 when CSRF fails on a state-changing request. */
export function requireCsrf(request: Request): Response | null {
  if (verifyCsrf(request)) return null
  return new Response(JSON.stringify({ error: 'csrf check failed' }), {
    status: 403,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

export function readSessionCookie(request: Request): string | null {
  const header = request.headers.get('Cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k === COOKIE_NAME) return rest.join('=')
  }
  return null
}

export async function currentEmail(request: Request, secret: string): Promise<string | null> {
  const cookie = readSessionCookie(request)
  if (!cookie) return null
  const payload = await verifySessionCookie(secret, cookie)
  return payload?.e ?? null
}

/**
 * Resolve the signed-in email or return a 401 Response. Handlers that always
 * require auth can early-out:
 *
 *   const auth = await requireSignedIn(request, env.SESSION_SECRET)
 *   if (auth instanceof Response) return auth
 *   const email = auth
 *
 * This mirrors the `requireTemplate` shape in functions/_lib/template.ts.
 */
export async function requireSignedIn(
  request: Request,
  secret: string,
): Promise<string | Response> {
  const email = await currentEmail(request, secret)
  if (!email) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })
  }
  return email
}

// Conservative email validator: rejects whitespace and bare TLDs. Not a full
// RFC 5322 implementation — Resend will reject malformed addresses too.
export function isPlausibleEmail(s: string): boolean {
  if (typeof s !== 'string' || s.length > 254) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}
