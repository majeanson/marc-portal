/**
 * Data layer — four labelled columns: Pages → Endpoints → Tables →
 * Services. Bézier edges trace request flow between columns. The visitor
 * view filters this down to Pages + Services with the middle two columns
 * hidden (and the edges that referenced them silently dropped).
 */

import { useMemo } from 'react'
import type { Lang } from '../../../i18n'
import type { MapData } from '../../../lib/map/types'
import { layoutData } from '../../../lib/map/layout'
import { MapNodeView } from '../MapNode'
import { MapEdgeView } from '../MapEdge'

interface Props {
  data: MapData
  lang: Lang
}

export function DataLayer({ data, lang }: Props) {
  const layout = useMemo(() => layoutData(data), [data])

  return (
    <svg
      className="map-canvas map-canvas--data"
      viewBox={`0 0 ${layout.viewBox.width} ${layout.viewBox.height}`}
      preserveAspectRatio="xMidYMin meet"
      role="img"
      aria-label={lang === 'en' ? 'Data flow map' : 'Flux de données'}
    >
      <defs>
        <marker
          id="map-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" className="map-arrow" />
        </marker>
      </defs>

      <g className="map-groups map-groups--columns">
        {layout.groups.map((g) => (
          <g key={g.group.id} transform={`translate(${g.x} ${g.y})`}>
            <text className="map-group__label mono" x={g.width / 2} y={26} textAnchor="middle">
              {g.group.label[lang]}
            </text>
          </g>
        ))}
      </g>

      <g className="map-edges">
        {layout.edges.map((e) => (
          <MapEdgeView key={e.edge.id} pos={e} />
        ))}
      </g>

      <g className="map-nodes">
        {layout.nodes.map((p) => (
          <MapNodeView key={p.node.id} pos={p} lang={lang} />
        ))}
      </g>
    </svg>
  )
}
