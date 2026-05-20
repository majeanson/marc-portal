/**
 * Vision layer — the “big picture” bubbles. Each bubble IS one feature.
 * Clicking a bubble doesn't navigate to a single page — it OPENS the
 * feature: switches the map to the Pages layer with ?feature=X applied,
 * so the visitor sees every surface that belongs to that colour (and the
 * FeatureIndex panel lists pages + home sections in text).
 *
 * The sub is one sentence describing what the user gets. Hand-positioned
 * in normalized 0–100 coordinates (curated.ts), projected into a 1280×980
 * SVG canvas here.
 *
 * Mobile fallback: at narrow widths the SVG is replaced by a vertical
 * HTML card stack since horizontally scrolling a 960px atlas on a phone
 * hides 2/3 of the bubbles. Same data, same behavior (open the feature) —
 * only the layout differs. Both render; CSS picks which is visible.
 */

import type { Lang } from '../../../i18n'
import type { FeatureId } from '../../../lib/features'
import { FEATURES } from '../../../lib/features'
import type { MapData, VisionBubble } from '../../../lib/map/types'

interface Props {
  data: MapData
  lang: Lang
  /** When set, bubbles that don't belong to this feature are dimmed. */
  activeFeature: FeatureId | null
  /** Open a feature — switches to the Pages layer filtered to it. */
  onSelectFeature: (feature: FeatureId) => void
}

// Logical canvas. CSS scales the SVG to fit any width via preserveAspectRatio.
// Each bubble hosts a full sentence, so radii are bumped and the canvas is
// taller to give the 2×3 grid room without rows overlapping.
const W = 1280
const H = 980

const RADIUS: Record<VisionBubble['size'], number> = {
  sm: 110,
  md: 128,
  lg: 148,
}

// Inset for the label's foreignObject — how much smaller than the diameter,
// so text doesn't crowd the circle edge.
const LABEL_INSET: Record<VisionBubble['size'], number> = {
  sm: 22,
  md: 26,
  lg: 30,
}

function openLabel(lang: Lang, featureLabel: string): string {
  return lang === 'en'
    ? `Open “${featureLabel}” — see every page and section in this colour`
    : `Ouvrir « ${featureLabel} » — voir chaque page et section de cette couleur`
}

export function VisionLayer({ data, lang, activeFeature, onSelectFeature }: Props) {
  const bubbles = data.vision.slice().sort((a, b) => a.index - b.index)

  // Pencil-style connector arcs between consecutive bubbles. Quadratic curves
  // with an offset midpoint give the line an organic "drawn by hand" wobble.
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
    const wobble = Math.min(80, len * 0.18) * (i % 2 === 0 ? 1 : -1)
    const cx = mx + (-dy / len) * wobble
    const cy = my + (dx / len) * wobble
    return {
      id: `${a.id}-${b.id}`,
      d: `M ${ax} ${ay} Q ${cx} ${cy} ${bx} ${by}`,
    }
  })

  return (
    <>
      <svg
        className="map-canvas map-canvas--vision map-vision__svg"
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
            const sub = b.sub?.[lang]
            const tooltip = sub ?? b.desc?.[lang] ?? label
            const open = () => onSelectFeature(b.feature)

            return (
              <g
                key={b.id}
                className={`map-vision__bubble map-vision__bubble--${b.size} map-vision__bubble--link${
                  activeFeature && activeFeature !== b.feature ? ' map-vision__bubble--dim' : ''
                }`}
                data-feature={b.feature}
                transform={`translate(${cx} ${cy})`}
                role="button"
                tabIndex={0}
                onClick={open}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    open()
                  }
                }}
                aria-label={`${b.index}. ${label} — ${openLabel(lang, label)}`}
              >
                <title>{tooltip === label ? label : `${label} — ${tooltip}`}</title>
                <circle className="map-vision__bubble-bg" r={r} />
                <text
                  className="map-vision__bubble-index mono"
                  x={-r + inset - 2}
                  y={-r + inset + 6}
                >
                  {b.index}
                </text>
                <foreignObject x={-labelW / 2} y={-labelH / 2} width={labelW} height={labelH}>
                  <div className="map-vision__bubble-content">
                    <div className="map-vision__bubble-label">{label}</div>
                    {sub && <div className="map-vision__bubble-sub">{sub}</div>}
                  </div>
                </foreignObject>
              </g>
            )
          })}
        </g>
      </svg>

      {/* Mobile vertical card stack — same six features, same behavior
          (open the feature). Each card is a <button>; CSS shows this stack
          only at narrow widths and hides the SVG. */}
      <ol
        className="map-vision__cards"
        aria-label={lang === 'en' ? 'Big picture map (list)' : 'Carte d’ensemble (liste)'}
      >
        {bubbles.map((b) => {
          const label = b.label[lang]
          const sub = b.sub?.[lang]
          const dim = !!(activeFeature && activeFeature !== b.feature)
          const featureName = FEATURES[b.feature].label[lang]
          return (
            <li
              key={b.id}
              data-feature={b.feature}
              className={`map-vision__card${dim ? ' map-vision__card--dim' : ''}`}
            >
              <button
                type="button"
                className="map-vision__card-link"
                onClick={() => onSelectFeature(b.feature)}
                aria-label={`${b.index}. ${label} — ${openLabel(lang, label)}`}
              >
                <span className="map-vision__card-index mono" aria-hidden="true">
                  {String(b.index).padStart(2, '0')}
                </span>
                <span className="map-vision__card-body">
                  <span className="map-vision__card-label">{label}</span>
                  {sub && <span className="map-vision__card-sub">{sub}</span>}
                  <span className="map-vision__card-feature mono">{featureName}</span>
                </span>
                <span className="map-vision__card-chevron" aria-hidden="true">
                  →
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </>
  )
}
