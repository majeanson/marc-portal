// POST /api/admin/digest — emails Marc a summary of any triage rows older than
// 48h AND any open admin_alerts (unresolved Stripe-notification fallbacks).
// Designed to be called once a day by a free external cron (cron-job.org,
// CF Workers cron via a separate worker, etc.) — Pages Functions don't have
// scheduled triggers natively.
//
// Auth: requires the X-Digest-Token header to match env.DIGEST_TOKEN. We don't
// gate by visitor cookie because no human is calling this. Idempotent — calling
// twice in the same hour just sends two emails.
//
// admin_alerts surfacing: the webhook's maybeNotifyAdmin() writes a row when
// Resend fails, so a Stripe sub-cancel during a Resend outage doesn't vanish.
// The digest includes all rows where resolved_at IS NULL — there is currently
// no UI to mark resolved, so any insert lives until manually cleared in D1
// (acceptable for the volume — low single digits per year at most).

import type { Env } from '../../_lib/env'
import { primaryAdminEmail } from '../../_lib/sessions'
import type { SessionRow } from '../../_lib/sessions'
import { ok, serverError, unauthorized } from '../../_lib/json'
import { getLang } from '../../_lib/userPrefs'
import { sweepEmailOutbox } from '../../_lib/email'

interface DigestEnv extends Env {
  DIGEST_TOKEN?: string
}

const FROM = 'Marc <noreply@marcportal.com>'
const SLA_THRESHOLD_SECONDS = 48 * 3600

// Tiny FR/EN copy bank — the digest doesn't go through renderEmail()
// because it's the one place where the body is a dynamically-sized list,
// not a static layout. The copy still matches the warm voice.
const COPY = {
  fr: {
    triageHeading: 'En triage depuis plus de 48h',
    triageOne: 'session',
    triageMany: 'sessions',
    triageOpen: 'ouvrir',
    alertsHeading: 'Alertes opérateur (fallback webhook)',
    alertOne: 'alerte non résolue',
    alertMany: 'alertes non résolues',
    alertResolveHelp: 'Marque comme résolue via D1 :',
    subjectPrefix: 'Digest',
    subjectTriage: (n: number) => `${n} en triage`,
    subjectAlerts: (n: number) => `${n} alerte${n === 1 ? '' : 's'}`,
  },
  en: {
    triageHeading: 'In triage for more than 48h',
    triageOne: 'session',
    triageMany: 'sessions',
    triageOpen: 'open',
    alertsHeading: 'Operator alerts (webhook fallbacks)',
    alertOne: 'unresolved alert',
    alertMany: 'unresolved alerts',
    alertResolveHelp: 'Mark resolved via D1:',
    subjectPrefix: 'Digest',
    subjectTriage: (n: number) => `${n} in triage`,
    subjectAlerts: (n: number) => `${n} alert${n === 1 ? '' : 's'}`,
  },
} as const

