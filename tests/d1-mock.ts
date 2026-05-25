/**
 * Tiny in-memory D1 mock — enough surface to satisfy the prepared-statement
 * pattern used in our handlers (`db.prepare(sql).bind(...args).first/all/run()`).
 *
 * It is NOT a full SQL engine. It pattern-matches the specific SQL statements
 * our codebase uses. When new SQL is added, the matcher list grows.
 *
 * Each "table" is a Map of rows (row key is the primary key string), with
 * arrays for ordering/filtering. Tests can seed via `db._tables.<name>.set(id, row)`.
 */

import type { D1Database, D1PreparedStatement, D1Result } from '@cloudflare/workers-types'

interface SessionRowMock {
  id: string
  email: string
  intake_json: string | null
  status: string
  created_at: number
  updated_at: number
  deleted_at: number | null
  status_history: string | null
  showcased_at: number | null
  showcase_title: string | null
  showcase_tagline: string | null
  tier?: number | null
  tier4_amount_cents?: number | null
  tier3_split?: string | null
  custodian_status?: string | null
  custodian_subscription_id?: string | null
  custodian_plan?: string | null
  all_yours_acknowledged_at?: number | null
  community_discount?: number
}

interface PaymentRowMock {
  id: string
  session_id: string
  kind: string
  tier?: number | null
  installment_index?: number | null
  installment_of?: number | null
  custodian_plan?: string | null
  amount_cents: number
  currency: string
  status: string
  stripe_checkout_session_id: string | null
  stripe_payment_intent_id: string | null
  stripe_subscription_id: string | null
  stripe_invoice_id: string | null
  stripe_customer_id: string | null
  stripe_charge_id?: string | null
  created_at: number
  paid_at: number | null
  refunded_at?: number | null
  refunded_amount_cents?: number
  failure_reason?: string | null
}

interface MessageRowMock {
  id: string
  session_id: string
  author: string
  body: string
  created_at: number
}

interface AttachmentRowMock {
  id: string
  session_id: string
  message_id: string | null
  uploaded_by: string
  filename: string
  content_type: string
  size: number
  r2_key: string
  created_at: number
  /** Mirrors AttachmentKind in functions/_lib/attachments.ts. Defaults to
   *  'file' so existing tests that omit it keep working — same shape as the
   *  real schema's DEFAULT 'file'. */
  kind?: string
  /** Voice notes only; left unset for everything else. */
  transcript?: string | null
}

interface RateLimitRowMock {
  key: string
  count: number
  window_start: number
}

interface MagicLinkRowMock {
  token: string
  email: string
  expires_at: number
  used_at: number | null
  created_at: number
  ip: string
}

interface WebhookEventRowMock {
  event_id: string
  event_type: string
  received_at: number
}

interface AdminAlertRowMock {
  id: string
  kind: string
  body: string
  created_at: number
  resolved_at: number | null
}

interface VouchRowMock {
  id: string
  author_name: string
  author_email: string
  author_relationship: string
  body: string
  link_url: string | null
  session_id: string | null
  status: string
  created_at: number
  approved_at: number | null
  deleted_at: number | null
}

interface UserPrefRowMock {
  email: string
  lang: string
  first_name: string | null
  updated_at: number
}

interface EmailEventRowMock {
  id: string
  to_email: string
  type: string
  subtype: string | null
  payload: string
  received_at: number
}

interface EmailOutboxRowMock {
  id: string
  to_email: string
  subject: string
  html: string
  text_body: string
  kind: string
  created_at: number
  attempts: number
  last_attempt: number | null
  last_error: string | null
  sent_at: number | null
}

export class D1Mock {
  sessions = new Map<string, SessionRowMock>()
  messages = new Map<string, MessageRowMock>()
  attachments = new Map<string, AttachmentRowMock>()
  rate_limits = new Map<string, RateLimitRowMock>()
  magic_link_tokens = new Map<string, MagicLinkRowMock>()
  payments = new Map<string, PaymentRowMock>()
  webhook_events = new Map<string, WebhookEventRowMock>()
  admin_alerts = new Map<string, AdminAlertRowMock>()
  vouches = new Map<string, VouchRowMock>()
  user_prefs = new Map<string, UserPrefRowMock>()
  email_outbox = new Map<string, EmailOutboxRowMock>()
  email_events = new Map<string, EmailEventRowMock>()

  prepare(sql: string): MockPreparedStatement {
    return new MockPreparedStatement(this, sql, [])
  }

  async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    const results: D1Result<T>[] = []
    for (const s of statements) {
      const r = await (s as unknown as MockPreparedStatement).run()
      results.push(r as unknown as D1Result<T>)
    }
    return results
  }

  // Unused stubs — present so the mock satisfies D1Database structurally.
  async dump(): Promise<ArrayBuffer> {
    return new ArrayBuffer(0)
  }
  async exec(): Promise<{ count: number; duration: number }> {
    return { count: 0, duration: 0 }
  }
  withSession(): D1Database {
    return this as unknown as D1Database
  }
}

class MockPreparedStatement {
  constructor(
    private db: D1Mock,
    private sql: string,
    private args: unknown[],
  ) {}

  bind(...args: unknown[]): MockPreparedStatement {
    return new MockPreparedStatement(this.db, this.sql, args)
  }

  async first<T = unknown>(): Promise<T | null> {
    const rows = this.execute()
    return (rows[0] as T) ?? null
  }

  async all<T = unknown>(): Promise<{ results: T[] }> {
    return { results: this.execute() as T[] }
  }

  async run(): Promise<{ success: true; meta: { changes: number } }> {
    const changes = this.executeMutation()
    return { success: true, meta: { changes } }
  }

  async raw(): Promise<unknown[][]> {
    return []
  }

