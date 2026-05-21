/**
 * Smoke coverage for the /meta page. Verifies the manifest projection
 * renders, status pills resolve, freshness math classifies correctly,
 * the expandable body carries the readable feature.json, and the live
 * link is localized to the EN mirror.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../lib/authContext'
import { TenantContext } from '../lib/tenantContext'

// Header pulls auth + tenant context; stub them minimally so the tree
// mounts without the real fetch-based providers.
function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter>
      <TenantContext.Provider
        value={{
          tenant: null,
          loading: false,
          refresh: vi.fn().mockResolvedValue(undefined),
        }}
      >
        <AuthContext.Provider
          value={{
            email: null,
            isAdmin: false,
            realIsAdmin: false,
            previewAsUser: false,
            setPreviewAsUser: vi.fn(),
            loading: false,
            requestLink: vi.fn().mockResolvedValue(false),
            logout: vi.fn().mockResolvedValue(undefined),
            refresh: vi.fn().mockResolvedValue(undefined),
          }}
        >
          {children}
        </AuthContext.Provider>
      </TenantContext.Provider>
    </MemoryRouter>
  )
}

// Mock the build-time manifest BEFORE importing the page. Vitest hoists
// vi.mock calls, but we still need an explicit factory so the path resolves.
vi.mock('../data/lac-features.json', () => ({
  default: {
    generatedAt: '2026-05-17T12:00:00.000Z',
    features: [
      {
        featureKey: 'feat-2026-001',
        title: 'Active test feature',
        status: 'active',
        domain: 'test/active',
        tags: ['tag-a', 'tag-b'],
        componentFile: 'src/pages/Active.tsx',
        liveUrl: '/intake',
        problem: 'A short problem statement for the active feature.',
        analysis: 'How the active feature is built, in one sentence.',
        decisions: [
          {
            decision: 'A decision was taken here',
            rationale: 'Because of a good reason.',
            recommendation: 'Keep doing the good thing.',
          },
          {
            decision: 'A second decision',
            rationale: 'Another reason.',
            recommendation: 'Another recommendation.',
          },
        ],
        successCriteria: '- The first criterion holds\n- The second criterion holds',
        knownLimitations: ['One known limitation'],
        statusHistory: [{ from: 'draft', to: 'active', date: '2026-05-07' }],
        lastTransitionDate: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10),
      },
      {
        featureKey: 'feat-2026-002',
        title: 'Frozen test feature',
        status: 'frozen',
        domain: 'test/frozen',
        tags: [],
        componentFile: 'src/pages/Frozen.tsx',
        liveUrl: '/',
        problem: 'A frozen feature.',
        analysis: '',
        decisions: [],
        successCriteria: '',
        knownLimitations: [],
        statusHistory: [{ from: 'active', to: 'frozen', date: '2025-01-01' }],
        lastTransitionDate: '2025-01-01',
      },
    ],
  },
}))

import { Meta } from './Meta'

// The embedded <Scorecard> fetches /api/health + /api/meta/stats on mount.
// Stub fetch so the Meta tests stay offline and deterministic.
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('offline in test'))),
  )
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Meta page', () => {
  it('renders one card per manifest feature with title + status pill', () => {
    render(
      <Wrap>
        <Meta lang="en" />
      </Wrap>,
    )
    expect(screen.getByRole('heading', { name: 'Active test feature' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Frozen test feature' })).toBeInTheDocument()
    // Both status labels resolve from the copy map.
    expect(screen.getAllByText(/^active$/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/^frozen$/).length).toBeGreaterThanOrEqual(1)
  })

  it('expanded body carries the readable feature.json (problem, analysis, decisions)', () => {
    render(
      <Wrap>
        <Meta lang="en" />
      </Wrap>,
    )
    // <details> renders its children in the DOM even while collapsed.
    expect(
      screen.getByText('How the active feature is built, in one sentence.'),
    ).toBeInTheDocument()
    expect(screen.getByText('A decision was taken here')).toBeInTheDocument()
    expect(screen.getByText('The first criterion holds')).toBeInTheDocument()
    expect(screen.getByText('One known limitation')).toBeInTheDocument()
  })

  it('live link is localized to the EN mirror', () => {
    render(
      <Wrap>
        <Meta lang="en" />
      </Wrap>,
    )
    const links = screen.getAllByText(/see it live/)
    // liveUrl '/intake' → '/en/intake'; liveUrl '/' → '/en'
    expect(links[0].closest('a')?.getAttribute('href')).toBe('/en/intake')
    expect(links[1].closest('a')?.getAttribute('href')).toBe('/en')
  })

  it('freshness pill: recent date → fresh, year-old date → stale', () => {
    render(
      <Wrap>
        <Meta lang="en" />
      </Wrap>,
    )
    // The 30-day-old transition reads as "fresh"; the year-old transition
    // reads as "stale" once age crosses the 180-day threshold.
    expect(screen.getByText(/fresh/i)).toBeInTheDocument()
    expect(screen.getByText(/stale/i)).toBeInTheDocument()
  })

  it('honors the lang prop on copy + back link', () => {
    render(
      <Wrap>
        <Meta lang="fr" />
      </Wrap>,
    )
    expect(screen.getByRole('heading', { name: 'Sous le capot' })).toBeInTheDocument()
    // FR back link points to /, EN to /en
    const backLinks = screen.getAllByText(/Retour à l'accueil/)
    expect(backLinks.length).toBeGreaterThan(0)
  })

  it('shows the manifest count + generated-on line', () => {
    render(
      <Wrap>
        <Meta lang="en" />
      </Wrap>,
    )
    expect(screen.getByText(/2 features/)).toBeInTheDocument()
    expect(screen.getByText(/Manifest generated on/)).toBeInTheDocument()
  })
})
