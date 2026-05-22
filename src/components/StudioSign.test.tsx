/**
 * Coverage for the footer studio sign — it must report the real capacity
 * state and never invent one when /api/capacity is unreachable.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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
  return { active: 0, triage: 0, cap: 2, activeCap: 2, triageCap: 3, atCap: false, ...over }
}

describe('StudioSign', () => {
  it('shows the studio open when not at capacity', async () => {
    mockCapacity.mockResolvedValue(capacity({ atCap: false }))
    render(<StudioSign lang="en" />)
    expect(await screen.findByText(/open for projects/i)).toBeInTheDocument()
  })

  it('shows the waitlist when at capacity', async () => {
    mockCapacity.mockResolvedValue(capacity({ atCap: true }))
    render(<StudioSign lang="en" />)
    expect(await screen.findByText(/waitlist open/i)).toBeInTheDocument()
  })

  it('falls back to a neutral line when capacity cannot be read', async () => {
    mockCapacity.mockRejectedValue(new Error('offline'))
    render(<StudioSign lang="en" />)
    expect(await screen.findByText(/québec/i)).toBeInTheDocument()
  })
})
