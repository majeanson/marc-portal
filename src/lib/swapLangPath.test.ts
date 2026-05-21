import { describe, it, expect } from 'vitest'
import { swapLangPath } from './swapLangPath'

describe('swapLangPath', () => {
  describe('root', () => {
    it('FR root → EN root', () => {
      expect(swapLangPath('/', '', '', true)).toBe('/en')
    })
    it('EN root → FR root', () => {
      expect(swapLangPath('/en', '', '', false)).toBe('/')
    })
    it('EN root with trailing slash → FR root', () => {
      expect(swapLangPath('/en/', '', '', false)).toBe('/')
    })
  })

  describe('same-slug routes', () => {
    it('FR /projects → EN /en/projects', () => {
      expect(swapLangPath('/projects', '', '', true)).toBe('/en/projects')
    })
    it('EN /en/projects → FR /projects', () => {
      expect(swapLangPath('/en/projects', '', '', false)).toBe('/projects')
    })
    it('FR /handoff/checklist → EN /en/handoff/checklist (nested)', () => {
      expect(swapLangPath('/handoff/checklist', '', '', true)).toBe('/en/handoff/checklist')
    })
    it('FR /admin/apparence → EN /en/admin/apparence (admin uses FR slugs in both)', () => {
      expect(swapLangPath('/admin/apparence', '', '', true)).toBe('/en/admin/apparence')
    })
  })

  describe('translated slugs', () => {
    it('FR /parcours → EN /en/journey', () => {
      expect(swapLangPath('/parcours', '', '', true)).toBe('/en/journey')
    })
    it('EN /en/journey → FR /parcours', () => {
      expect(swapLangPath('/en/journey', '', '', false)).toBe('/parcours')
    })
    it('FR /confidentialite → EN /en/privacy', () => {
      expect(swapLangPath('/confidentialite', '', '', true)).toBe('/en/privacy')
    })
    it('EN /en/privacy → FR /confidentialite', () => {
      expect(swapLangPath('/en/privacy', '', '', false)).toBe('/confidentialite')
    })
    it('FR /carte → EN /en/map', () => {
      expect(swapLangPath('/carte', '', '', true)).toBe('/en/map')
    })
    it('EN /en/map → FR /carte', () => {
      expect(swapLangPath('/en/map', '', '', false)).toBe('/carte')
    })
  })

  describe('preserves query + hash', () => {
    it('FR /projects?tier=2 → EN /en/projects?tier=2', () => {
      expect(swapLangPath('/projects', '?tier=2', '', true)).toBe('/en/projects?tier=2')
    })
    it('FR /#how → EN /en#how', () => {
      expect(swapLangPath('/', '', '#how', true)).toBe('/en#how')
    })
    it('FR /parcours#step-3 → EN /en/journey#step-3 (translated + hash)', () => {
      expect(swapLangPath('/parcours', '', '#step-3', true)).toBe('/en/journey#step-3')
    })
    it('EN /en/privacy?from=footer → FR /confidentialite?from=footer', () => {
      expect(swapLangPath('/en/privacy', '?from=footer', '', false)).toBe(
        '/confidentialite?from=footer',
      )
    })
  })

  describe('no-op when already on the target language', () => {
    // The header click-handler short-circuits these, but the function itself
    // should still produce a sane URL if called.
    it('FR /projects with toEn=false → /projects', () => {
      expect(swapLangPath('/projects', '', '', false)).toBe('/projects')
    })
    it('EN /en/projects with toEn=true → /en/projects', () => {
      expect(swapLangPath('/en/projects', '', '', true)).toBe('/en/projects')
    })
  })
})
