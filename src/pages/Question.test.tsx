import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../components/Header', () => ({ Header: () => null }))
vi.mock('../components/Footer', () => ({ Footer: () => null }))
vi.mock('../lib/questionsApi', () => ({
  QUESTION_LIMITS: { bodyMin: 10, bodyMax: 1500, emailMax: 254 },
  submitQuestion: vi.fn().mockResolvedValue({ received: true }),
}))

import { submitQuestion } from '../lib/questionsApi'
import { Question } from './Question'

function setup(lang: 'fr' | 'en' = 'en') {
  return render(
    <MemoryRouter>
      <Question lang={lang} />
    </MemoryRouter>,
  )
}

describe('Question page', () => {
  beforeEach(() => vi.mocked(submitQuestion).mockClear())

  it('blocks a bad email and a short question before calling the server', () => {
    setup()
    fireEvent.change(screen.getByLabelText(/your email/i), { target: { value: 'nope' } })
    fireEvent.change(screen.getByLabelText(/your question/i), { target: { value: 'short' } })
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }))
    expect(screen.getAllByRole('alert')).toHaveLength(2)
    expect(submitQuestion).not.toHaveBeenCalled()
  })

  it('sends a valid question and swaps to the thank-you state with a way into a request', async () => {
    setup()
    fireEvent.change(screen.getByLabelText(/your email/i), { target: { value: 'a@b.co' } })
    fireEvent.change(screen.getByLabelText(/your question/i), {
      target: { value: 'Is this the kind of thing you do?' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }))
    await waitFor(() => expect(screen.getByText(/got it/i)).toBeInTheDocument())
    expect(submitQuestion).toHaveBeenCalledWith({
      email: 'a@b.co',
      body: 'Is this the kind of thing you do?',
    })
    expect(screen.getByRole('link', { name: /start a request/i })).toHaveAttribute(
      'href',
      '/en/intake',
    )
  })
})
