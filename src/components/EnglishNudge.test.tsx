/**
 * Coverage for the one-time EN nudge. Two contracts: it renders no DOM at all
 * on the EN side (an /en visitor is already where they want to be), and its
 * dismiss writes the persistent flag + drops the paint-time visibility
 * attribute so the banner disappears in the same frame as the click.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { EnglishNudge } from './EnglishNudge'

const DISMISS_KEY = 'mp_en_nudge_dismissed'

function renderNudge(lang: 'fr' | 'en') {
  return render(
    <MemoryRouter>
      <EnglishNudge lang={lang} />
    </MemoryRouter>,
  )
}

afterEach(() => {
  window.localStorage.clear()
  document.documentElement.removeAttribute('data-lang-nudge')
})

describe('EnglishNudge', () => {
  it('renders no banner on the EN side', () => {
    const { container } = renderNudge('en')
    expect(container.querySelector('.en-nudge')).toBeNull()
  })

  it('renders the banner with both affordances on the FR side', () => {
    const { container } = renderNudge('fr')
    expect(container.querySelector('.en-nudge')).not.toBeNull()
    expect(container.querySelector('.en-nudge__yes')).not.toBeNull()
    expect(container.querySelector('.en-nudge__no')).not.toBeNull()
  })

  it('persists the dismiss flag and drops the visibility attribute on "no"', () => {
    document.documentElement.setAttribute('data-lang-nudge', 'en')
    const { container } = renderNudge('fr')
    fireEvent.click(container.querySelector('.en-nudge__no')!)
    expect(window.localStorage.getItem(DISMISS_KEY)).toBe('1')
    expect(document.documentElement.hasAttribute('data-lang-nudge')).toBe(false)
  })
})
