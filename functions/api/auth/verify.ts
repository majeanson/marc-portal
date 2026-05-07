// GET /api/auth/verify?token=... — consumes a magic-link token, sets the
// session cookie, redirects into the SPA. Single-use: a verified token is
// marked used_at and cannot be replayed. Failure modes redirect to /login
// with a reason query param so the SPA can render a friendly message.

import { setSessionCookieHeader, signSessionCookie } from '../../_lib/auth'
import type { Env } from '../../_lib/env'
import { isAdmin } from '../../_lib/env'

interface TokenRow {
  token: string
  email: string
  expires_at: number
  used_at: number | null
}

function redirect(url: string, cookie?: string): Response {
  const headers: Record<string, string> = { Location: url }
  if (cookie) headers['Set-Cookie'] = cookie
  return new Response(null, { status: 302, headers })
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url)
  const token = url.searchParams.get('token') ?? ''
  const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'fr'
  const langPrefix = lang === 'en' ? '/en' : ''

  if (!token) {
    return redirect(`${langPrefix}/login?reason=missing-token`)
  }

  const row = await env.DB.prepare(
    `SELECT token, email, expires_at, used_at FROM magic_link_tokens WHERE token = ?`,
  )
    .bind(token)
    .first<TokenRow>()

  const now = Math.floor(Date.now() / 1000)

  if (!row) {
    return redirect(`${langPrefix}/login?reason=unknown-token`)
  }
  if (row.used_at !== null) {
    return redirect(`${langPrefix}/login?reason=token-used`)
  }
  if (row.expires_at < now) {
    return redirect(`${langPrefix}/login?reason=token-expired`)
  }

  await env.DB.prepare(`UPDATE magic_link_tokens SET used_at = ? WHERE token = ?`)
    .bind(now, token)
    .run()

  const sessionCookie = await signSessionCookie(env.SESSION_SECRET, row.email)
  const cookieHeader = setSessionCookieHeader(sessionCookie)

  const dest = isAdmin(env, row.email) ? `${langPrefix}/admin/inbox` : `${langPrefix}/me`
  return redirect(dest, cookieHeader)
}
