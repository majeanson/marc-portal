// GET /api/health           — public liveness probe; D1 reachability only.
// GET /api/health?deep=1    — admin-gated readiness probe; pings every
//                              configured external binding (R2, Resend,
//                              Stripe). Unconfigured bindings report
//                              'unconfigured' (not a failure). A bad
//                              upstream flips overall ok=false.
//
// The shallow probe stays public so uptime monitors (cron-job.org etc.) can
// hit it on a 5-minute cadence without burning external API quota. The deep
// probe is admin-gated for two reasons: it makes real upstream calls
// (Stripe / Resend), and an unauthenticated DDoS against it would translate
// directly into a Stripe + Resend bill. Use a separate weekly cron with
// Marc's admin cookie when automation is wanted.

import { currentEmail } from '../_lib/auth'
import type { Env } from '../_lib/env'
import { isAdmin } from '../_lib/env'
import { forbidden, json, unauthorized } from '../_lib/json'

interface ProbeResult {
  status: 'ok' | 'fail' | 'unconfigured'
  /** Round-trip latency for the probe call. Absent for 'unconfigured'. */
  latencyMs?: number
  /** Truncated error string on 'fail'. Absent on success. */
  error?: string
}

// Bound per-probe runtime so a hung upstream doesn't pin the worker.
const PROBE_TIMEOUT_MS = 5000

async function probeD1(env: Env): Promise<ProbeResult> {
  const t0 = Date.now()
  try {
    const r = await env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>()
    return r?.ok === 1
      ? { status: 'ok', latencyMs: Date.now() - t0 }
      : { status: 'fail', latencyMs: Date.now() - t0, error: 'unexpected result' }
  } catch (err) {
    return {
      status: 'fail',
      latencyMs: Date.now() - t0,
      error: errorToString(err),
    }
  }
}

async function probeR2(env: Env): Promise<ProbeResult> {
  if (!env.MEDIA) return { status: 'unconfigured' }
  const t0 = Date.now()
  try {
    // list({ limit: 1 }) is a metadata-only operation — no object bytes
    // transferred. Confirms the binding is reachable and credentials work.
    await env.MEDIA.list({ limit: 1 })
    return { status: 'ok', latencyMs: Date.now() - t0 }
  } catch (err) {
    return {
      status: 'fail',
      latencyMs: Date.now() - t0,
      error: errorToString(err),
    }
  }
}

async function probeResend(env: Env): Promise<ProbeResult> {
  if (!env.RESEND_API_KEY) return { status: 'unconfigured' }
  const t0 = Date.now()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS)
  try {
    // GET /domains validates the API key and returns a small JSON listing.
    // 401 on bad key, 200 on good. No quota cost beyond a regular API call.
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` },
      signal: ctrl.signal,
    })
    if (res.ok) return { status: 'ok', latencyMs: Date.now() - t0 }
    return {
      status: 'fail',
      latencyMs: Date.now() - t0,
      error: `${res.status}`,
    }
  } catch (err) {
    return {
      status: 'fail',
      latencyMs: Date.now() - t0,
      error: errorToString(err),
    }
  } finally {
    clearTimeout(timer)
  }
}

async function probeStripe(env: Env): Promise<ProbeResult> {
  if (!env.STRIPE_SECRET_KEY) return { status: 'unconfigured' }
  // E2E sentinel keys (see _lib/stripe.ts) are intentionally invalid —
  // reporting them as 'fail' on a deep probe would generate noise in the
  // e2e harness. Treat the stub as unconfigured.
  if (env.STRIPE_SECRET_KEY === 'sk_test_e2e_stub') return { status: 'unconfigured' }
  const t0 = Date.now()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS)
  try {
    // GET /v1/balance is the canonical "is the key live?" probe — tiny
    // response, no side effects, no quota cost.
    const res = await fetch('https://api.stripe.com/v1/balance', {
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
      signal: ctrl.signal,
    })
    if (res.ok) return { status: 'ok', latencyMs: Date.now() - t0 }
    return {
      status: 'fail',
      latencyMs: Date.now() - t0,
      error: `${res.status}`,
    }
  } catch (err) {
    return {
      status: 'fail',
      latencyMs: Date.now() - t0,
      error: errorToString(err),
    }
  } finally {
    clearTimeout(timer)
  }
}

function errorToString(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.slice(0, 200)
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const ts = Math.floor(Date.now() / 1000)
  const url = new URL(request.url)
  const wantDeep = url.searchParams.get('deep') === '1'

  // Shallow probe — public, D1 only.
  if (!wantDeep) {
    const db = await probeD1(env)
    const dbOk = db.status === 'ok'
    return json({ ok: dbOk, db: dbOk ? 'ok' : 'fail', ts }, { status: dbOk ? 200 : 500 })
  }

  // Deep probe — admin-gated. The probes themselves are cheap individually
  // but multiply across a DDoS, and they cost real upstream API budget.
  // Same auth shape as the other /admin endpoints.
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()
  if (!isAdmin(env, email)) return forbidden()

  // Probes run in parallel — they're independent and the total wall-clock
  // is bounded by the slowest. PROBE_TIMEOUT_MS keeps a hung upstream from
  // pinning the worker past its CPU budget.
  const [db, r2, resend, stripe] = await Promise.all([
    probeD1(env),
    probeR2(env),
    probeResend(env),
    probeStripe(env),
  ])

  // Overall ok = every configured probe is 'ok'. 'unconfigured' is neutral —
  // a portal without Stripe set up isn't broken, the payment endpoints
  // already return 503 in that state.
  const allOk = [db, r2, resend, stripe].every(
    (p) => p.status === 'ok' || p.status === 'unconfigured',
  )
  return json(
    {
      ok: allOk,
      ts,
      db: db.status === 'ok' ? 'ok' : 'fail',
      deep: { db, r2, resend, stripe },
    },
    { status: allOk ? 200 : 500 },
  )
}
