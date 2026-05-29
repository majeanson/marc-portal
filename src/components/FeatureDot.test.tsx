/**
 * Coverage for FeatureDot's three render variants. The dot is the site's
 * primary cross-feature affordance (footer, page titles, rails all lean on
 * it), so the contract that matters is: a feature-bearing dot links into the
 * right atlas slice per language, a decorative dot is paint-only inside an
 * already-clickable parent, and a feature-less dot is an inert neutral disc.
 */

import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { FeatureDot } from './FeatureDot'

function renderDot(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('FeatureDot', () => {
  it('links into the FR atlas slice for a feature dot', () => {
    const { container } = renderDot(<FeatureDot feature="intake" lang="fr" />)
    const link = container.querySelector('a')
    expect(link).not.toBeNull()
    expect(link!.getAttribute('href')).toBe('/carte?feature=intake')
    expect(link!.getAttribute('aria-label')).toBeTruthy()
    expect(link!.getAttribute('data-feature')).toBe('intake')
  })

  it('links into the EN atlas slice for a feature dot', () => {
    const { container } = renderDot(<FeatureDot feature="intake" lang="en" />)
    expect(container.querySelector('a')!.getAttribute('href')).toBe('/en/map?feature=intake')
  })

  it('renders a decorative dot as paint-only (no link, aria-hidden)', () => {
    const { container } = renderDot(<FeatureDot feature="intake" lang="fr" decorative />)
    expect(container.querySelector('a')).toBeNull()
    const span = container.querySelector('.feature-dot')
    expect(span).not.toBeNull()
    expect(span!.getAttribute('aria-hidden')).toBe('true')
    expect(span!.getAttribute('data-feature')).toBe('intake')
  })

  it('renders a feature-less dot as an inert neutral disc', () => {
    const { container } = renderDot(<FeatureDot feature={undefined} lang="fr" />)
    expect(container.querySelector('a')).toBeNull()
    const span = container.querySelector('.feature-dot')
    expect(span).not.toBeNull()
    expect(span!.className).toContain('feature-dot--neutral')
    expect(span!.getAttribute('aria-hidden')).toBe('true')
  })
})
