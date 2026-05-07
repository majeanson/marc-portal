// GET /api/auth/verify?token=... — consumes a magic-link token, sets the
// session cookie, redirects into the SPA. Single-use: a verified token is
// marked used_at and cannot be replayed. Failure modes redirect to /login
// with a reason query param so the SPA can render a friendly message.
//
// Tenant-aware: a token issued from one tenant's domain (e.g. the buyer's
// roger-voice-truck.com) cannot be redeemed from another tenant's domain
// (e.g. lifeascode.app). This prevents cross-tenant magic-link replay.

import { setSessionCookieHeader, signSessionCookie } from '../../_lib/auth'
import type { Env } from '../../_lib/env'
import { isAdmin } from '../../_lib/env'
import { requireTenant } from '../../_lib/tenant'

interface TokenRow {
  token: string
  email: string
  expires_at: number
  used_at: number | null
  tenant_id: string | null
}

function redirect(url: string, cookie?: string): Response {
  const headers: Record<string, string> = { Location: url }
  if (cookie) headers['Set-Cookie'] = cookie
  return new Response(null, { status: 302, headers })
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const tenant = requireTenant(ctx)
  const url = new URL(ctx.request.url)
  const token = url.searchParams.get('token') ?? ''
  const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'fr'
  const langPrefix = lang === 'en' ? '/en' : ''

  if (!token) {
    return redirect(`${langPrefix}/login?reason=missing-token`)
  }

  const row = await ctx.env.DB.prepare(
    `SELECT token, email, expires_at, used_at, tenant_id
       FROM magic_link_tokens WHERE token = ?`,
  )
    .bind(token)
    .first<TokenRow>()

  const now = Math.floor(Date.now() / 1000)

  if (!row) {
    return redirect(`${langPrefix}/login?reason=unknown-token`)
  }
  // Cross-tenant replay guard: a token issued for tenant A can't be redeemed
  // on tenant B's domain. tenant_id may be null on legacy pre-fleet tokens —
  // in that case allow only if the resolved tenant is Marc's (back-compat).
  if (row.tenant_id !== null && row.tenant_id !== tenant.id) {
    return redirect(`${langPrefix}/login?reason=unknown-token`)
  }
  if (row.used_at !== null) {
    return redirect(`${langPrefix}/login?reason=token-used`)
  }
  if (row.expires_at < now) {
    return redirect(`${langPrefix}/login?reason=token-expired`)
  }

  await ctx.env.DB.prepare(`UPDATE magic_link_tokens SET used_at = ? WHERE token = ?`)
    .bind(now, token)
    .run()

  const sessionCookie = await signSessionCookie(ctx.env.SESSION_SECRET, row.email)
  const cookieHeader = setSessionCookieHeader(sessionCookie)

  // Operator (Marc on his own tenant) → /admin/inbox; everyone else → /me.
  const isOperator = isAdmin(ctx.env, row.email) && tenant.flags.isOperator === true
  const dest = isOperator ? `${langPrefix}/admin/inbox` : `${langPrefix}/me`
  return redirect(dest, cookieHeader)
}
