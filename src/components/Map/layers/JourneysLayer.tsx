/**
 * Journeys layer — re-uses the Pages layer layout so a journey draws as
 * a polyline through the actual page node positions. Step number badges
 * sit above each waypoint; the line uses CSS keyframes to animate a
 * marching dash so the eye traces the flow without manual play controls.
 *
 * v1: one journey at a time, selected via prop. Curated supplies the
 * journey list; Map.tsx picks the first visible one as default.
 */

import { useMemo } from 'react'
import type { Lang } from '../../../i18n'
import type { MapData } from '../../../lib/map/types'
import { layoutJourney, layoutPages } from '../../../lib/map/layout'
import { MapNodeView } from '../MapNode'

interface Props {
  data: MapData
  lang: Lang
  journeyId?: string
}

export function JourneysLayer({ data, lang, journeyId }: Props) {
  const pages = useMemo(() => layoutPages(data), [data])
  const journey = data.journeys.find((j) => j.id === journeyId) ?? data.journeys[0]
  const overlay = useMemo(() => (journey ? layoutJourney(pages, journey) : null), [pages, journey])

  return (
    <svg
      className="map-canvas map-canvas--journeys"
      viewBox={`0 0 ${pages.viewBox.width} ${pages.viewBox.height}`}
      preserveAspectRatio="xMidYMin meet"
      role="img"
      aria-label={journey ? journey.label[lang] : lang === 'en' ? 'Journey map' : 'Parcours'}
    >
      <defs>
        <marker
          id="map-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" className="map-arrow map-arrow--journey" />
        </marker>
      </defs>

      <g className="map-groups">
        {pages.groups.map((g) => (
          <g key={g.group.id} transform={`translate(${g.x} ${g.y})`}>
            <rect
              className="map-group__bg map-group__bg--dim"
              x={0}
              y={0}
              width={g.width}
              height={g.height}
              rx={10}
            />
            <text className="map-group__label mono" x={16} y={26}>
              {g.group.label[lang]}
            </text>
          </g>
        ))}
      </g>

      <g className="map-nodes map-nodes--dim">
        {pages.nodes.map((p) => (
          <MapNodeView key={p.node.id} pos={p} lang={lang} />
        ))}
      </g>

      {overlay && (
        <g className="map-journey">
          <path
            className="map-journey__path"
            d={overlay.d}
            fill="none"
            markerEnd="url(#map-arrow)"
          />
          {overlay.steps.map((s) => (
            <g key={`${s.nodeId}-${s.index}`} transform={`translate(${s.x} ${s.y})`}>
              <circle className="map-journey__step-bg" r={14} />
              <text className="map-journey__step-num" textAnchor="middle" dy="0.35em">
                {s.index}
              </text>
            </g>
          ))}
        </g>
      )}
    </svg>
  )
}
