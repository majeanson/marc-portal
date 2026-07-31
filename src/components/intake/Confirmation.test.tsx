/**
 * Coverage for the magic-link resend button's feedback states. Before this
 * fix, onResendClick had no catch and no success feedback — the button just
 * reverted to its idle label whether the resend worked or not, so a visitor
 * who mistyped their email (or hit a network blip) had no signal to act on.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Confirmation } from './Confirmation'

const baseProps = {
  lang: 'en' as const,
  account: { email: 'visitor@example.com' },
  type: 'paperasse' as const,
  values: {},
  waitlist: false,
  submittedAt: '2026-07-01',
  magicLinkSent: true,
  onStartOver: vi.fn(),
}

function renderConfirmation(onResendLink: () => Promise<boolean>) {
  return render(
    <MemoryRouter>
      <Confirmation {...baseProps} onResendLink={onResendLink} />
    </MemoryRouter>,
  )
}

describe('Confirmation resend feedback', () => {
  it('shows a confirmation line when the resend succeeds', async () => {
    const onResendLink = vi.fn().mockResolvedValue(true)
    renderConfirmation(onResendLink)
    fireEvent.click(screen.getByRole('button', { name: /resend the link/i }))
    expect(await screen.findByText(/link resent/i)).toBeInTheDocument()
    expect(screen.queryByText(/didn't send/i)).not.toBeInTheDocument()
  })

  it('shows an error line when the resend fails', async () => {
    const onResendLink = vi.fn().mockResolvedValue(false)
    renderConfirmation(onResendLink)
    fireEvent.click(screen.getByRole('button', { name: /resend the link/i }))
    expect(await screen.findByText(/didn't send/i)).toBeInTheDocument()
    expect(screen.queryByText(/link resent/i)).not.toBeInTheDocument()
  })

  it('catches a thrown rejection and still shows the error line', async () => {
    const onResendLink = vi.fn().mockRejectedValue(new Error('boom'))
    renderConfirmation(onResendLink)
    fireEvent.click(screen.getByRole('button', { name: /resend the link/i }))
    await waitFor(() => expect(screen.getByText(/didn't send/i)).toBeInTheDocument())
  })
})
