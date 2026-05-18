// GET   /api/me/prefs — returns {lang} for the signed-in account.
// PATCH /api/me/prefs — upserts {lang}. Validates lang ∈ {fr, en}.
//
// One endpoint, two account types: the signed-in identity is the email on
// the session cookie. Visitors and admins use the same shape. Marc's own
// preference written here is what every admin-side notification email
// (vouches, new visitor messages, withdrawals, intake-edits, all-yours
// acks, digest) renders in.
//
// CSRF-guarded on PATCH (state-changing). GET is safe to call without.

import { currentEmail, requireCsrf } from '../../_lib/auth'
import type { Env } from '../../_lib/env'
import { badRequest, ok, unauthorized } from '../../_lib/json'
import { getLang, isValidLang, setLang } from '../../_lib/userPrefs'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()
  const lang = await getLang(env.DB, email)
  return ok({ lang })
}

interface PatchBody {
  lang?: unknown
}

export const onRequestPatch: PagesFunction<Env> = async ({ request, env }) => {
  const csrf = requireCsrf(request)
  if (csrf) return csrf
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()

  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return badRequest('invalid json')
  }

  if (!isValidLang(body.lang)) return badRequest('lang must be "fr" or "en"')

  await setLang(env.DB, email, body.lang)
  return ok({ lang: body.lang })
}
