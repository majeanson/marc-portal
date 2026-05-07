// HMAC-signed session cookies. Workers WebCrypto has SHA-256 HMAC built in;
// no jsonwebtoken / lucia / etc. Format: base64url(payload).base64url(sig).
// Payload is JSON {e: email, x: expSeconds}. Compact field names because the
// payload travels in a Cookie header on every request.

import { b64urlToBytes, bytesToB64url, bytesToUtf8, utf8ToBytes } from './bytes'

const COOKIE_NAME = 'mp_session'
const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

export interface SessionPayload {
  e: string
  x: number
}

async function importHmacKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
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

// Conservative email validator: rejects whitespace and bare TLDs. Not a full
// RFC 5322 implementation — Resend will reject malformed addresses too.
export function isPlausibleEmail(s: string): boolean {
  if (typeof s !== 'string' || s.length > 254) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}
