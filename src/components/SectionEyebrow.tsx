/**
 * SectionEyebrow — the small uppercase mono label above a section's h2,
 * with its feature dot. Every home section carries one; bundling the
 * dot + label here keeps the "every section title has a coloured dot"
 * rhythm consistent and means a new section can't accidentally ship
 * without it.
 *
 * `feature` is whatever the section resolved from HOME_SECTION_FEATURE
 * (or PAGE_FEATURE for page-backed sections like the intake teaser).
 * Passing it in — rather than looking it up here from a string id —
 * keeps the mapping visible at the top of each section component.
 */

import type { ReactNode } from 'react'
import type { Lang } from '../i18n'
import type { FeatureId } from '../lib/features'
import { FeatureDot } from './FeatureDot'

interface Props {
  lang: Lang
  /** The section's feature, or undefined for cross-cutting sections
   *  (How it works, FAQ, About) — those get a neutral hollow dot. */
  feature: FeatureId | undefined
  children: ReactNode
  /** Extra class on the wrapper (e.g. the inline-teaser variant). */
  className?: string
}

export function SectionEyebrow({ lang, feature, children, className }: Props) {
  return (
    <div className={`section__eyebrow${className ? ` ${className}` : ''}`}>
      <FeatureDot feature={feature} lang={lang} size="sm" />
      {children}
    </div>
  )
}
