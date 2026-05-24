// GET  /api/sessions — list sessions. Visitor sees their own; Marc sees all.
// POST /api/sessions — create a session for the current user, status=draft.
// One session per intake submission; the body carries the intake_json blob.

import { currentEmail } from '../../_lib/auth'
import { randomTokenB64url } from '../../_lib/bytes'
import type { Env } from '../../_lib/env'
import { isAdmin } from '../../_lib/env'
import { badRequest, conflict, ok, tooManyRequests, unauthorized } from '../../_lib/json'
import { clientIp, rateLimitCheck, rateLimitSweep } from '../../_lib/ratelimit'
import {
  countActiveAndTriage,
  isTriageAtCap,
  SESSION_SELECT_COLUMNS,
  type SessionRow,
} from '../../_lib/sessions'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()

  const admin = isAdmin(env, email)
  // ?deleted=true returns *only* soft-deleted rows (admin trash). Default
  // is live rows only. Visitors can never see deleted rows in either mode.
  const url = new URL(request.url)
  const wantDeleted = admin && url.searchParams.get('deleted') === 'true'

  const stmt = admin
    ? env.DB.prepare(
        `SELECT ${SESSION_SELECT_COLUMNS}
         FROM sessions
         WHERE deleted_at ${wantDeleted ? 'IS NOT NULL' : 'IS NULL'}
         ORDER BY updated_at DESC`,
      )
    : env.DB.prepare(
        `SELECT ${SESSION_SELECT_COLUMNS}
         FROM sessions WHERE email = ? AND deleted_at IS NULL
         ORDER BY updated_at DESC`,
      ).bind(email)

  const res = await stmt.all<SessionRow>()
  return ok({ sessions: res.results ?? [] })
}

interface CreateBody {
  intakeJson?: unknown
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()

  // Throttle session creation: 5/h per email, 10/h per IP. Above the
  // intended 1-2/day usage but well below abuse. 429 is friendlier than
  // a silent drop here — the visitor sees the cap in the UI.
  const ip = clientIp(request)
  const okEmail = await rateLimitCheck(env, `sessions:create:email:${email}`, 5, 3600)
  if (!okEmail) return tooManyRequests('too many sessions in the last hour')
  const okIp = await rateLimitCheck(env, `sessions:create:ip:${ip}`, 10, 3600)
  if (!okIp) return tooManyRequests('too many sessions in the last hour')
  await rateLimitSweep(env)

  let body: CreateBody
  try {
    body = (await request.json()) as CreateBody
  } catch {
    return badRequest('invalid json')
  }

  // Bedrock cap: 1 active + 1 in triage. New sessions land in `draft`, which
  // doesn't itself count, but submitting from intake auto-promotes to triage
  // (see Intake.tsx). To keep the cap honest at the *moment of intake* — when
  // the visitor sees the "atCap" notice — we refuse new sessions whose intake
  // payload is non-null (i.e. "real" submissions, not Marc-created drafts) when
  // triage is already full. Admins are exempt; they may need to seed a draft.
  const admin = isAdmin(env, email)
  if (!admin && body.intakeJson !== undefined && body.intakeJson !== null) {
    const counts = await countActiveAndTriage(env.DB)
    if (isTriageAtCap(counts)) {
      return conflict('at capacity — added to waitlist')
    }
  }

  // intake_json is stored as text; we accept either a stringified JSON or an
  // object that we serialize. Either way it's opaque to the server.
  let intakeJson: string | null = null
  if (body.intakeJson !== undefined && body.intakeJson !== null) {
    intakeJson =
      typeof body.intakeJson === 'string' ? body.intakeJson : JSON.stringify(body.intakeJson)
  }

  // Defensive size cap on the serialized intake. After P1.8 the napkin PNG
  // lives in R2 (uploaded as a separate kind='napkin' attachment by the
  // intake client), so a "real" intake from the current client is well
  // under 50 KB. We KEEP the 1 MB cap deliberately — a visitor who had the
  // pre-P1.8 intake page open in a stale tab and submits after the deploy
  // would still POST the PNG inline. Tightening here would 400 them.
  // Future tightening to ~256 KB is safe once we're confident no
  // pre-P1.8 client cache is still in flight (typical window: a few days).
  const MAX_INTAKE_BYTES = 1024 * 1024
  if (intakeJson && intakeJson.length > MAX_INTAKE_BYTES) {
    return badRequest('intake payload too large')
  }

  const id = randomTokenB64url(12)
  const now = Math.floor(Date.now() / 1000)

  await env.DB.prepare(
    `INSERT INTO sessions (id, email, intake_json, status, created_at, updated_at)
     VALUES (?, ?, ?, 'draft', ?, ?)`,
  )
    .bind(id, email, intakeJson, now, now)
    .run()

  const row: SessionRow = {
    id,
    email,
    intake_json: intakeJson,
    status: 'draft',
    created_at: now,
    updated_at: now,
    deleted_at: null,
    status_history: null,
    showcased_at: null,
    showcase_title: null,
    showcase_tagline: null,
    tier: null,
    tier4_amount_cents: null,
    tier3_split: null,
    custodian_status: null,
    custodian_plan: null,
    all_yours_acknowledged_at: null,
    decline_note: null,
    community_discount: 0,
    // The intake client may follow up with a napkin upload (POST
    // /api/sessions/:id/attachments?kind=napkin). At the moment of this
    // synthetic return there is no attachment yet — the client doesn't
    // need this field on the create response.
    napkin_attachment_id: null,
  }
  return ok({ session: row })
}
