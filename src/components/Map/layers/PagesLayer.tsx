/**
 * Pages layer — every page grouped by purpose (Public surface, Account,
 * Docs/Legal, Admin working, Admin other). Each group is a labelled
 * card; nodes flow as a 3-column grid inside.
 */

import { useMemo } from 'react'
import type { Lang } from '../../../i18n'
import type { FeatureId } from '../../../lib/features'
import type { MapData } from '../../../lib/map/types'
import { layoutPages } from '../../../lib/map/layout'
import { MapNodeView } from '../MapNode'
import { MapEdgeView } from '../MapEdge'

interface Props {
  data: MapData
  lang: Lang
  /** When set, groups + nodes that don't belong to this feature are dimmed. */
  activeFeature: FeatureId | null
}

export function PagesLayer({ data, lang, activeFeature }: Props) {
  const layout = useMemo(() => layoutPages(data), [data])

  return (
    <svg
      className="map-canvas map-canvas--pages"
      viewBox={`0 0 ${layout.viewBox.width} ${layout.viewBox.height}`}
      preserveAspectRatio="xMidYMin meet"
      role="img"
      aria-label={lang === 'en' ? 'Pages map' : 'Carte des pages'}
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

      <g className="map-groups">
        {layout.groups.map((g) => (
          <g
            key={g.group.id}
            // data-feature drives the accent color via CSS custom-property
            // overrides (.map-group[data-feature=...]). Groups without a
            // feature (transparency, operator console) fall through to the
            // neutral default styling.
            data-feature={g.group.feature}
            className={`map-group${g.group.feature ? ' map-group--featured' : ''}${
              activeFeature && g.group.feature !== activeFeature ? ' map-group--dim' : ''
            }`}
            transform={`translate(${g.x} ${g.y})`}
          >
            <rect className="map-group__bg" x={0} y={0} width={g.width} height={g.height} rx={10} />
            <text className="map-group__label mono" x={16} y={26}>
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
          <MapNodeView
            key={p.node.id}
            pos={p}
            lang={lang}
            dim={!!activeFeature && p.node.feature !== activeFeature}
          />
        ))}
      </g>
    </svg>
  )
}
