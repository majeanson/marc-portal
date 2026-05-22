import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SessionTierStrip } from './SessionTierStrip'

describe('SessionTierStrip', () => {
  it('renders all five tier buttons plus a clear button', () => {
    render(<SessionTierStrip lang="en" tier={1} onPick={() => {}} />)
    expect(screen.getByRole('button', { name: /T0/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /T1/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /T2/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /T3/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /T4/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /None/i })).toBeInTheDocument()
  })

  it('disables the current tier button', () => {
    render(<SessionTierStrip lang="en" tier={2} onPick={() => {}} />)
    expect(screen.getByRole('button', { name: /T2/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /T1/ })).not.toBeDisabled()
  })

  it('disables the clear button when tier is null', () => {
    render(<SessionTierStrip lang="en" tier={null} onPick={() => {}} />)
    expect(screen.getByRole('button', { name: /None/i })).toBeDisabled()
  })

  it('clicking a tier fires onPick with that number', () => {
    const onPick = vi.fn()
    render(<SessionTierStrip lang="en" tier={null} onPick={onPick} />)
    fireEvent.click(screen.getByRole('button', { name: /T1/ }))
    expect(onPick).toHaveBeenCalledWith(1)
  })

  it('clicking clear fires onPick with null', () => {
    const onPick = vi.fn()
    render(<SessionTierStrip lang="en" tier={2} onPick={onPick} />)
    fireEvent.click(screen.getByRole('button', { name: /None/i }))
    expect(onPick).toHaveBeenCalledWith(null)
  })
})
