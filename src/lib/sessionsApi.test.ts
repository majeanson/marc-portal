import { describe, expect, it } from 'vitest'
import { parseStatusHistory } from './sessionsApi'

describe('parseStatusHistory (frontend)', () => {
  it('returns [] for null', () => {
    expect(parseStatusHistory(null)).toEqual([])
  })

  it('returns [] for malformed JSON', () => {
    expect(parseStatusHistory('not json')).toEqual([])
  })

  it('returns [] for non-array JSON', () => {
    expect(parseStatusHistory('{"a":1}')).toEqual([])
  })

  it('parses a valid history array', () => {
    const raw = JSON.stringify([
      { from: 'draft', to: 'triage', by: 'marc@x', at: 1700000000 },
      { from: 'triage', to: 'active', by: 'marc@x', at: 1700001000 },
    ])
    const out = parseStatusHistory(raw)
    expect(out).toHaveLength(2)
    expect(out[0]?.from).toBe('draft')
    expect(out[1]?.to).toBe('active')
  })
})
