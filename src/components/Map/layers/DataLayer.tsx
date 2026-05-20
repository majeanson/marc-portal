/**
 * Data layer — four labelled columns: Pages → Endpoints → Tables →
 * Services. Bézier edges trace request flow between columns. The visitor
 * view filters this down to Pages + Services with the middle two columns
 * hidden (and the edges that referenced them silently dropped).
 *
 * Mobile fallback: at < 640px the SVG is hidden and a vertical HTML list
 * grouped by data-flow column renders in its place. The bezier edges
 * don't survive the layout swap — on mobile the relationship is implied
 * by ordering (Pages above Endpoints above Tables above Services).
 */

import { useMemo } from 'react'
import type { Lang } from '../../../i18n'
import type { MapData, MapNode } from '../../../lib/map/types'
import { layoutData } from '../../../lib/map/layout'
import { MapNodeView } from '../MapNode'
import { MapEdgeView } from '../MapEdge'
import { MapNodeCard } from '../MapNodeCard'

interface Props {
  data: MapData
  lang: Lang
}

export function DataLayer({ data, lang }: Props) {
  const layout = useMemo(() => layoutData(data), [data])

  // Mobile card-stack data: walk the four data-layer column groups in
  // order, pair each with its nodes. Nodes are pulled by membership in
  // group.nodeIds (curated order) but only the ones that the visibility
  // filter has left behind (data.nodes) are included.
  const nodeById = useMemo(() => {
    const m = new Map<string, MapNode>()
    for (const n of data.nodes) m.set(n.id, n)
    return m
  }, [data.nodes])
  const columnsForCards = useMemo(() => {
    return data.groups
      .filter((g) => g.layer === 'data')
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((g) => {
        const nodes: MapNode[] = []
        for (const nid of g.nodeIds) {
          const n = nodeById.get(nid)
          if (n && n.layers.includes('data')) nodes.push(n)
        }
        return { group: g, nodes }
      })
      .filter((g) => g.nodes.length > 0)
  }, [data.groups, nodeById])

  return (
    <>
      <svg
        className="map-canvas map-canvas--data map-canvas--svg-only"
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

      {/* Mobile column stack — one section per data-flow column, in flow
        order (Pages → Endpoints → Tables → Services on admin, just
        Pages → Services on the visitor filter). Bezier edges between
        columns aren't drawn — the column ordering itself communicates
        the "page calls endpoint reads table" flow. */}
      <div
        className="map-cards map-cards--data"
        aria-label={lang === 'en' ? 'Data flow map (list)' : 'Flux de données (liste)'}
      >
        {columnsForCards.map(({ group, nodes }) => (
          <section key={group.id} className="map-cards__group map-cards__group--column">
            <h3 className="map-cards__group-label mono">{group.label[lang]}</h3>
            <ol className="map-cards__list">
              {nodes.map((n) => (
                <MapNodeCard key={n.id} node={n} lang={lang} />
              ))}
            </ol>
          </section>
        ))}
      </div>
    </>
  )
}
