/**
 * The read-side fallback for the napkin PNG. When the image's R2 object is
 * gone (stale napkin_attachment_id) the <img> would render a broken-image
 * glyph; NapkinImage swaps to a plain "unavailable" line on error. A napkin
 * with no scene never reaches Excalidraw, so this renders without the heavy
 * lazy canvas chunk.
 */

import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { NapkinSection } from './NapkinSection'

const napkin = {
  png: '/api/sessions/s1/attachments/a1',
  text: 'a box and an arrow',
  savedAt: '2026-01-02T00:00:00.000Z',
}

describe('NapkinSection PNG fallback', () => {
  it('renders the napkin image at rest', () => {
    render(<NapkinSection lang="en" napkin={napkin} />)
    const img = screen.getByRole('img', { name: napkin.text })
    expect(img).toHaveAttribute('src', napkin.png)
  })

  it('swaps to the unavailable line when the image fails to load', () => {
    render(<NapkinSection lang="en" napkin={napkin} />)
    fireEvent.error(screen.getByRole('img', { name: napkin.text }))
    expect(screen.getByText('Sketch unavailable.')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('shows the unavailable line immediately when there is no PNG', () => {
    render(<NapkinSection lang="fr" napkin={{ ...napkin, png: '' }} />)
    expect(screen.getByText('Le croquis n’est pas disponible.')).toBeInTheDocument()
  })
})
