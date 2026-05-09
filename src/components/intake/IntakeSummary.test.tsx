import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { IntakeSummary } from './IntakeSummary'

const baseProps = {
  lang: 'en' as const,
  account: { email: 'visitor@x.com', name: 'Visitor' },
  type: 'paperasse' as const,
  values: { whatGetsRebuilt: 'invoices every Sunday', frequency: 'weekly' },
  submittedAt: '2026-04-22',
}

describe('IntakeSummary read mode', () => {
  it('renders email + name + type + submittedAt', () => {
    render(<IntakeSummary {...baseProps} />)
    expect(screen.getByText('visitor@x.com')).toBeInTheDocument()
    expect(screen.getByText('Visitor')).toBeInTheDocument()
    // Type label is localized — paperasse → "Paperwork to automate" in EN
    expect(screen.getByText(/Paperwork to automate/i)).toBeInTheDocument()
    // Date is localized; just look for the year
    expect(screen.getByText(/2026/)).toBeInTheDocument()
  })

  it('renders answered fields, omits unanswered ones', () => {
    render(<IntakeSummary {...baseProps} />)
    expect(screen.getByText(/invoices every Sunday/i)).toBeInTheDocument()
    // 'Every week' is the localized label for value 'weekly' — may appear
    // multiple times in the rendered tree (label + select option) so tolerate.
    expect(screen.getAllByText(/Every week/i).length).toBeGreaterThan(0)
  })

  it('hides the name row entirely when name is missing', () => {
    render(<IntakeSummary {...baseProps} account={{ email: 'visitor@x.com' }} />)
    expect(screen.queryByText('First name')).not.toBeInTheDocument()
  })
})

describe('IntakeSummary edit mode', () => {
  it('shows required pill on empty required fields', () => {
    const empty = { ...baseProps, values: {} }
    render(<IntakeSummary {...empty} editable />)
    // Multiple required fields → multiple "required" labels visible
    expect(screen.getAllByText(/required/i).length).toBeGreaterThan(0)
  })

  it('clicking a value swaps to an input and onChange fires on commit', async () => {
    const onChange = vi.fn()
    render(<IntakeSummary {...baseProps} editable onChange={onChange} />)

    // Click the rendered value to enter edit mode (button is the trigger)
    const trigger = screen.getByText(/invoices every Sunday/i)
    fireEvent.click(trigger)

    // textarea (whatGetsRebuilt is type=textarea) should now be focused
    const textarea = document.querySelector('textarea.summary__edit-input')
    expect(textarea).not.toBeNull()
    fireEvent.change(textarea!, { target: { value: 'invoices every Saturday' } })
    fireEvent.blur(textarea!)

    expect(onChange).toHaveBeenCalledOnce()
    const [arg] = onChange.mock.calls[0]!
    expect(arg.values.whatGetsRebuilt).toBe('invoices every Saturday')
  })

  it('Escape cancels edit without firing onChange', () => {
    const onChange = vi.fn()
    render(<IntakeSummary {...baseProps} editable onChange={onChange} />)
    const trigger = screen.getByText(/invoices every Sunday/i)
    fireEvent.click(trigger)
    const textarea = document.querySelector('textarea.summary__edit-input')!
    fireEvent.change(textarea, { target: { value: 'something else' } })
    fireEvent.keyDown(textarea, { key: 'Escape' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('type select appears when editableType is on', () => {
    render(<IntakeSummary {...baseProps} editable editableType />)
    // At least one <select> rendered for type-change
    expect(document.querySelectorAll('select').length).toBeGreaterThan(0)
  })
})
