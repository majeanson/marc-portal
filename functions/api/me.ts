// GET /api/me — returns the current identity from the session cookie.
// 200 with {email, isAdmin} when authenticated, 200 with {email: null} when
// not. Returning 200 (not 401) keeps the SPA's bootstrap simpler: it always
// gets a JSON body, never a redirect or error.

import { currentEmail } from '../_lib/auth'
import type { Env } from '../_lib/env'
import { isAdmin } from '../_lib/env'
import { ok } from '../_lib/json'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return ok({ email: null, isAdmin: false })
  return ok({ email, isAdmin: isAdmin(env, email) })
}
