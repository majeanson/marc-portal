// feat-operator-console
// GET /api/admin/audit — return the most recent audit_log entries (operator only).
// Append-only across the workspace, ordered ts DESC. Used by /admin/audit
// to give Marc a "what happened recently" panel.

import { currentEmail } from '../../_lib/auth'
import type { Env } from '../../_lib/env'
import { isAdmin } from '../../_lib/env'
import { forbidden, ok, unauthorized } from '../../_lib/json'
import { requireTenant } from '../../_lib/tenant'

interface AuditRow {
  id: string
  ts: number
  actor_email: string
  tenant_id: string | null
  action: string
  payload: string | null
}

interface AuditEntry {
  id: string
  ts: number
  actorEmail: string
  tenantId: string | null
  tenantSlug: string | null
  action: string
  payload: unknown
}

interface TenantSlugRow {
  id: string
  slug: string
}

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const tenant = requireTenant(ctx)
  const email = await currentEmail(ctx.request, ctx.env.SESSION_SECRET)
  if (!email) return unauthorized()
  if (!isAdmin(ctx.env, email)) return forbidden('not an operator')
  if (tenant.flags.isOperator !== true) {
    return forbidden('audit log only available on operator tenants')
  }

  const url = new URL(ctx.request.url)
  const requested = Number.parseInt(url.searchParams.get('limit') ?? '', 10)
  const limit = Number.isFinite(requested) && requested > 0 && requested <= MAX_LIMIT
    ? requested
    : DEFAULT_LIMIT

  const [entries, slugs] = await Promise.all([
    ctx.env.DB.prepare(
      `SELECT id, ts, actor_email, tenant_id, action, payload
         FROM audit_log ORDER BY ts DESC LIMIT ?`,
    )
      .bind(limit)
      .all<AuditRow>(),
    ctx.env.DB.prepare(`SELECT id, slug FROM tenants`).all<TenantSlugRow>(),
  ])

  const slugById = new Map<string, string>()
  for (const r of slugs.results ?? []) slugById.set(r.id, r.slug)

  const out: AuditEntry[] = (entries.results ?? []).map((r) => ({
    id: r.id,
    ts: r.ts,
    actorEmail: r.actor_email,
    tenantId: r.tenant_id,
    tenantSlug: r.tenant_id ? (slugById.get(r.tenant_id) ?? null) : null,
    action: r.action,
    payload: parsePayload(r.payload),
  }))

  return ok({ entries: out })
}

function parsePayload(raw: string | null): unknown {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}
