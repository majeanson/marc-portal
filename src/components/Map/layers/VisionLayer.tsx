/**
 * Vision layer — the “big picture” bubbles. Each bubble is one product
 * feature; the sub-items inside name the concrete pieces of that feature.
 * Hand-positioned in normalized 0–100 coordinates (curated.ts) and
 * projected into a 1280×800 SVG canvas here.
 *
 * Bubbles with an `href` become real navigation. We use useNavigate +
 * onClick/onKeyDown on the <g> (with role="link", cursor:pointer) so the
 * navigation stays SPA-native — no anchor + full-page-reload trick.
 *
 * Intentionally low-fi compared to the other layers — this layer wants to
 * read as a napkin sketch, not a UML diagram.
 */

import { useNavigate } from 'react-router-dom'
import type { Lang } from '../../../i18n'
import type { MapData, VisionBubble } from '../../../lib/map/types'

interface Props {
  data: MapData
  lang: Lang
}

// Logical canvas. CSS scales the SVG to fit any width via preserveAspectRatio.
// Taller than wide-ratio because we lay out 2 columns × 3 rows of bubbles with
// sub-item lists inside; height ~= width × 0.625 keeps each row breathable.
const W = 1280
const H = 800

const RADIUS: Record<VisionBubble['size'], number> = {
  sm: 96,
  md: 116,
  lg: 136,
}

// Inset for the label's foreignObject — how much smaller than the diameter,
// so text doesn't crowd the circle edge. Smaller bubbles need a tighter inset
// because their absolute padding shouldn't scale linearly.
const LABEL_INSET: Record<VisionBubble['size'], number> = {
  sm: 22,
  md: 28,
  lg: 34,
}

export function VisionLayer({ data, lang }: Props) {
  const navigate = useNavigate()
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
    const wobble = Math.min(80, len * 0.18) * (i % 2 === 0 ? 1 : -1)
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
          const inset = LABEL_INSET[b.size]
          const labelW = r * 2 - inset * 2
          const labelH = r * 1.85
          const label = b.label[lang]
          const desc = b.desc?.[lang]
          const subItems = b.sub?.map((s) => s[lang]) ?? []
          const href = b.href?.[lang]
          const interactive = !!href

          const onActivate = href ? () => navigate(href) : undefined

          return (
            <g
              key={b.id}
              className={`map-vision__bubble map-vision__bubble--${b.size}${
                interactive ? ' map-vision__bubble--link' : ''
              }`}
              transform={`translate(${cx} ${cy})`}
              role={interactive ? 'link' : undefined}
              tabIndex={interactive ? 0 : undefined}
              onClick={onActivate}
              onKeyDown={
                interactive
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onActivate?.()
                      }
                    }
                  : undefined
              }
              aria-label={
                interactive
                  ? `${b.index}. ${label}${
                      subItems.length ? ` — ${subItems.join(' · ')}` : ''
                    }${desc ? ` — ${desc}` : ''}`
                  : undefined
              }
            >
              <title>{desc ? `${label} — ${desc}` : label}</title>
              <circle className="map-vision__bubble-bg" r={r} />
              <text className="map-vision__bubble-index mono" x={-r + inset - 2} y={-r + inset + 6}>
                {b.index}
              </text>
              <foreignObject x={-labelW / 2} y={-labelH / 2} width={labelW} height={labelH}>
                <div className="map-vision__bubble-content">
                  <div className="map-vision__bubble-label">{label}</div>
                  {subItems.length > 0 && (
                    <div className="map-vision__bubble-sub mono">{subItems.join(' · ')}</div>
                  )}
                </div>
              </foreignObject>
            </g>
          )
        })}
      </g>
    </svg>
  )
}
