/**
 * SceneBoundary is the guard that keeps a corrupt Excalidraw scene from
 * blanking the whole page: a render throw in the wrapped subtree must show
 * the fallback in place, not propagate to the route errorElement.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SceneBoundary } from './SceneBoundary'

function Boom(): never {
  throw new Error('corrupt scene element')
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SceneBoundary', () => {
  it('renders children when they render fine', () => {
    render(
      <SceneBoundary surface="test" fallback={<p>fallback</p>}>
        <p>the scene</p>
      </SceneBoundary>,
    )
    expect(screen.getByText('the scene')).toBeInTheDocument()
    expect(screen.queryByText('fallback')).not.toBeInTheDocument()
  })

  it('shows the fallback instead of propagating a render throw', () => {
    // React logs the caught error to console.error; silence it so the test
    // output stays readable. We assert on the rendered fallback, not the log.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <SceneBoundary surface="test" fallback={<p>fallback</p>}>
        <Boom />
      </SceneBoundary>,
    )
    expect(screen.getByText('fallback')).toBeInTheDocument()
  })
})
