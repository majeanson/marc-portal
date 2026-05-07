// POST /api/auth/request-link — issues a magic-link token, emails it via Resend.
// Always returns 200 (even on rate-limit hit or invalid email) so callers
// can't enumerate valid emails. Rate limit is enforced in Phase 4.

import { isPlausibleEmail } from '../../_lib/auth'
import type { Env } from '../../_lib/env'
import { ok, badRequest } from '../../_lib/json'
import { sendMagicLink } from '../../_lib/email'
import { randomTokenB64url } from '../../_lib/bytes'
import { requireTenant } from '../../_lib/tenant'

const TOKEN_TTL_SECONDS = 30 * 60
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60
const RATE_LIMIT_MAX = 5

interface RequestBody {
  email?: unknown
  lang?: unknown
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const tenant = requireTenant(ctx)
  let body: RequestBody
  try {
    body = (await ctx.request.json()) as RequestBody
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
  const ip = ctx.request.headers.get('CF-Connecting-IP') ?? 'unknown'
  const since = now - RATE_LIMIT_WINDOW_SECONDS

  // Rolling-window rate limit: 5 requests per email OR ip per hour, scoped
  // to this tenant. Counted from magic_link_tokens (no separate rate-limit
  // table needed).
  const recent = await ctx.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM magic_link_tokens
     WHERE tenant_id = ? AND (email = ? OR ip = ?) AND created_at > ?`,
  )
    .bind(tenant.id, email, ip, since)
    .first<{ n: number }>()

  if (recent && recent.n >= RATE_LIMIT_MAX) {
    console.warn('rate limit hit', { tenant: tenant.slug, email, ip, n: recent.n })
    return ok({ sent: true })
  }

  const token = randomTokenB64url()
  const expiresAt = now + TOKEN_TTL_SECONDS

  await ctx.env.DB.prepare(
    `INSERT INTO magic_link_tokens (token, email, expires_at, created_at, ip, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(token, email, expiresAt, now, ip, tenant.id)
    .run()

  const origin = new URL(ctx.request.url).origin
  const verifyUrl = `${origin}/api/auth/verify?token=${encodeURIComponent(token)}&lang=${lang}`

  // Fire-and-forget: even if Resend is down we return 200. The token is in
  // D1; visitor can request another link. Error is logged inside sendMagicLink.
  await sendMagicLink(ctx.env.RESEND_API_KEY, email, verifyUrl, lang)

  return ok({ sent: true })
}
