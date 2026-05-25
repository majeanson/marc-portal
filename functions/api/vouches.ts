// POST /api/vouches — UNAUTHENTICATED submission endpoint. Anyone who
// knows Marc can write a short testimonial; Marc moderates in
// /admin/vouches before anything goes public.
//
// Why no auth: requiring a magic link before someone can say "Marc
// shipped my idea in a weekend" kills the funnel. Email is captured in
// the form so Marc can reach back out if a vouch needs editing — it's
// never returned by the public endpoint (see PublicVouchRow projection
// in _lib/vouches.ts).
//
// Anti-abuse:
//   - rate limit 3/h per submitter email, 5/h per IP (lower than session
//     creation because a vouch carries less value to the submitter than a
//     project request and is a tempting spam vector)
//   - body/name/url length caps validated against VOUCH_LIMITS
//   - URL must be http(s); javascript:/data: rejected
//   - if session_id is supplied, it must match a live session — typo-class
//     mistakes are rejected so Marc doesn't see ghost attributions
//
// Moderation: every row lands status='pending'. Public endpoint filters
// to status='approved' AND deleted_at IS NULL.
//
// Notification: Marc gets one email per submission (sendNewVouchNotification).
// Failure to send is logged-and-swallowed so a Resend outage doesn't
// block submissions.

import { isPlausibleEmail } from '../_lib/auth'
import { randomTokenB64url } from '../_lib/bytes'
import { sendNewVouchNotification } from '../_lib/email'
import type { Env } from '../_lib/env'
import { badRequest, ok, tooManyRequests } from '../_lib/json'
import { clientIp, rateLimitCheck, rateLimitSweep } from '../_lib/ratelimit'
import { primaryAdminEmail } from '../_lib/sessions'
import { getLang } from '../_lib/userPrefs'
import { isValidRelationship, validateLinkUrl, VOUCH_LIMITS } from '../_lib/vouches'

interface SubmitBody {
  authorName?: unknown
  authorEmail?: unknown
  relationship?: unknown
  body?: unknown
  linkUrl?: unknown
  sessionId?: unknown
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let payload: SubmitBody
  try {
    payload = (await request.json()) as SubmitBody
  } catch {
    return badRequest('invalid json')
  }

  // --- Validate fields one by one so the client can show inline errors.
  if (typeof payload.authorName !== 'string') return badRequest('missing name')
  const authorName = payload.authorName.trim()
  if (authorName.length < VOUCH_LIMITS.nameMin || authorName.length > VOUCH_LIMITS.nameMax) {
    return badRequest('invalid name')
  }

  if (typeof payload.authorEmail !== 'string') return badRequest('missing email')
  const authorEmail = payload.authorEmail.trim().toLowerCase()
  if (!isPlausibleEmail(authorEmail) || authorEmail.length > VOUCH_LIMITS.emailMax) {
    return badRequest('invalid email')
  }

  if (!isValidRelationship(payload.relationship)) return badRequest('invalid relationship')
  const relationship = payload.relationship

  if (typeof payload.body !== 'string') return badRequest('missing body')
  const body = payload.body.trim()
  if (body.length < VOUCH_LIMITS.bodyMin || body.length > VOUCH_LIMITS.bodyMax) {
    return badRequest('invalid body length')
  }

  const linkUrl = validateLinkUrl(payload.linkUrl)
  if (linkUrl === false) return badRequest('invalid link url')

  // Session attribution is optional but, if provided, must resolve. A
  // soft FK — see schema comment in 0017_vouches.sql.
  let sessionId: string | null = null
  if (payload.sessionId !== undefined && payload.sessionId !== null && payload.sessionId !== '') {
    if (typeof payload.sessionId !== 'string') return badRequest('invalid session id')
    const exists = await env.DB.prepare(
      `SELECT id FROM sessions WHERE id = ? AND deleted_at IS NULL`,
    )
      .bind(payload.sessionId)
      .first<{ id: string }>()
    if (!exists) return badRequest('invalid session id')
    sessionId = exists.id
  }

  // --- Rate limit. Tighter than session creation (3/h/email, 5/h/IP).
  // We rate-limit AFTER validation so casual typos don't burn a slot.
  const ip = clientIp(request)
  const okEmail = await rateLimitCheck(env, `vouches:submit:email:${authorEmail}`, 3, 3600)
  if (!okEmail) return tooManyRequests('too many submissions in the last hour')
  const okIp = await rateLimitCheck(env, `vouches:submit:ip:${ip}`, 5, 3600)
  if (!okIp) return tooManyRequests('too many submissions in the last hour')
  await rateLimitSweep(env)

  const id = randomTokenB64url(12)
  const now = Math.floor(Date.now() / 1000)

  await env.DB.prepare(
    `INSERT INTO vouches
       (id, author_name, author_email, author_relationship, body, link_url,
        session_id, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
  )
    .bind(id, authorName, authorEmail, relationship, body, linkUrl, sessionId, now)
    .run()

  // Notify Marc. Origin pulled from the request so the moderate link
  // points at the right environment (preview vs prod). Swallow errors —
  // the submission is already persisted.
  const marc = primaryAdminEmail(env.ADMIN_EMAILS)
  if (marc && env.RESEND_API_KEY) {
    const origin = new URL(request.url).origin
    try {
      const marcLang = await getLang(env.DB, marc)
      await sendNewVouchNotification(
        env,
        marc,
        id,
        authorName,
        authorEmail,
        relationship,
        body,
        origin,
        marcLang,
      )
    } catch (err) {
      console.error('vouch notify failed', err)
    }
  }

  return ok({ id, status: 'pending' as const })
}
