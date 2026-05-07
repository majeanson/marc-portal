// POST /api/auth/logout — clears the session cookie. Stateless: the cookie is
// the only thing that matters; nothing to revoke server-side beyond expiring
// the magic-link token (which already happens on consumption).

import { clearSessionCookieHeader } from '../../_lib/auth'
import type { Env } from '../../_lib/env'

export const onRequestPost: PagesFunction<Env> = async () => {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'Set-Cookie': clearSessionCookieHeader(),
    },
  })
}