export const onRequestPost: PagesFunction<DigestEnv> = async ({ request, env }) => {
  const supplied = request.headers.get('X-Digest-Token') ?? ''
  if (!env.DIGEST_TOKEN || supplied !== env.DIGEST_TOKEN) {
    return unauthorized('invalid digest token')
  }

  const now = Math.floor(Date.now() / 1000)
  const cutoff = now - SLA_THRESHOLD_SECONDS

  // Piggyback housekeeping: prune magic-link tokens older than 24h. Used
  // tokens never expire on their own; the rate-limit query scans this table
  // every request, so it must stay small. Errors here don't fail the digest —
  // the inbox-nudge is the user-facing value, cleanup is best-effort.
  try {
    const tokenCutoff = now - 86_400
    const result = await env.DB.prepare(`DELETE FROM magic_link_tokens WHERE created_at < ?`)
      .bind(tokenCutoff)
      .run()
    if (result.meta && typeof result.meta.changes === 'number' && result.meta.changes > 0) {
      console.log(`digest: pruned ${result.meta.changes} expired magic-link tokens`)
    }
  } catch (err) {
    console.warn('digest: token cleanup failed (continuing)', err)
  }

  // Piggyback housekeeping #1b: cancel stale pending payments. A visitor who
  // clicks Pay and then closes the tab leaves a 'pending' payments row that
  // will never resolve (no Stripe webhook arrives without a completed
  // Checkout). Without sweeping, AdminBilling fills with orphans over time.
  // 24h is well past Stripe's Checkout session expiry (24h by default).
  try {
    const pendingCutoff = now - 86_400
    const result = await env.DB.prepare(
      `UPDATE payments SET status = 'canceled' WHERE status = 'pending' AND created_at < ?`,
    )
      .bind(pendingCutoff)
      .run()
    if (result.meta && typeof result.meta.changes === 'number' && result.meta.changes > 0) {
      console.log(`digest: canceled ${result.meta.changes} stale pending payment row(s)`)
    }
  } catch (err) {
    console.warn('digest: pending-payments reap failed (continuing)', err)
  }

  // Piggyback housekeeping #1c: prune webhook_events older than 30 days.
  // The dedupe table only needs to cover Stripe's retry window (3 days
  // worst case); 30d gives us audit headroom without unbounded growth.
  try {
    const webhookCutoff = now - 30 * 86_400
    const result = await env.DB.prepare(`DELETE FROM webhook_events WHERE received_at < ?`)
      .bind(webhookCutoff)
      .run()
    if (result.meta && typeof result.meta.changes === 'number' && result.meta.changes > 0) {
      console.log(`digest: pruned ${result.meta.changes} webhook_events row(s)`)
    }
  } catch (err) {
    console.warn('digest: webhook_events prune failed (continuing)', err)
  }

  // Piggyback housekeeping #2: prune orphan attachment uploads (message_id
  // IS NULL) older than 7 days. Visitors who upload but never send a message
  // leave R2 + DB rows behind; this sweep reclaims them. R2 objects are
  // deleted alongside the DB row so we don't leak storage.
  //
  // `kind = 'napkin'` is excluded: napkin attachments are session-scoped by
  // design (one per session, never linked to a message), so they would
  // otherwise be eligible for sweep the moment they age out. The napkin
  // belongs to the intake — it stays alive as long as the session does, and
  // is erased via /api/me's cascade when the visitor erases their data.
  try {
    const orphanCutoff = now - 7 * 86_400
    interface OrphanRow {
      id: string
      r2_key: string
    }
    const orphans = await env.DB.prepare(
      `SELECT id, r2_key FROM attachments
       WHERE message_id IS NULL AND kind != 'napkin' AND created_at < ?`,
    )
      .bind(orphanCutoff)
      .all<OrphanRow>()
    const rows = orphans.results ?? []
    let pruned = 0
    for (const o of rows) {
      // R2 first — if we drop the DB row but fail to delete the R2 object,
      // we can no longer find the orphan. Inverse failure (R2 OK, DB fail)
      // is recoverable by the next sweep.
      try {
        if (env.MEDIA) await env.MEDIA.delete(o.r2_key)
      } catch (err) {
        console.warn('digest: r2 delete failed for', o.r2_key, err)
        continue
      }
      await env.DB.prepare(`DELETE FROM attachments WHERE id = ?`).bind(o.id).run()
      pruned++
    }
    if (pruned > 0) {
      console.log(`digest: pruned ${pruned} orphan attachment(s)`)
    }
  } catch (err) {
    console.warn('digest: attachment cleanup failed (continuing)', err)
  }

  // Piggyback housekeeping #3: sweep the email outbox (AUDIT P1.3). Durable
  // notices (tier-assigned, refund, installment-cleared, status-change,
  // visitor-withdrawal) write to `email_outbox` when Resend fails at the
  // moment of send. The sweeper does three things: retry pending rows,
  // alert Marc on rows that JUST hit OUTBOX_MAX_ATTEMPTS (stuck queue),
  // and prune delivered rows past OUTBOX_DELIVERED_TTL_SECONDS. Errors
  // don't fail the triage digest — outbox is secondary.
  try {
    const marc = primaryAdminEmail(env.ADMIN_EMAILS)
    const marcLang = marc ? await getLang(env.DB, marc) : 'fr'
    const origin = new URL(request.url).origin
    const r = await sweepEmailOutbox(env, now, marc, origin, marcLang)
    if (r.retried > 0 || r.alerted > 0 || r.pruned > 0) {
      console.log(
        `digest: outbox sweep — retried ${r.retried}, delivered ${r.delivered}, ` +
          `failed ${r.failed}, alerted ${r.alerted}, pruned ${r.pruned}`,
      )
    }
  } catch (err) {
    console.warn('digest: outbox sweep failed (continuing)', err)
  }

  let rows: SessionRow[] = []
  try {
    const res = await env.DB.prepare(
      `SELECT id, email, intake_json, status, created_at, updated_at, deleted_at, status_history,
              showcased_at, showcase_title, showcase_tagline
         FROM sessions
        WHERE status = 'triage'
          AND deleted_at IS NULL
          AND created_at < ?
        ORDER BY created_at ASC`,
    )
      .bind(cutoff)
      .all<SessionRow>()
    rows = res.results ?? []
  } catch (err) {
    console.error('digest: query failed', err)
    return serverError('digest query failed')
  }

  // Pull unresolved admin_alerts (webhook fallbacks when Resend was down).
  // Failure here doesn't abort the triage digest — alerts are a secondary
  // signal; missing them once is recoverable on the next run.
  interface AlertRow {
    id: string
    kind: string
    body: string
    created_at: number
  }
  let alerts: AlertRow[] = []
  try {
    const res = await env.DB.prepare(
      `SELECT id, kind, body, created_at
         FROM admin_alerts
        WHERE resolved_at IS NULL
        ORDER BY created_at ASC`,
    ).all<AlertRow>()
    alerts = res.results ?? []
  } catch (err) {
    console.warn('digest: admin_alerts query failed (continuing without)', err)
  }

  if (rows.length === 0 && alerts.length === 0) {
    // Nothing to nudge about — silently return 200 so cron logs stay clean.
    return ok({ sent: false, count: 0, alerts: 0 })
  }

  const marc = primaryAdminEmail(env.ADMIN_EMAILS)
  if (!marc) {
    return ok({ sent: false, count: rows.length, alerts: alerts.length, reason: 'no admin email' })
  }

  const origin = new URL(request.url).origin
  const lang = await getLang(env.DB, marc)
  const t = COPY[lang]

  const triageLines = rows.map((r) => {
    const ageH = Math.floor((now - r.created_at) / 3600)
    return `• ${ageH}h · ${r.email} · ${origin}/admin/inbox/${r.id}`
  })
  const alertLines = alerts.map((a) => {
    const ageH = Math.floor((now - a.created_at) / 3600)
    return `• ${ageH}h · [${a.kind}] ${a.body}`
  })
  const triageBlock =
    rows.length > 0
      ? `${rows.length} ${rows.length === 1 ? t.triageOne : t.triageMany} — ${t.triageHeading}:\n\n${triageLines.join('\n')}\n`
      : ''
  const alertsBlock =
    alerts.length > 0
      ? `${alerts.length} ${alerts.length === 1 ? t.alertOne : t.alertMany} (${t.alertsHeading}):\n\n${alertLines.join('\n')}\n\n${t.alertResolveHelp} UPDATE admin_alerts SET resolved_at = unixepoch() WHERE id = '...';\n`
      : ''
  const text = [triageBlock, alertsBlock].filter(Boolean).join('\n')

  const triageHtml =
    rows.length > 0
      ? `<h2 style="margin:0 0 12px 0;color:#1f1d1a;font-size:18px;">${t.triageHeading}</h2>
<p style="margin:0 0 12px 0;color:#1f1d1a;"><strong>${rows.length}</strong> ${rows.length === 1 ? t.triageOne : t.triageMany}.</p>
<ul style="margin:0 0 18px 0;padding-left:20px;color:#3f3c34;line-height:1.7;">
${rows
  .map((r) => {
    const ageH = Math.floor((now - r.created_at) / 3600)
    return `<li>${ageH}h · ${escapeHtml(r.email)} · <a href="${origin}/admin/inbox/${r.id}" style="color:#3d6e4e;">${t.triageOpen}</a></li>`
  })
  .join('\n')}
</ul>`
      : ''
  const alertsHtml =
    alerts.length > 0
      ? `<h2 style="margin:18px 0 12px 0;color:#1f1d1a;font-size:18px;">${t.alertsHeading}</h2>
<p style="margin:0 0 12px 0;color:#1f1d1a;"><strong>${alerts.length}</strong> ${alerts.length === 1 ? t.alertOne : t.alertMany}.</p>
<ul style="margin:0 0 18px 0;padding-left:20px;color:#3f3c34;line-height:1.7;">
${alerts
  .map((a) => {
    const ageH = Math.floor((now - a.created_at) / 3600)
    return `<li>${ageH}h · <code style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#5a554b;">${escapeHtml(a.kind)}</code> · ${escapeHtml(a.body)}</li>`
  })
  .join('\n')}
