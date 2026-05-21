/**
 * Coverage for the /meta A2 scorecard. Verifies the build-time stats
 * render from the static import, and the live tiles resolve from the
 * mocked /api/health + /api/meta/stats responses.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('../data/portal-stats.json', () => ({
  default: {
    testCount: 381,
    commit: 'abc1234',
    builtAt: '2026-05-21T12:00:00.000Z',
  },
}))

import { Scorecard } from './Scorecard'

function mockFetch(handlers: Record<string, { ok: boolean; body: unknown }>) {
  return vi.fn((url: string) => {
    const match = Object.keys(handlers).find((k) => url.includes(k))
    if (!match) return Promise.reject(new Error(`unmocked ${url}`))
    const { ok, body } = handlers[match]
    return Promise.resolve({
      ok,
      status: ok ? 200 : 503,
      json: () => Promise.resolve(body),
    } as Response)
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Scorecard', () => {
  it('renders the build-time test count and commit', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    )
    render(<Scorecard lang="fr" />)
    expect(screen.getByText('381')).toBeInTheDocument()
    expect(screen.getByText('abc1234')).toBeInTheDocument()
  })

  it('shows the service as operational when /api/health is ok', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        '/api/health': { ok: true, body: { ok: true, db: 'ok', ts: 1 } },
        '/api/meta/stats': {
          ok: true,
          body: { shippedCount: 2, medianResponseHours: 41.5, sampleSize: 3, slaHours: 72 },
        },
      }),
    )
    render(<Scorecard lang="en" />)
    await waitFor(() => expect(screen.getByText('operational')).toBeInTheDocument())
    // Median beats the 72h SLA → response tile shows the measured value.
    expect(screen.getByText('41.5 h')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('falls back to a pending label when there is no intake data yet', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        '/api/health': { ok: true, body: { ok: true } },
        '/api/meta/stats': {
          ok: true,
          body: { shippedCount: 0, medianResponseHours: null, sampleSize: 0, slaHours: 72 },
        },
      }),
    )
    render(<Scorecard lang="en" />)
    await waitFor(() => expect(screen.getByText('first case still to come')).toBeInTheDocument())
  })
})
