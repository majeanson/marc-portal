/**
 * Mobile-friendly HTML card for a map node. The SVG layers (Pages, Data,
 * Journeys) hide on narrow viewports and these cards render in their
 * place — same data, same hrefs, same feature colours, but flowed
 * vertically instead of laid out on a 1280px-wide canvas.
 *
 * Mirrors the dual-render pattern VisionLayer uses for its mobile card
 * stack (.map-vision__cards). The cards inherit `--ft-color` from a
 * `data-feature` attribute set on the wrapping <li>, so the colour
 * story matches the desktop SVG one-to-one.
 */

import { Link } from 'react-router-dom'
import type { Lang } from '../../i18n'
import type { MapNode } from '../../lib/map/types'

function pickHref(node: MapNode, lang: Lang): { href: string; external: boolean } | null {
  if (!node.href) return null
  const href = typeof node.href === 'string' ? node.href : node.href[lang]
  if (!href) return null
  const external = node.hrefExternal ?? /^https?:\/\//.test(href)
  return { href, external }
}

interface Props {
  node: MapNode
  lang: Lang
  /** When true (active feature filter mismatch), card renders dim. */
  dim?: boolean
  /** Optional override for the leading mono badge (used by Journeys to
   *  show the step number instead of the node's folio/badge). */
  leadBadge?: string
}

export function MapNodeCard({ node, lang, dim, leadBadge }: Props) {
  const link = pickHref(node, lang)
  const label = node.label[lang]
  const desc = node.desc?.[lang]
  const badge = leadBadge ?? node.folio ?? node.badge
  const className = `surface map-card map-card--${node.kind}${node.teaser ? ' map-card--teaser' : ''}${
    dim ? ' map-card--dim' : ''
  }`

  const inner = (
    <>
      {badge && <span className="map-card__badge mono">{badge}</span>}
      <span className="map-card__body">
        <span className="map-card__label">{label}</span>
        {desc && <span className="map-card__desc">{desc}</span>}
      </span>
      {link && (
        <span className="map-card__chevron" aria-hidden="true">
          →
        </span>
      )}
    </>
  )

  return (
    <li className="map-card-row" data-feature={node.feature} data-search-node={node.id}>
      {link ? (
        link.external ? (
          <a className={className} href={link.href} target="_blank" rel="noreferrer">
            {inner}
          </a>
        ) : (
          <Link className={className} to={link.href}>
            {inner}
          </Link>
        )
      ) : (
        <div
          className={className}
          title={desc}
          role="img"
          aria-label={desc ? `${label} — ${desc}` : label}
        >
          {inner}
        </div>
      )}
    </li>
  )
}
