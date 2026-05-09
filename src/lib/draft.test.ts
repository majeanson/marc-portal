import { beforeEach, describe, expect, it } from 'vitest'
import { clearDraft, loadDraft, loadDraftWithTTL, saveDraft } from './draft'

beforeEach(() => {
  window.localStorage.clear()
})

describe('saveDraft + loadDraft', () => {
  it('round-trips an object', () => {
    saveDraft('k', { a: 1, b: 'two' })
    expect(loadDraft<{ a: number; b: string }>('k')).toEqual({ a: 1, b: 'two' })
  })

  it('returns null for missing key', () => {
    expect(loadDraft('nope')).toBeNull()
  })

  it('returns null for malformed json', () => {
    window.localStorage.setItem('marc-portal:bad', 'not json')
    expect(loadDraft('bad')).toBeNull()
  })
})

describe('loadDraftWithTTL', () => {
  it('returns the draft when within TTL', () => {
    const fresh = { savedAt: new Date().toISOString(), email: 'a@b.com' }
    saveDraft('k', fresh)
    const got = loadDraftWithTTL<typeof fresh>('k', 60_000)
    expect(got).not.toBeNull()
    expect(got?.email).toBe('a@b.com')
  })

  it('returns null and clears stash when older than TTL', () => {
    const stale = { savedAt: new Date(Date.now() - 10_000).toISOString(), email: 'x@y.com' }
    saveDraft('k', stale)
    const got = loadDraftWithTTL<typeof stale>('k', 5_000)
    expect(got).toBeNull()
    // Cleared
    expect(loadDraft('k')).toBeNull()
  })

  it('treats missing savedAt as expired', () => {
    saveDraft('k', { email: 'a@b.com' })
    expect(loadDraftWithTTL('k', 60_000)).toBeNull()
  })

  it('treats invalid savedAt as expired', () => {
    saveDraft('k', { savedAt: 'not a date', email: 'a@b.com' })
    expect(loadDraftWithTTL('k', 60_000)).toBeNull()
  })
})

describe('clearDraft', () => {
  it('removes the entry', () => {
    saveDraft('k', { x: 1 })
    clearDraft('k')
    expect(loadDraft('k')).toBeNull()
  })
})
