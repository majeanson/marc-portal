// Stateless unsubscribe tokens — HMAC over the recipient email so we can
// verify a /api/unsubscribe request without a per-token DB row. The same
// link works forever; revocation is implicit (unsubscribing writes a row
// to email_events that the send-time suppression check picks up).
//
// Token shape: base64url(HMAC-SHA-256(SESSION_SECRET, lowercased_email)).
// Stable per email. Re-using SESSION_SECRET means rotating the session
// secret also rotates every outstanding unsubscribe link — acceptable
// because (a) rotation is rare, (b) the link is the same shape every
// future email reissues. The visitor can always re-find an unsubscribe
// link in any subsequent email.

import { bytesToB64url, utf8ToBytes } from './bytes'
import { requireSessionSecret } from './auth'

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    utf8ToBytes(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

/** Sign a fresh unsubscribe token for the given email. */
export async function signUnsubscribeToken(
  secret: string | undefined | null,
  email: string,
): Promise<string> {
  const s = requireSessionSecret(secret)
  const key = await importKey(s)
  const sig = await crypto.subtle.sign('HMAC', key, utf8ToBytes(email.toLowerCase()))
  return bytesToB64url(new Uint8Array(sig))
}

/** Verify an unsubscribe token. Returns true when the token is a valid
 *  HMAC of the supplied email under the configured secret. Constant-time
 *  via crypto.subtle.verify. */
export async function verifyUnsubscribeToken(
  secret: string | undefined | null,
  email: string,
  token: string,
): Promise<boolean> {
  if (!email || !token) return false
  const s = requireSessionSecret(secret)
  let candidate: Uint8Array
  try {
    // base64url decode — mirror b64urlToBytes' tolerance for missing padding.
    const pad = token.length % 4 === 0 ? '' : '='.repeat(4 - (token.length % 4))
    const b64 = token.replace(/-/g, '+').replace(/_/g, '/') + pad
    const raw = atob(b64)
    candidate = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; i++) candidate[i] = raw.charCodeAt(i)
  } catch {
    return false
  }
  const key = await importKey(s)
  return crypto.subtle.verify('HMAC', key, candidate, utf8ToBytes(email.toLowerCase()))
}

/** Build the absolute one-click unsubscribe URL embedded in every
 *  outbound email's List-Unsubscribe header + footer link. */
export function unsubscribeUrl(origin: string, email: string, token: string): string {
  const params = new URLSearchParams({ email: email.toLowerCase(), token })
  return `${origin}/api/unsubscribe?${params.toString()}`
}
