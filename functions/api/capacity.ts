// GET /api/capacity — public, unauthenticated. Returns active + triage counts
// straight from D1. Powers the homepage CapacityCounter; replaces the static
// public/data/capacity.json fixture. The 1-active + 1-triage cap is the most
// important rule in the system; this endpoint is its source of truth.

import type { Env } from '../_lib/env'
import { ok, serverError } from '../_lib/json'

interface CountRow {
  status: 'active' | 'triage'
  n: number
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const res = await env.DB.prepare(
      `SELECT status, COUNT(*) AS n FROM sessions
       WHERE status IN ('active', 'triage')
       GROUP BY status`,
    ).all<CountRow>()

    let active = 0
    let triage = 0
    for (const row of res.results ?? []) {
      if (row.status === 'active') active = row.n
      else if (row.status === 'triage') triage = row.n
    }
    return ok({ active, triage, cap: 1 })
  } catch (err) {
    console.error('capacity query failed', err)
    return serverError('capacity query failed')
  }
}
