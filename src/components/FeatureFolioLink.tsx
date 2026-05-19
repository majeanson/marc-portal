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
}

export function FeatureFolioLink({
  feature,
  lang,
  children,
  className = 'page-folio-mark mono',
}: Props) {
  if (!feature) {
    return (
      <p className={className} aria-hidden="true">
        {children}
      </p>
    )
  }
  const to = lang === 'en' ? `/en/map?feature=${feature}` : `/carte?feature=${feature}`
  const label =
    lang === 'en'
      ? `Filter the site map to ${FEATURES[feature].label.en}`
      : `Filtrer la carte du site sur ${FEATURES[feature].label.fr}`
  return (
    <Link className={className} to={to} aria-label={label}>
      {children}
    </Link>
  )
}
