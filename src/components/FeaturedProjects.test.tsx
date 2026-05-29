/**
 * Coverage for the featured-projects strip. The states matter beyond their
 * own UX: the homepage prerender (scripts/prerender.mjs) freezes the *loading*
 * state into the static first paint, so "loading renders the skeleton, not the
 * error panel" is the contract that keeps the boot flicker-free. The resolved
 * and errored branches are covered too so a refactor can't silently swap them.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { FeaturedProjects, FEATURED_LIMIT } from './FeaturedProjects'
import { listPublicProjects, type PublicProject } from '../lib/sessionsApi'

vi.mock('../lib/sessionsApi', () => ({
  listPublicProjects: vi.fn(),
}))
const mockList = vi.mocked(listPublicProjects)

afterEach(() => {
  mockList.mockReset()
})

function project(over: Partial<PublicProject> = {}): PublicProject {
  return {
    id: 'p1',
    showcasedAt: 1_700_000_000_000,
    title: 'A small build',
    tagline: 'one weekend, one idea',
    status: 'shipped',
    tier: 1,
    currentBuild: null,
    ...over,
  }
}

function renderStrip() {
  // A data router (not plain MemoryRouter): FeaturedCard reads
  // useViewTransitionState, which requires one.
  const router = createMemoryRouter([{ path: '/', element: <FeaturedProjects lang="en" /> }], {
    initialEntries: ['/'],
  })
  return render(<RouterProvider router={router} />)
}

describe('FeaturedProjects', () => {
  it('shows the skeleton grid while the fetch is in flight', () => {
    // A pending promise that never settles — the prerender holds the request
    // open the same way to bake this exact state into the static first paint.
    mockList.mockReturnValue(new Promise<{ projects: PublicProject[] }>(() => {}))
    renderStrip()
    expect(document.querySelectorAll('.project-card--skeleton')).toHaveLength(FEATURED_LIMIT)
    // The error/empty panels must NOT be the loading paint.
    expect(screen.queryByText(/can.t load the projects/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/lands here very soon/i)).not.toBeInTheDocument()
    // Screen readers still hear the loading state.
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i)
  })

  it('fills in the cards once the fetch resolves', async () => {
    mockList.mockResolvedValue({
      projects: [
        project({ id: 'a', title: 'First' }),
        project({ id: 'b', title: 'Second' }),
        project({ id: 'c', title: 'Third' }),
      ],
    })
    renderStrip()
    expect(await screen.findByText('First')).toBeInTheDocument()
    expect(screen.getByText('Third')).toBeInTheDocument()
    // The skeleton is gone once real cards land.
    expect(document.querySelectorAll('.project-card--skeleton')).toHaveLength(0)
  })

  it('falls back to the empty panel below the card threshold', async () => {
    // Fewer than FEATURED_LIMIT cards reads as half-built, so the strip shows
    // the invitation panel instead of a thin one-card row.
    mockList.mockResolvedValue({ projects: [project()] })
    renderStrip()
    expect(await screen.findByText(/lands here very soon/i)).toBeInTheDocument()
    expect(document.querySelectorAll('.project-card--skeleton')).toHaveLength(0)
  })

  it('shows the error panel when the fetch rejects', async () => {
    mockList.mockRejectedValue(new Error('offline'))
    renderStrip()
    expect(await screen.findByText(/can.t load the projects/i)).toBeInTheDocument()
    expect(document.querySelectorAll('.project-card--skeleton')).toHaveLength(0)
  })
})
