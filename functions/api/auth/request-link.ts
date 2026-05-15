// POST /api/auth/request-link — issues a magic-link token, emails it via Resend.
// Always returns 200 (even on rate-limit hit or invalid email) so callers
// can't enumerate valid emails. Rate limit is enforced in Phase 4.
//
// Security: the random token is sent ONCE in the email URL. We store only its
// SHA-256 hash in D1. A DB snapshot, an admin SELECT, or a misrouted backup
// can no longer leak usable tokens.

import { isPlausibleEmail } from '../../_lib/auth'
import type { Env } from '../../_lib/env'
import { ok, badRequest } from '../../_lib/json'
import { sendMagicLink } from '../../_lib/email'
import { randomTokenB64url, sha256B64url } from '../../_lib/bytes'

const TOKEN_TTL_SECONDS = 30 * 60
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60
const RATE_LIMIT_MAX = 5
// Separate, stricter IP-only ceiling. Catches the rotating-email-same-IP
// attacker who would otherwise drain Resend's 100/day free-tier quota by
// staying under the per-email limit. Tuned generously: a household behind one
// NAT, two adults each requesting a fresh link a few times = well under 20.
const RATE_LIMIT_IP_MAX = 20

interface RequestBody {
  email?: unknown
  lang?: unknown
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: RequestBody
  try {
    body = (await request.json()) as RequestBody
  } catch {
    return badRequest('invalid json')
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const lang: 'fr' | 'en' = body.lang === 'en' ? 'en' : 'fr'

  // Always return the same shape on bad input — don't let the caller probe
  // by reading status codes. The single exception is malformed JSON above.
  if (!isPlausibleEmail(email)) {
    return ok({ sent: true })
  }

  const now = Math.floor(Date.now() / 1000)
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  const since = now - RATE_LIMIT_WINDOW_SECONDS

  // Two independent rolling-window ceilings, counted from magic_link_tokens
  // (no separate rate-limit table). Different attack shapes need different
  // ceilings:
  //   - per-email (5/h) catches "spam one address" — one human shouldn't need
  //     more than 5 fresh links in an hour
  //   - per-ip (20/h) catches rotating-email-same-IP — would otherwise stay
  //     under the per-email cap while draining Resend's quota. Tuned for
  //     household NAT (a few legitimate users behind one IP).
  const counts = await env.DB.prepare(
    `SELECT
       SUM(CASE WHEN email = ? THEN 1 ELSE 0 END) AS emailCount,
       SUM(CASE WHEN ip = ? THEN 1 ELSE 0 END) AS ipCount
     FROM magic_link_tokens
     WHERE created_at > ?`,
  )
    .bind(email, ip, since)
    .first<{ emailCount: number | null; ipCount: number | null }>()

  const emailCount = counts?.emailCount ?? 0
  const ipCount = counts?.ipCount ?? 0

  if (emailCount >= RATE_LIMIT_MAX || ipCount >= RATE_LIMIT_IP_MAX) {
    // Silent drop — return the same 200 a happy path would. Logged so we can
    // see abuse in tail.
    console.warn('rate limit hit', { email, ip, emailCount, ipCount })
    return ok({ sent: true })
  }

  const plaintextToken = randomTokenB64url()
  const tokenHash = await sha256B64url(plaintextToken)
  const expiresAt = now + TOKEN_TTL_SECONDS

  // The `token` column historically stored the plaintext token; it is now the
  // PRIMARY KEY for the at-rest hash. Pre-hashing rows from before this change
  // become unverifiable (they will redirect to /login?reason=unknown-token);
  // they expire in <= 30 min anyway.
  await env.DB.prepare(
    `INSERT INTO magic_link_tokens (token, email, expires_at, created_at, ip)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(tokenHash, email, expiresAt, now, ip)
    .run()

  const origin = new URL(request.url).origin
  const verifyUrl = `${origin}/api/auth/verify?token=${encodeURIComponent(plaintextToken)}&lang=${lang}`

  // Fire-and-forget: even if Resend is down we return 200. The token is in
  // D1; visitor can request another link. Error is logged inside sendMagicLink.
  await sendMagicLink(env.RESEND_API_KEY, email, verifyUrl, lang)

  return ok({ sent: true })
}
