import { describe, expect, it } from 'vitest'
import { D1Mock } from '../../tests/d1-mock'
import {
  ACTIVE_CAP,
  TRIAGE_CAP,
  appendStatusHistory,
  canAccessSession,
  countActiveAndTriage,
  isActiveAtCap,
  isTriageAtCap,
  isValidStatus,
  parseStatusHistory,
  primaryAdminEmail,
  requireSessionAccess,
  type SessionRow,
  type StatusHistoryEntry,
} from './sessions'
import type { D1Database } from '@cloudflare/workers-types'

function makeSession(over: Partial<SessionRow> = {}): SessionRow {
  return {
    id: 's1',
    email: 'visitor@x.com',
    intake_json: null,
    status: 'draft',
    created_at: 1700000000,
    updated_at: 1700000000,
    deleted_at: null,
    status_history: null,
    ...over,
  }
}

describe('isValidStatus', () => {
  it('accepts the known statuses', () => {
    expect(isValidStatus('draft')).toBe(true)
    expect(isValidStatus('triage')).toBe(true)
    expect(isValidStatus('active')).toBe(true)
    expect(isValidStatus('shipped')).toBe(true)
    expect(isValidStatus('rejected')).toBe(true)
  })

  it('rejects unknowns and non-strings', () => {
    expect(isValidStatus('bogus')).toBe(false)
    expect(isValidStatus(42)).toBe(false)
    expect(isValidStatus(null)).toBe(false)
    expect(isValidStatus(undefined)).toBe(false)
  })
})

describe('canAccessSession', () => {
  it('admins always pass', () => {
    expect(canAccessSession('marc@x.com', true, makeSession())).toBe(true)
  })

  it('visitors only see their own', () => {
    expect(canAccessSession('visitor@x.com', false, makeSession())).toBe(true)
    expect(canAccessSession('other@x.com', false, makeSession())).toBe(false)
  })
})

describe('primaryAdminEmail', () => {
  it('returns the first comma-split entry', () => {
    expect(primaryAdminEmail('a@x.com,b@y.com')).toBe('a@x.com')
  })

  it('trims whitespace', () => {
    expect(primaryAdminEmail(' a@x.com , b@y.com ')).toBe('a@x.com')
  })

  it('returns null for empty input', () => {
    expect(primaryAdminEmail('')).toBeNull()
    expect(primaryAdminEmail(',')).toBeNull()
  })
})

describe('parseStatusHistory + appendStatusHistory', () => {
  const entry: StatusHistoryEntry = {
    from: 'draft',
    to: 'triage',
    by: 'marc@x.com',
    at: 1700000100,
  }

  it('parse returns [] for null/malformed/non-array', () => {
    expect(parseStatusHistory(null)).toEqual([])
    expect(parseStatusHistory('not json')).toEqual([])
    expect(parseStatusHistory('{}')).toEqual([])
  })

  it('append starts a fresh array on null', () => {
    const raw = appendStatusHistory(null, entry)
    expect(parseStatusHistory(raw)).toEqual([entry])
  })

  it('append preserves order', () => {
    const second: StatusHistoryEntry = { ...entry, to: 'active', at: 1700000200 }
    const raw1 = appendStatusHistory(null, entry)
    const raw2 = appendStatusHistory(raw1, second)
    const out = parseStatusHistory(raw2)
    expect(out).toHaveLength(2)
    expect(out[0]?.to).toBe('triage')
    expect(out[1]?.to).toBe('active')
  })

  it('append discards malformed prior history rather than throwing', () => {
    const raw = appendStatusHistory('garbage', entry)
    expect(parseStatusHistory(raw)).toEqual([entry])
  })
})