  // The query dispatcher. Pattern-matches each SQL string our handlers use.
  // Order matters: more specific patterns first.
  private execute(): Record<string, unknown>[] {
    const sql = norm(this.sql)
    const a = this.args

    // SELECT from rate_limits
    if (sql.includes('SELECT count, window_start FROM rate_limits WHERE key = ?')) {
      const row = this.db.rate_limits.get(a[0] as string)
      return row ? [{ count: row.count, window_start: row.window_start }] : []
    }

    // SELECT COUNT(*) FROM magic_link_tokens WHERE (email = ? OR ip = ?) AND created_at > ?
    if (
      sql.includes('FROM magic_link_tokens') &&
      sql.includes('SELECT COUNT(*)') &&
      sql.includes('email = ? OR ip = ?')
    ) {
      const email = a[0] as string
      const ip = a[1] as string
      const since = a[2] as number
      let n = 0
      for (const r of this.db.magic_link_tokens.values()) {
        if ((r.email === email || r.ip === ip) && r.created_at > since) n++
      }
      return [{ n }]
    }

    // SELECT SUM(CASE WHEN email = ? ...) AS emailCount,
    //        SUM(CASE WHEN ip = ? ...) AS ipCount
    //   FROM magic_link_tokens WHERE created_at > ?
    // — used by request-link.ts for the dual independent ceilings.
    if (
      sql.includes('FROM magic_link_tokens') &&
      sql.includes('SUM(CASE WHEN email = ?') &&
      sql.includes('SUM(CASE WHEN ip = ?')
    ) {
      const email = a[0] as string
      const ip = a[1] as string
      const since = a[2] as number
      let emailCount = 0
      let ipCount = 0
      for (const r of this.db.magic_link_tokens.values()) {
        if (r.created_at <= since) continue
        if (r.email === email) emailCount++
        if (r.ip === ip) ipCount++
      }
      return [{ emailCount, ipCount }]
    }

    // SELECT token, email, expires_at, used_at FROM magic_link_tokens WHERE token = ?
    if (
      sql.includes('FROM magic_link_tokens WHERE token = ?') &&
      sql.includes('SELECT token, email')
    ) {
      const r = this.db.magic_link_tokens.get(a[0] as string)
      return r
        ? [
            {
              token: r.token,
              email: r.email,
              expires_at: r.expires_at,
              used_at: r.used_at,
            },
          ]
        : []
    }

    // SELECT status, COUNT(*) AS n FROM sessions WHERE status IN ('active', 'triage')
    // AND deleted_at IS NULL [AND id != ?] GROUP BY status
    if (
      sql.includes('FROM sessions') &&
      sql.includes("status IN ('active', 'triage')") &&
      sql.includes('deleted_at IS NULL') &&
      sql.includes('GROUP BY status')
    ) {
      const excludeId = sql.includes('id != ?') ? (a[0] as string) : null
      const buckets = { active: 0, triage: 0 }
      for (const s of this.db.sessions.values()) {
        if (s.deleted_at !== null) continue
        if (excludeId && s.id === excludeId) continue
        if (s.status === 'active') buckets.active++
        else if (s.status === 'triage') buckets.triage++
      }
      const out: Record<string, unknown>[] = []
      if (buckets.active > 0) out.push({ status: 'active', n: buckets.active })
      if (buckets.triage > 0) out.push({ status: 'triage', n: buckets.triage })
      return out
    }

    // SELECT session by id (full)
    if (sql.includes('FROM sessions WHERE id = ?') && sql.includes('SELECT id, email')) {
      const s = this.db.sessions.get(a[0] as string)
      return s ? [projectSession(this.db, s)] : []
    }

    // SELECT session list (admin all live)
    if (
      sql.includes('FROM sessions WHERE deleted_at IS NULL') &&
      sql.includes('ORDER BY updated_at DESC')
    ) {
      const out = [...this.db.sessions.values()]
        .filter((s) => s.deleted_at === null)
        .sort((x, y) => y.updated_at - x.updated_at)
      return out.map((s) => projectSession(this.db, s))
    }

    // SELECT session list (admin trash)
    if (
      sql.includes('FROM sessions') &&
      sql.includes('deleted_at IS NOT NULL') &&
      sql.includes('ORDER BY updated_at DESC')
    ) {
      const out = [...this.db.sessions.values()]
        .filter((s) => s.deleted_at !== null)
        .sort((x, y) => y.updated_at - x.updated_at)
      return out.map((s) => projectSession(this.db, s))
    }

    // SELECT session list (visitor own)
    if (
      sql.includes('FROM sessions WHERE email = ? AND deleted_at IS NULL') &&
      sql.includes('ORDER BY updated_at DESC')
    ) {
      const out = [...this.db.sessions.values()]
        .filter((s) => s.email === (a[0] as string) && s.deleted_at === null)
        .sort((x, y) => y.updated_at - x.updated_at)
      return out.map((s) => projectSession(this.db, s))
    }

    // SELECT messages by session
    if (sql.includes('FROM messages WHERE session_id = ? ORDER BY created_at ASC')) {
      const out = [...this.db.messages.values()]
        .filter((m) => m.session_id === (a[0] as string))
        .sort((x, y) => x.created_at - y.created_at)
      return out.map((m) => ({ ...m }))
    }

    // SELECT attachments by message_id IN (...)
    if (sql.includes('FROM attachments') && sql.includes('WHERE message_id IN')) {
      const ids = new Set(a.map((x) => String(x)))
      const out = [...this.db.attachments.values()]
        .filter((at) => at.message_id && ids.has(at.message_id))
        .sort((x, y) => x.created_at - y.created_at)
      return out.map((at) => ({ ...at }))
    }

    // SELECT attachments WHERE message_id = ? AND id IN (...)
    if (
      sql.includes('FROM attachments') &&
      sql.includes('WHERE message_id = ?') &&
      sql.includes('AND id IN')
    ) {
      const messageId = a[0] as string
      const ids = new Set(a.slice(1).map((x) => String(x)))
      const out = [...this.db.attachments.values()]
        .filter((at) => at.message_id === messageId && ids.has(at.id))
        .sort((x, y) => x.created_at - y.created_at)
      return out.map((at) => ({ ...at }))
    }

    // SELECT attachments WHERE id = ? AND session_id = ?
    if (sql.includes('FROM attachments WHERE id = ? AND session_id = ?')) {
      const att = this.db.attachments.get(a[0] as string)
      if (!att || att.session_id !== a[1]) return []
      return [{ ...att }]
    }

    // SELECT ... FROM attachments WHERE session_id = ? AND kind = 'napkin' LIMIT 1
    // — findNapkinForSession + the upload handler's one-per-session check.
    if (
      sql.includes('FROM attachments') &&
      sql.includes("kind = 'napkin'") &&
      sql.includes('WHERE session_id = ?')
    ) {
      for (const at of this.db.attachments.values()) {
        if (at.session_id === a[0] && at.kind === 'napkin') return [{ ...at }]
      }
      return []
    }

    // SELECT attachments WHERE session_id = ? AND uploaded_by = ? AND message_id IS NULL
    if (
      sql.includes('FROM attachments') &&
      sql.includes('WHERE session_id = ? AND uploaded_by = ? AND message_id IS NULL')
    ) {
      const out = [...this.db.attachments.values()]
        .filter((at) => at.session_id === a[0] && at.uploaded_by === a[1] && at.message_id === null)
        .sort((x, y) => x.created_at - y.created_at)
      return out.map((at) => ({ ...at }))
    }

    // SELECT COALESCE(SUM(size), 0) AS total FROM attachments WHERE session_id = ?
    if (
      sql.includes('FROM attachments') &&
      sql.includes('SUM(size)') &&
      sql.includes('WHERE session_id = ?')
    ) {
      let total = 0
      for (const at of this.db.attachments.values()) {
        if (at.session_id === a[0]) total += at.size
      }
      return [{ total }]
    }

    // SELECT id, r2_key FROM attachments WHERE message_id IS NULL
    //   AND kind != 'napkin' AND created_at < ?
    if (
      sql.includes('FROM attachments') &&
      sql.includes('WHERE message_id IS NULL') &&
      sql.includes('created_at <')
    ) {
      const cutoff = a[0] as number
      const skipNapkin = sql.includes("kind != 'napkin'")
      const out = [...this.db.attachments.values()]
        .filter((at) => at.message_id === null && at.created_at < cutoff)
        .filter((at) => (skipNapkin ? at.kind !== 'napkin' : true))
        .map((at) => ({ id: at.id, r2_key: at.r2_key }))
      return out
    }

    // SELECT paid_at FROM payments WHERE id = ?  (used by webhook to detect
    // first transition vs. Stripe retry)
    if (sql.includes('SELECT paid_at FROM payments WHERE id = ?')) {
      const p = this.db.payments.get(a[0] as string)
      return p ? [{ paid_at: p.paid_at }] : []
    }

    // SELECT 1 FROM payments WHERE session_id = ? AND kind = 'scoping'
    //   AND status = 'paid' LIMIT 1  (checkout: one scoping report per session)
    if (
      sql.includes('FROM payments') &&
      sql.includes('SELECT 1') &&
      sql.includes("kind = 'scoping'")
    ) {
      const sid = a[0] as string
      for (const p of this.db.payments.values()) {
        if (p.session_id === sid && p.kind === 'scoping' && p.status === 'paid') return [{ 1: 1 }]
      }
      return []
    }

    // SELECT COUNT(*) AS c FROM payments WHERE session_id = ? AND kind = 'build'
    //   AND status = 'paid'  (checkout: which installment is next)
    if (
      sql.includes('FROM payments') &&
      sql.includes('SELECT COUNT(*)') &&
      sql.includes("kind = 'build'")
    ) {
      const sid = a[0] as string
      let c = 0
      for (const p of this.db.payments.values()) {
        if (p.session_id === sid && p.kind === 'build' && p.status === 'paid') c++
      }
      return [{ c }]
    }

    // SELECT COALESCE(SUM(amount_cents), 0) AS c FROM payments WHERE
    //   session_id = ? AND kind = 'scoping' AND status = 'paid'  (scoping credit)
    if (
      sql.includes('FROM payments') &&
      sql.includes('SUM(amount_cents)') &&
      sql.includes("kind = 'scoping'")
    ) {
      const sid = a[0] as string
      let c = 0
      for (const p of this.db.payments.values()) {
        if (p.session_id === sid && p.kind === 'scoping' && p.status === 'paid') c += p.amount_cents
      }
      return [{ c }]
    }

    // SELECT ... FROM payments WHERE session_id = ? ORDER BY created_at DESC
    //   (payment summary endpoint)
    if (
      sql.includes('FROM payments') &&
      sql.includes('WHERE session_id = ?') &&
      sql.includes('ORDER BY created_at DESC')
    ) {
      const sid = a[0] as string
      return [...this.db.payments.values()]
        .filter((p) => p.session_id === sid)
        .sort((x, y) => y.created_at - x.created_at)
        .map((p) => ({ ...p }))
    }

    // SELECT email FROM sessions WHERE id = ? AND deleted_at IS NULL
    if (sql.includes('SELECT email FROM sessions WHERE id = ? AND deleted_at IS NULL')) {
      const s = this.db.sessions.get(a[0] as string)
      if (!s || s.deleted_at !== null) return []
      return [{ email: s.email }]
    }

    // SELECT id FROM payments WHERE stripe_invoice_id = ? LIMIT 1  (idempotency)
    if (
      sql.includes('FROM payments') &&
      sql.includes('WHERE stripe_invoice_id = ?') &&
      sql.includes('LIMIT 1')
    ) {
      const invoiceId = a[0] as string
      for (const p of this.db.payments.values()) {
        if (p.stripe_invoice_id === invoiceId) return [{ id: p.id }]
      }
      return []
    }

    // SELECT id FROM sessions WHERE custodian_subscription_id = ? LIMIT 1
    if (sql.includes('FROM sessions') && sql.includes('WHERE custodian_subscription_id = ?')) {
      const subId = a[0] as string
      for (const s of this.db.sessions.values()) {
        if (s.custodian_subscription_id === subId) return [{ id: s.id }]
      }
      return []
    }

    // SELECT id, amount_cents FROM payments WHERE stripe_payment_intent_id = ? LIMIT 1
    // (used by charge.refunded handler)
    if (
      sql.includes('FROM payments') &&
      sql.includes('SELECT id, amount_cents') &&
      sql.includes('stripe_payment_intent_id = ?')
    ) {
      const pi = a[0] as string
      for (const p of this.db.payments.values()) {
        if (p.stripe_payment_intent_id === pi) return [{ id: p.id, amount_cents: p.amount_cents }]
      }
      return []
    }

    // SELECT id, kind, body, created_at FROM admin_alerts WHERE resolved_at IS NULL
    // (used by daily digest to surface unresolved Stripe-notification fallbacks)
    if (sql.includes('FROM admin_alerts') && sql.includes('resolved_at IS NULL')) {
      const rows: Array<{ id: string; kind: string; body: string; created_at: number }> = []
      for (const v of this.db.admin_alerts.values()) {
        if (v.resolved_at == null) {
          rows.push({ id: v.id, kind: v.kind, body: v.body, created_at: v.created_at })
        }
      }
      rows.sort((x, y) => x.created_at - y.created_at)
      return rows
    }

    // SELECT COUNT(*) AS n FROM vouches WHERE (author_email = ? OR ...) AND created_at > ?
    // — rate-limit lookup (1/24h per email + 3/24h per IP via two separate calls).
    if (sql.includes('FROM vouches') && sql.includes('SELECT COUNT(*)')) {
      const since = a[a.length - 1] as number
      let n = 0
      if (sql.includes('author_email = ?')) {
        const email = a[0] as string
        for (const v of this.db.vouches.values()) {
          if (v.author_email === email && v.created_at > since) n++
        }
      }
      return [{ n }]
    }

    // SELECT id FROM sessions WHERE id = ? AND deleted_at IS NULL
    // (vouches.ts uses this for the optional sessionId attribution check.)
    if (sql === 'SELECT id FROM sessions WHERE id = ? AND deleted_at IS NULL') {
      const s = this.db.sessions.get(a[0] as string)
      if (!s || s.deleted_at !== null) return []
      return [{ id: s.id }]
    }

    // SELECT * FROM vouches by id
    if (sql.startsWith('SELECT') && sql.includes('FROM vouches WHERE id = ?')) {
      const id = a[0] as string
      const v = this.db.vouches.get(id)
      return v ? [{ ...v }] : []
    }

    // Public list filtered by sessionId: includes WHERE session_id = ?
    if (
      sql.startsWith('SELECT') &&
      sql.includes('FROM vouches') &&
      sql.includes("status = 'approved'") &&
      sql.includes('deleted_at IS NULL') &&
      sql.includes('session_id = ?')
    ) {
      const sessionId = a[0] as string
      const rows = [...this.db.vouches.values()]
        .filter(
          (v) => v.status === 'approved' && v.deleted_at == null && v.session_id === sessionId,
        )
        .sort((x, y) => y.created_at - x.created_at)
      return rows.map((v) => ({ ...v }))
    }

    // Public list: SELECT ... FROM vouches WHERE status = 'approved' AND
    // deleted_at IS NULL ORDER BY created_at DESC
    if (
      sql.startsWith('SELECT') &&
      sql.includes('FROM vouches') &&
      sql.includes("status = 'approved'") &&
      sql.includes('deleted_at IS NULL')
    ) {
      const rows = [...this.db.vouches.values()]
        .filter((v) => v.status === 'approved' && v.deleted_at == null)
        .sort((x, y) => y.created_at - x.created_at)
      return rows.map((v) => ({ ...v }))
    }

    // Admin list filtered by status: WHERE status = ?
    if (
      sql.startsWith('SELECT') &&
      sql.includes('FROM vouches') &&
      sql.includes('WHERE status = ?')
    ) {
      const wantedStatus = a[0] as string
      const rows = [...this.db.vouches.values()]
        .filter((v) => v.status === wantedStatus)
        .sort((x, y) => {
          // (deleted_at IS NULL) DESC — live rows before trashed.
          const aLive = x.deleted_at == null ? 1 : 0
          const bLive = y.deleted_at == null ? 1 : 0
          if (aLive !== bLive) return bLive - aLive
          return y.created_at - x.created_at
        })
      return rows.map((v) => ({ ...v }))
    }

    // Admin unfiltered list: pending first, then live, then by created_at.
    if (
      sql.startsWith('SELECT') &&
      sql.includes('FROM vouches') &&
      sql.includes("(status = 'pending') DESC")
    ) {
      const rows = [...this.db.vouches.values()].sort((x, y) => {
        const aPending = x.status === 'pending' ? 1 : 0
        const bPending = y.status === 'pending' ? 1 : 0
        if (aPending !== bPending) return bPending - aPending
        const aLive = x.deleted_at == null ? 1 : 0
        const bLive = y.deleted_at == null ? 1 : 0
        if (aLive !== bLive) return bLive - aLive
        return y.created_at - x.created_at
      })
      return rows.map((v) => ({ ...v }))
    }

    // Generic admin list: SELECT ... FROM vouches ORDER BY created_at DESC
    if (sql.startsWith('SELECT') && sql.includes('FROM vouches ORDER BY created_at DESC')) {
      const rows = [...this.db.vouches.values()].sort((x, y) => y.created_at - x.created_at)
      return rows.map((v) => ({ ...v }))
    }

    // SELECT lang, first_name FROM user_prefs WHERE email = ? (or just lang)
    if (sql.includes('FROM user_prefs WHERE email = ?')) {
      const row = this.db.user_prefs.get((a[0] as string).toLowerCase())
      if (!row) return []
      return [{ lang: row.lang, first_name: row.first_name }]
    }

    // SELECT type, subtype FROM email_events WHERE to_email = ? AND (
    //   type IN ('email.complained', 'email.unsubscribed') OR
    //   (type = 'email.bounced' AND subtype = 'permanent')
    // ) ORDER BY received_at DESC LIMIT 1
    // — the suppression check from functions/_lib/emailSuppression.ts.
    if (
      sql.includes('FROM email_events') &&
      sql.includes('WHERE to_email = ?') &&
      sql.includes("'email.complained'")
    ) {
      const targetEmail = (a[0] as string).toLowerCase()
      const rows = [...this.db.email_events.values()]
        .filter((r) => r.to_email.toLowerCase() === targetEmail)
        .filter(
          (r) =>
            r.type === 'email.complained' ||
            r.type === 'email.unsubscribed' ||
            (r.type === 'email.bounced' && r.subtype === 'permanent'),
        )
        .sort((x, y) => y.received_at - x.received_at)
      const first = rows[0]
      return first ? [{ type: first.type, subtype: first.subtype }] : []
    }

    // SELECT pending email_outbox rows for the sweeper
    if (
      sql.includes('FROM email_outbox') &&
      sql.includes('sent_at IS NULL') &&
      sql.includes('attempts <') &&
      sql.includes('ORDER BY created_at')
    ) {
      const maxAttempts = a[0] as number
      const limit = a[1] as number
      const rows = [...this.db.email_outbox.values()]
        .filter((r) => r.sent_at === null && r.attempts < maxAttempts)
        .sort((x, y) => x.created_at - y.created_at)
        .slice(0, limit)
      return rows.map((r) => ({
        id: r.id,
        to_email: r.to_email,
        subject: r.subject,
        html: r.html,
        text_body: r.text_body,
        kind: r.kind,
        attempts: r.attempts,
      }))
    }

    // SELECT last_attempt FROM email_outbox WHERE id = ?
    if (sql.includes('SELECT last_attempt FROM email_outbox WHERE id = ?')) {
      const r = this.db.email_outbox.get(a[0] as string)
      return r ? [{ last_attempt: r.last_attempt }] : []
    }

    // Fallback: SELECT intake_json FROM sessions WHERE email = ? AND deleted_at IS NULL
    //          ORDER BY updated_at DESC LIMIT 1
    if (
      sql.includes('FROM sessions') &&
      sql.includes('SELECT intake_json') &&
      sql.includes('WHERE email = ? AND deleted_at IS NULL')
    ) {
      const email = a[0] as string
      const rows = [...this.db.sessions.values()]
        .filter((s) => s.email === email && s.deleted_at === null)
        .sort((x, y) => y.updated_at - x.updated_at)
      const first = rows[0]
      return first ? [{ intake_json: first.intake_json }] : []
    }

    return []
  }

