// Resend webhook signature verification + event-shape types (AUDIT P1.2).
//
// Resend uses Svix to sign outbound webhooks. The signing scheme is:
//
//   signed = `${svix_id}.${svix_timestamp}.${raw_body}`
//   sig    = base64(hmacSha256(secret_bytes, signed))
//
// The `svix-signature` header is a space-separated list of signatures, each
// of the form `<version>,<base64-sig>`. Currently only `v1` exists. The
// secret itself is base64-encoded with a `whsec_` prefix that we strip
// before decoding.
//
// Timestamp validation: reject events whose timestamp is more than
// SVIX_TOLERANCE_SECONDS off "now" to prevent replay of historical
// signatures. Five minutes mirrors Svix's documented default and the
// Stripe webhook tolerance we already use.

const SVIX_TOLERANCE_SECONDS = 5 * 60

/** What a successful verify hands back so handlers can read the parts
 *  without re-touching the headers. */
export interface ResendWebhookContext {
  /** Resend / Svix's idempotency id. Use this as the dedupe key. */
  id: string
  /** Unix seconds (the timestamp Svix signed). */
  timestamp: number
}

/**
 * Verify a Resend webhook signature against the configured secret. Returns
 * the parsed context on success; null on any failure (missing headers,
 * stale timestamp, signature mismatch). Pure crypto — no DB or fetch.
 *
 * Caller must pass the EXACT raw body string. Re-encoded JSON has different
 * whitespace and breaks the HMAC.
 */
export async function verifyResendSignature(
  rawBody: string,
  headers: Headers,
  secret: string,
  nowSeconds: number,
): Promise<ResendWebhookContext | null> {
  const id = headers.get('svix-id')
  const tsHeader = headers.get('svix-timestamp')
  const sigHeader = headers.get('svix-signature')
  if (!id || !tsHeader || !sigHeader) return null

  const ts = Number.parseInt(tsHeader, 10)
  if (!Number.isFinite(ts)) return null
  // Replay window: reject events older than the tolerance OR more than the
  // tolerance in the future (clock skew).
  if (Math.abs(nowSeconds - ts) > SVIX_TOLERANCE_SECONDS) return null

  // Resend's secrets ship as `whsec_<base64>` — strip the prefix before
  // decoding. An unprefixed secret is also accepted (matches Svix's own
  // tolerance) so an operator who copy-pasted only the body works too.
  const rawSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret
  let keyBytes: Uint8Array
  try {
    keyBytes = base64Decode(rawSecret)
  } catch {
    return null
  }

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signedPayload = `${id}.${ts}.${rawBody}`
  const expected = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    new TextEncoder().encode(signedPayload),
  )
  const expectedB64 = base64Encode(new Uint8Array(expected))

  // `svix-signature` is a space-separated list of <version>,<sig> pairs.
  // Multiple signatures appear during key rotation; accept if ANY v1 entry
  // matches.
  for (const part of sigHeader.split(' ')) {
    const [version, candidate] = part.split(',')
    if (version !== 'v1' || !candidate) continue
    if (constantTimeEquals(candidate, expectedB64)) {
      return { id, timestamp: ts }
    }
  }
  return null
}

/** Shape of the Resend webhook envelope we care about. The `data` field
 *  carries the event-specific payload; we keep it `unknown` and let the
 *  handler narrow per type. */
export interface ResendWebhookEvent {
  type: ResendEventType
  created_at?: string
  data?: {
    /** Most events carry a recipient address; `to` may be a string or an
     *  array depending on the event source. The handler normalizes. */
    to?: string | string[]
    email_id?: string
    [k: string]: unknown
  }
}

/** Resend's documented webhook event types as of 2026-05. Add as the
 *  upstream catalog grows. Unknown types come through as the raw string. */
export type ResendEventType =
  | 'email.sent'
  | 'email.delivered'
  | 'email.delivery_delayed'
  | 'email.bounced'
  | 'email.complained'
  | 'email.opened'
  | 'email.clicked'
  | (string & {}) // accept forward-compat unknown types without losing narrowing

/** Extract the recipient address from a Resend event. Returns null when the
 *  shape is unexpected — caller logs and ignores. */
export function recipientOf(event: ResendWebhookEvent): string | null {
  const to = event.data?.to
  if (typeof to === 'string') return to
  if (Array.isArray(to) && typeof to[0] === 'string') return to[0]
  return null
}

// =============================================================================
// Tiny base64 helpers — workerd doesn't expose Buffer; atob/btoa are global.
// =============================================================================

function base64Decode(b64: string): Uint8Array {
  // Svix uses standard base64 (not URL-safe). atob lives on the Worker global.
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function base64Encode(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary)
}

/** Constant-time string compare to avoid leaking the secret via timing. */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}
