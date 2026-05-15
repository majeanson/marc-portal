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

export class D1Mock {
  sessions = new Map<string, SessionRowMock>()
  messages = new Map<string, MessageRowMock>()
  attachments = new Map<string, AttachmentRowMock>()
  rate_limits = new Map<string, RateLimitRowMock>()
  magic_link_tokens = new Map<string, MagicLinkRowMock>()

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
      return s ? [{ ...s }] : []
    }

    // SELECT session list (admin all live)
    if (
      sql.includes('FROM sessions WHERE deleted_at IS NULL') &&
      sql.includes('ORDER BY updated_at DESC')
    ) {
      const out = [...this.db.sessions.values()]
        .filter((s) => s.deleted_at === null)
        .sort((x, y) => y.updated_at - x.updated_at)
      return out.map((s) => ({ ...s }))
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
      return out.map((s) => ({ ...s }))
    }

    // SELECT session list (visitor own)
    if (
      sql.includes('FROM sessions WHERE email = ? AND deleted_at IS NULL') &&
      sql.includes('ORDER BY updated_at DESC')
    ) {
      const out = [...this.db.sessions.values()]
        .filter((s) => s.email === (a[0] as string) && s.deleted_at === null)
        .sort((x, y) => y.updated_at - x.updated_at)
      return out.map((s) => ({ ...s }))
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

    // SELECT id, r2_key FROM attachments WHERE message_id IS NULL AND created_at < ?
    if (
      sql.includes('FROM attachments') &&
      sql.includes('WHERE message_id IS NULL') &&
      sql.includes('created_at <')
    ) {
      const cutoff = a[0] as number
      const out = [...this.db.attachments.values()]
        .filter((at) => at.message_id === null && at.created_at < cutoff)
        .map((at) => ({ id: at.id, r2_key: at.r2_key }))
      return out
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
      const id = a[0] as string
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
      })
      return 1
    }

    if (sql.startsWith('DELETE FROM attachments WHERE id = ?')) {
      const id = a[0] as string
      const had = this.db.attachments.delete(id)
      return had ? 1 : 0
    }

    return 0
  }
}

function norm(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim()
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
