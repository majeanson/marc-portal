// GET /api/auth/verify?token=... — consumes a magic-link token, sets the
// session cookie, redirects into the SPA. Single-use: a verified token is
// marked used_at and cannot be replayed. Failure modes redirect to /login
// with a reason query param so the SPA can render a friendly message.
//
// The plaintext token in the URL is hashed with SHA-256 before lookup; D1
// stores only the hash (see request-link.ts).

import {
  newCsrfToken,
  setCsrfCookieHeader,
  setSessionCookieHeader,
  signSessionCookie,
} from '../../_lib/auth'
import { sha256B64url } from '../../_lib/bytes'
import type { Env } from '../../_lib/env'
import { isAdmin } from '../../_lib/env'

interface TokenRow {
  token: string
  email: string
  expires_at: number
  used_at: number | null
}

function redirect(url: string, cookies?: string[]): Response {
  // Workers Headers supports multiple Set-Cookie via append(). One Set-Cookie
  // per call so the runtime serializes them separately on the wire.
  const headers = new Headers({ Location: url })
  for (const c of cookies ?? []) headers.append('Set-Cookie', c)
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

  const tokenHash = await sha256B64url(token)

  const row = await env.DB.prepare(
    `SELECT token, email, expires_at, used_at FROM magic_link_tokens WHERE token = ?`,
  )
    .bind(tokenHash)
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
    .bind(now, tokenHash)
    .run()

  const sessionCookie = await signSessionCookie(env.SESSION_SECRET, row.email)
  const csrf = newCsrfToken()
  const cookies = [setSessionCookieHeader(sessionCookie), setCsrfCookieHeader(csrf)]

  const dest = isAdmin(env, row.email) ? `${langPrefix}/admin/inbox` : `${langPrefix}/me`
  return redirect(dest, cookies)
}
