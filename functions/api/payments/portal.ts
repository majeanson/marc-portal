// POST /api/payments/portal — generate a Stripe Customer Portal session for
// the visitor's custodian subscription. Returns { url } to redirect to.
// Visitor must own the session; admin can portal-into any session.
//
// The Customer Portal is Stripe-hosted: lets the visitor update their card,
// view invoice history, cancel. Cancellation triggers the
// customer.subscription.deleted webhook, which flips custodian_status to
// 'switched_to_tout_a_toi' per the /handoff promise.

import { currentEmail } from '../../_lib/auth'
import type { Env } from '../../_lib/env'
import { isAdmin } from '../../_lib/env'
import { badRequest, notFound, ok, serviceUnavailable, unauthorized } from '../../_lib/json'
import { requireSessionAccess } from '../../_lib/sessions'
import { createBillingPortalSession } from '../../_lib/stripe'

interface PortalBody {
  sessionId?: string
  lang?: 'fr' | 'en'
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const email = await currentEmail(request, env.SESSION_SECRET)
  if (!email) return unauthorized()
  if (!env.STRIPE_SECRET_KEY) return serviceUnavailable('payments not configured')

  let body: PortalBody
  try {
    body = (await request.json()) as PortalBody
  } catch {
    return badRequest('invalid json')
  }
  const sessionId = body.sessionId
  const lang: 'fr' | 'en' = body.lang === 'en' ? 'en' : 'fr'
  if (typeof sessionId !== 'string' || !sessionId) return badRequest('sessionId required')

  // A deleted session has no live custodian subscription to portal into.
  // The session row isn't needed beyond the access check — the Stripe lookup
  // below keys off sessionId directly via payments.
  const viewer = { email, isAdmin: isAdmin(env, email) }
  const access = await requireSessionAccess(env.DB, sessionId, viewer, {
    softDeleted: 'hide-from-all',
  })
  if (access instanceof Response) return access

  // Find the Stripe customer id from the most recent paid sub payment row
  // for this session. If the visitor never paid, there's no portal to open.
  const sub = await env.DB.prepare(
    `SELECT stripe_customer_id
       FROM payments
      WHERE session_id = ?
        AND kind = 'custodian'
        AND stripe_customer_id IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 1`,
  )
    .bind(sessionId)
    .first<{ stripe_customer_id: string }>()
  if (!sub?.stripe_customer_id) return notFound('no subscription on this session')

  const origin = new URL(request.url).origin
  const langPath = lang === 'en' ? '/en' : ''
  const result = await createBillingPortalSession({
    apiKey: env.STRIPE_SECRET_KEY,
    customerId: sub.stripe_customer_id,
    returnUrl: `${origin}${langPath}/me`,
    lang,
  })
  return ok({ url: result.url })
}
