/**
 * One map node rendered inside SVG via foreignObject so the inner content
 * is real HTML (Link for in-app routes, <a target=_blank> for external,
 * <div> for non-navigable nodes like D1 tables). Keeps keyboard/cursor
 * affordances honest without re-implementing them in SVG.
 */

import { Link } from 'react-router-dom'
import type { Lang } from '../../i18n'
import type { MapNode } from '../../lib/map/types'
import type { PositionedNode } from '../../lib/map/layout'

interface Props {
  pos: PositionedNode
  lang: Lang
  /** When true (active feature filter mismatch), node is rendered dim. */
  dim?: boolean
}

function pickHref(node: MapNode, lang: Lang): { href: string; external: boolean } | null {
  if (!node.href) return null
  const href = typeof node.href === 'string' ? node.href : node.href[lang]
  if (!href) return null
  const external = node.hrefExternal ?? /^https?:\/\//.test(href)
  return { href, external }
}

export function MapNodeView({ pos, lang, dim }: Props) {
  const { node } = pos
  const link = pickHref(node, lang)
  const label = node.label[lang]
  const desc = node.desc?.[lang]
  const className = `map-node map-node--${node.kind}${node.teaser ? ' map-node--teaser' : ''}${
    dim ? ' map-node--dim' : ''
  }`

  // The feature dot is a small colored circle in the top-left corner that
  // ties this page to its feature accent (sage = intake, ochre = iterative,
  // etc.). Nodes without a feature (endpoints/tables/bindings, transparency
  // pages, admin pages) just don't render the dot.
  const inner = (
    <>
      {node.feature && (
        <span
          className="map-node__feature-dot"
          aria-hidden="true"
          title={`Feature: ${node.feature}`}
        />
      )}
      {node.folio && <span className="map-node__folio mono">{node.folio}</span>}
      {node.badge && <span className="map-node__badge mono">{node.badge}</span>}
      <span className="map-node__label">{label}</span>
      {desc && <span className="map-node__desc">{desc}</span>}
    </>
  )

  return (
    <g data-feature={node.feature} transform={`translate(${pos.x} ${pos.y})`}>
      <foreignObject
        width={pos.width}
        height={pos.height}
        // foreignObject needs an explicit xmlns on its HTML child for some
        // serializers, but React handles that for the runtime DOM tree.
        style={{ overflow: 'visible' }}
      >
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
      </foreignObject>
    </g>
  )
}