  private executeMutation(): number {
    const sql = norm(this.sql)
    const a = this.args

    if (sql.startsWith('INSERT OR REPLACE INTO rate_limits')) {
      // SQL is: VALUES (?, 1, ?) — count is a literal, only 2 binds.
      this.db.rate_limits.set(a[0] as string, {
        key: a[0] as string,
        count: 1,
        window_start: a[1] as number,
      })
      return 1
    }

    if (sql.startsWith('UPDATE rate_limits SET count = count + 1')) {
      const row = this.db.rate_limits.get(a[0] as string)
      if (row) row.count += 1
      return row ? 1 : 0
    }

    if (sql.startsWith('DELETE FROM rate_limits WHERE window_start <')) {
      const cutoff = a[0] as number
      let n = 0
      for (const [k, v] of this.db.rate_limits) {
        if (v.window_start < cutoff) {
          this.db.rate_limits.delete(k)
          n++
        }
      }
      return n
    }

    if (sql.startsWith('DELETE FROM magic_link_tokens WHERE created_at <')) {
      const cutoff = a[0] as number
      let n = 0
      for (const [k, v] of this.db.magic_link_tokens) {
        if (v.created_at < cutoff) {
          this.db.magic_link_tokens.delete(k)
          n++
        }
      }
      return n
    }

    if (sql.startsWith('INSERT INTO magic_link_tokens')) {
      const token = a[0] as string
      this.db.magic_link_tokens.set(token, {
        token,
        email: a[1] as string,
        expires_at: a[2] as number,
        used_at: null,
        created_at: a[3] as number,
        ip: a[4] as string,
      })
      return 1
    }

    if (sql.startsWith('UPDATE magic_link_tokens SET used_at = ?')) {
      const token = a[1] as string
      const r = this.db.magic_link_tokens.get(token)
      if (r) r.used_at = a[0] as number
      return r ? 1 : 0
    }

    if (sql.startsWith('INSERT INTO sessions')) {
      const id = a[0] as string
      this.db.sessions.set(id, {
        id,
        email: a[1] as string,
        intake_json: a[2] as string | null,
        status: 'draft',
        created_at: a[3] as number,
        updated_at: a[4] as number,
        deleted_at: null,
        status_history: null,
        showcased_at: null,
        showcase_title: null,
        showcase_tagline: null,
      })
      return 1
    }

    // Atomic cap-checked status transition (triage/active):
    //   UPDATE sessions SET status = ?, status_history = ?, updated_at = ?
    //   WHERE id = ?
    //     AND (SELECT COUNT(*) FROM sessions
    //          WHERE status = ? AND deleted_at IS NULL AND id != ?) < ?
    if (
      sql.startsWith('UPDATE sessions SET status = ?, status_history = ?, updated_at = ?') &&
      sql.includes('SELECT COUNT(*) FROM sessions')
    ) {
      const newStatus = a[0] as string
      const nextHistory = a[1] as string | null
      const updatedAt = a[2] as number
      const id = a[3] as string
      const capStatus = a[4] as string
      const excludeId = a[5] as string
      const cap = a[6] as number
      let count = 0
      for (const s of this.db.sessions.values()) {
        if (s.status === capStatus && s.deleted_at === null && s.id !== excludeId) count++
      }
      if (count >= cap) return 0
      const row = this.db.sessions.get(id)
      if (row) {
        row.status = newStatus
        row.status_history = nextHistory
        row.updated_at = updatedAt
      }
      return row ? 1 : 0
    }

    if (sql.startsWith('UPDATE sessions SET status = ?, status_history = ?, updated_at = ?')) {
      const id = a[3] as string
      const row = this.db.sessions.get(id)
      if (row) {
        row.status = a[0] as string
        row.status_history = a[1] as string | null
        row.updated_at = a[2] as number
      }
      return row ? 1 : 0
    }

    if (sql.startsWith('UPDATE sessions SET intake_json = ?, updated_at = ?')) {
      const id = a[2] as string
      const row = this.db.sessions.get(id)
      if (row) {
        row.intake_json = a[0] as string | null
        row.updated_at = a[1] as number
      }
      return row ? 1 : 0
    }

    if (sql.startsWith('UPDATE sessions SET deleted_at = ?, updated_at = ?')) {
      const id = a[2] as string
      const row = this.db.sessions.get(id)
      if (row) {
        row.deleted_at = a[0] as number
        row.updated_at = a[1] as number
      }
      return row ? 1 : 0
    }

    if (sql.startsWith('UPDATE sessions SET deleted_at = NULL, updated_at = ?')) {
      const id = a[1] as string
      const row = this.db.sessions.get(id)
      if (row) {
        row.deleted_at = null
        row.updated_at = a[0] as number
      }
      return row ? 1 : 0
    }

    if (sql.startsWith('UPDATE sessions SET updated_at = ?')) {
      const id = a[1] as string
      const row = this.db.sessions.get(id)
      if (row) row.updated_at = a[0] as number
      return row ? 1 : 0
    }

    // UPDATE sessions SET tier = ?, updated_at = ? WHERE id = ?
    if (sql.startsWith('UPDATE sessions SET tier = ?, updated_at = ?')) {
      const id = a[2] as string
      const row = this.db.sessions.get(id)
      if (row) {
        ;(row as Record<string, unknown>).tier = a[0]
        row.updated_at = a[1] as number
      }
      return row ? 1 : 0
    }

    // UPDATE sessions SET tier4_amount_cents = ?, updated_at = ? WHERE id = ?
    if (sql.startsWith('UPDATE sessions SET tier4_amount_cents = ?, updated_at = ?')) {
      const id = a[2] as string
      const row = this.db.sessions.get(id)
      if (row) {
        ;(row as Record<string, unknown>).tier4_amount_cents = a[0]
        row.updated_at = a[1] as number
      }
      return row ? 1 : 0
    }

    // Atomic freeze-checked community_discount toggle:
    //   UPDATE sessions SET community_discount = ?, updated_at = ?
    //   WHERE id = ?
    //     AND NOT EXISTS (SELECT 1 FROM payments
    //                     WHERE session_id = ? AND kind = 'build' AND status = 'paid')
    // Returns meta.changes = 0 when a paid build leg exists (freeze tripped).
    if (
      sql.startsWith('UPDATE sessions SET community_discount = ?, updated_at = ?') &&
      sql.includes('NOT EXISTS') &&
      sql.includes("kind = 'build'") &&
      sql.includes("status = 'paid'")
    ) {
      const nextFlag = a[0] as number
      const updatedAt = a[1] as number
      const id = a[2] as string
      // a[3] is the second `id` binding for the subselect.
      let hasPaidLeg = false
      for (const p of this.db.payments.values()) {
        if (p.session_id === id && p.kind === 'build' && p.status === 'paid') {
          hasPaidLeg = true
          break
        }
      }
      if (hasPaidLeg) return 0
      const row = this.db.sessions.get(id) as Record<string, unknown> | undefined
      if (row) {
        row.community_discount = nextFlag
        row.updated_at = updatedAt
      }
      return row ? 1 : 0
    }

    // UPDATE sessions SET tier3_split = ?, updated_at = ? WHERE id = ?
    if (sql.startsWith('UPDATE sessions SET tier3_split = ?, updated_at = ?')) {
      const id = a[2] as string
      const row = this.db.sessions.get(id)
      if (row) {
        ;(row as Record<string, unknown>).tier3_split = a[0]
        row.updated_at = a[1] as number
      }
      return row ? 1 : 0
    }

    // UPDATE sessions SET all_yours_acknowledged_at = ?, updated_at = ? WHERE id = ?
    if (sql.startsWith('UPDATE sessions SET all_yours_acknowledged_at = ?, updated_at = ?')) {
      const id = a[2] as string
      const row = this.db.sessions.get(id)
      if (row) {
        row.all_yours_acknowledged_at = a[0] as number | null
        row.updated_at = a[1] as number
      }
      return row ? 1 : 0
    }

    // UPDATE sessions SET all_yours_acknowledged_at = NULL, updated_at = ? WHERE id = ?
    if (sql.startsWith('UPDATE sessions SET all_yours_acknowledged_at = NULL, updated_at = ?')) {
      const id = a[1] as string
      const row = this.db.sessions.get(id)
      if (row) {
        row.all_yours_acknowledged_at = null
        row.updated_at = a[0] as number
      }
      return row ? 1 : 0
    }

    if (sql.startsWith('INSERT INTO messages')) {
      const id = a[0] as string
      this.db.messages.set(id, {
        id,
        session_id: a[1] as string,
        author: a[2] as string,
        body: a[3] as string,
        created_at: a[4] as number,
      })
      return 1
    }

    if (sql.startsWith('UPDATE attachments SET message_id = ?')) {
      const messageId = a[0] as string
      const ids = a.slice(1, a.length - 2).map((x) => String(x))
      const sessionId = a[a.length - 2] as string
      const uploadedBy = a[a.length - 1] as string
      let n = 0
      for (const id of ids) {
        const att = this.db.attachments.get(id)
        if (
          att &&
          att.session_id === sessionId &&
          att.uploaded_by === uploadedBy &&
          att.message_id === null
        ) {
          att.message_id = messageId
          n++
        }
      }
      return n
    }

    if (sql.startsWith('INSERT INTO attachments')) {
      // `message_id` is a literal NULL in the INSERT (no bind), so the
      // bind order in both the pre-migration and post-migration handlers
      // is: id, session_id, uploaded_by, filename, content_type, size,
      // r2_key, created_at[, kind, transcript].
      const id = a[0] as string
      const hasKind = sql.includes('kind')
      this.db.attachments.set(id, {
        id,
        session_id: a[1] as string,
        message_id: null,
        uploaded_by: a[2] as string,
        filename: a[3] as string,
        content_type: a[4] as string,
        size: a[5] as number,
        r2_key: a[6] as string,
        created_at: a[7] as number,
        kind: hasKind ? (a[8] as string) : 'file',
        transcript: hasKind ? ((a[9] as string | null) ?? null) : null,
      })
      return 1
    }

    if (sql.startsWith('DELETE FROM attachments WHERE id = ?')) {
      const id = a[0] as string
      const had = this.db.attachments.delete(id)
      return had ? 1 : 0
    }

    // INSERT INTO payments — two shapes. The renewal-from-invoice insert
    // carries stripe_invoice_id; the initial decoupled mint carries
    // tier/installment/custodian_plan columns.
    if (sql.startsWith('INSERT INTO payments') && sql.includes('amount_cents')) {
      const id = a[0] as string
      if (sql.includes('stripe_invoice_id')) {
        this.db.payments.set(id, {
          id,
          session_id: a[1] as string,
          kind: 'custodian',
          amount_cents: a[2] as number,
          currency: 'cad',
          status: 'paid',
          stripe_checkout_session_id: null,
          stripe_payment_intent_id: null,
          stripe_subscription_id: a[4] as string,
          stripe_invoice_id: a[3] as string,
          stripe_customer_id: a[5] as string,
          created_at: a[6] as number,
          paid_at: a[7] as number,
        })
      } else {
        // (id, session_id, kind, tier, installment_index, installment_of,
        //  custodian_plan, amount_cents, ..., created_at)
        this.db.payments.set(id, {
          id,
          session_id: a[1] as string,
          kind: a[2] as string,
          tier: (a[3] as number | null) ?? null,
          installment_index: (a[4] as number | null) ?? null,
          installment_of: (a[5] as number | null) ?? null,
          custodian_plan: (a[6] as string | null) ?? null,
          amount_cents: a[7] as number,
          currency: 'cad',
          status: 'pending',
          stripe_checkout_session_id: null,
          stripe_payment_intent_id: null,
          stripe_subscription_id: null,
          stripe_invoice_id: null,
          stripe_customer_id: null,
          created_at: a[8] as number,
          paid_at: null,
        })
      }
      return 1
    }

    // UPDATE payments SET stripe_checkout_session_id = ? WHERE id = ?
    if (sql.startsWith('UPDATE payments SET stripe_checkout_session_id = ?')) {
      const p = this.db.payments.get(a[1] as string)
      if (p) p.stripe_checkout_session_id = a[0] as string
      return p ? 1 : 0
    }

    // UPDATE payments SET status = 'paid', paid_at = COALESCE(...) — the
    // webhook's primary mutation. Multiple COALESCE fields collapse to a
    // few binds; we map by position to mirror webhook.ts.
    if (
      sql.startsWith('UPDATE payments') &&
      sql.includes("status = 'paid'") &&
      sql.includes('paid_at = COALESCE')
    ) {
      const p = this.db.payments.get(a[4] as string)
      if (p) {
        p.status = 'paid'
        if (p.paid_at == null) p.paid_at = a[0] as number
        if (p.stripe_payment_intent_id == null) p.stripe_payment_intent_id = a[1] as string | null
        if (p.stripe_subscription_id == null) p.stripe_subscription_id = a[2] as string | null
        if (p.stripe_customer_id == null) p.stripe_customer_id = a[3] as string | null
      }
      return p ? 1 : 0
    }

    // UPDATE payments SET status = 'failed', failure_reason = ? WHERE id = ?
    if (sql.startsWith('UPDATE payments') && sql.includes("status = 'failed'")) {
      const p = this.db.payments.get(a[1] as string)
      if (p) {
        p.status = 'failed'
        p.failure_reason = a[0] as string
      }
      return p ? 1 : 0
    }

    // UPDATE sessions SET custodian_status='active', custodian_subscription_id=?,
    //   custodian_plan=? WHERE id=?
    if (sql.startsWith("UPDATE sessions SET custodian_status = 'active'")) {
      const p = this.db.sessions.get(a[2] as string)
      if (p) {
        p.custodian_status = 'active'
        p.custodian_subscription_id = a[0] as string
        p.custodian_plan = (a[1] as string | null) ?? null
      }
      return p ? 1 : 0
    }

    // UPDATE sessions SET custodian_status = 'past_due' WHERE custodian_subscription_id = ?
    if (sql.startsWith("UPDATE sessions SET custodian_status = 'past_due'")) {
      const subId = a[0] as string
      let n = 0
      for (const s of this.db.sessions.values()) {
        if (s.custodian_subscription_id === subId) {
          s.custodian_status = 'past_due'
          n++
        }
      }
      return n
    }

    // UPDATE sessions SET custodian_status = 'switched_to_tout_a_toi'
    if (
      sql.startsWith('UPDATE sessions SET custodian_status') &&
      sql.includes('switched_to_tout_a_toi')
    ) {
      const subId = a[0] as string
      let n = 0
      for (const s of this.db.sessions.values()) {
        if (s.custodian_subscription_id === subId) {
          s.custodian_status = 'switched_to_tout_a_toi'
          n++
        }
      }
      return n
    }

    // INSERT OR IGNORE INTO webhook_events (event_id, event_type, received_at)
    if (sql.startsWith('INSERT OR IGNORE INTO webhook_events')) {
      const event_id = a[0] as string
      if (this.db.webhook_events.has(event_id)) return 0
      this.db.webhook_events.set(event_id, {
        event_id,
        event_type: a[1] as string,
        received_at: a[2] as number,
      })
      return 1
    }

    // DELETE FROM webhook_events WHERE received_at < ?
    if (sql.startsWith('DELETE FROM webhook_events WHERE received_at <')) {
      const cutoff = a[0] as number
      let n = 0
      for (const [k, v] of this.db.webhook_events) {
        if (v.received_at < cutoff) {
          this.db.webhook_events.delete(k)
          n++
        }
      }
      return n
    }

    // INSERT INTO admin_alerts (id, kind, body, created_at)
    if (sql.startsWith('INSERT INTO admin_alerts')) {
      const id = a[0] as string
      this.db.admin_alerts.set(id, {
        id,
        kind: 'stripe',
        body: a[1] as string,
        created_at: a[2] as number,
        resolved_at: null,
      })
      return 1
    }

    // UPDATE payments SET refunded_amount_cents = ?, status = CASE ..., refunded_at = CASE ...
    // (charge.refunded handler)
    if (
      sql.startsWith('UPDATE payments') &&
      sql.includes('refunded_amount_cents = ?') &&
      sql.includes('CASE WHEN ? = 1')
    ) {
      const id = a[4] as string
      const p = this.db.payments.get(id)
      if (p) {
        p.refunded_amount_cents = a[0] as number
        const flip = (a[1] as number) === 1
        if (flip) {
          p.status = 'refunded'
          if (p.refunded_at == null) p.refunded_at = a[3] as number
        }
      }
      return p ? 1 : 0
    }

    // UPDATE payments SET status = 'canceled' WHERE status = 'pending' AND created_at < ?
    // (daily reap of stale pending rows)
    if (
      sql.startsWith('UPDATE payments') &&
      sql.includes("status = 'canceled'") &&
      sql.includes("status = 'pending'") &&
      sql.includes('created_at <')
    ) {
      const cutoff = a[0] as number
      let n = 0
      for (const p of this.db.payments.values()) {
        if (p.status === 'pending' && p.created_at < cutoff) {
          p.status = 'canceled'
          n++
        }
      }
      return n
    }

    // INSERT INTO vouches (id, author_name, author_email, author_relationship,
    //                     body, link_url, session_id, status, created_at)
    if (sql.startsWith('INSERT INTO vouches')) {
      const id = a[0] as string
      this.db.vouches.set(id, {
        id,
        author_name: a[1] as string,
        author_email: a[2] as string,
        author_relationship: a[3] as string,
        body: a[4] as string,
        link_url: a[5] as string | null,
        session_id: a[6] as string | null,
        status: 'pending',
        created_at: a[7] as number,
        approved_at: null,
        deleted_at: null,
      })
      return 1
    }

    // UPDATE vouches SET deleted_at = NULL WHERE id = ?
    //   (undelete; SET clause has a literal NULL, not a bind)
    if (sql === 'UPDATE vouches SET deleted_at = NULL WHERE id = ?') {
      const id = a[0] as string
      const v = this.db.vouches.get(id)
      if (v) v.deleted_at = null
      return v ? 1 : 0
    }

    // setLang upsert:
    //   INSERT INTO user_prefs (email, lang, updated_at) VALUES (?, ?, ?)
    //   ON CONFLICT(email) DO UPDATE SET lang = excluded.lang, updated_at = excluded.updated_at
    if (
      sql.startsWith('INSERT INTO user_prefs') &&
      sql.includes('ON CONFLICT(email)') &&
      sql.includes('SET lang = excluded.lang')
    ) {
      const email = (a[0] as string).toLowerCase()
      const prev = this.db.user_prefs.get(email)
      this.db.user_prefs.set(email, {
        email,
        lang: a[1] as string,
        first_name: prev?.first_name ?? null,
        updated_at: a[2] as number,
      })
      return 1
    }

    // setFirstName upsert:
    //   INSERT INTO user_prefs (email, lang, first_name, updated_at)
    //   VALUES (?, 'fr', ?, ?)
    //   ON CONFLICT(email) DO UPDATE SET first_name = excluded.first_name, updated_at = excluded.updated_at
    if (
      sql.startsWith('INSERT INTO user_prefs') &&
      sql.includes('ON CONFLICT(email)') &&
      sql.includes('first_name = excluded.first_name')
    ) {
      const email = (a[0] as string).toLowerCase()
      const prev = this.db.user_prefs.get(email)
      this.db.user_prefs.set(email, {
        email,
        lang: prev?.lang ?? 'fr',
        first_name: (a[1] as string | null) ?? null,
        updated_at: a[2] as number,
      })
      return 1
    }

    // INSERT INTO email_outbox (...)
    //   (id, to_email, subject, html, text_body, kind, created_at,
    //    attempts=1, last_attempt, last_error, sent_at=NULL)
    if (sql.startsWith('INSERT INTO email_outbox')) {
      const id = a[0] as string
      this.db.email_outbox.set(id, {
        id,
        to_email: a[1] as string,
        subject: a[2] as string,
        html: a[3] as string,
        text_body: a[4] as string,
        kind: a[5] as string,
        created_at: a[6] as number,
        attempts: 1,
        last_attempt: a[7] as number,
        last_error: a[8] as string,
        sent_at: null,
      })
      return 1
    }

    // UPDATE email_outbox SET sent_at = ?, last_attempt = ? WHERE id = ?
    if (sql.startsWith('UPDATE email_outbox SET sent_at = ?, last_attempt = ?')) {
      const id = a[2] as string
      const r = this.db.email_outbox.get(id)
      if (r) {
        r.sent_at = a[0] as number
        r.last_attempt = a[1] as number
      }
      return r ? 1 : 0
    }

    // UPDATE email_outbox SET attempts = attempts + 1, last_attempt = ?, last_error = ?
    if (
      sql.startsWith('UPDATE email_outbox SET attempts = attempts + 1') &&
      sql.includes('last_attempt')
    ) {
      const id = a[2] as string
      const r = this.db.email_outbox.get(id)
      if (r) {
        r.attempts += 1
        r.last_attempt = a[0] as number
        r.last_error = a[1] as string
      }
      return r ? 1 : 0
    }

    // DELETE FROM email_outbox WHERE sent_at IS NOT NULL AND sent_at < ?
    if (
      sql.startsWith('DELETE FROM email_outbox') &&
      sql.includes('sent_at IS NOT NULL') &&
      sql.includes('sent_at <')
    ) {
      const cutoff = a[0] as number
      let n = 0
      for (const [k, v] of this.db.email_outbox) {
        if (v.sent_at !== null && v.sent_at < cutoff) {
          this.db.email_outbox.delete(k)
          n++
        }
      }
      return n
    }

    // INSERT INTO email_events — two known shapes:
    //   (a) Webhook handler (functions/api/webhooks/resend.ts):
    //       VALUES (?, ?, ?, ?, ?, ?) — all 6 columns bound.
    //   (b) Unsubscribe handler / recordUnsubscribe:
    //       VALUES (?, ?, 'email.unsubscribed', ?, ?, ?) — type literal, 5 binds.
    //   Detect by scanning the SQL for the literal type string.
    if (sql.startsWith('INSERT INTO email_events')) {
      const id = a[0] as string
      const typeIsLiteral = sql.includes("'email.unsubscribed'")
      this.db.email_events.set(id, {
        id,
        to_email: a[1] as string,
        type: typeIsLiteral ? 'email.unsubscribed' : (a[2] as string),
        subtype: typeIsLiteral
          ? ((a[2] as string | null) ?? null)
          : ((a[3] as string | null) ?? null),
        payload: typeIsLiteral ? (a[3] as string) : (a[4] as string),
        received_at: typeIsLiteral ? (a[4] as number) : (a[5] as number),
      })
      return 1
    }

    // INSERT OR IGNORE INTO user_prefs (email, lang, updated_at) VALUES (?, ?, ?)
    if (sql.startsWith('INSERT OR IGNORE INTO user_prefs')) {
      const email = (a[0] as string).toLowerCase()
      if (this.db.user_prefs.has(email)) return 0
      this.db.user_prefs.set(email, {
        email,
        lang: a[1] as string,
        first_name: null,
        updated_at: a[2] as number,
      })
      return 1
    }

    // Generic vouches UPDATE: parse the SET clause so admin/vouches/[id] can
    // assemble updates from any combination of fields.
    //
    //   UPDATE vouches SET <field> = ? [, <field> = ?]* WHERE id = ?
    //
    // Supports literal NULLs (e.g. `approved_at = NULL`) — those don't consume
    // a bind. Bind order matches the order of `?`-fields left-to-right.
    if (sql.startsWith('UPDATE vouches SET ') && sql.endsWith(' WHERE id = ?')) {
      const inner = sql.slice('UPDATE vouches SET '.length, -' WHERE id = ?'.length)
      const id = a[a.length - 1] as string
      const v = this.db.vouches.get(id)
      if (!v) return 0
      const parts = inner.split(',').map((s) => s.trim())
      let bindIdx = 0
      for (const part of parts) {
        const eq = part.indexOf('=')
        if (eq === -1) continue
        const col = part.slice(0, eq).trim()
        const rhs = part.slice(eq + 1).trim()
        let value: unknown
        if (rhs === 'NULL') {
          value = null
        } else if (rhs === '?') {
          value = a[bindIdx++]
        } else {
          continue
        }
        switch (col) {
          case 'status':
            v.status = value as string
            break
          case 'approved_at':
            v.approved_at = value as number | null
            break
          case 'deleted_at':
            v.deleted_at = value as number | null
            break
          case 'author_name':
            v.author_name = value as string
            break
          case 'author_relationship':
            v.author_relationship = value as string
            break
          case 'body':
            v.body = value as string
            break
          case 'link_url':
            v.link_url = value as string | null
            break
        }
      }
      return 1
    }

    return 0
  }
}

