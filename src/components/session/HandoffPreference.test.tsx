import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { HandoffPreference } from './HandoffPreference'

function renderPicker(value: string | undefined, onPick = vi.fn(), lang: 'fr' | 'en' = 'fr') {
  render(
    <MemoryRouter>
      <HandoffPreference lang={lang} value={value} busy={false} onPick={onPick} />
    </MemoryRouter>,
  )
  return onPick
}

describe('HandoffPreference', () => {
  it('defaults to « On en parle plus tard » and uses no infrastructure jargon', () => {
    renderPicker(undefined)
    expect(screen.getByRole('radio', { name: /On en parle plus tard/ })).toBeChecked()
    expect(document.body.textContent).not.toMatch(/Cloudflare|Resend|DNS/)
  })

  it('reports the picked mode', () => {
    const onPick = renderPicker('on-en-parle')
    fireEvent.click(screen.getByRole('radio', { name: /Je m’en occupe pour toi/ }))
    expect(onPick).toHaveBeenCalledWith('je-men-occupe')
  })

  it('reflects a stored choice', () => {
    renderPicker('tout-a-toi', vi.fn(), 'en')
    expect(screen.getByRole('radio', { name: /hand you everything/ })).toBeChecked()
  })
})
