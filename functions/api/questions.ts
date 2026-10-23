// POST /api/questions — UNAUTHENTICATED « pose une question ». For the
// stranger with a half-idea who is not ready to open a request (and with it an
// account) just to ask « est-ce le genre de truc que tu fais ? ».
//
// Durability first: the question is written to admin_alerts (kind
// 'visitor-question') BEFORE any email is tried. Unlike a vouch, a lost
// question is a lost lead with nobody to notice, and admin_alerts is already
// what the daily digest and /admin/today surface until someone resolves it.
// The email to Marc then carries Reply-To = the visitor, so answering is just
// « Répondre ». A Resend outage is logged and swallowed: the alert row stays.
//
// Why no auth and no table of its own: same reasoning as /api/vouches (a
// cookie would filter out exactly the people this is for), and a question is a
// short-lived to-do for one person, which is what admin_alerts is.
//
// Anti-abuse: 2/h per email, 5/h per IP, after validation so typos don't burn
// a slot. The body is capped; nothing is echoed back.

import { isPlausibleEmail } from '../_lib/auth'
import { randomTokenB64url } from '../_lib/bytes'
import { sendVisitorQuestionNotification } from '../_lib/email'
import type { Env } from '../_lib/env'
import { badRequest, ok, tooManyRequests } from '../_lib/json'
import { clientIp, rateLimitCheck, rateLimitSweep } from '../_lib/ratelimit'
import { primaryAdminEmail } from '../_lib/sessions'
import { getLang } from '../_lib/userPrefs'

export const QUESTION_LIMITS = { bodyMin: 10, bodyMax: 1500, emailMax: 254 } as const

interface SubmitBody {
  email?: unknown
  body?: unknown
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let payload: SubmitBody
  try {
    payload = (await request.json()) as SubmitBody
  } catch {
    return badRequest('invalid json')
  }

  if (typeof payload.email !== 'string') return badRequest('missing email')
  const email = payload.email.trim().toLowerCase()
  if (!isPlausibleEmail(email) || email.length > QUESTION_LIMITS.emailMax) {
    return badRequest('invalid email')
  }
  if (typeof payload.body !== 'string') return badRequest('missing body')
  const body = payload.body.trim()
  if (body.length < QUESTION_LIMITS.bodyMin || body.length > QUESTION_LIMITS.bodyMax) {
    return badRequest('invalid body length')
  }

  const ip = clientIp(request)
  if (!(await rateLimitCheck(env, `questions:email:${email}`, 2, 3600))) {
    return tooManyRequests('too many questions in the last hour')
  }
  if (!(await rateLimitCheck(env, `questions:ip:${ip}`, 5, 3600))) {
    return tooManyRequests('too many questions in the last hour')
  }
  await rateLimitSweep(env)

  const id = `alrt_${randomTokenB64url(10)}`
  const now = Math.floor(Date.now() / 1000)
  await env.DB.prepare(
    `INSERT INTO admin_alerts (id, kind, body, created_at) VALUES (?, 'visitor-question', ?, ?)`,
  )
    .bind(id, `${email}: ${body}`, now)
    .run()

  const marc = primaryAdminEmail(env.ADMIN_EMAILS)
  if (marc && env.RESEND_API_KEY) {
    try {
      const marcLang = await getLang(env.DB, marc)
      await sendVisitorQuestionNotification(
        env,
        marc,
        email,
        body,
        new URL(request.url).origin,
        marcLang,
      )
    } catch (err) {
      // The alert row above is the durable copy; the digest will surface it.
      console.error('question notify failed', err)
    }
  }

  return ok({ received: true as const })
}