function norm(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim()
}

/** Spread a seeded session row and fill in any columns with a NOT NULL
 *  DEFAULT 0 in the real schema. The mock seed paths often omit these,
 *  so the spread would surface `undefined` where the production DB
 *  always returns 0. Mirroring that here keeps `Boolean(row.X)`-style
 *  defenses in handler code honest at test time too.
 *
 *  `napkin_attachment_id` is a derived correlated subquery on the real
 *  query — we recompute it here from the attachments map so the mock
 *  agrees with production on its presence/absence. */
function projectSession(db: D1Mock, s: SessionRowMock): Record<string, unknown> {
  let napkin_attachment_id: string | null = null
  for (const at of db.attachments.values()) {
    if (at.session_id === s.id && at.kind === 'napkin') {
      napkin_attachment_id = at.id
      break
    }
  }
  return {
    ...s,
    community_discount: s.community_discount ?? 0,
    napkin_attachment_id,
  }
}

export function makeMockEnv(over: Record<string, unknown> = {}) {
  const db = new D1Mock()
  return {
    DB: db as unknown as D1Database,
    RESEND_API_KEY: 'test-key',
    ADMIN_EMAILS: 'marc@x.com',
    SESSION_SECRET: '0'.repeat(64),
    ...over,
    _db: db,
  }
}
