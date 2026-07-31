/**
 * Coverage for the U2 fix to onStatusChange's 409 handling. Before this fix,
 * every 409 from PATCH /api/sessions/:id set the same `staleConflict` flag —
 * but the atomic ACTIVE_CAP guard (functions/api/sessions/[id].ts) also 409s
 * with a message containing "at capacity" when promoting into `active` would
 * push past the two-build cap. That's a capacity wall, not a stale row:
 * "refresh and reapply" is the wrong advice since reloading won't free a
 * slot. These tests pin the discrimination: a capacity 409 renders the
 * capacity copy and does NOT re-fetch; any other 409 refetches (the stale-row
 * path) and does not render the capacity copy. A third test covers the
 * in-flight guard added alongside it (double-click can't fire two PATCHes).
 *
 * SessionShowcase and OperatorNotesPanel are stubbed out — they live on the
 * admin-only "Opérateur" tab, are irrelevant to the statut-tab behaviour
 * under test, and would otherwise make real (unmocked) fetch calls in this
 * environment.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext, type AuthState } from '../lib/authContext'
import { ApiError } from '../lib/api'
import * as sessionsApi from '../lib/sessionsApi'
import type { SessionRow } from '../lib/sessionsApi'
import * as advancementsApi from '../lib/advancementsApi'
import * as paymentsApi from '../lib/paymentsApi'
import { SessionPage } from './SessionPage'

vi.mock('../components/SessionShowcase', () => ({
  SessionShowcase: () => null,
}))
vi.mock('../components/OperatorNotesPanel', () => ({
  OperatorNotesPanel: () => null,
}))

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

function makeSession(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: 'session-1234',
    email: 'visitor@example.com',
    intake_json: null,
    status: 'triage',
    created_at: 0,
    updated_at: 0,
    deleted_at: null,
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

function renderSessionPage() {
  window.location.hash = ''
  return render(
    <MemoryRouter initialEntries={['/en/session/session-1234']}>
      <AuthContext.Provider value={authValue()}>
        <Routes>
          <Route path="/en/session/:id" element={<SessionPage lang="en" />} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SessionPage onStatusChange 409 discrimination', () => {
  it('renders the capacity copy (not stale-conflict) and does not refetch on an "at capacity" 409', async () => {
    const getSession = vi
      .spyOn(sessionsApi, 'getSession')
      .mockResolvedValue({ session: makeSession() })
    vi.spyOn(sessionsApi, 'listMessages').mockResolvedValue({ messages: [] })
    vi.spyOn(advancementsApi, 'listAdvancements').mockResolvedValue({ advancements: [] })
    vi.spyOn(paymentsApi, 'getPaymentSummary').mockRejectedValue(new Error('no summary'))
    vi.spyOn(sessionsApi, 'patchSession').mockRejectedValue(
      new ApiError(409, 'active at capacity — ship or reject a current build first'),
    )

    renderSessionPage()

    fireEvent.click(await screen.findByRole('button', { name: /in progress/i }))

    expect(await screen.findByText(/already two active builds/i)).toBeInTheDocument()
    expect(screen.queryByText(/changed somewhere else/i)).not.toBeInTheDocument()
    // Capacity is a wall, not a stale row — refetching wouldn't free a slot,
    // so the initial load should be the only getSession call.
    expect(getSession).toHaveBeenCalledTimes(1)
  })

  it('refetches and does not render the capacity copy on a generic (stale-row) 409', async () => {
    const getSession = vi
      .spyOn(sessionsApi, 'getSession')
      .mockResolvedValue({ session: makeSession() })
    vi.spyOn(sessionsApi, 'listMessages').mockResolvedValue({ messages: [] })
    vi.spyOn(advancementsApi, 'listAdvancements').mockResolvedValue({ advancements: [] })
    vi.spyOn(paymentsApi, 'getPaymentSummary').mockRejectedValue(new Error('no summary'))
    vi.spyOn(sessionsApi, 'patchSession').mockRejectedValue(
      new ApiError(409, 'session has changed since you loaded it'),
    )

    renderSessionPage()

    fireEvent.click(await screen.findByRole('button', { name: /in progress/i }))

    await waitFor(() => expect(getSession).toHaveBeenCalledTimes(2))
    expect(screen.queryByText(/already two active builds/i)).not.toBeInTheDocument()
  })
})

describe('SessionPage onStatusChange in-flight guard', () => {
  it('disables the status pills while a PATCH is in flight, then re-enables them', async () => {
    vi.spyOn(sessionsApi, 'getSession').mockResolvedValue({ session: makeSession() })
    vi.spyOn(sessionsApi, 'listMessages').mockResolvedValue({ messages: [] })
    vi.spyOn(advancementsApi, 'listAdvancements').mockResolvedValue({ advancements: [] })
    vi.spyOn(paymentsApi, 'getPaymentSummary').mockRejectedValue(new Error('no summary'))
    let resolvePatch: (v: { session: SessionRow }) => void = () => {}
    vi.spyOn(sessionsApi, 'patchSession').mockReturnValue(
      new Promise((resolve) => {
        resolvePatch = resolve
      }),
    )

    renderSessionPage()

    const activeBtn = await screen.findByRole('button', { name: /in progress/i })
    fireEvent.click(activeBtn)

    // In flight: every pill in the strip (not just the one clicked) is
    // disabled — a double-click on a different pill must not fire a second
    // PATCH (the server emails the visitor on every status transition).
    await waitFor(() => expect(activeBtn).toBeDisabled())
    const rejectBtn = screen.getByRole('button', { name: /rejected/i })
    expect(rejectBtn).toBeDisabled()

    resolvePatch({ session: makeSession({ status: 'active', updated_at: 1 }) })

    await waitFor(() => expect(rejectBtn).not.toBeDisabled())
  })
})