describe('countActiveAndTriage + isActiveAtCap + isTriageAtCap', () => {
  function seed(
    db: D1Mock,
    rows: Array<{ id: string; status: string; deleted_at?: number | null }>,
  ) {
    for (const r of rows) {
      db.sessions.set(r.id, {
        id: r.id,
        email: 'x@x.com',
        intake_json: null,
        status: r.status,
        created_at: 1,
        updated_at: 1,
        deleted_at: r.deleted_at ?? null,
        status_history: null,
      })
    }
  }

  it('counts only live active/triage rows', async () => {
    const db = new D1Mock()
    seed(db, [
      { id: 'a', status: 'active' },
      { id: 't', status: 'triage' },
      { id: 'd', status: 'draft' },
      { id: 's', status: 'shipped' },
      { id: 'r', status: 'rejected' },
      { id: 'gone', status: 'active', deleted_at: 100 },
    ])
    const c = await countActiveAndTriage(db as unknown as D1Database)
    expect(c).toEqual({ active: 1, triage: 1 })
  })

  it('excludeSessionId removes the targeted row from counts', async () => {
    const db = new D1Mock()
    seed(db, [
      { id: 'a', status: 'active' },
      { id: 't', status: 'triage' },
    ])
    const c = await countActiveAndTriage(db as unknown as D1Database, 'a')
    expect(c).toEqual({ active: 0, triage: 1 })
  })

  it('cap predicates match the constants', () => {
    expect(isActiveAtCap({ active: ACTIVE_CAP, triage: 0 })).toBe(true)
    expect(isActiveAtCap({ active: ACTIVE_CAP - 1, triage: 0 })).toBe(false)
    expect(isTriageAtCap({ active: 0, triage: TRIAGE_CAP })).toBe(true)
    expect(isTriageAtCap({ active: 0, triage: TRIAGE_CAP - 1 })).toBe(false)
  })
})

describe('requireSessionAccess', () => {
  function dbWith(rows: Array<{ id: string; email?: string; deleted_at?: number | null }>) {
    const db = new D1Mock()
    for (const r of rows) {
      db.sessions.set(r.id, {
        id: r.id,
        email: r.email ?? 'visitor@x.com',
        intake_json: null,
        status: 'active',
        created_at: 1,
        updated_at: 1,
        deleted_at: r.deleted_at ?? null,
        status_history: null,
      })
    }
    return db as unknown as D1Database
  }

  const visitor = { email: 'visitor@x.com', isAdmin: false }
  const admin = { email: 'marc@x.com', isAdmin: true }
  const stranger = { email: 'someone@else.com', isAdmin: false }

  it('400 on missing or empty session id', async () => {
    const db = dbWith([])
    const a = await requireSessionAccess(db, '', visitor)
    expect(a).toBeInstanceOf(Response)
    expect((a as Response).status).toBe(400)
    const b = await requireSessionAccess(db, undefined, visitor)
    expect((b as Response).status).toBe(400)
  })

  it('404 when session does not exist', async () => {
    const db = dbWith([])
    const r = await requireSessionAccess(db, 'no-such', visitor)
    expect((r as Response).status).toBe(404)
  })

  it('default policy (hide-from-non-admin): visitor 404 on soft-deleted', async () => {
    const db = dbWith([{ id: 's', deleted_at: 100 }])
    const r = await requireSessionAccess(db, 's', visitor)
    expect((r as Response).status).toBe(404)
  })

  it('default policy: admin still loads soft-deleted row', async () => {
    const db = dbWith([{ id: 's', deleted_at: 100 }])
    const r = await requireSessionAccess(db, 's', admin)
    expect(r).not.toBeInstanceOf(Response)
    expect((r as SessionRow).id).toBe('s')
  })

  it('hide-from-all: even admin gets 404 on soft-deleted', async () => {
    const db = dbWith([{ id: 's', deleted_at: 100 }])
    const r = await requireSessionAccess(db, 's', admin, { softDeleted: 'hide-from-all' })
    expect((r as Response).status).toBe(404)
  })

  it('include: soft-deleted row returns to handler regardless of admin', async () => {
    const db = dbWith([{ id: 's', deleted_at: 100 }])
    const a = await requireSessionAccess(db, 's', visitor, { softDeleted: 'include' })
    expect((a as SessionRow).id).toBe('s')
    const b = await requireSessionAccess(db, 's', admin, { softDeleted: 'include' })
    expect((b as SessionRow).id).toBe('s')
  })

  it('403 when live session belongs to someone else (non-admin viewer)', async () => {
    const db = dbWith([{ id: 's', email: 'visitor@x.com' }])
    const r = await requireSessionAccess(db, 's', stranger)
    expect((r as Response).status).toBe(403)
  })

  it('returns the session for the owner', async () => {
    const db = dbWith([{ id: 's', email: 'visitor@x.com' }])
    const r = await requireSessionAccess(db, 's', visitor)
    expect((r as SessionRow).email).toBe('visitor@x.com')
  })

  it('returns the session for admin (any owner)', async () => {
    const db = dbWith([{ id: 's', email: 'visitor@x.com' }])
    const r = await requireSessionAccess(db, 's', admin)
    expect((r as SessionRow).email).toBe('visitor@x.com')
  })
})
