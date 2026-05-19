import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Lang } from '../i18n'
import { FEATURES, type FeatureId } from '../lib/features'

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
 *
 * ─── Canonical page shape (2026-05 standardization pass) ─────────────────
 *
 * Content pages (the PAGE_FOLIOS issues) should follow:
 *
 *   export function Foo({ lang }: { lang: Lang }) {
 *     const t = COPY[lang]              // or DICT[lang].foo — pick one per file
 *     useEffect(() => { document.title = `${t.crumb} — Marc` }, [t])
 *     return (
 *       <article className="foo">      // single page-class wrapper
 *         <PageMast folio={`№ ${PAGE_FOLIOS.foo} — ${t.title}`}
 *                   stampLabel="..." stampSub="...">
 *           <p className="section__eyebrow">{t.eyebrow}</p>
 *           <h1 className="page-mast__title">{t.title}</h1>
 *           <p className="page-mast__lead">{t.lead}</p>
 *         </PageMast>
 *         <main>... body ...</main>
 *       </article>
 *     )
 *   }
 *
 * Pages that intentionally diverge (no PageMast, hand-rolled header):
 *   - Privacy, Pia — legal-doc structure with anchored TOC
 *   - Map — interactive canvas with layer-toggle UI as the chrome
 *   - HandoffChecklist — collapsed technical sections with a back link
 *   - Login, MagicLinkSent, Intake, Vouch, MePortal — functional flows,
 *     not magazine "issues"
 *
 * If you're adding a new content page, follow PageMast. If you're adding a
 * form/flow, hand-roll the header but keep the `.{page}-page` or `.{page}`
 * wrapper class for CSS hooks.
 */
export function PageMast({
  folio,
  stampLabel,
  stampSub,
  back,
  feature,
  lang,
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
  /** When both feature + lang are set, the folio renders as a Link to
   *  /carte?feature=X (fr) or /en/map?feature=X (en) so the cross-cutting
   *  feature accent doubles as cross-site navigation. */
  feature?: FeatureId
  lang?: Lang
  children: ReactNode
}) {
  const folioContent =
    feature && lang ? (
      <Link
        className="page-mast__folio mono"
        to={lang === 'en' ? `/en/map?feature=${feature}` : `/carte?feature=${feature}`}
        aria-label={
          lang === 'en'
            ? `Filter the site map to ${FEATURES[feature].label.en}`
            : `Filtrer la carte du site sur ${FEATURES[feature].label.fr}`
        }
      >
        {folio}
      </Link>
    ) : (
      <div className="page-mast__folio mono" aria-hidden="true">
        {folio}
      </div>
    )
  return (
    <header className="page-mast">
      {back && (
        <a className="page-mast__back mono" href={back.href}>
          {back.label}
        </a>
      )}
      {folioContent}
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
