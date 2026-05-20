/**
 * FeatureDot — the cross-cutting "color" of the site, made tangible.
 *
 * Every user-facing feature (intake, conversation, iterative, pricing, keys,
 * shipped) carries a hue. A FeatureDot is a small clickable disc rendered in
 * that hue. Clicking it lands the visitor on /carte (fr) or /en/map (en)
 * with `?feature=X` already applied, so the same colour they just touched
 * dims everything outside its slice on the atlas. The dot is the network's
 * primary affordance: any title with a dot belongs to a coloured cluster,
 * and any dot leads back to the cluster.
 *
 * Variants:
 *   - feature set → renders as a <Link> to /carte?feature=X
 *   - feature undefined → renders a neutral hollow dot (transparency/meta
 *     pages — Privacy, PIA, Meta, Map — show this so the visual rhythm of
 *     "every page title has a dot" doesn't break)
 *
 * Sizes:
 *   - 'sm' (8px)  — beside small inline links (footer, section rail)
 *   - 'md' (10px) — beside page titles
 *   - 'lg' (14px) — beside big magazine-style h1 (PageMast title)
 */

import type { Lang } from '../i18n'
import { Link } from 'react-router-dom'
import { FEATURES, type FeatureId } from '../lib/features'

interface Props {
  feature: FeatureId | undefined
  lang: Lang
  size?: 'sm' | 'md' | 'lg'
  /** When true, the dot is decorative and not focusable. The wrapping
   *  element (a Link/anchor/button) already navigates. Use this when the
   *  dot sits *inside* a clickable title. */
  decorative?: boolean
  className?: string
}

export function FeatureDot({ feature, lang, size = 'sm', decorative = false, className }: Props) {
  const cls = `feature-dot feature-dot--${size}${feature ? '' : ' feature-dot--neutral'}${
    className ? ` ${className}` : ''
  }`

  if (!feature) {
    // Neutral dot: hollow circle, same dimensions as a coloured one so the
    // baseline of titles aligns whether or not the page is featured.
    return <span className={cls} aria-hidden="true" />
  }

  if (decorative) {
    // Inside an already-clickable parent — render a plain styled span that
    // inherits the feature accent. The PARENT is the link; we're just paint.
    return <span className={cls} data-feature={feature} aria-hidden="true" />
  }

  const to = lang === 'en' ? `/en/map?feature=${feature}` : `/carte?feature=${feature}`
  const label =
    lang === 'en'
      ? `Filter the site map to “${FEATURES[feature].label.en}”`
      : `Filtrer la carte du site sur « ${FEATURES[feature].label.fr} »`

  return <Link to={to} className={cls} data-feature={feature} aria-label={label} title={label} />
}
