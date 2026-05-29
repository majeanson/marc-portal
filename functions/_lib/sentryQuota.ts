// Sentry quota watchdog (prod-readiness gap #8).
//
// Sentry is the practice's only error-reporting processor, on the free plan
// (~5000 errors/month). If a bad deploy starts throwing on every request, the
// quota burns silently and Sentry begins DROPPING events — so the one tool
// that would tell us something's wrong goes blind exactly when it matters.
// This watchdog reads the org's 30-day error usage from the Sentry stats API
// and raises an operator alert when usage crosses a fraction of the quota,
// while there's still headroom to act.
//
// Alert-only, deduped, and run from the daily digest cron — same shape and
// rationale as the custodian reconciliation (functions/_lib/custodianReconcile.ts).
// No-op until SENTRY_AUTH_TOKEN + SENTRY_ORG are configured.

import type { Env } from './env'
import { randomTokenB64url } from './bytes'

const SENTRY_API = 'https://sentry.io/api/0'
const FETCH_TIMEOUT_MS = 5000
const DEFAULT_MONTHLY_QUOTA = 5000 // Sentry free-plan errors/month
const DEFAULT_THRESHOLD = 0.8 // alert at 80% of quota

export interface QuotaEvaluation {
  used: number
  quota: number
  /** Fraction of quota used, 0..N (can exceed 1 when over quota). */
  pct: number
  over: boolean
}

/** Pure: decide whether 30-day error usage has crossed the alert threshold.
 *  A non-positive quota is treated as "no quota configured" → never over
 *  (avoids a divide-by-zero alert storm on a misconfiguration). */
export function evaluateQuota(
  used: number,
  quota: number,
  threshold = DEFAULT_THRESHOLD,
): QuotaEvaluation {
  if (quota <= 0) return { used, quota, pct: 0, over: false }
  const pct = used / quota
  return { used, quota, pct, over: pct >= threshold }
}

/** Pure: sum the `sum(quantity)` totals across every group in a Sentry
 *  stats_v2 response. The query already filters to category=error, so every
 *  group's quantity counts. Tolerant of a missing/short shape — returns 0
 *  rather than throwing, so a Sentry API change degrades to "no usage seen"
 *  (which the caller treats as not-over) instead of crashing the digest. */
export function sumErrorQuantity(json: unknown): number {
  const groups = (json as { groups?: unknown })?.groups
  if (!Array.isArray(groups)) return 0
  let total = 0
  for (const g of groups) {
    const q = (g as { totals?: Record<string, unknown> })?.totals?.['sum(quantity)']
    if (typeof q === 'number' && Number.isFinite(q)) total += q
  }
  return total
}

function quotaFromEnv(env: Env): number {
  const raw = env.SENTRY_MONTHLY_ERROR_QUOTA
  if (!raw) return DEFAULT_MONTHLY_QUOTA
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MONTHLY_QUOTA
}

export interface QuotaCheckResult {
  skipped?: 'unconfigured'
  evaluation?: QuotaEvaluation
  alerted: boolean
}

/**
 * Fetch the org's 30-day accepted-error count from Sentry, compare against the
 * monthly quota, and write one admin_alerts row (kind `sentry-quota`) when over
 * threshold and no open one already exists. No-op when the token/org are unset.
 */
export async function checkSentryQuota(env: Env): Promise<QuotaCheckResult> {
  if (!env.SENTRY_AUTH_TOKEN || !env.SENTRY_ORG) return { skipped: 'unconfigured', alerted: false }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  let used: number
  try {
    const qs = new URLSearchParams({
      field: 'sum(quantity)',
      category: 'error',
      interval: '1d',
      statsPeriod: '30d',
    })
    const res = await fetch(
      `${SENTRY_API}/organizations/${encodeURIComponent(env.SENTRY_ORG)}/stats_v2/?${qs.toString()}`,
      { headers: { Authorization: `Bearer ${env.SENTRY_AUTH_TOKEN}` }, signal: ctrl.signal },
    )
    if (!res.ok) throw new Error(`sentry stats failed: ${res.status}`)
    used = sumErrorQuantity(await res.json())
  } finally {
    clearTimeout(timer)
  }

  const evaluation = evaluateQuota(used, quotaFromEnv(env))
  let alerted = false
  if (evaluation.over) {
    // One open alert at a time — a daily cron would otherwise restate the same
    // overage every 24h. Resolve it (after trimming noise / bumping the plan)
    // to re-arm.
    const existing = await env.DB.prepare(
      `SELECT id FROM admin_alerts WHERE kind = 'sentry-quota' AND resolved_at IS NULL LIMIT 1`,
    ).first<{ id: string }>()
    if (!existing) {
      const body = `Sentry error usage is at ${Math.round(evaluation.pct * 100)}% of the monthly quota (${evaluation.used} / ${evaluation.quota} errors, last 30 days). Investigate the top issues in Sentry — a runaway error will exhaust the quota and start dropping events. Resolve this alert once usage is back under control or the quota is raised.`
      const id = `alrt_${randomTokenB64url(10)}`
      const now = Math.floor(Date.now() / 1000)
      await env.DB.prepare(
        `INSERT INTO admin_alerts (id, kind, body, created_at) VALUES (?, 'sentry-quota', ?, ?)`,
      )
        .bind(id, body, now)
        .run()
      alerted = true
    }
  }
  return { evaluation, alerted }
}
