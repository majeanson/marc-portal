import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'

/**
 * Btn — the one crisp keycap button. Before this, ~20 components each
 * hand-rolled the same border / hard-bottom-edge / 6px-radius / press-down
 * skin under a bespoke class; the reskin made them all identical, so they
 * collapse into this. `variant` picks the fill (primary = accent, ghost =
 * raised card surface); both wear the same edge so they read as the same
 * physical object.
 *
 * It renders a real <button> by default, or an <a> when `as="a"` — a few
 * call sites are links styled as buttons (the hero CTA family). The class
 * recipe lives in styles.css under `.btn` / `.btn--ghost`; this component is
 * only the JSX shape + variant→class mapping. `className` still passes through
 * for the rare layout tweak (margin, full-width) a call site needs.
 */
type Variant = 'primary' | 'ghost'

type ButtonProps = { as?: 'button' } & ButtonHTMLAttributes<HTMLButtonElement>
type AnchorProps = { as: 'a' } & AnchorHTMLAttributes<HTMLAnchorElement>

type Props = {
  variant?: Variant
  className?: string
  children: ReactNode
} & (ButtonProps | AnchorProps)

export function Btn({ variant = 'primary', className, children, ...rest }: Props) {
  const cls = `btn${variant === 'ghost' ? ' btn--ghost' : ''}${className ? ` ${className}` : ''}`

  if (rest.as === 'a') {
    const { as: _as, ...anchorProps } = rest
    return (
      <a className={cls} {...anchorProps}>
        {children}
      </a>
    )
  }

  const { as: _as, type = 'button', ...buttonProps } = rest
  return (
    <button className={cls} type={type} {...buttonProps}>
      {children}
    </button>
  )
}
