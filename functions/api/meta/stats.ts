// GET /api/meta/stats — public, unauthenticated. The live half of the /meta
// scorecard: the portal grading itself in public.
//
// Returns aggregate numbers only — never an email, a body, or anything that
// identifies a visitor:
//   { shippedCount, medianResponseHours, sampleSize, slaHours }
//
// shippedCount        — engagements that reached `shipped`
// medianResponseHours — median time from a session being created to its
//                       triage decision (the first transition to `active`
//                       or `rejected`); null until there is at least one
// sampleSize          — how many sessions that median is computed from
// slaHours            — the public triage SLA the median is measured against
//
// The triage decision is read from each session's status_history JSON; the
// computation is done here rather than in SQL because the history is a blob.

import type { Env } from '../../_lib/env'
import { json, serviceUnavailable } from '../../_lib/json'

const SLA_HOURS = 72
const MAX_PLAUSIBLE_HOURS = 24 * 365 // discard a clock-skew / bad-data outlier

interface HistoryEntry {
  from?: string
  to?: string
  at?: number
}

export const onRequest: PagesFunction<Env> = async ({ env }) => {
  try {
    const shipped = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM sessions WHERE status = 'shipped' AND deleted_at IS NULL",
    ).first<{ n: number }>()

    const rows = await env.DB.prepare(
      'SELECT created_at, status_history FROM sessions WHERE deleted_at IS NULL',
    ).all<{ created_at: number; status_history: string | null }>()

    const responseHours: number[] = []
    for (const row of rows.results ?? []) {
      if (typeof row.created_at !== 'number') continue
      let history: HistoryEntry[] = []
      try {
        const parsed = JSON.parse(row.status_history ?? '[]')
        if (Array.isArray(parsed)) history = parsed
      } catch {
        history = []
      }
      const decision = history.find((e) => e && (e.to === 'active' || e.to === 'rejected'))
      if (decision && typeof decision.at === 'number') {
        const hours = (decision.at - row.created_at) / 3600
        if (hours >= 0 && hours < MAX_PLAUSIBLE_HOURS) responseHours.push(hours)
      }
    }

    responseHours.sort((a, b) => a - b)
    const median =
      responseHours.length > 0 ? responseHours[Math.floor((responseHours.length - 1) / 2)] : null

    return json({
      shippedCount: shipped?.n ?? 0,
      medianResponseHours: median === null ? null : Math.round(median * 10) / 10,
      sampleSize: responseHours.length,
      slaHours: SLA_HOURS,
    })
  } catch (err) {
    console.error('meta/stats: query failed', err)
    return serviceUnavailable('stats unavailable')
  }
}
