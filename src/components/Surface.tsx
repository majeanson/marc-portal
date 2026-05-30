import type { ElementType, HTMLAttributes, ReactNode } from 'react'

/**
 * Surface — a raised crisp panel/card/tile carrying the shared edge recipe
 * (1px --edge border, hard --edge-shadow bottom, 6px radius) in one place
 * instead of repeating it on ~40 bespoke classes. Per-surface CSS then only
 * owns its own padding/layout/colour, not the edge.
 *
 * Polymorphic via `as` (default <div>) because surfaces are sometimes a
 * <section>, <article>, or <li>. Pass a `className` for the surface's own
 * layout class — it sits alongside `.surface`, so existing per-component rules
 * keep working while the edge comes from the shared class.
 */
type Props = {
  as?: ElementType
  className?: string
  children: ReactNode
} & HTMLAttributes<HTMLElement>

export function Surface({ as: Tag = 'div', className, children, ...rest }: Props) {
  return (
    <Tag className={`surface${className ? ` ${className}` : ''}`} {...rest}>
      {children}
    </Tag>
  )
}
