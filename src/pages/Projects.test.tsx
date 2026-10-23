/**
 * The gallery names itself after what is on it and only offers filters that
 * lead somewhere. Both came from the 2026-10-23 stranger review: a page titled
 * « Projets en cours » over nine SHIPPED cards, and four of six status chips
 * answering « Aucun projet ne correspond ».
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { Projects } from './Projects'
import { listPublicProjects, type PublicProject } from '../lib/sessionsApi'

vi.mock('../lib/sessionsApi', () => ({
  listPublicProjects: vi.fn(),
}))
// Chrome that needs AuthProvider/Tenant is irrelevant to what is asserted here.
vi.mock('../components/Header', () => ({ Header: () => null }))
vi.mock('../components/Footer', () => ({ Footer: () => null }))
vi.mock('../components/FeatureContinue', () => ({ FeatureContinue: () => null }))
vi.mock('../components/MobileStickyCta', () => ({ MobileStickyCta: () => null }))
const mockList = vi.mocked(listPublicProjects)

afterEach(() => {
  mockList.mockReset()
})

function project(id: string, status: string): PublicProject {
  return {
    id,
    showcasedAt: 1_700_000_000_000,
    title: `Build ${id}`,
    tagline: 'x',
    titleEn: null,
    taglineEn: null,
    status,
    tier: 1,
    currentBuild: null,
  }
}

function renderPage(lang: 'fr' | 'en' = 'fr') {
  const router = createMemoryRouter([{ path: '/', element: <Projects lang={lang} /> }], {
    initialEntries: ['/'],
  })
  return render(<RouterProvider router={router} />)
}

describe('Projects heading + status filters', () => {
  it('says « livrés » and offers no status row when everything is shipped', async () => {
    mockList.mockResolvedValue({ projects: [project('a', 'shipped'), project('b', 'shipped')] })
    renderPage()
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Projets livrés'),
    )
    expect(screen.queryByRole('group', { name: 'État' })).toBeNull()
  })

  it('keeps « en cours » and shows only statuses that have cards, with counts', async () => {
    mockList.mockResolvedValue({
      projects: [project('a', 'shipped'), project('b', 'shipped'), project('c', 'active')],
    })
    renderPage()
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Projets en cours'),
    )
    const group = screen.getByRole('group', { name: 'État' })
    expect(group.textContent).toContain('livré 2')
    expect(group.textContent).toContain('en cours 1')
    expect(group.textContent).not.toContain('brouillon')
    expect(group.textContent).not.toContain('refusé')
  })
})
