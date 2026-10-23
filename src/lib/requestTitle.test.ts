import { describe, expect, it } from 'vitest'
import { requestTitle } from './requestTitle'

const raw = (formData: Record<string, string>, type = 'suivi') =>
  JSON.stringify({ type, formData, submittedAt: '2026-10-23T12:00:00Z' })

describe('requestTitle', () => {
  it('returns null when there is nothing to parse', () => {
    expect(requestTitle(null, 'fr')).toBeNull()
    expect(requestTitle('not json', 'fr')).toBeNull()
    expect(requestTitle(JSON.stringify({ type: 'nope' }), 'fr')).toBeNull()
  })

  it('falls back to the type label when no free-text answer exists', () => {
    expect(requestTitle(raw({}), 'fr')).toBe('Suivi')
    expect(requestTitle(raw({}), 'en')).toBe('Tracking')
  })

  it('appends the first free-text answer, flattened', () => {
    const t = requestTitle(raw({ whatTracked: 'Club de course\ndu dimanche' }), 'fr')
    expect(t).toMatch(/^Suivi · /)
    expect(t).not.toMatch(/\n/)
  })

  it('cuts long answers on a word boundary with an ellipsis', () => {
    const long = 'un club de course du dimanche matin avec beaucoup trop de membres à suivre'
    const t = requestTitle(raw({ whatTracked: long }), 'fr') ?? ''
    expect(t.endsWith('…')).toBe(true)
    expect(t.length).toBeLessThanOrEqual('Suivi · '.length + 49)
  })
})
