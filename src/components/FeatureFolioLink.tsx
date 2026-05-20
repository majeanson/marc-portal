/**
 * FeatureFolioLink — renders a page's folio mark as either a plain <p>
 * (when the page has no feature) or a <Link> that jumps to /carte with
 * the page's feature pre-filtered. The link is the cross-cutting
 * navigation primitive: every page that belongs to a feature offers
 * one-click access back to its slice of the map.
 *
 * On /carte the dropped URL param looks like `/carte?feature=keys` (fr)
 * or `/en/map?feature=keys` (en). The map's filter logic dims everything
 * outside that feature so the user lands focused.
 */

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Lang } from '../i18n'
import { FEATURES, type FeatureId } from '../lib/features'

interface Props {
  /** The page's feature, or undefined for pages without one (Privacy, Map…). */
  feature: FeatureId | undefined
  lang: Lang
  /** The folio text, e.g. `№ 07`. */
  children: ReactNode
  /** Override the CSS class — defaults to .page-folio-mark + .mono. */
  className?: string
  /** When true, prepend a clickable feature dot (or neutral placeholder)
   *  so the colour cue is visible even on hand-rolled pages that don't
   *  use PageMast. Hand-rolled headers (Privacy, PIA, Map,
   *  HandoffChecklist) opt in. Default false to keep older callers byte-
   *  for-byte compatible. */
  withDot?: boolean
}

export function FeatureFolioLink({
  feature,
  lang,
  children,
  className = 'page-folio-mark mono',
  withDot = false,
}: Props) {
  if (!feature) {
    // Neutral folio mark — still optionally prefixed with a hollow dot so
    // the visual rhythm matches feature-tagged pages on the same site.
    return (
      <p className={`${className} page-folio-mark--neutral`} aria-hidden="true">
        {withDot && <span className="page-folio-mark__dot page-folio-mark__dot--neutral" />}
        <span className="page-folio-mark__text">{children}</span>
      </p>
    )
  }
  const to = lang === 'en' ? `/en/map?feature=${feature}` : `/carte?feature=${feature}`
  const label =
    lang === 'en'
      ? `Filter the site map to ${FEATURES[feature].label.en}`
      : `Filtrer la carte du site sur ${FEATURES[feature].label.fr}`
  return (
    <Link className={className} to={to} aria-label={label} data-feature={feature}>
      {withDot && <span className="page-folio-mark__dot" data-feature={feature} aria-hidden="true" />}
      <span className="page-folio-mark__text">{children}</span>
    </Link>
  )
}
