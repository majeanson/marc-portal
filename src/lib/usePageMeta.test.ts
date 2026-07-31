/**
 * usePageMeta is the only thing standing between an FR<->EN client-side
 * navigation (useLangSwitch never reloads) and a stale <html lang> or a
 * leaked meta description from the page the visitor just left. The
 * contract that matters: title/lang always reflect the latest props, and
 * the description tag returns to whatever it held before this page mounted.
 */

import { describe, expect, it, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePageMeta } from './usePageMeta'

function setDescriptionTag(content: string) {
  const meta = document.createElement('meta')
  meta.setAttribute('name', 'description')
  meta.setAttribute('content', content)
  document.head.appendChild(meta)
  return meta
}

function descriptionContent() {
  return document.querySelector('meta[name="description"]')?.getAttribute('content') ?? null
}

afterEach(() => {
  document.title = ''
  document.querySelectorAll('meta[name="description"]').forEach((el) => el.remove())
})

describe('usePageMeta', () => {
  it('sets document.title verbatim', () => {
    renderHook(() => usePageMeta({ title: 'Accueil — Marc', lang: 'fr' }))
    expect(document.title).toBe('Accueil — Marc')
  })

  it('flips documentElement.lang when lang goes fr -> en', () => {
    const { rerender } = renderHook(({ lang }) => usePageMeta({ title: 'x', lang }), {
      initialProps: { lang: 'fr' as const },
    })
    expect(document.documentElement.lang).toBe('fr-CA')

    rerender({ lang: 'en' })
    expect(document.documentElement.lang).toBe('en-CA')
  })

  it('creates the description tag when absent and removes it on unmount', () => {
    expect(document.querySelector('meta[name="description"]')).toBeNull()

    const { unmount } = renderHook(() =>
      usePageMeta({ title: 'x', lang: 'fr', description: 'nouvelle description' }),
    )
    expect(descriptionContent()).toBe('nouvelle description')

    unmount()
    expect(document.querySelector('meta[name="description"]')).toBeNull()
  })

  it('restores the previous description content on unmount when a tag pre-existed', () => {
    setDescriptionTag('description du site')

    const { unmount } = renderHook(() =>
      usePageMeta({ title: 'x', lang: 'fr', description: 'description de la page' }),
    )
    expect(descriptionContent()).toBe('description de la page')

    unmount()
    expect(descriptionContent()).toBe('description du site')
  })

  it('updates the description when props change', () => {
    setDescriptionTag('description du site')

    const { rerender } = renderHook(
      ({ description }) => usePageMeta({ title: 'x', lang: 'fr', description }),
      { initialProps: { description: 'premiere page' } },
    )
    expect(descriptionContent()).toBe('premiere page')

    rerender({ description: 'deuxieme page' })
    expect(descriptionContent()).toBe('deuxieme page')
  })
})
