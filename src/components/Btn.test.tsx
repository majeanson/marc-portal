/**
 * Btn is the one crisp keycap button ~20 call sites collapse onto, so the
 * contract that matters is the variant→class mapping and the button-vs-anchor
 * switch — get those wrong and a whole batch of migrated call sites render the
 * wrong element or lose their skin. Passthrough (onClick, href, type) is what
 * lets a bespoke <button>/<a> be swapped 1:1, so it's pinned here too.
 */

import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { Btn } from './Btn'

describe('Btn', () => {
  it('renders a real <button> with type=button by default', () => {
    const { container } = render(<Btn>Go</Btn>)
    const el = container.querySelector('button')
    expect(el).not.toBeNull()
    expect(el!.getAttribute('type')).toBe('button')
    expect(el!.className).toBe('btn')
  })

  it('adds the ghost modifier for the secondary variant', () => {
    const { container } = render(<Btn variant="ghost">Cancel</Btn>)
    expect(container.querySelector('button')!.className).toBe('btn btn--ghost')
  })

  it('renders an <a> (no type attr) when as="a"', () => {
    const { container } = render(
      <Btn as="a" href="/intake">
        Start
      </Btn>,
    )
    const a = container.querySelector('a')
    expect(a).not.toBeNull()
    expect(a!.getAttribute('href')).toBe('/intake')
    expect(a!.hasAttribute('type')).toBe(false)
  })

  it('passes through className alongside the recipe and forwards onClick', () => {
    const onClick = vi.fn()
    const { container } = render(
      <Btn className="me-portal__danger-btn" onClick={onClick}>
        Delete
      </Btn>,
    )
    const el = container.querySelector('button')!
    expect(el.className).toBe('btn me-portal__danger-btn')
    el.click()
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('keeps an explicit type override (e.g. submit)', () => {
    const { container } = render(<Btn type="submit">Send</Btn>)
    expect(container.querySelector('button')!.getAttribute('type')).toBe('submit')
  })
})
