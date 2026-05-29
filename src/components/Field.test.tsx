import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Field } from './Field'

describe('Field', () => {
  it('renders a label and input wired together by id', () => {
    render(<Field id="email" label="Your email" value="" onChange={() => {}} />)
    // getByLabelText only resolves when htmlFor ↔ id is correct, so this
    // asserts the accessible label association in one shot.
    const input = screen.getByLabelText('Your email')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('id', 'email')
  })

  it('shows a hint and points the input at it via aria-describedby', () => {
    render(<Field id="email" label="Your email" value="" onChange={() => {}} hint="No password." />)
    const hint = screen.getByText('No password.')
    expect(hint).toHaveAttribute('id', 'email-hint')
    expect(screen.getByLabelText('Your email')).toHaveAttribute('aria-describedby', 'email-hint')
  })

  it('shows an error, sets aria-invalid, and describes the input by the error', () => {
    render(<Field id="email" label="Your email" value="" onChange={() => {}} error="Required." />)
    const input = screen.getByLabelText('Your email')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Required.')
    expect(input).toHaveAttribute('aria-describedby', 'email-error')
  })

  it('lists the error before the hint in aria-describedby when both are present', () => {
    render(
      <Field
        id="email"
        label="Your email"
        value=""
        onChange={() => {}}
        hint="No password."
        error="Required."
      />,
    )
    expect(screen.getByLabelText('Your email')).toHaveAttribute(
      'aria-describedby',
      'email-error email-hint',
    )
  })

  it('forwards value and emits the raw string on change', () => {
    const onChange = vi.fn()
    render(<Field id="email" label="Your email" value="marc@x.com" onChange={onChange} />)
    const input = screen.getByLabelText('Your email') as HTMLInputElement
    expect(input.value).toBe('marc@x.com')
    fireEvent.change(input, { target: { value: 'new@x.com' } })
    expect(onChange).toHaveBeenCalledWith('new@x.com')
  })

  it('marks the field required and renders the required mark', () => {
    render(<Field id="email" label="Your email" value="" onChange={() => {}} required />)
    expect(screen.getByLabelText(/Your email/)).toBeRequired()
    expect(screen.getByText('*')).toBeInTheDocument()
  })

  it('passes through remaining input props (type, placeholder)', () => {
    render(
      <Field
        id="email"
        label="Your email"
        value=""
        onChange={() => {}}
        type="email"
        placeholder="you@email.com"
      />,
    )
    const input = screen.getByLabelText('Your email')
    expect(input).toHaveAttribute('type', 'email')
    expect(input).toHaveAttribute('placeholder', 'you@email.com')
  })
})
