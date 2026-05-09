// GET /api/capacity — public, unauthenticated. Returns active + triage counts
// straight from D1. Powers the homepage CapacityCounter and the intake form.
// The 1-active + 1-triage cap is the most important rule in the system; this
// endpoint is its source of truth (the static public/data/capacity.json fixture
// has been removed).

import type { Env } from '../_lib/env'
import { ok, serverError } from '../_lib/json'
import {
  ACTIVE_CAP,
  TRIAGE_CAP,
  countActiveAndTriage,
  isActiveAtCap,
  isTriageAtCap,
} from '../_lib/sessions'

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const counts = await countActiveAndTriage(env.DB)
    return ok({
      active: counts.active,
      triage: counts.triage,
      cap: ACTIVE_CAP, // legacy field — single number for the rare older caller
      activeCap: ACTIVE_CAP,
      triageCap: TRIAGE_CAP,
      atCap: isActiveAtCap(counts) || isTriageAtCap(counts),
    })
  } catch (err) {
    console.error('capacity query failed', err)
    return serverError('capacity query failed')
  }
}
