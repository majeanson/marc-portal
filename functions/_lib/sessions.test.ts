import { describe, expect, it } from 'vitest'
import {
  appendStatusHistory,
  canAccessSession,
  isValidStatus,
  parseStatusHistory,
  primaryAdminEmail,
  visitorLang,
  type SessionRow,
  type StatusHistoryEntry,
} from './sessions'

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
