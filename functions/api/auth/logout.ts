// POST /api/auth/logout — clears the session cookie. Stateless: the cookie is
// the only thing that matters; nothing to revoke server-side beyond expiring
// the magic-link token (which already happens on consumption).
//
// We don't require CSRF on logout. Worst-case forced-logout is a nuisance,
// not an account compromise, and gating it would create a chicken-and-egg
// problem when the SPA's local CSRF cookie has somehow drifted.

import { clearCsrfCookieHeader, clearSessionCookieHeader } from '../../_lib/auth'
import type { Env } from '../../_lib/env'

export const onRequestPost: PagesFunction<Env> = async () => {
  const headers = new Headers({ 'content-type': 'application/json' })
  headers.append('Set-Cookie', clearSessionCookieHeader())
  headers.append('Set-Cookie', clearCsrfCookieHeader())
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers })
}
