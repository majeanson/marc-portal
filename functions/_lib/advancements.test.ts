import { describe, expect, it } from 'vitest'
import {
  canSeeAdvancement,
  normalizeBody,
  normalizeIframePath,
  normalizeLabel,
  parseFlags,
  stringifyFlags,
} from './advancements'

describe('parseFlags', () => {
  it('returns empty object for null/empty/garbage', () => {
    expect(parseFlags(null)).toEqual({})
    expect(parseFlags(undefined)).toEqual({})
    expect(parseFlags('')).toEqual({})
    expect(parseFlags('not json')).toEqual({})
    expect(parseFlags('[1,2,3]')).toEqual({})
    expect(parseFlags('"a string"')).toEqual({})
  })

  it('keeps only known boolean keys', () => {
    expect(
      parseFlags(
        JSON.stringify({
          allowedForPublic: true,
          showInConversation: false,
          showAsCurrentBuild: true,
          random: 'ignored',
        }),
      ),
    ).toEqual({
      allowedForPublic: true,
      showInConversation: false,
      showAsCurrentBuild: true,
    })
  })

  it('rejects non-boolean values for known keys', () => {
    expect(parseFlags(JSON.stringify({ allowedForPublic: 'yes' }))).toEqual({})
    expect(parseFlags(JSON.stringify({ showAsCurrentBuild: 1 }))).toEqual({})
  })
})

describe('stringifyFlags', () => {
  it('drops falsy keys to keep the blob tight', () => {
    expect(stringifyFlags({})).toBe('{}')
    expect(stringifyFlags({ allowedForPublic: false })).toBe('{}')
    expect(stringifyFlags({ allowedForPublic: true, showInConversation: false })).toBe(
      '{"allowedForPublic":true}',
    )
  })

  it('round-trips truthy keys through parseFlags', () => {
    const flags = {
      allowedForPublic: true,
      showInConversation: true,
      showAsCurrentBuild: true,
    }
    expect(parseFlags(stringifyFlags(flags))).toEqual(flags)
  })
})

describe('normalizeLabel', () => {
  it('trims and rejects empty', () => {
    expect(normalizeLabel('  Rev 1 demo  ')).toBe('Rev 1 demo')
    expect(normalizeLabel('   ')).toBeNull()
    expect(normalizeLabel('')).toBeNull()
  })

  it('rejects non-strings', () => {
    expect(normalizeLabel(42)).toBeNull()
    expect(normalizeLabel(null)).toBeNull()
    expect(normalizeLabel(undefined)).toBeNull()
  })

  it('rejects over-long input', () => {
    expect(normalizeLabel('x'.repeat(201))).toBeNull()
    expect(normalizeLabel('x'.repeat(200))).toBe('x'.repeat(200))
  })
})

describe('normalizeBody', () => {
  it('trims and truncates', () => {
    expect(normalizeBody('  hello  ')).toBe('hello')
    expect(normalizeBody('a'.repeat(10000))).toBe('a'.repeat(8000))
  })

  it('returns empty string for non-strings', () => {
    expect(normalizeBody(undefined)).toBe('')
    expect(normalizeBody(null)).toBe('')
    expect(normalizeBody(42)).toBe('')
  })
})

describe('normalizeIframePath', () => {
  it('accepts site-relative paths', () => {
    expect(normalizeIframePath('/me')).toBe('/me')
    expect(normalizeIframePath('/session/abc123')).toBe('/session/abc123')
  })

  it('rejects absolute URLs, protocol-relative, and non-slash starts', () => {
    expect(normalizeIframePath('https://evil.com/x')).toBeNull()
    expect(normalizeIframePath('me')).toBeNull()
    expect(normalizeIframePath('//evil.com/x')).toBeNull()
    expect(normalizeIframePath('http://x')).toBeNull()
    expect(normalizeIframePath('/x://y')).toBeNull()
  })

  it('rejects empty / non-strings', () => {
    expect(normalizeIframePath('')).toBeNull()
    expect(normalizeIframePath('   ')).toBeNull()
    expect(normalizeIframePath(undefined)).toBeNull()
  })
})

describe('canSeeAdvancement', () => {
  it('owner/admin always passes', () => {
    expect(canSeeAdvancement({}, true)).toBe(true)
    expect(canSeeAdvancement({ allowedForPublic: false }, true)).toBe(true)
  })

  it('public viewers only see allowedForPublic entries', () => {
    expect(canSeeAdvancement({}, false)).toBe(false)
    expect(canSeeAdvancement({ allowedForPublic: false }, false)).toBe(false)
    expect(canSeeAdvancement({ allowedForPublic: true }, false)).toBe(true)
  })
})
