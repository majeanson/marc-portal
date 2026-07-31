/**
 * Coverage for the loadError flag on the build-advancements timeline. Before
 * this fix, SessionPage's listAdvancements catch set the list to `[]` on any
 * failure — indistinguishable from a session that genuinely has zero
 * advancements yet. `loadError` (threaded from SessionPage's own fetch
 * effect) lets this component render "couldn't load" instead of the silently
 * wrong empty state.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SessionAdvancements } from './SessionAdvancements'

const noop = vi.fn()

describe('SessionAdvancements loadError', () => {
  it('renders the empty state when items is [] and there is no load error', () => {
    render(
      <SessionAdvancements
        sessionId="s1"
        isAdmin={false}
        lang="en"
        items={[]}
        loading={false}
        loadError={false}
        onCreated={noop}
        onPatched={noop}
        onDeleted={noop}
      />,
    )
    expect(screen.getByText(/no advancements posted yet/i)).toBeInTheDocument()
  })

  it('renders a load-error line instead of the empty state when loadError is true', () => {
    render(
      <SessionAdvancements
        sessionId="s1"
        isAdmin={false}
        lang="en"
        items={[]}
        loading={false}
        loadError={true}
        onCreated={noop}
        onPatched={noop}
        onDeleted={noop}
      />,
    )
    expect(screen.queryByText(/no advancements posted yet/i)).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn.t load the advancements/i)
  })

  it('renders the FR load-error copy when lang=fr', () => {
    render(
      <SessionAdvancements
        sessionId="s1"
        isAdmin={false}
        lang="fr"
        items={[]}
        loading={false}
        loadError={true}
        onCreated={noop}
        onPatched={noop}
        onDeleted={noop}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(/impossible de charger les avancées/i)
  })
})
