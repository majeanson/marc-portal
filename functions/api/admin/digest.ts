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

interface DigestEnv extends Env {
  DIGEST_TOKEN?: string
}

const FROM = 'Marc Portal <noreply@marcportal.com>'
const SLA_THRESHOLD_SECONDS = 48 * 3600

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
  try {
    const orphanCutoff = now - 7 * 86_400
    interface OrphanRow {
      id: string
      r2_key: string
    }
    const orphans = await env.DB.prepare(
      `SELECT id, r2_key FROM attachments
       WHERE message_id IS NULL AND created_at < ?`,
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
      ? `${rows.length} session${rows.length === 1 ? '' : 's'} en triage depuis plus de 48h:\n\n${triageLines.join('\n')}\n`
      : ''
  const alertsBlock =
    alerts.length > 0
      ? `${alerts.length} alerte${alerts.length === 1 ? '' : 's'} opérateur non résolue${alerts.length === 1 ? '' : 's'} (fallback webhook):\n\n${alertLines.join('\n')}\n\nMarque comme résolue via D1: UPDATE admin_alerts SET resolved_at = unixepoch() WHERE id = '...';\n`
      : ''
  const text = [triageBlock, alertsBlock].filter(Boolean).join('\n')

  const triageHtml =
    rows.length > 0
      ? `<p><strong>${rows.length} session${rows.length === 1 ? '' : 's'}</strong> en triage depuis plus de 48h.</p>
<ul>
${rows
  .map((r) => {
    const ageH = Math.floor((now - r.created_at) / 3600)
    return `<li>${ageH}h · ${escapeHtml(r.email)} · <a href="${origin}/admin/inbox/${r.id}">ouvrir</a></li>`
  })
  .join('\n')}
</ul>`
      : ''
  const alertsHtml =
    alerts.length > 0
      ? `<p><strong>${alerts.length} alerte${alerts.length === 1 ? '' : 's'} opérateur</strong> non résolue${alerts.length === 1 ? '' : 's'} (fallback webhook Stripe → admin_alerts).</p>
<ul>
${alerts
  .map((a) => {
    const ageH = Math.floor((now - a.created_at) / 3600)
    return `<li>${ageH}h · <code>${escapeHtml(a.kind)}</code> · ${escapeHtml(a.body)}</li>`
  })
  .join('\n')}
</ul>
<p style="color:#666;font-size:13px">Marque comme résolue via D1 : <code>UPDATE admin_alerts SET resolved_at = unixepoch() WHERE id = '…';</code></p>`
      : ''
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;color:#1a1a1a">
${triageHtml}
${alertsHtml}
</body></html>`

  const subjectParts: string[] = []
  if (rows.length > 0) subjectParts.push(`${rows.length} en triage`)
  if (alerts.length > 0) subjectParts.push(`${alerts.length} alerte${alerts.length === 1 ? '' : 's'}`)
  const subject = `Digest — ${subjectParts.join(' · ')}`

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
