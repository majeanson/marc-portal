/**
 * Vision layer — the “big picture” bubbles. Each bubble answers one
 * question a curious visitor asks; the sub is ONE SENTENCE describing
 * what they get or can do (NOT a list of internal pages — page names
 * mean nothing to a first-time visitor). Hand-positioned in normalized
 * 0–100 coordinates (curated.ts) and projected into a 1280×980 SVG
 * canvas here.
 *
 * Bubbles with an `href` become real navigation. We use useNavigate +
 * onClick/onKeyDown on the <g> (with role="link", cursor:pointer) so the
 * navigation stays SPA-native — no anchor + full-page-reload trick.
 *
 * Intentionally low-fi compared to the other layers — this layer wants to
 * read as a napkin sketch, not a UML diagram.
 *
 * Mobile fallback: at narrow widths the SVG is replaced by a vertical
 * HTML card stack (.map-vision-cards) since horizontally scrolling a
 * 960px atlas on a phone hides 2/3 of the bubbles. Same data, same
 * navigation — only the layout differs. Both are rendered; CSS chooses
 * which one is visible via the .map-vision__svg / .map-vision__cards
 * display rules.
 */

import { Link, useNavigate } from 'react-router-dom'
import type { Lang } from '../../../i18n'
import type { FeatureId } from '../../../lib/features'
import { FEATURES } from '../../../lib/features'
import type { MapData, VisionBubble } from '../../../lib/map/types'

interface Props {
  data: MapData
  lang: Lang
  /** When set, bubbles that don't belong to this feature are dimmed. */
  activeFeature: FeatureId | null
}

// Logical canvas. CSS scales the SVG to fit any width via preserveAspectRatio.
// Each bubble now hosts a full sentence (not a middot list), so radii are
// bumped and the canvas is taller to give the 2×3 grid room without rows
// overlapping.
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

export function VisionLayer({ data, lang, activeFeature }: Props) {
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
          const desc = b.desc?.[lang]
          const href = b.href?.[lang]
          const interactive = !!href

          const onActivate = href ? () => navigate(href) : undefined
          // Hover/screen-reader tooltip prefers the user-facing sub sentence;
          // desc is a fallback for bubbles that lack a sub.
          const tooltip = sub ?? desc ?? label

          return (
            <g
              key={b.id}
              className={`map-vision__bubble map-vision__bubble--${b.size}${
                interactive ? ' map-vision__bubble--link' : ''
              }${activeFeature && activeFeature !== b.feature ? ' map-vision__bubble--dim' : ''}`}
              // data-feature drives the accent color via CSS custom-property
              // overrides in styles.css (.map-vision__bubble[data-feature=...]).
              // Children inside foreignObject inherit the custom properties.
              data-feature={b.feature}
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
              aria-label={interactive ? `${b.index}. ${label}${sub ? ` — ${sub}` : ''}` : undefined}
            >
              <title>{tooltip === label ? label : `${label} — ${tooltip}`}</title>
              <circle className="map-vision__bubble-bg" r={r} />
              <text className="map-vision__bubble-index mono" x={-r + inset - 2} y={-r + inset + 6}>
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

    {/* Mobile vertical card stack. Visible at < 640px (CSS-controlled);
        hidden otherwise. Renders the same 6 bubbles as a numbered list
        of feature cards, each carrying the matching --ft-color via
        data-feature, so the colour story stays identical to the SVG
        view. The cards are real <Link>s when href is set so the
        navigation path matches the SVG version. */}
    <ol
      className="map-vision__cards"
      aria-label={lang === 'en' ? 'Big picture map (list)' : "Carte d’ensemble (liste)"}
    >
      {bubbles.map((b) => {
        const label = b.label[lang]
        const sub = b.sub?.[lang]
        const href = b.href?.[lang]
        const dim = !!(activeFeature && activeFeature !== b.feature)
        const featureName = b.feature ? FEATURES[b.feature].label[lang] : null
        const inner = (
          <>
            <span className="map-vision__card-index mono" aria-hidden="true">
              {String(b.index).padStart(2, '0')}
            </span>
            <span className="map-vision__card-body">
              <span className="map-vision__card-label">{label}</span>
              {sub && <span className="map-vision__card-sub">{sub}</span>}
              {featureName && (
                <span className="map-vision__card-feature mono">{featureName}</span>
              )}
            </span>
            <span className="map-vision__card-chevron" aria-hidden="true">
              →
            </span>
          </>
        )
        return (
          <li
            key={b.id}
            data-feature={b.feature}
            className={`map-vision__card${dim ? ' map-vision__card--dim' : ''}`}
          >
            {href ? (
              <Link className="map-vision__card-link" to={href}>
                {inner}
              </Link>
            ) : (
              <div className="map-vision__card-link map-vision__card-link--static">{inner}</div>
            )}
          </li>
        )
      })}
    </ol>
    </>
  )
}
