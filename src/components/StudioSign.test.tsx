/**
 * Coverage for the footer studio sign — it must report the real capacity
 * state and never invent one when /api/capacity is unreachable.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { StudioSign } from './StudioSign'
import { getCapacityLive, type CapacityLive } from '../lib/sessionsApi'

vi.mock('../lib/sessionsApi', () => ({
  getCapacityLive: vi.fn(),
}))
const mockCapacity = vi.mocked(getCapacityLive)

afterEach(() => {
  mockCapacity.mockReset()
})

function capacity(over: Partial<CapacityLive>): CapacityLive {
  return { active: 0, triage: 0, cap: 2, activeCap: 2, triageCap: null, atCap: false, ...over }
}

// StudioSign renders a router <Link> (the "back to top of home" stamp), so
// it needs a Router ancestor same as any other Link-bearing component under
// test — see FeatureDot.test.tsx for the same pattern.
function renderSign(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('StudioSign', () => {
  it('shows the studio open when not at capacity', async () => {
    mockCapacity.mockResolvedValue(capacity({ atCap: false }))
    renderSign(<StudioSign lang="en" />)
    expect(await screen.findByText(/open for projects/i)).toBeInTheDocument()
  })

  it('shows the waitlist when at capacity', async () => {
    mockCapacity.mockResolvedValue(capacity({ atCap: true }))
    renderSign(<StudioSign lang="en" />)
    expect(await screen.findByText(/waitlist open/i)).toBeInTheDocument()
  })

  it('falls back to a neutral line when capacity cannot be read', async () => {
    mockCapacity.mockRejectedValue(new Error('offline'))
    renderSign(<StudioSign lang="en" />)
    expect(await screen.findByText(/québec/i)).toBeInTheDocument()
  })
})
