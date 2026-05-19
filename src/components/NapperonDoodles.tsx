/**
 * Hand-drawn margin doodles for the home page. The whole site already leans
 * on the napperon (placemat) metaphor through the `/` canvas widget — these
 * extend the metaphor to the page itself, so reading the home feels like
 * reading a napperon Marc scribbled on at a diner: a red-pen circle around
 * something important, a coffee-ring stain, an ink check, a squiggle, an
 * asterisk, a small blot, and an arrow pointing at a CTA.
 *
 * All decoration. The whole tree is `aria-hidden` and `pointer-events:none`.
 * Each doodle is pinned to an approximate scroll position in the page
 * margins (the gutter outside the centered ~880px content column) so they
 * never crowd the text on big viewports. The whole layer hides under
 * 1080px since the margins disappear behind the content there.
 *
 * Scroll-driven fade: each doodle ink-ins as it scrolls into view, giving
 * the impression that Marc is drawing them as you read. Static under
 * prefers-reduced-motion (visible immediately).
 *
 * Palette + stroke weights match the site tokens (sage, terracotta, ink)
 * so the doodles read as part of the same hand, not random clip-art.
 */
export function NapperonDoodles() {
  return (
    <div className="napperon" aria-hidden="true">
      <CircleScribble />
      <CheckMark />
      <CoffeeRing />
      <Squiggle />
      <Asterisk />
      <InkBlot />
      <ArrowScribble />
    </div>
  )
}

function CircleScribble() {
  return (
    <svg
      className="napperon__doodle napperon__circle"
      viewBox="0 0 200 120"
      width="200"
      height="120"
    >
      {/* Wobbly red-pen circle — the "this matters" mark. Two overlapping
          loops so the ends overshoot like a real pen pass. */}
      <path
        d="M 26 70 C 4 36 38 12 78 10 C 132 4 188 28 188 60 C 190 94 148 110 92 108 C 38 106 14 86 24 60"
        fill="none"
        stroke="#c1693d"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
      />
      <path
        d="M 28 72 C 14 50 38 22 80 18"
        fill="none"
        stroke="#c1693d"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.4"
      />
    </svg>
  )
}

function CoffeeRing() {
  return (
    <svg
      className="napperon__doodle napperon__coffee"
      viewBox="0 0 160 160"
      width="160"
      height="160"
    >
      {/* Faint outer halo where the cup sat */}
      <ellipse
        cx="80"
        cy="80"
        rx="66"
        ry="62"
        fill="none"
        stroke="#7a5031"
        strokeWidth="6"
        opacity="0.09"
      />
      {/* Inner darker ring with the kind of breaks a coffee cup leaves */}
      <ellipse
        cx="80"
        cy="80"
        rx="60"
        ry="56"
        fill="none"
        stroke="#7a5031"
        strokeWidth="1.5"
        opacity="0.32"
        strokeDasharray="120 18 80 14 180 22"
      />
      {/* A tiny splash drop on the side */}
      <circle cx="38" cy="138" r="2.5" fill="#7a5031" opacity="0.28" />
      <circle cx="46" cy="146" r="1.4" fill="#7a5031" opacity="0.22" />
    </svg>
  )
}

function Squiggle() {
  return (
    <svg
      className="napperon__doodle napperon__squiggle"
      viewBox="0 0 220 20"
      width="220"
      height="20"
    >
      {/* Sage underline that wobbles like a quick pen pass */}
      <path
        d="M 6 12 Q 22 2 38 12 T 70 12 T 102 12 T 134 12 T 166 12 T 198 12 T 214 12"
        fill="none"
        stroke="#3d6e4e"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  )
}

function ArrowScribble() {
  return (
    <svg className="napperon__doodle napperon__arrow" viewBox="0 0 140 80" width="140" height="80">
      {/* Arched line ending in a quick arrowhead, pointing toward something */}
      <path
        d="M 8 14 Q 36 0 76 18 Q 102 30 114 60"
        fill="none"
        stroke="#2c5239"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M 102 50 L 116 62 L 128 50"
        fill="none"
        stroke="#2c5239"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
    </svg>
  )
}

function CheckMark() {
  return (
    <svg className="napperon__doodle napperon__check" viewBox="0 0 80 64" width="80" height="64">
      {/* Big confident check — the "oui ça" mark */}
      <path
        d="M 6 36 L 28 56 L 74 8"
        fill="none"
        stroke="#3d6e4e"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.72"
      />
    </svg>
  )
}

function Asterisk() {
  return (
    <svg className="napperon__doodle napperon__star" viewBox="0 0 60 60" width="60" height="60">
      {/* Six-stroke asterisk like a footnote drawn fast */}
      <path
        d="M 30 6 L 30 54 M 9 18 L 51 42 M 9 42 L 51 18"
        fill="none"
        stroke="#c1693d"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  )
}

function InkBlot() {
  return (
    <svg className="napperon__doodle napperon__blot" viewBox="0 0 80 80" width="80" height="80">
      {/* Faint ink stain with two scattered droplets */}
      <path
        d="M 22 38 Q 14 24 28 18 Q 40 12 50 20 Q 64 28 60 44 Q 56 58 44 60 Q 28 60 22 50 Q 18 44 22 38 Z"
        fill="#1f1d18"
        opacity="0.07"
      />
      <circle cx="44" cy="46" r="2" fill="#1f1d18" opacity="0.18" />
      <circle cx="60" cy="62" r="1.4" fill="#1f1d18" opacity="0.14" />
    </svg>
  )
}
