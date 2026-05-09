import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SessionStatusStrip } from './SessionStatusStrip'

describe('SessionStatusStrip read mode', () => {
  it('renders the four flow steps and no rejected pill on a normal status', () => {
    render(<SessionStatusStrip lang="en" status="active" />)
    expect(screen.getByText(/Draft/)).toBeInTheDocument()
    expect(screen.getByText(/Triage/)).toBeInTheDocument()
    expect(screen.getByText(/In progress/)).toBeInTheDocument()
    expect(screen.getByText(/Shipped/)).toBeInTheDocument()
    expect(screen.queryByText(/Rejected/)).not.toBeInTheDocument()
  })

  it('marks current and prior steps as --done; later steps stay neutral', () => {
    const { container } = render(<SessionStatusStrip lang="en" status="active" />)
    const items = container.querySelectorAll('.intake__progress-step')
    // 0 draft, 1 triage, 2 active (current), 3 shipped
    expect(items[0]?.className).toMatch(/--done/)
    expect(items[1]?.className).toMatch(/--done/)
    expect(items[2]?.className).toMatch(/--current/)
    expect(items[3]?.className).not.toMatch(/--done/)
  })

  it('on rejected: rail loses its current marker, off-rail pill turns on', () => {
    const { container } = render(<SessionStatusStrip lang="en" status="rejected" />)
    const items = container.querySelectorAll('.intake__progress-step')
    for (const el of items) {
      expect(el.className).not.toMatch(/--current/)
    }
    expect(container.querySelector('.session-strip__rejected--on')).not.toBeNull()
  })
})

describe('SessionStatusStrip admin onPick', () => {
  it('renders each step as a button; the current one is disabled', () => {
    render(<SessionStatusStrip lang="en" status="triage" onPick={() => {}} />)
    // 4 flow buttons + 1 rejected off-rail button = 5 total
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBe(5)
    const triageBtn = buttons.find((b) => /Triage/.test(b.textContent ?? ''))
    expect(triageBtn).toBeDefined()
    expect(triageBtn).toBeDisabled()
  })

  it('clicking a non-current step fires onPick with that status', () => {
    const onPick = vi.fn()
    render(<SessionStatusStrip lang="en" status="triage" onPick={onPick} />)
    const activeBtn = screen.getByRole('button', { name: /In progress/i })
    fireEvent.click(activeBtn)
    expect(onPick).toHaveBeenCalledWith('active')
  })

  it('shows the rejected button when admin can act, even on a non-rejected session', () => {
    render(<SessionStatusStrip lang="en" status="active" onPick={() => {}} />)
    expect(screen.getByRole('button', { name: /Rejected/i })).toBeInTheDocument()
  })
})
