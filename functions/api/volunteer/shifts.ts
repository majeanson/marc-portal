// feat-template-volunteer-roster
// GET  /api/volunteer/shifts — list upcoming shifts for the current tenant
// POST /api/volunteer/shifts — owner-only: create a new shift
//
// Tenant-scoped, template-gated to 'volunteer-roster'. Joins vr_signups for
// live slot-fill counts (one query, server-side aggregate — keeps the SPA
// dumb).

import { currentEmail } from '../../_lib/auth'
import { randomTokenB64url } from '../../_lib/bytes'
import type { Env } from '../../_lib/env'
import { isAdmin } from '../../_lib/env'
import { badRequest, forbidden, notFound, ok, unauthorized } from '../../_lib/json'
import { requireTenant } from '../../_lib/tenant'

export interface Shift {
  id: string
  startsAt: number
  endsAt: number
  role: string
  slotsNeeded: number
  filled: number
  location: string | null
  notes: string | null
  createdByEmail: string
  createdAt: number
}

interface ShiftRow {
  id: string
  starts_at: number
  ends_at: number
  role: string
  slots_needed: number
  filled: number
  location: string | null
  notes: string | null
  created_by_email: string
  created_at: number
}

function rowToShift(r: ShiftRow): Shift {
  return {
    id: r.id,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    role: r.role,
    slotsNeeded: r.slots_needed,
    filled: r.filled,
    location: r.location,
    notes: r.notes,
    createdByEmail: r.created_by_email,
    createdAt: r.created_at,
  }
}

async function gateAuthed(
  ctx: Parameters<PagesFunction<Env>>[0],
): Promise<{ email: string; isOwner: boolean } | Response> {
  const tenant = requireTenant(ctx)
  if (tenant.templateId !== 'volunteer-roster') return notFound()
  const email = await currentEmail(ctx.request, ctx.env.SESSION_SECRET)
  if (!email) return unauthorized()
  const isOwner =
    tenant.ownerEmail.toLowerCase() === email.toLowerCase() ||
    (isAdmin(ctx.env, email) && tenant.flags.isOperator === true)
  return { email, isOwner }
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const gate = await gateAuthed(ctx)
  if (gate instanceof Response) return gate
  const tenant = requireTenant(ctx)

  const now = Math.floor(Date.now() / 1000)
  // Show shifts that haven't ended yet (cutoff at ends_at, not starts_at, so
  // an in-progress shift is still visible to volunteers running late).
  const res = await ctx.env.DB.prepare(
    `SELECT s.id, s.starts_at, s.ends_at, s.role, s.slots_needed,
            s.location, s.notes, s.created_by_email, s.created_at,
            COALESCE(SUM(CASE WHEN su.status = 'confirmed' THEN 1 ELSE 0 END), 0) AS filled
       FROM vr_shifts s
       LEFT JOIN vr_signups su ON su.shift_id = s.id
      WHERE s.tenant_id = ? AND s.ends_at >= ?
      GROUP BY s.id
      ORDER BY s.starts_at ASC
      LIMIT 200`,
  )
    .bind(tenant.id, now)
    .all<ShiftRow>()

  return ok({ shifts: (res.results ?? []).map(rowToShift) })
}

interface CreateBody {
  startsAt?: unknown
  endsAt?: unknown
  role?: unknown
  slotsNeeded?: unknown
  location?: unknown
  notes?: unknown
}

const MAX_ROLE_LEN = 80
const MAX_LOCATION_LEN = 120
const MAX_NOTES_LEN = 600

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const gate = await gateAuthed(ctx)
  if (gate instanceof Response) return gate
  if (!gate.isOwner) return forbidden('only the owner can create shifts')
  const tenant = requireTenant(ctx)

  let body: CreateBody
  try {
    body = (await ctx.request.json()) as CreateBody
  } catch {
    return badRequest('invalid json')
  }

  const startsAt = toUnixSeconds(body.startsAt)
  const endsAt = toUnixSeconds(body.endsAt)
  if (startsAt === null) return badRequest('startsAt required')
  if (endsAt === null) return badRequest('endsAt required')
  if (endsAt <= startsAt) return badRequest('endsAt must be after startsAt')

  const role = typeof body.role === 'string' ? body.role.trim() : ''
  if (!role) return badRequest('role required')
  if (role.length > MAX_ROLE_LEN) return badRequest('role too long')

  const slotsNeededRaw = Number(body.slotsNeeded ?? 1)
  if (!Number.isFinite(slotsNeededRaw) || slotsNeededRaw < 1 || slotsNeededRaw > 200) {
    return badRequest('slotsNeeded must be 1–200')
  }
  const slotsNeeded = Math.floor(slotsNeededRaw)

  const location =
    typeof body.location === 'string' && body.location.trim().length > 0
      ? body.location.trim().slice(0, MAX_LOCATION_LEN)
      : null
  const notes =
    typeof body.notes === 'string' && body.notes.trim().length > 0
      ? body.notes.trim().slice(0, MAX_NOTES_LEN)
      : null

  const id = `vr_${randomTokenB64url(10).toLowerCase()}`
  const now = Math.floor(Date.now() / 1000)

  await ctx.env.DB.prepare(
    `INSERT INTO vr_shifts
       (id, tenant_id, starts_at, ends_at, role, slots_needed, location, notes,
        created_by_email, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, tenant.id, startsAt, endsAt, role, slotsNeeded, location, notes, gate.email, now)
    .run()

  const shift: Shift = {
    id,
    startsAt,
    endsAt,
    role,
    slotsNeeded,
    filled: 0,
    location,
    notes,
    createdByEmail: gate.email,
    createdAt: now,
  }
  return ok({ shift })
}

function toUnixSeconds(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw > 1_000_000_000_000 ? Math.floor(raw / 1000) : Math.floor(raw)
  }
  if (typeof raw === 'string' && raw.trim()) {
    const ms = Date.parse(raw)
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : null
  }
  return null
}
