/**
 * Coverage for the suppressed-email surfacing on /login/sent. Before this
 * fix, a visitor whose address had previously hard-bounced (or unsubscribed,
 * or complained) got the generic "check your spam folder" fallback forever —
 * actively misleading, since the server already knows the mail won't
 * deliver. Login.tsx threads the `suppressed` reason through as a query
 * param (see Login.test.tsx for that half); this covers the render side.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext, type AuthState } from '../lib/authContext'
import { MagicLinkSent } from './MagicLinkSent'

// MagicLinkSent renders <Header/>, which reads useAuth() — stub the minimum
// signed-out shape so the page doesn't need a full AuthProvider round trip.
const authValue: AuthState = {
  email: null,
  isAdmin: false,
  realIsAdmin: false,
  previewAsUser: false,
  setPreviewAsUser: vi.fn(),
  loading: false,
  requestLink: vi.fn().mockResolvedValue({ sent: true }),
  logout: vi.fn().mockResolvedValue(undefined),
  refresh: vi.fn().mockResolvedValue(undefined),
}

function renderSent(query: string) {
  return render(
    <MemoryRouter initialEntries={[`/en/login/sent${query}`]}>
      <AuthContext.Provider value={authValue}>
        <MagicLinkSent lang="en" />
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}

describe('MagicLinkSent suppressed-email surfacing', () => {
  it('shows the generic fallback when no suppression reason is present', () => {
    renderSent('?email=v%40example.com')
    expect(screen.getByText(/check your spam folder/i)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('replaces the fallback with a hard-bounce-specific message', () => {
    renderSent('?email=v%40example.com&suppressed=hard-bounce')
    expect(screen.queryByText(/check your spam folder/i)).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/bounced our mail before/i)
  })

  it('replaces the fallback with an unsubscribed-specific message', () => {
    renderSent('?email=v%40example.com&suppressed=unsubscribed')
    expect(screen.getByRole('alert')).toHaveTextContent(/unsubscribed from our emails/i)
  })

  it('ignores an unrecognized suppression value and falls back to the default copy', () => {
    // Defensive: a malformed or future-unknown value shouldn't crash or
    // silently render "undefined" — it should just behave as if absent.
    renderSent('?email=v%40example.com&suppressed=something-new')
    expect(screen.getByText(/check your spam folder/i)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
