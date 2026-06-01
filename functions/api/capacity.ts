// GET /api/capacity — public, unauthenticated. Returns active + triage counts
// straight from D1. Powers the homepage hero pill, the studio sign, and the
// intake form. The active-build cap (ACTIVE_CAP) is the most important rule in
// the system; this endpoint is its read-side source of truth (the static
// public/data/capacity.json fixture has been removed). Triage is uncapped, so
// `triageCap` is reported as null and `atCap` reflects the active cap only.

import type { Env } from '../_lib/env'
import { ok, serverError } from '../_lib/json'
import { ACTIVE_CAP, countActiveAndTriage, isActiveAtCap } from '../_lib/sessions'

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const counts = await countActiveAndTriage(env.DB)
    return ok({
      active: counts.active,
      triage: counts.triage,
      cap: ACTIVE_CAP, // legacy field — single number for the rare older caller
      activeCap: ACTIVE_CAP,
      triageCap: null, // triage is uncapped; null means "no limit", not zero
      atCap: isActiveAtCap(counts),
    })
  } catch (err) {
    console.error('capacity query failed', err)
    return serverError('capacity query failed')
  }
}
