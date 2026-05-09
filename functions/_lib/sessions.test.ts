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
  visitorLang,
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

describe('visitorLang', () => {
  it('returns fr when intake_json is null', () => {
    expect(visitorLang(makeSession({ intake_json: null }))).toBe('fr')
  })

  it('returns lang from intake payload', () => {
    expect(visitorLang(makeSession({ intake_json: JSON.stringify({ lang: 'en' }) }))).toBe('en')
    expect(visitorLang(makeSession({ intake_json: JSON.stringify({ lang: 'fr' }) }))).toBe('fr')
  })

  it('falls back to fr when payload lang is invalid', () => {
    expect(visitorLang(makeSession({ intake_json: JSON.stringify({ lang: 'pt' }) }))).toBe('fr')
  })

  it('falls back to fr for malformed JSON', () => {
    expect(visitorLang(makeSession({ intake_json: '{not json' }))).toBe('fr')
  })
})
