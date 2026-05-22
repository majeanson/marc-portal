/**
 * Feature glyphs — one obvious pictogram per feature colour.
 *
 * The colour alone (see styles.css `--feat-*`) tells a returning visitor
 * "this belongs to the pricing cluster"; the glyph tells a FIRST-time
 * visitor *which* cluster without having to learn the palette. Every
 * FeatureDot, the FeatureIndex header, and the Vision bubbles render one.
 *
 * Each glyph is the inner content of a 16×16 viewBox:
 *   - the main shape is painted in `currentColor`
 *   - any cut-out (eye pupil, key bow, gear hub) is painted in
 *     `var(--feature-glyph-hole)` so it reads as a hole punched through
 *
 * Callers decide the two colours via CSS:
 *   - on a coloured disc (FeatureDot) → glyph = paper, hole = feature hue
 *   - on a tinted background (Vision bubble) → glyph = feature hue,
 *     hole = the soft tint
 *
 * Glyphs are deliberately solid fills (no thin strokes): a stroke vanishes
 * at the 11px `sm` dot size, a filled silhouette survives it.
 */

import type { ReactElement, SVGProps } from 'react'
import type { FeatureId } from './features'

const HOLE = 'var(--feature-glyph-hole, var(--bg))'

// Gear teeth — eight stubby rects spun around the 8,8 hub.
const GEAR_TEETH = [0, 45, 90, 135, 180, 225, 270, 315]

const GLYPHS: Record<FeatureId, ReactElement> = {
  // intake — a folder. "Bring a project": the thing you arrive with.
  intake: (
    <>
      <path
        fill="currentColor"
        d="M2 4c0-.6.5-1.1 1.1-1.1h3c.4 0 .8.2 1 .5l.8 1.1h5C13.5 4.5 14 5 14 5.6V6H2z"
      />
      <path fill="currentColor" d="M2 6.4h12v5.4c0 .7-.6 1.3-1.3 1.3H3.3C2.6 13.1 2 12.5 2 11.8z" />
    </>
  ),
  // conversation — a speech bubble. The async back-and-forth.
  conversation: (
    <g transform="translate(0 0.19)">
      <path
        fill="currentColor"
        d="M3.4 2.6h9.2c.8 0 1.4.6 1.4 1.4v5c0 .8-.6 1.4-1.4 1.4H7.2l-3 2.5c-.4.3-.9 0-.9-.5v-2H3.4C2.6 10.4 2 9.8 2 9V4c0-.8.6-1.4 1.4-1.4z"
      />
    </g>
  ),
  // iterative — an eye. "You see every build" as it happens.
  iterative: (
    <>
      <path
        fill="currentColor"
        d="M8 3.7C4.2 3.7 1.7 7.1 1.2 7.7a.5.5 0 0 0 0 .6C1.7 8.9 4.2 12.3 8 12.3s6.3-3.4 6.8-4a.5.5 0 0 0 0-.6C14.3 7.1 11.8 3.7 8 3.7z"
      />
      <circle cx="8" cy="8" r="2.5" fill={HOLE} />
    </>
  ),
  // pricing — a dollar sign. The one colour that talks money.
  // Drawn as geometry, not live <text>: an S-curve stroke with a vertical
  // bar through it. Both sub-paths are symmetric about x=8 and y=8, so the
  // glyph is centred on the 8,8 box centre exactly — no font metrics, no
  // per-platform baseline drift, no empirical nudge. Stroked (not filled)
  // because an S-ribbon has no honest solid silhouette; strokeWidth 2.2 is
  // the weight of the gear teeth, so it still reads at the 11px `sm` size.
  pricing: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11.2 4.7C11.2 3 9.5 2.6 8 2.6 6.3 2.6 4.8 3.3 4.8 5.4 4.8 9 11.2 7.6 11.2 10.9 11.2 13 9.6 13.4 8 13.4 6.4 13.4 4.8 12.9 4.8 11" />
      <path d="M8 1.2V14.8" />
    </g>
  ),
  // keys — a key. "You keep the keys": ownership of the code.
  keys: (
    <g transform="translate(0 0.25)">
      <circle cx="8" cy="4.6" r="3.3" fill="currentColor" />
      <circle cx="8" cy="4.6" r="1.4" fill={HOLE} />
      <path
        fill="currentColor"
        d="M7.05 7.1h1.9v6.6c0 .3-.2.5-.45.5h-1c-.25 0-.45-.2-.45-.5zM8.95 8.8h2.5v1.7h-2.5zM8.95 11.4h2v1.7h-2z"
      />
    </g>
  ),
  // shipped — a check mark. "See what's shipped": done, delivered.
  shipped: (
    <g transform="translate(0 -0.62)">
      <path
        fill="currentColor"
        d="M13.9 4.4c.4.36.43.97.07 1.36l-6.7 7.2a.95.95 0 0 1-1.36.04L2.1 9.3a.96.96 0 1 1 1.32-1.4l3.07 2.9 6.05-6.5a.95.95 0 0 1 1.35-.07z"
      />
    </g>
  ),
  // meta — a gear. The backstage / "behind the scenes" layer.
  meta: (
    <>
      {GEAR_TEETH.map((a) => (
        <rect
          key={a}
          x="6.8"
          y="0.4"
          width="2.4"
          height="3.8"
          rx="0.6"
          fill="currentColor"
          transform={`rotate(${a} 8 8)`}
        />
      ))}
      <circle cx="8" cy="8" r="5" fill="currentColor" />
      <circle cx="8" cy="8" r="2.1" fill={HOLE} />
    </>
  ),
}

interface Props extends Omit<SVGProps<SVGSVGElement>, 'viewBox'> {
  feature: FeatureId
}

/** Renders a feature's pictogram as a self-contained 16×16 SVG. Extra SVG
 *  props (width/height/x/y for nesting inside another SVG, className) pass
 *  straight through. */
export function FeatureGlyph({ feature, className, ...rest }: Props) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`feature-glyph${className ? ` ${className}` : ''}`}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {GLYPHS[feature]}
    </svg>
  )
}
