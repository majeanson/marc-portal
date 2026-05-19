/**
 * Vision layer — the “big picture” bubbles. Hand-positioned in normalized
 * 0–100 coordinates (curated.ts) and projected into a 1280×720 SVG canvas
 * here. Bubble radius is driven by VisionBubble.size; thin pencil-style
 * connector arcs trace the read order (1 → 2 → ... → N) so the eye knows
 * where to land first.
 *
 * Intentionally low-fi compared to the other layers — this layer wants to
 * read as a napkin sketch, not a UML diagram. No edges from MapData here,
 * no folio system, no descriptions in the bubble itself (they show as a
 * <title> tooltip + an aria-label).
 */

import type { Lang } from '../../../i18n'
import type { MapData, VisionBubble } from '../../../lib/map/types'

interface Props {
  data: MapData
  lang: Lang
}

// Logical canvas. CSS scales the SVG to fit any width via preserveAspectRatio.
const W = 1280
const H = 720

const RADIUS: Record<VisionBubble['size'], number> = {
  sm: 78,
  md: 96,
  lg: 116,
}

export function VisionLayer({ data, lang }: Props) {
  const bubbles = data.vision.slice().sort((a, b) => a.index - b.index)

  // Pencil-style connector arcs between consecutive bubbles. Quadratic curves
  // with an offset midpoint give the line an organic "drawn by hand" wobble
  // without animating anything.
  const connectors = bubbles.slice(1).map((b, i) => {
    const a = bubbles[i]
    const ax = (a.pos.x / 100) * W
    const ay = (a.pos.y / 100) * H
    const bx = (b.pos.x / 100) * W
    const by = (b.pos.y / 100) * H
    const mx = (ax + bx) / 2
    const my = (ay + by) / 2
    const dx = bx - ax
    const dy = by - ay
    const len = Math.hypot(dx, dy) || 1
    // Push the curve handle perpendicular to the segment so the line bows.
    const wobble = Math.min(80, len * 0.22) * (i % 2 === 0 ? 1 : -1)
    const cx = mx + (-dy / len) * wobble
    const cy = my + (dx / len) * wobble
    return {
      id: `${a.id}-${b.id}`,
      d: `M ${ax} ${ay} Q ${cx} ${cy} ${bx} ${by}`,
    }
  })

  return (
    <svg
      className="map-canvas map-canvas--vision"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={lang === 'en' ? 'Big picture map' : 'Carte d’ensemble'}
    >
      <g className="map-vision__connectors">
        {connectors.map((c) => (
          <path key={c.id} className="map-vision__connector" d={c.d} fill="none" />
        ))}
      </g>

      <g className="map-vision__bubbles">
        {bubbles.map((b) => {
          const cx = (b.pos.x / 100) * W
          const cy = (b.pos.y / 100) * H
          const r = RADIUS[b.size]
          const label = b.label[lang]
          const desc = b.desc?.[lang]
          return (
            <g
              key={b.id}
              className={`map-vision__bubble map-vision__bubble--${b.size}`}
              transform={`translate(${cx} ${cy})`}
            >
              <title>{desc ? `${label} — ${desc}` : label}</title>
              <circle className="map-vision__bubble-bg" r={r} />
              <text className="map-vision__bubble-index mono" x={-r + 18} y={-r + 22}>
                {b.index}
              </text>
              <foreignObject x={-r + 14} y={-22} width={r * 2 - 28} height={64}>
                <div className="map-vision__bubble-label">{label}</div>
              </foreignObject>
            </g>
          )
        })}
      </g>
    </svg>
  )
}
