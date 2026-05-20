/**
 * CrossFeatureLink — an inline text link that points at a page belonging
 * to a DIFFERENT feature cluster than the section it sits in. The small
 * leading dot + the link colour both adopt the destination feature's hue
 * (via data-feature on the wrapper), so the visitor sees they're about
 * to cross into another colour story before they click.
 *
 * Used e.g. inside the Pricing section (plum) for the "Mode dépositaire"
 * link that leads to /handoff (keys / terracotta), and inside About for
 * the same handoff cross-reference.
 */

import type { ReactNode } from 'react'
import type { Lang } from '../i18n'
import type { FeatureId } from '../lib/features'
import { FeatureDot } from './FeatureDot'

interface Props {
  lang: Lang
  /** The destination page's feature — drives the dot + link colour. */
  feature: FeatureId | undefined
  href: string
  /** Render the link text in the mono typeface (matches mono surroundings). */
  mono?: boolean
  children: ReactNode
}

export function CrossFeatureLink({ lang, feature, href, mono, children }: Props) {
  return (
    <span className="cross-feature-link" data-feature={feature}>
      <FeatureDot
        feature={feature}
        lang={lang}
        size="sm"
        decorative
        className="cross-feature-link__dot"
      />
      <a href={href} className={`cross-feature-link__anchor${mono ? ' mono' : ''}`}>
        {children}
      </a>
    </span>
  )
}
