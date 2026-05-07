// GET /api/capacity — public, unauthenticated. Returns active + triage counts
// for the resolved tenant. Powers the homepage CapacityCounter; replaces the
// static public/data/capacity.json fixture. The 1-active + 1-triage cap is
// the most important rule in *Marc's* tenant; other tenants set their own
// caps via tenants.flags.cap (default still 1 if unset).

import type { Env } from '../_lib/env'
import { ok, serverError } from '../_lib/json'
import { requireTenant } from '../_lib/tenant'

interface CountRow {
  status: 'active' | 'triage'
  n: number
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  try {
    const tenant = requireTenant(ctx)
    const res = await ctx.env.DB.prepare(
      `SELECT status, COUNT(*) AS n FROM sessions
         WHERE status IN ('active', 'triage') AND tenant_id = ?
         GROUP BY status`,
    )
      .bind(tenant.id)
      .all<CountRow>()

    let active = 0
    let triage = 0
    for (const row of res.results ?? []) {
      if (row.status === 'active') active = row.n
      else if (row.status === 'triage') triage = row.n
    }
    const cap = typeof tenant.flags.cap === 'number' ? tenant.flags.cap : 1
    return ok({ active, triage, cap })
  } catch (err) {
    console.error('capacity query failed', err)
    return serverError('capacity query failed')
  }
}
