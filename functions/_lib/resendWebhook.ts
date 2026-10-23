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

/** Why a verify failed. Kept out of the HTTP body (the 401 stays generic so a
 *  prober learns nothing) but logged to Sentry: on 2026-10-16 every event
 *  401'd for 8 days and "signature mismatch" could not tell a rotated secret
 *  from a stale clock from a mangled secret. */
export type ResendVerifyFailure =
  | 'missing_headers'
  | 'stale_timestamp'
  | 'bad_secret_format'
  | 'no_matching_signature'

export type ResendVerifyResult =
  | { ok: true; ctx: ResendWebhookContext }
  | { ok: false; reason: ResendVerifyFailure }

/**
 * Verify a Resend webhook signature against the configured secret. Returns
 * the parsed context on success, or the reason it failed. Pure crypto, no DB
 * or fetch.
 *
 * Caller must pass the EXACT raw body string. Re-encoded JSON has different
 * whitespace and breaks the HMAC.
 */
export async function verifyResendSignature(
  rawBody: string,
  headers: Headers,
  secret: string,
  nowSeconds: number,
): Promise<ResendVerifyResult> {
  const id = headers.get('svix-id')
  const tsHeader = headers.get('svix-timestamp')
  const sigHeader = headers.get('svix-signature')
  if (!id || !tsHeader || !sigHeader) return { ok: false, reason: 'missing_headers' }

  const ts = Number.parseInt(tsHeader, 10)
  if (!Number.isFinite(ts)) return { ok: false, reason: 'missing_headers' }
  // Replay window: reject events older than the tolerance OR more than the
  // tolerance in the future (clock skew).
  if (Math.abs(nowSeconds - ts) > SVIX_TOLERANCE_SECONDS) {
    return { ok: false, reason: 'stale_timestamp' }
  }

  // Resend's secrets ship as `whsec_<base64>` — strip the prefix before
  // decoding. An unprefixed secret is also accepted (matches Svix's own
  // tolerance) so an operator who copy-pasted only the body works too.
  const rawSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret
  let keyBytes: Uint8Array
  try {
    keyBytes = base64Decode(rawSecret)
  } catch {
    return { ok: false, reason: 'bad_secret_format' }
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
      return { ok: true, ctx: { id, timestamp: ts } }
    }
  }
  return { ok: false, reason: 'no_matching_signature' }
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

/** Addresses the portal itself sends from. One Resend account serves several
 *  sites (Babillard sends from babillard@marcportal.com), but there is one
 *  webhook, so events arrive for mail that isn't ours. Ingesting those would
 *  put Babillard users and e2e `*@resend.dev` addresses into `email_events`,
 *  and a Babillard bounce would then suppress portal mail to that person.
 *  Keep in sync with RESEND_FROM in _lib/email.ts. */
const PORTAL_SENDERS = new Set(['noreply@marcportal.com'])

/** True when the event is for mail the portal sent. An event with no `from`
 *  is treated as ours: we can't tell, and wrongly dropping a real bounce
 *  costs more than wrongly keeping a foreign one. */
export function isPortalSender(event: ResendWebhookEvent): boolean {
  const from = event.data?.from
  if (typeof from !== 'string') return true
  // `from` may be `Name <addr@host>` or a bare address.
  const addr = (/<([^>]+)>/.exec(from)?.[1] ?? from).trim().toLowerCase()
  return PORTAL_SENDERS.has(addr)
}

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
