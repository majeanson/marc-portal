import { describe, it, expect } from 'vitest'
import { shouldFocusMainOnRouteChange } from './routeFocus'

describe('shouldFocusMainOnRouteChange', () => {
  it('focuses main on a plain path change (no hash)', () => {
    expect(shouldFocusMainOnRouteChange('')).toBe(true)
  })

  it('skips focus when a hash is present (in-page anchor navigation)', () => {
    expect(shouldFocusMainOnRouteChange('#session-conversation')).toBe(false)
  })

  it('skips focus for a bare "#"', () => {
    expect(shouldFocusMainOnRouteChange('#')).toBe(false)
  })
})
