// GET /api/health — public, unauthenticated, no tenant lookup needed (caller
// can be anyone, including UptimeRobot or Marc's curl). Confirms the runtime
// is reachable and the D1 binding is alive with a SELECT 1.
//
// Returns:
//   { ok: true,  db: 'ok',   commit, ts }   when D1 responds
//   { ok: false, db: 'fail', commit, ts }   when D1 throws (status 500)
//
// `commit` is supplied at build time via the `__COMMIT_HASH__` define and is
// only available in the SPA, not Pages Functions; we re-read from request URL
// or omit it. To keep this dependency-free we omit it and rely on the SPA's
// build stamp for "what's deployed".

import type { Env } from '../_lib/env'
import { json } from '../_lib/json'

export const onRequest: PagesFunction<Env> = async ({ env }) => {
  const ts = Math.floor(Date.now() / 1000)
  let dbOk = false
  try {
    const r = await env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>()
    dbOk = r?.ok === 1
  } catch (err) {
    console.error('health: db query failed', err)
  }

  return json(
    {
      ok: dbOk,
      db: dbOk ? 'ok' : 'fail',
      ts,
    },
    { status: dbOk ? 200 : 500 },
  )
}
