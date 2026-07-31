/**
 * Coverage for the Loi 25 right-of-access page's failure path. Before this
 * fix, a rejected exportMyData() call was caught and replaced with a
 * fabricated empty bundle — so an outage rendered "I hold no sessions in
 * your name" on the one page whose entire job is telling a visitor the
 * truth about their data. These tests pin the honest behaviour: a fetch
 * failure shows a retryable error, never the empty state.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext, type AuthState } from '../lib/authContext'
import * as exportLib from '../lib/export'
import type { ExportBundle } from '../lib/export'
import { MyData } from './MyData'

function authValue(overrides: Partial<AuthState> = {}): AuthState {
  return {
    email: 'visitor@example.com',
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

function renderMyData(auth: AuthState) {
  return render(
    <MemoryRouter initialEntries={['/en/me/data']}>
      <AuthContext.Provider value={auth}>
        <MyData lang="en" />
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('MyData load failure', () => {
  it('shows a retryable error, not the fabricated empty state, when exportMyData rejects', async () => {
    vi.spyOn(exportLib, 'exportMyData').mockRejectedValue(new Error('network down'))
    renderMyData(authValue())

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn.t load your data/i)
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    // The old fabricated-bundle behaviour rendered this exact empty-state
    // copy on any failure — it must never appear on a genuine outage.
    expect(screen.queryByText(/i hold no sessions in your name/i)).not.toBeInTheDocument()
  })

  it('retry re-fetches and renders the real bundle once it succeeds', async () => {
    const bundle: ExportBundle = {
      exportFormat: 'marc-portal-export-v1',
      exportedAt: '2026-07-01T00:00:00.000Z',
      exportedBy: 'visitor@example.com',
      sessions: [],
    }
    vi.spyOn(exportLib, 'exportMyData')
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(bundle)
    renderMyData(authValue())

    fireEvent.click(await screen.findByRole('button', { name: /retry/i }))

    await waitFor(() =>
      expect(screen.getByText(/prepared for visitor@example.com/i)).toBeInTheDocument(),
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
