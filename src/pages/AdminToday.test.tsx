/**
 * Pins the U5 live region: /admin/today re-fetches when the tab comes back
 * into view, which swaps every count without a sound. The SR-only status
 * line is how a screen-reader user hears what moved. These tests check it
 * is a polite, atomic region and that its text follows the refreshed data.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import * as todayApi from '../lib/todayApi'
import type { TodayResponse } from '../lib/todayApi'
import { AdminToday } from './AdminToday'

function payload(active: number, triage: number): TodayResponse {
  return {
    sessions: [],
    overduePayments: [],
    slaBreaches: [],
    unansweredMessages: [],
    systemHealth: {
      outboxPending: 0,
      outboxStuck: 0,
      emailBouncesLast7d: 0,
      emailComplaintsLast7d: 0,
      openAdminAlerts: 0,
      capacity: { active, triage, activeCap: 2, triageCap: null },
      lastDigestAtS: 1_700_000_000,
      digestStale: false,
    },
    custodianAlerts: { pastDue: [], recentSwitches: [] },
    generatedAtS: 1_700_000_000,
  }
}

function renderToday(lang: 'fr' | 'en') {
  return render(
    <MemoryRouter>
      <AdminToday lang={lang} />
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AdminToday live region', () => {
  it('is a polite, atomic status region carrying the headline counts', async () => {
    vi.spyOn(todayApi, 'getToday').mockResolvedValue(payload(1, 3))
    renderToday('en')

    const region = await screen.findByText(/Dashboard updated/)
    expect(region).toHaveAttribute('role', 'status')
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region).toHaveAttribute('aria-atomic', 'true')
    expect(region).toHaveClass('sr-only')
    expect(region).toHaveTextContent('Active: 1. Triage: 3.')
  })

  it('updates in place when the tab-visible refresh brings new counts', async () => {
    vi.spyOn(todayApi, 'getToday')
      .mockResolvedValueOnce(payload(1, 3))
      .mockResolvedValueOnce(payload(2, 4))
    renderToday('fr')

    const region = await screen.findByText(/Tableau à jour/)
    expect(region).toHaveTextContent('Actifs : 1. Triage : 3.')

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await waitFor(() => expect(region).toHaveTextContent('Actifs : 2. Triage : 4.'))
  })
})
