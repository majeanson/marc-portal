import type { CSSProperties } from 'react'

/**
 * Build an inline style object that carries CSS custom-property values
 * (e.g. `--i: 3`). React's `style` prop is typed against CSSProperties,
 * which doesn't allow arbitrary `--*` keys, so without a helper every
 * call-site needs the ugly `{ ['--i' as string]: i } as CSSProperties`
 * cast. This wraps that cast in one place.
 *
 * Usage:
 *   <li style={cssVars({ '--i': index })}>...</li>
 */
export function cssVars(vars: Record<`--${string}`, string | number>): CSSProperties {
  return vars as unknown as CSSProperties
}
