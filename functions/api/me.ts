// GET /api/me — returns the current identity from the session cookie.
// 200 with {email, isAdmin} when authenticated, 200 with {email: null} when
// not. Returning 200 (not 401) keeps the SPA's bootstrap simpler: it always
// gets a JSON body, never a redirect or error.
//
// `isAdmin` here means "operator on this tenant" — the email must be in
// ADMIN_EMAILS AND the resolved tenant must have flags.isOperator. A buyer
// signing in to roger-voice-truck.com using marc.jeanson92@... will see
// isAdmin=false because Roger's tenant isn't flagged operator.

import { currentEmail } from '../_lib/auth'
import type { Env } from '../_lib/env'
import { isAdmin } from '../_lib/env'
import { ok } from '../_lib/json'
import { requireTenant } from '../_lib/tenant'

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const tenant = requireTenant(ctx)
  const email = await currentEmail(ctx.request, ctx.env.SESSION_SECRET)
  if (!email) return ok({ email: null, isAdmin: false })
  const isOperator = isAdmin(ctx.env, email) && tenant.flags.isOperator === true
  return ok({ email, isAdmin: isOperator })
}
