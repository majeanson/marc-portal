import type { ReactNode } from 'react'

/**
 * Editorial masthead used at the top of public subpages. Ports the same
 * folio + VÉRIFIÉ-stamp pattern that anchors the home hero so every page
 * reads as the same publication. The folio sits top-right in mono; the
 * stamp sits low-opacity in the lower-right as decorative chrome that
 * never competes with the headline. The h1 inside gets an editorial
 * accent rule via the .page-mast__title class (animated underline on
 * mount, with reduced-motion fallback to a static rule).
 *
 * Visual hierarchy inside <PageMast>: caller passes children — typically
 * an eyebrow + h1 + lead. We don't bake the eyebrow/title structure in
 * because each page already has its own copy and tier of section
 * detail (Journey has stats + legend, Meta has counts + asof line).
 */
export function PageMast({
  folio,
  stampLabel,
  stampSub,
  back,
  children,
}: {
  /** Mono text rendered top-right. Matches the home hero pattern,
   *  e.g. "№ 02 — La galerie". */
  folio: string
  /** Stamp big text, e.g. "LIVRÉ" or "JOURNAL". */
  stampLabel: string
  /** Stamp sub-text under the big text, e.g. "QUÉBEC · ASYNC". Optional. */
  stampSub?: string
  /** Optional "back" link rendered above the eyebrow. */
  back?: { href: string; label: string }
  children: ReactNode
}) {
  return (
    <header className="page-mast">
      {back && (
        <a className="page-mast__back mono" href={back.href}>
          {back.label}
        </a>
      )}
      <div className="page-mast__folio mono" aria-hidden="true">
        {folio}
      </div>
      <svg className="page-mast__stamp" viewBox="0 0 260 100" aria-hidden="true" focusable="false">
        <g transform="translate(130 50) rotate(-7)">
          <rect
            x="-122"
            y="-42"
            width="244"
            height="84"
            rx="10"
            ry="10"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          />
          <rect
            x="-114"
            y="-34"
            width="228"
            height="68"
            rx="6"
            ry="6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <text
            x="0"
            y={stampSub ? -4 : 6}
            textAnchor="middle"
            fontFamily="var(--mono), monospace"
            fontSize="20"
            fontWeight="700"
            letterSpacing="4"
            fill="currentColor"
          >
            {stampLabel}
          </text>
          {stampSub && (
            <text
              x="0"
              y="20"
              textAnchor="middle"
              fontFamily="var(--mono), monospace"
              fontSize="11"
              letterSpacing="5"
              fill="currentColor"
            >
              {stampSub}
            </text>
          )}
        </g>
      </svg>
      <div className="page-mast__content">{children}</div>
    </header>
  )
}
