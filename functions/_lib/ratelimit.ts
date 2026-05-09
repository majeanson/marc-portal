// Tiny D1-backed token-bucket-ish rate limiter. One row per (endpoint, actor)
// bucket; `count` increments inside a window of `windowSec` seconds. When a
// new request arrives after the window expired, the row resets to count=1.
//
// This is best-effort: D1 has no row locks, so two concurrent requests can
// both pass. Acceptable for our limits, which are about throttling abuse —
// not enforcing exact billing.

import type { Env } from './env'

interface Row {
  count: number
  window_start: number
}

/** Returns true if the request is within limits, false if it should be rejected. */
export async function rateLimitCheck(
  env: Env,
  bucketKey: string,
  limit: number,
  windowSec: number,
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000)
  const row = await env.DB.prepare('SELECT count, window_start FROM rate_limits WHERE key = ?')
    .bind(bucketKey)
    .first<Row>()

  if (!row || now - row.window_start >= windowSec) {
    await env.DB.prepare(
      'INSERT OR REPLACE INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)',
    )
      .bind(bucketKey, now)
      .run()
    return true
  }

  if (row.count >= limit) return false

  await env.DB.prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ?')
    .bind(bucketKey)
    .run()
  return true
}

/**
 * Best-effort prune of rows older than 24h. Cheap to call from any handler
 * (one DELETE with an indexed range). We avoid a cron path by sweeping
 * opportunistically — every Nth request shoulders the cost.
 */
export async function rateLimitSweep(env: Env, oddsDenominator = 50): Promise<void> {
  if (Math.random() * oddsDenominator >= 1) return
  const cutoff = Math.floor(Date.now() / 1000) - 86_400
  await env.DB.prepare('DELETE FROM rate_limits WHERE window_start < ?').bind(cutoff).run()
}

export function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ?? 'unknown'
}
