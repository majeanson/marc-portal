// feat-runtime-theme-editor
// PATCH /api/tenant/theme — update the current tenant's theme JSON.
// Auth: must be signed in AS the tenant's owner_email (or an operator).
// Theme is stored opaquely; values are sanitized on render via themeToCssVars
// (see _lib/tenant.ts) so we accept any string here and reject HTML breakouts
// at injection time.

import { currentEmail } from '../../_lib/auth'
import type { Env } from '../../_lib/env'
import { isAdmin } from '../../_lib/env'
import { badRequest, ok, unauthorized, forbidden } from '../../_lib/json'
import { requireTenant, type ThemeJSON } from '../../_lib/tenant'

interface PatchBody {
  theme?: Partial<ThemeJSON>
}

/** Allowed keys + max value length. Anything else is rejected silently. */
const KEY_LIMITS: Record<keyof ThemeJSON, number> = {
  accent: 64,
  accentDeep: 64,
  accentSoft: 64,
  paper: 64,
  paperWarm: 64,
  paperSoft: 64,
  paperDeep: 64,
  ink: 64,
  inkSoft: 64,
  warm: 64,
  cool: 64,
  display: 200,
  sans: 200,
  radius: 32,
  logoUrl: 500,
  displayName: 100,
  footer: 200,
}

function sanitize(theme: Partial<ThemeJSON>): ThemeJSON {
  const out: ThemeJSON = {}
  for (const [k, max] of Object.entries(KEY_LIMITS) as Array<[keyof ThemeJSON, number]>) {
    const v = theme[k]
    if (typeof v !== 'string') continue
    const trimmed = v.trim()
    if (trimmed.length === 0 || trimmed.length > max) continue
    // Defense-in-depth: reject HTML-breakout chars even though render-side
    // also escapes. logoUrl is the one place we permit a colon (https://…).
    if (/[<>\\\n\r]/.test(trimmed)) continue
    out[k] = trimmed
  }
  return out
}

export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  const tenant = requireTenant(ctx)
  const email = await currentEmail(ctx.request, ctx.env.SESSION_SECRET)
  if (!email) return unauthorized()

  // Permission: owner of this tenant, OR a global operator (Marc).
  const isOwner = tenant.ownerEmail.toLowerCase() === email.toLowerCase()
  if (!isOwner && !isAdmin(ctx.env, email)) return forbidden()

  let body: PatchBody
  try {
    body = (await ctx.request.json()) as PatchBody
  } catch {
    return badRequest('invalid json')
  }

  if (!body.theme || typeof body.theme !== 'object') {
    return badRequest('theme object required')
  }

  // Merge new keys over existing theme; explicit empty string from client
  // means "reset to default" (filtered by sanitize, falls back via removeProperty).
  const next = { ...tenant.theme, ...sanitize(body.theme) }
  // Explicit reset: client sends a key with the literal string "__reset__".
  // We delete that key from the merged theme.
  for (const [k, v] of Object.entries(body.theme)) {
    if (v === '__reset__') delete (next as Record<string, unknown>)[k]
  }

  const now = Math.floor(Date.now() / 1000)
  await ctx.env.DB.prepare('UPDATE tenants SET theme = ? WHERE id = ?')
    .bind(JSON.stringify(next), tenant.id)
    .run()

  // Audit trail.
  await ctx.env.DB.prepare(
    `INSERT INTO audit_log (id, ts, actor_email, tenant_id, action, payload)
     VALUES (?, ?, ?, ?, 'theme.update', ?)`,
  )
    .bind(crypto.randomUUID(), now, email, tenant.id, JSON.stringify({ keys: Object.keys(body.theme) }))
    .run()

  return ok({ theme: next })
}
