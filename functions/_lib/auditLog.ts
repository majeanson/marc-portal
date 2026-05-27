// audit_log writer.
//
// The audit_log table (migration 0002) was append-only by design but had no
// active write site — read-only AdminAudit was rendering an empty feed. This
// helper closes the loop: every mutation that wants to surface in
// /admin/audit calls appendAuditLog with an action label + a JSON payload.
//
// Best-effort: a D1 hiccup here does NOT fail the parent mutation. The
// payload IS the contract — the read endpoint just returns whatever
// landed. Keep payload shapes small and human-readable; payload columns are
// indexed by ts only, so a stable shape is more valuable than a dense one.
//
// PII discipline: don't write the body of a visitor message, the full
// intake_json, or the decline_note text. Capture the FACT of the change
// (hadNote: true → hasNote: false) without leaking content.

import { randomTokenB64url } from './bytes'

export interface AppendAuditLogArgs {
  actorEmail: string
  /** From `ctx.data.tenant?.id` when available; null otherwise. The read
   *  endpoint doesn't filter by tenant yet, so null is acceptable on
   *  pre-migration envs and on single-tenant deployments. */
  tenantId: string | null
  /** A stable, dotted label like `session.status` or `session.tier4_amount`.
   *  AdminAudit's filter UI does substring search on this. */
  action: string
  /** JSON-serializable. We stringify here so callers can pass plain
   *  objects without wrapping. */
  payload: unknown
}

interface AuditLogEnv {
  DB: D1Database
}

/**
 * Append a single row to audit_log. Best-effort: catches errors and logs
 * them. The mutation that triggered the audit entry has already succeeded
 * by the time this runs — a logging failure must not be visible upstream.
 */
export async function appendAuditLog(env: AuditLogEnv, args: AppendAuditLogArgs): Promise<void> {
  try {
    const id = `aud_${randomTokenB64url(10)}`
    const ts = Math.floor(Date.now() / 1000)
    const payloadStr = args.payload === undefined ? null : JSON.stringify(args.payload)
    await env.DB.prepare(
      `INSERT INTO audit_log (id, ts, actor_email, tenant_id, action, payload)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, ts, args.actorEmail, args.tenantId, args.action, payloadStr)
      .run()
  } catch (err) {
    // No throw — the parent mutation has already committed.
    console.error('audit_log insert failed', err)
  }
}
