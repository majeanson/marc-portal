// GET   /api/me/prefs — returns {lang, firstName} for the signed-in account.
// PATCH /api/me/prefs — partial update. Body may contain `lang` and/or
//                       `firstName`. At least one must be present.
//
// One endpoint, two account types: the signed-in identity is the email on
// the session cookie. Visitors and admins use the same shape. Marc's own
// preference written here is what every admin-side notification email
// (vouches, new visitor messages, withdrawals, intake-edits, all-yours
// acks, digest) renders in.
//
// Side effect on lang change: also writes the `mp_lang` cookie so the
// next bare-`/` visit lands in the saved language. The bare-`/` redirect
// in functions/_middleware.ts is cookie-only by design (no D1 read on the
// hot path) — keeping cookie and DB in sync is the prefs endpoint's job.
//
// CSRF-guarded on PATCH (state-changing). GET is safe to call without.

import { currentEmail, requireCsrf, setLangCookieHeader } from '../../_lib/auth'
import type { Env } from '../../_lib/env'
import { badRequest, json, unauthorized } from '../../_lib/json'
import {
  getPrefs,
  isValidLang,
  normalizeFirstName,
  setFirstName,
  setLang,
} from '../../_lib/userPrefs'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()
  const prefs = await getPrefs(env.DB, email)
  return json(prefs, { status: 200 })
}

interface PatchBody {
  lang?: unknown
  firstName?: unknown
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

  const hasLang = body.lang !== undefined
  const hasFirstName = body.firstName !== undefined
  if (!hasLang && !hasFirstName) {
    return badRequest('must include lang or firstName')
  }

  // Validate both fields before writing either — partial writes on a bad
  // payload leave the row in a half-applied state and force the caller to
  // re-PATCH.
  if (hasLang && !isValidLang(body.lang)) {
    return badRequest('lang must be "fr" or "en"')
  }
  let normalizedFirstName: string | null = null
  if (hasFirstName) {
    // Explicit `null` (and "" trimmed to "") clear the stored name.
    // Anything else must trim non-empty and fit in 80 chars.
    if (body.firstName === null) {
      normalizedFirstName = null
    } else {
      const norm = normalizeFirstName(body.firstName)
      if (norm === null) {
        return badRequest('firstName must be 1–80 characters')
      }
      normalizedFirstName = norm
    }
  }

  if (hasLang) {
    await setLang(env.DB, email, body.lang as 'fr' | 'en')
  }
  if (hasFirstName) {
    await setFirstName(env.DB, email, normalizedFirstName)
  }

  const prefs = await getPrefs(env.DB, email)
  const response = json(prefs, { status: 200 })
  // Keep the cookie write conditional on a lang change — touching
  // firstName alone shouldn't churn the visitor's lang cookie.
  if (hasLang) {
    response.headers.append('Set-Cookie', setLangCookieHeader(body.lang as 'fr' | 'en'))
  }
  return response
}
