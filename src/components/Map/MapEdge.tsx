/**
 * One edge — a single SVG path with an arrowhead marker. The marker is
 * defined once per SVG in MapCanvas; edges just reference it by id.
 *
 * Edge `kind` becomes a CSS class so the stylesheet can color writes vs
 * reads vs navigations differently if we want; for v1 they're all the
 * same muted gray.
 */

import type { PositionedEdge } from '../../lib/map/layout'

interface Props {
  pos: PositionedEdge
}

export function MapEdgeView({ pos }: Props) {
  return (
    <path
      className={`map-edge map-edge--${pos.edge.kind}`}
      d={pos.d}
      fill="none"
      markerEnd="url(#map-arrow)"
    />
  )
}
