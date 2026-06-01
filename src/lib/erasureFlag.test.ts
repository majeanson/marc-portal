import { afterEach, describe, expect, it } from 'vitest'
import { consumeJustErasedFlag, markJustErased } from './erasureFlag'

const KEY = 'mp_just_erased'

// Swap window.sessionStorage for the duration of a test, restoring after. Used
// to simulate a blocked/throwing store (private mode, quota) since happy-dom's
// real Storage never throws.
function withStorage(stub: Partial<Storage>, fn: () => void) {
  const orig = window.sessionStorage
  Object.defineProperty(window, 'sessionStorage', { value: stub, configurable: true })
  try {
    fn()
  } finally {
    Object.defineProperty(window, 'sessionStorage', { value: orig, configurable: true })
  }
}

afterEach(() => {
  window.sessionStorage.clear()
})

describe('erasureFlag', () => {
  it('round-trips: mark sets the flag, consume reads it true', () => {
    markJustErased()
    expect(window.sessionStorage.getItem(KEY)).toBe('1')
    expect(consumeJustErasedFlag()).toBe(true)
  })

  it('consume is one-shot — it clears the flag so a fresh tab tomorrow stays quiet', () => {
    markJustErased()
    expect(consumeJustErasedFlag()).toBe(true)
    // Second read sees nothing: the goodbye ritual plays exactly once.
    expect(consumeJustErasedFlag()).toBe(false)
    expect(window.sessionStorage.getItem(KEY)).toBeNull()
  })

  it('consume returns false when nothing was marked', () => {
    expect(consumeJustErasedFlag()).toBe(false)
  })

  it('mark swallows a storage-blocked write (au-revoir falls back to direct-hit copy)', () => {
    withStorage(
      {
        setItem() {
          throw new Error('blocked')
        },
      },
      () => {
        expect(() => markJustErased()).not.toThrow()
      },
    )
  })

  it('consume returns false when the storage read throws', () => {
    withStorage(
      {
        getItem() {
          throw new Error('blocked')
        },
      },
      () => {
        expect(consumeJustErasedFlag()).toBe(false)
      },
    )
  })
})
