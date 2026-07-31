/**
 * Coverage for the U2 fix to onRestore: the handler used to be a bare
 * try/finally with no catch, so a rejected undeleteSession() left the row
 * sitting in the trash with no signal that anything went wrong — a failed
 * restore looked identical to "hasn't finished yet". These tests pin the
 * honest behaviour: a rejection surfaces a retryable error and the row
 * stays put; a success drops the row with no error banner.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext, type AuthState } from '../lib/authContext'
import * as sessionsApi from '../lib/sessionsApi'
import type { SessionRow } from '../lib/sessionsApi'
import { AdminTrash } from './AdminTrash'

function authValue(overrides: Partial<AuthState> = {}): AuthState {
  return {
    email: 'marc@example.com',
    isAdmin: true,
    realIsAdmin: true,
    previewAsUser: false,
    setPreviewAsUser: vi.fn(),
    loading: false,
    requestLink: vi.fn().mockResolvedValue(true),
    logout: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function row(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: 's1',
    email: 'visitor@example.com',
    intake_json: null,
    status: 'triage',
    created_at: 0,
    updated_at: 0,
    deleted_at: 1000,
    status_history: null,
    showcased_at: null,
    showcase_title: null,
    showcase_tagline: null,
    tier: null,
    tier4_amount_cents: null,
    tier3_split: null,
    custodian_status: null,
    custodian_plan: null,
    all_yours_acknowledged_at: null,
    decline_note: null,
    community_discount: 0,
    napkin_attachment_id: null,
    ...overrides,
  }
}

function renderTrash() {
  return render(
    <MemoryRouter initialEntries={['/en/admin/trash']}>
      <AuthContext.Provider value={authValue()}>
        <AdminTrash lang="en" />
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AdminTrash restore failure', () => {
  it('shows a retryable error and keeps the row when undeleteSession rejects', async () => {
    vi.spyOn(sessionsApi, 'listSessions').mockResolvedValue({ sessions: [row()] })
    vi.spyOn(sessionsApi, 'undeleteSession').mockRejectedValue(new Error('network down'))
    renderTrash()

    fireEvent.click(await screen.findByRole('button', { name: /restore/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/didn't go through/i)
    // A failed restore must not read as done — the row stays in the trash.
    expect(screen.getByText('visitor@example.com')).toBeInTheDocument()
  })

  it('drops the row with no error banner when undeleteSession succeeds', async () => {
    vi.spyOn(sessionsApi, 'listSessions').mockResolvedValue({ sessions: [row()] })
    vi.spyOn(sessionsApi, 'undeleteSession').mockResolvedValue({
      session: row({ deleted_at: null }),
    })
    renderTrash()

    fireEvent.click(await screen.findByRole('button', { name: /restore/i }))

    await waitFor(() => expect(screen.queryByText('visitor@example.com')).not.toBeInTheDocument())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders the session status through the real pill class with a bilingual label', async () => {
    vi.spyOn(sessionsApi, 'listSessions').mockResolvedValue({
      sessions: [row({ status: 'active' })],
    })
    renderTrash()

    const pill = await screen.findByText('In progress')
    expect(pill.className).toMatch(/session-frame__status-pill/)
    expect(pill.className).toMatch(/session-frame__status-pill--active/)
  })
})
