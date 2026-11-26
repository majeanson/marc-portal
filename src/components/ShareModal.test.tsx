import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ShareModal } from './ShareModal'

/**
 * The modal is aria-modal over the /share page, so Tab has to wrap inside it
 * instead of walking into the covered document. happy-dom doesn't move focus
 * on a synthetic Tab, so these only exercise the wrap edges, which is the
 * part the trap owns; the browser handles the steps in between.
 */
function focusables() {
  const dialog = screen.getByRole('dialog')
  return Array.from(
    dialog.querySelectorAll<HTMLElement>('a[href], button, input, [tabindex]:not([tabindex="-1"])'),
  )
}

describe('ShareModal focus trap', () => {
  it('Tab from the last focusable wraps to the first', () => {
    render(<ShareModal lang="en" sessionId="abc" open onClose={() => {}} />)
    const items = focusables()
    expect(items.length).toBeGreaterThan(1)
    const first = items[0]
    const last = items[items.length - 1]
    last.focus()
    fireEvent.keyDown(last, { key: 'Tab' })
    expect(document.activeElement).toBe(first)
  })

  it('Shift+Tab from the first focusable wraps to the last', () => {
    render(<ShareModal lang="fr" sessionId="abc" open onClose={() => {}} />)
    const items = focusables()
    const first = items[0]
    const last = items[items.length - 1]
    first.focus()
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
  })

  it('leaves Tab alone in the middle of the cycle', () => {
    render(<ShareModal lang="en" sessionId="abc" open onClose={() => {}} />)
    const items = focusables()
    const first = items[0]
    first.focus()
    fireEvent.keyDown(first, { key: 'Tab' })
    expect(document.activeElement).toBe(first)
  })
})
