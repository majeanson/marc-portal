import { beforeEach, describe, expect, it } from 'vitest'
import { isUnread, markSeen, seedIfMissing } from './unread'

beforeEach(() => {
  window.localStorage.clear()
})

describe('isUnread', () => {
  it('returns false on first sighting (no last-seen)', () => {
    expect(isUnread({ id: 'a', updated_at: 100 })).toBe(false)
  })

  it('returns true when updated_at is newer than last seen', () => {
    markSeen({ id: 'a', updated_at: 100 })
    expect(isUnread({ id: 'a', updated_at: 200 })).toBe(true)
  })

  it('returns false when updated_at matches last seen', () => {
    markSeen({ id: 'a', updated_at: 100 })
    expect(isUnread({ id: 'a', updated_at: 100 })).toBe(false)
  })
})

describe('seedIfMissing', () => {
  it('treats new sessions as already-seen', () => {
    seedIfMissing({ id: 'b', updated_at: 100 })
    expect(isUnread({ id: 'b', updated_at: 100 })).toBe(false)
  })

  it('does not overwrite existing last-seen', () => {
    markSeen({ id: 'c', updated_at: 50 })
    seedIfMissing({ id: 'c', updated_at: 100 })
    expect(isUnread({ id: 'c', updated_at: 100 })).toBe(true)
  })
})

describe('markSeen', () => {
  it('persists across reads', () => {
    markSeen({ id: 'd', updated_at: 999 })
    expect(isUnread({ id: 'd', updated_at: 999 })).toBe(false)
    expect(isUnread({ id: 'd', updated_at: 1000 })).toBe(true)
  })

  it('handles malformed localStorage gracefully', () => {
    window.localStorage.setItem('marc-portal:last-seen', 'not-json')
    expect(isUnread({ id: 'e', updated_at: 1 })).toBe(false)
    markSeen({ id: 'e', updated_at: 100 })
    expect(isUnread({ id: 'e', updated_at: 200 })).toBe(true)
  })
})
