// POST /api/admin/test-emails — operator-only diagnostic. Fires one of every
// outbound email type at the signed-in admin's address, exactly as a real
// recipient would receive it. Synthetic sample data — no production rows
// are read or touched. Lets Marc eyeball deliverability, rendering, voice
// across the whole catalog without walking the matching user flow.
//
// Auth: signed-in cookie + ADMIN_EMAILS gate (same pattern as
// /api/admin/audit). CSRF is enforced centrally by _middleware.ts.
//
// Pacing: sends are sequential with a ~600 ms gap. Resend's free tier
// caps at 2 req/s; 12 sends × ~600 ms = ~7 s, well inside Pages
// Functions' 30 s wall-time budget.

import { currentEmail } from '../../_lib/auth'
import type { Env } from '../../_lib/env'
import { isAdmin } from '../../_lib/env'
import { badRequest, forbidden, ok, serviceUnavailable, unauthorized } from '../../_lib/json'
import {
  sendAdminAlert,
  sendAllYoursAckNotification,
  sendInstallmentClearedPrompt,
  sendIntakeEditedNotification,
  sendMagicLink,
  sendMarcMessageNotification,
  sendNewVouchNotification,
  sendRefundNotice,
  sendStatusChangeNotification,
  sendTierAssignedNotification,
  sendVisitorMessageNotification,
  sendWithdrawalNotification,
  type Lang,
} from '../../_lib/email'

interface ReqBody {
  lang?: Lang
}

interface TestResult {
  kind: string
  delivered: boolean
}

const PACING_MS = 600

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const email = await currentEmail(ctx.request, ctx.env.SESSION_SECRET)
  if (!email) return unauthorized()
  if (!isAdmin(ctx.env, email)) return forbidden('not an operator')

  if (!ctx.env.RESEND_API_KEY) {
    return serviceUnavailable('email transport not configured')
  }

  let body: ReqBody = {}
  try {
    body = (await ctx.request.json()) as ReqBody
  } catch {
    return badRequest('invalid json body')
  }

  const lang: Lang = body.lang === 'en' ? 'en' : 'fr'
  const origin = new URL(ctx.request.url).origin
  // All public send fns now take `env` instead of raw apiKey; the env
  // shape exposes DB + ADMIN_EMAILS + SESSION_SECRET that the suppression
  // check + unsubscribe headers need.
  const env = ctx.env

  // Synthetic identifiers — shaped like real ones (UUID-ish, plausible
  // names) so the rendered emails read like the production article.
  const sessionId = 'test-session-id'
  const vouchId = 'test-vouch-id'
  const sampleVisitor = 'sophie.tremblay@exemple.ca'
  const sampleName = 'Sophie Tremblay'
  const magicLinkUrl = `${origin}${lang === 'en' ? '/en' : ''}/login?token=test-token`
  const visitorPreview =
    lang === 'fr'
      ? 'Salut Marc, je veux savoir si ton service peut m’aider avec un site WordPress qui rame.'
      : 'Hi Marc, wondering if your service can help with a slow WordPress site.'
  const marcPreview =
    lang === 'fr'
      ? 'Je peux regarder ça demain matin. On commence par le hosting.'
      : "Can take a look tomorrow morning. We'll start with the hosting."
  const vouchBody =
    lang === 'fr'
      ? 'Marc a livré ma refonte en une fin de semaine, exactement comme promis.'
      : 'Marc shipped my redesign in a weekend, exactly as promised.'
  const alertBody =
    lang === 'fr'
      ? 'Abonnement Custodian Care annulé pour sophie@exemple.ca — webhook customer.subscription.deleted reçu.'
      : 'Custodian Care subscription canceled for sophie@example.ca — received customer.subscription.deleted webhook.'

  const tasks: Array<{ kind: string; run: () => Promise<{ ok: boolean }> }> = [
    { kind: 'magic-link', run: () => sendMagicLink(env, email, magicLinkUrl, lang) },
    {
      kind: 'visitor-message',
      run: () =>
        sendVisitorMessageNotification(
          env,
          email,
          sampleVisitor,
          sessionId,
          origin,
          visitorPreview,
          lang,
        ),
    },
    {
      kind: 'marc-reply',
      run: () => sendMarcMessageNotification(env, email, sessionId, origin, marcPreview, lang),
    },
    {
      kind: 'status-change',
      run: () =>
        sendStatusChangeNotification(env, email, sessionId, 'triage', 'active', origin, lang),
    },
    {
      kind: 'intake-edited',
      run: () => sendIntakeEditedNotification(env, email, sampleVisitor, sessionId, origin, lang),
    },
    {
      kind: 'withdrawal-admin',
      run: () =>
        sendWithdrawalNotification(env, email, sampleVisitor, sessionId, origin, lang, 'admin'),
    },
    {
      kind: 'withdrawal-visitor',
      run: () =>
        sendWithdrawalNotification(env, email, sampleVisitor, sessionId, origin, lang, 'visitor'),
    },
    {
      kind: 'installment-cleared',
      run: () => sendInstallmentClearedPrompt(env, email, sessionId, 1, 3, origin, lang),
    },
    {
      kind: 'tier-assigned',
      run: () => sendTierAssignedNotification(env, email, sessionId, 2, 180000, origin, lang),
    },
    {
      kind: 'new-vouch',
      run: () =>
        sendNewVouchNotification(
          env,
          email,
          vouchId,
          sampleName,
          sampleVisitor,
          lang === 'fr' ? 'cliente' : 'client',
          vouchBody,
          origin,
          lang,
        ),
    },
    {
      kind: 'admin-alert',
      run: () => sendAdminAlert(env, email, origin, alertBody, lang),
    },
    {
      kind: 'all-yours-ack',
      run: () => sendAllYoursAckNotification(env, email, sampleVisitor, sessionId, origin, lang),
    },
    {
      kind: 'refund-notice',
      run: () => sendRefundNotice(env, email, 30000, 60000, origin, lang),
    },
  ]

  const results: TestResult[] = []
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]
    let delivered = false
    try {
      delivered = (await task.run()).ok
    } catch {
      delivered = false
    }
    results.push({ kind: task.kind, delivered })
    if (i < tasks.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, PACING_MS))
    }
  }

  return ok({ recipient: email, lang, results })
}
