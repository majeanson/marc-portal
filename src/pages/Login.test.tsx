/**
 * Coverage for the anti-enumeration / transport-failure distinction in
 * onSubmit. The server always 200s a request-link call (so a visitor can't
 * probe which emails have accounts) — but requestLink() itself returns
 * false when the *request never reached the server* (offline, DNS, server
 * down). Before this fix, onSubmit navigated to "check your email"
 * unconditionally, which told an offline visitor their email was sent when
 * it never left the browser.
 *
 * useNavigate is mocked at the react-router-dom module boundary so the test
 * asserts the state-logic decision (navigate vs. stay + show error), not a
 * router-internals round trip.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type * as ReactRouterDom from 'react-router-dom'
import { AuthContext, type AuthState } from '../lib/authContext'
import { Login } from './Login'

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }))
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactRouterDom>()
  return { ...actual, useNavigate: () => mockNavigate }
})

function authValue(overrides: Partial<AuthState> = {}): AuthState {
  return {
    email: null,
    isAdmin: false,
    realIsAdmin: false,
    previewAsUser: false,
    setPreviewAsUser: vi.fn(),
    loading: false,
    requestLink: vi.fn().mockResolvedValue(true),
    logout: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function renderLogin(auth: AuthState, path = '/en/login') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthContext.Provider value={auth}>
        <Login lang="en" />
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  mockNavigate.mockClear()
})

describe('Login onSubmit', () => {
  it('stays on the form and shows a transport error when requestLink resolves false', async () => {
    const requestLink = vi.fn().mockResolvedValue(false)
    renderLogin(authValue({ requestLink }))
    fireEvent.change(screen.getByLabelText(/your email/i), {
      target: { value: 'v@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send the link/i }))

    expect(await screen.findByText(/didn't send/i)).toBeInTheDocument()
    await waitFor(() => expect(requestLink).toHaveBeenCalledWith('v@example.com', 'en'))
    // Never navigated — the request never reached the server, so telling
    // the visitor "check your email" would be a lie.
    expect(mockNavigate).not.toHaveBeenCalled()
    // Re-enabled so the visitor can retry without reloading.
    expect(screen.getByRole('button', { name: /send the link/i })).not.toBeDisabled()
  })

  it('navigates to the sent page when requestLink resolves true', async () => {
    const requestLink = vi.fn().mockResolvedValue(true)
    renderLogin(authValue({ requestLink }))
    fireEvent.change(screen.getByLabelText(/your email/i), {
      target: { value: 'v@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send the link/i }))

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/en/login/sent?email=v%40example.com'),
    )
    expect(screen.queryByText(/didn't send/i)).not.toBeInTheDocument()
  })
})

describe('Login email seeding from ?email=', () => {
  it('pre-fills the email field from a valid ?email= param', () => {
    renderLogin(authValue(), '/en/login?email=v%40example.com')
    expect(screen.getByLabelText(/your email/i)).toHaveValue('v@example.com')
  })

  it('ignores a junk ?email= param and leaves the field blank', () => {
    renderLogin(authValue(), '/en/login?email=not-an-email')
    expect(screen.getByLabelText(/your email/i)).toHaveValue('')
  })
})