</ul>
<p style="color:#8a8478;font-size:13px;line-height:1.5;">${t.alertResolveHelp} <code style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;">UPDATE admin_alerts SET resolved_at = unixepoch() WHERE id = '…';</code></p>`
      : ''
  const html = `<!doctype html>
<html lang="${lang}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5efe3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:#fffaf2;border-radius:14px;overflow:hidden;box-shadow:0 12px 30px rgba(36,30,20,0.08);">
      <div style="background:linear-gradient(135deg,#fbf7ec 0%,#fadfb8 45%,#cfdfd1 100%);padding:24px 28px;">
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#2a2a26;">marc<span style="color:#d97706;">.</span></div>
        <div style="margin-top:6px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#7a7568;font-weight:600;">${t.subjectPrefix}</div>
      </div>
      <div style="padding:24px 28px;">
        ${triageHtml}
        ${alertsHtml}
      </div>
    </div>
  </div>
</body>
</html>`

  const subjectParts: string[] = []
  if (rows.length > 0) subjectParts.push(t.subjectTriage(rows.length))
  if (alerts.length > 0) subjectParts.push(t.subjectAlerts(alerts.length))
  const subject = `${t.subjectPrefix} — ${subjectParts.join(' · ')}`

  // Best-effort send. If Resend is down we still return 200 so the cron job
  // sees the call as successful and doesn't retry into a backoff loop.
  let mailSent = false
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: marc,
        subject,
        text,
        html,
      }),
    })
    mailSent = res.ok
    if (!res.ok) console.error('digest: resend send failed', res.status, await res.text())
  } catch (err) {
    console.error('digest: resend send threw', err)
  }

  return ok({ sent: mailSent, count: rows.length, alerts: alerts.length })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
