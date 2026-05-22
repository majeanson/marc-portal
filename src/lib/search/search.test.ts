/**
 * Coverage for the site-search ranking engine. Behaviours are asserted
 * against the live corpus (the /carte atlas) but kept content-robust —
 * only `page.intake`, a stable core destination, is named directly.
 */

import { describe, expect, it } from 'vitest'
import { fold, runSearch } from './search'
import { SEARCH_CORPUS, visibleEntries } from './corpus'

describe('fold', () => {
  it('lowercases, strips diacritics, and trims', () => {
    expect(fold('  Privé ')).toBe('prive')
    expect(fold('Français')).toBe('francais')
    expect(fold('À PROPOS')).toBe('a propos')
    expect(fold('Élève')).toBe('eleve')
  })
})

describe('runSearch — empty query', () => {
  it('returns priority-ranked suggestions rather than nothing', () => {
    const { results, suggested } = runSearch('')
    expect(suggested).toBe(true)
    expect(results.length).toBeGreaterThan(0)
    expect(results.length).toBeLessThanOrEqual(6)
    const priorities = results.map((r) => r.entry.priority)
    expect(priorities).toEqual([...priorities].sort((a, b) => b - a))
  })

  it('treats a whitespace-only query as empty', () => {
    expect(runSearch('   ').suggested).toBe(true)
  })
})

describe('runSearch — queries', () => {
  it('finds a known destination and ranks it first', () => {
    const { results, suggested } = runSearch('intake')
    expect(suggested).toBe(false)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].entry.id).toBe('page.intake')
  })

  it('matches corpus entries through the accent fold', () => {
    // A real entry with an accented French label — searching a de-accented
    // word from it must still surface it.
    const entry = SEARCH_CORPUS.find((e) => /[À-ÿ]/.test(e.label.fr))
    expect(entry).toBeDefined()
    if (!entry) return
    const word = fold(entry.label.fr)
      .split(/\s+/)
      .find((w) => w.length > 2)
    expect(word).toBeTruthy()
    const ids = runSearch(word as string, { isAdmin: true }).results.map((r) => r.entry.id)
    expect(ids).toContain(entry.id)
  })

  it('applies AND semantics — every word must match something', () => {
    expect(runSearch('intake zzznotaword').results).toHaveLength(0)
  })

  it('returns no results for a nonsense query (and not as suggestions)', () => {
    const { results, suggested } = runSearch('qqzzxxnotathing')
    expect(results).toHaveLength(0)
    expect(suggested).toBe(false)
  })
})

describe('visibility', () => {
  it('hides admin-only nodes from non-admin viewers', () => {
    const visitor = visibleEntries(false)
    const admin = visibleEntries(true)
    expect(admin.length).toBeGreaterThanOrEqual(visitor.length)
    expect(visitor.every((e) => e.visibility === 'public')).toBe(true)
  })
})
