// feat-template-snd-package
// GET  /api/snd/clips — list voice clips for the current tenant
// POST /api/snd/clips — create a new voice clip from a text transcript
//
// Tenant-scoped: every read filters by tenant_id; every write tags it.
// Auth: signed-in tenant owner OR operator (Marc) acting on the tenant.
// Template gate: only available on tenants whose templateId is 'snd' —
// other templates 404 these endpoints to keep the API surface tight.

import { currentEmail } from '../../_lib/auth'
import { randomTokenB64url } from '../../_lib/bytes'
import type { Env } from '../../_lib/env'
import { isAdmin } from '../../_lib/env'
import { badRequest, forbidden, notFound, ok, unauthorized } from '../../_lib/json'
import { requireTenant } from '../../_lib/tenant'

export interface VoiceClip {
  id: string
  recordedAt: number
  clientName: string
  transcriptFr: string | null
  transcriptEn: string | null
  createdByEmail: string
  createdAt: number
}

interface ClipRow {
  id: string
  recorded_at: number
  client_name: string
  transcript_fr: string | null
  transcript_en: string | null
  created_by_email: string
  created_at: number
}

function rowToClip(r: ClipRow): VoiceClip {
  return {
    id: r.id,
    recordedAt: r.recorded_at,
    clientName: r.client_name,
    transcriptFr: r.transcript_fr,
    transcriptEn: r.transcript_en,
    createdByEmail: r.created_by_email,
    createdAt: r.created_at,
  }
}

/**
 * Caller must be signed in AND either the tenant's owner OR an operator
 * on an operator tenant. Returns email when allowed; a Response otherwise.
 */
async function gateBuyerOrOperator(
  ctx: Parameters<PagesFunction<Env>>[0],
): Promise<{ email: string } | Response> {
  const tenant = requireTenant(ctx)
  if (tenant.templateId !== 'snd') return notFound()

  const email = await currentEmail(ctx.request, ctx.env.SESSION_SECRET)
  if (!email) return unauthorized()

  const isOwner = tenant.ownerEmail.toLowerCase() === email.toLowerCase()
  const isOperator = isAdmin(ctx.env, email) && tenant.flags.isOperator === true
  if (!isOwner && !isOperator) return forbidden()

  return { email }
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const gate = await gateBuyerOrOperator(ctx)
  if (gate instanceof Response) return gate
  const tenant = requireTenant(ctx)

  const res = await ctx.env.DB.prepare(
    `SELECT id, recorded_at, client_name, transcript_fr, transcript_en,
            created_by_email, created_at
       FROM snd_voice_clips
      WHERE tenant_id = ?
      ORDER BY recorded_at DESC, created_at DESC
      LIMIT 200`,
  )
    .bind(tenant.id)
    .all<ClipRow>()

  return ok({ clips: (res.results ?? []).map(rowToClip) })
}

interface CreateBody {
  clientName?: unknown
  recordedAt?: unknown
  transcriptFr?: unknown
  transcriptEn?: unknown
}

const MAX_TRANSCRIPT_LEN = 4000
const MAX_CLIENT_LEN = 80

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const gate = await gateBuyerOrOperator(ctx)
  if (gate instanceof Response) return gate
  const tenant = requireTenant(ctx)

  let body: CreateBody
  try {
    body = (await ctx.request.json()) as CreateBody
  } catch {
    return badRequest('invalid json')
  }

  const clientName = typeof body.clientName === 'string' ? body.clientName.trim() : ''
  if (!clientName) return badRequest('clientName required')
  if (clientName.length > MAX_CLIENT_LEN) return badRequest('clientName too long')

  const transcriptFr =
    typeof body.transcriptFr === 'string' && body.transcriptFr.trim().length > 0
      ? body.transcriptFr.trim().slice(0, MAX_TRANSCRIPT_LEN)
      : null
  const transcriptEn =
    typeof body.transcriptEn === 'string' && body.transcriptEn.trim().length > 0
      ? body.transcriptEn.trim().slice(0, MAX_TRANSCRIPT_LEN)
      : null

  // At least one transcript must be provided. Both can coexist (some buyers
  // dictate in french and have automated translation in the future).
  if (!transcriptFr && !transcriptEn) {
    return badRequest('transcriptFr or transcriptEn required')
  }

  // recordedAt: client may pass an explicit time (millis or seconds), or omit
  // for "now". We normalize to unix seconds and reject anything wildly off.
  const now = Math.floor(Date.now() / 1000)
  let recordedAt: number = now
  if (body.recordedAt !== undefined) {
    const raw = Number(body.recordedAt)
    if (!Number.isFinite(raw)) return badRequest('recordedAt must be a number')
    // Heuristic: if it looks like millis (>= year 2001 in ms), divide.
    const seconds = raw > 1_000_000_000_000 ? Math.floor(raw / 1000) : Math.floor(raw)
    if (seconds < 0 || seconds > now + 86400) {
      return badRequest('recordedAt out of range')
    }
    recordedAt = seconds
  }

  const id = `snd_${randomTokenB64url(10).toLowerCase()}`

  await ctx.env.DB.prepare(
    `INSERT INTO snd_voice_clips
       (id, tenant_id, recorded_at, client_name, transcript_fr, transcript_en,
        created_by_email, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, tenant.id, recordedAt, clientName, transcriptFr, transcriptEn, gate.email, now)
    .run()

  const clip: VoiceClip = {
    id,
    recordedAt,
    clientName,
    transcriptFr,
    transcriptEn,
    createdByEmail: gate.email,
    createdAt: now,
  }
  return ok({ clip })
}
