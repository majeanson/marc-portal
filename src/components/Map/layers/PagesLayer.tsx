/**
 * Pages layer — every page grouped by purpose (Public surface, Account,
 * Docs/Legal, Admin working, Admin other). Each group is a labelled
 * card; nodes flow as a 3-column grid inside.
 *
 * Mobile fallback: at < 640px the SVG is hidden and a vertical HTML list
 * grouped by MapGroup renders in its place (.map-cards). Same data,
 * same navigation, same feature colours — only the layout differs.
 */

import { useMemo } from 'react'
import type { Lang } from '../../../i18n'
import type { FeatureId } from '../../../lib/features'
import type { MapData, MapNode } from '../../../lib/map/types'
import { layoutPages } from '../../../lib/map/layout'
import { MapNodeView } from '../MapNode'
import { MapEdgeView } from '../MapEdge'
import { MapNodeCard } from '../MapNodeCard'

interface Props {
  data: MapData
  lang: Lang
  /** When set, groups + nodes that don't belong to this feature are dimmed. */
  activeFeature: FeatureId | null
}

export function PagesLayer({ data, lang, activeFeature }: Props) {
  const layout = useMemo(() => layoutPages(data), [data])

  // Mobile card-stack data: walk the same group order the SVG uses,
  // pair each group with its nodes (in curated order). Nodes that are
  // unreferenced by any group end up in a trailing "Autres" bucket.
  const nodeById = useMemo(() => {
    const m = new Map<string, MapNode>()
    for (const n of data.nodes) m.set(n.id, n)
    return m
  }, [data.nodes])
  const groupsForCards = useMemo(() => {
    return data.groups
      .filter((g) => g.layer === 'pages')
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((g) => {
        const nodes: MapNode[] = []
        for (const nid of g.nodeIds) {
          const n = nodeById.get(nid)
          if (n && n.layers.includes('pages')) nodes.push(n)
        }
        return { group: g, nodes }
      })
      .filter((g) => g.nodes.length > 0)
  }, [data.groups, nodeById])

  return (
    <>
      <svg
        className="map-canvas map-canvas--pages map-canvas--svg-only"
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
              <rect
                className="map-group__bg"
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

      {/* Mobile card stack — CSS hides this above 640px and hides the SVG
        above it below 640px. Grouping mirrors the SVG: one section per
        MapGroup, each with its own --ft-color (so the section header
        + cards inside read in the feature colour the desktop SVG uses
        for that cluster). */}
      <div
        className="map-cards"
        aria-label={lang === 'en' ? 'Pages map (list)' : 'Carte des pages (liste)'}
      >
        {groupsForCards.map(({ group, nodes }) => {
          const groupDim = !!activeFeature && group.feature !== activeFeature
          return (
            <section
              key={group.id}
              data-feature={group.feature}
              className={`map-cards__group${group.feature ? ' map-cards__group--featured' : ''}${
                groupDim ? ' map-cards__group--dim' : ''
              }`}
            >
              <h3 className="map-cards__group-label mono">{group.label[lang]}</h3>
              <ol className="map-cards__list">
                {nodes.map((n) => (
                  <MapNodeCard
                    key={n.id}
                    node={n}
                    lang={lang}
                    dim={!!activeFeature && n.feature !== activeFeature}
                  />
                ))}
              </ol>
            </section>
          )
        })}
      </div>
    </>
  )
}
