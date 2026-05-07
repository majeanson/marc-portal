// feat-operator-console
// GET  /api/admin/fleet — list every tenant in the workspace (operator only)
// POST /api/admin/fleet — provision a new tenant (operator only)
//
// Operator gate: must be signed in AS an email in the ADMIN_EMAILS allowlist
// AND the resolved tenant (from Host) must have flags.isOperator === true.
// The second check prevents Marc's email from accidentally creating tenants
// from a buyer's domain — those requests 403.

import { currentEmail } from '../../_lib/auth'
import { randomTokenB64url } from '../../_lib/bytes'
import type { Env } from '../../_lib/env'
import { isAdmin } from '../../_lib/env'
import { badRequest, forbidden, ok, unauthorized } from '../../_lib/json'
import { requireTenant } from '../../_lib/tenant'

interface FleetRow {
  id: string
  slug: string
  ownerEmail: string
  templateId: string
  templateVersion: string
  status: string
  domains: string[]
  primaryDomain: string | null
  createdAt: number
  frozenAt: number | null
}

interface TenantSqlRow {
  id: string
  slug: string
  owner_email: string
  template_id: string
  template_version: string
  status: string
  created_at: number
  frozen_at: number | null
}

interface DomainSqlRow {
  domain: string
  tenant_id: string
  is_primary: number
}

async function gateOperator(
  ctx: Parameters<PagesFunction<Env>>[0],
): Promise<{ email: string } | Response> {
  const tenant = requireTenant(ctx)
  const email = await currentEmail(ctx.request, ctx.env.SESSION_SECRET)
  if (!email) return unauthorized()
  if (!isAdmin(ctx.env, email)) return forbidden('not an operator')
  // Operator surface only renders on operator tenants (Marc's). Buyers who
  // somehow load /api/admin/fleet on their own domain get 403 even if their
  // email happens to be in ADMIN_EMAILS — protects against operator-account
  // confusion across tenants.
  if (tenant.flags.isOperator !== true) {
    return forbidden('operator console not enabled on this tenant')
  }
  return { email }
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const gate = await gateOperator(ctx)
  if (gate instanceof Response) return gate

  const tenants = await ctx.env.DB.prepare(
    `SELECT id, slug, owner_email, template_id, template_version, status, created_at, frozen_at
       FROM tenants ORDER BY created_at DESC`,
  ).all<TenantSqlRow>()

  const domains = await ctx.env.DB.prepare(
    `SELECT domain, tenant_id, is_primary FROM tenant_domains`,
  ).all<DomainSqlRow>()

  const byTenant = new Map<string, DomainSqlRow[]>()
  for (const d of domains.results ?? []) {
    const arr = byTenant.get(d.tenant_id) ?? []
    arr.push(d)
    byTenant.set(d.tenant_id, arr)
  }

  const rows: FleetRow[] = (tenants.results ?? []).map((t) => {
    const ds = byTenant.get(t.id) ?? []
    const primary = ds.find((d) => d.is_primary === 1) ?? ds[0]
    return {
      id: t.id,
      slug: t.slug,
      ownerEmail: t.owner_email,
      templateId: t.template_id,
      templateVersion: t.template_version,
      status: t.status,
      domains: ds.map((d) => d.domain),
      primaryDomain: primary?.domain ?? null,
      createdAt: t.created_at,
      frozenAt: t.frozen_at,
    }
  })

  return ok({ tenants: rows })
}

interface ProvisionBody {
  slug?: string
  ownerEmail?: string
  templateId?: string
  templateVersion?: string
  domain?: string
  displayName?: string
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const gate = await gateOperator(ctx)
  if (gate instanceof Response) return gate
  const operator = gate.email

  let body: ProvisionBody
  try {
    body = (await ctx.request.json()) as ProvisionBody
  } catch {
    return badRequest('invalid json')
  }

  const slug = (body.slug ?? '').trim().toLowerCase()
  const ownerEmail = (body.ownerEmail ?? '').trim().toLowerCase()
  const templateId = (body.templateId ?? '').trim()
  const templateVersion = (body.templateVersion ?? '1.0').trim()
  const domain = (body.domain ?? '').trim().toLowerCase()
  const displayName = (body.displayName ?? '').trim()

  if (!SLUG_RE.test(slug)) {
    return badRequest('invalid slug — lowercase letters, digits, hyphens; 1–40 chars')
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) return badRequest('invalid owner email')
  if (!templateId) return badRequest('template_id required')
  if (!domain) return badRequest('domain required')

  const id = `t_${randomTokenB64url(8).toLowerCase()}`
  const now = Math.floor(Date.now() / 1000)
  const theme = displayName ? JSON.stringify({ displayName }) : '{}'

  // Single transaction-ish insert (D1 doesn't have BEGIN/COMMIT in scripts;
  // we rely on individual statement atomicity and the UNIQUE constraints to
  // catch dupes). If any step fails, the previous rows persist as orphans —
  // a future cleanup job sweeps tenants.status='pending' older than 24h.
  try {
    await ctx.env.DB.prepare(
      `INSERT INTO tenants (id, slug, owner_email, template_id, template_version, theme, flags, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, '{}', 'pending', ?)`,
    )
      .bind(id, slug, ownerEmail, templateId, templateVersion, theme, now)
      .run()

    await ctx.env.DB.prepare(
      `INSERT INTO tenant_domains (domain, tenant_id, is_primary, ssl_status, added_at)
       VALUES (?, ?, 1, 'pending', ?)`,
    )
      .bind(domain, id, now)
      .run()

    await ctx.env.DB.prepare(
      `INSERT INTO audit_log (id, ts, actor_email, tenant_id, action, payload)
       VALUES (?, ?, ?, ?, 'tenant.provision', ?)`,
    )
      .bind(crypto.randomUUID(), now, operator, id, JSON.stringify({ slug, domain, templateId }))
      .run()
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    if (msg.includes('UNIQUE')) {
      return badRequest('slug or domain already taken')
    }
    throw err
  }

  return ok({
    tenant: {
      id,
      slug,
      ownerEmail,
      templateId,
      templateVersion,
      domain,
      status: 'pending',
      createdAt: now,
    },
  })
}
