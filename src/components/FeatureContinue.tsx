/**
 * FeatureContinue — the page-outro "next up" pointer. Sits at the bottom of
 * a content page and points the visitor at the NEXT feature in the arc
 * (FEATURE_NEXT), coloured with that destination feature's hue.
 *
 * It turns six standalone pages into one walkable loop: read about pricing
 * → "next: you keep the keys" → /handoff → "next: see what's shipped" →
 * /vouches → "next: bring a project" → /intake. The loop closes on intake
 * so the proof pages double as a conversion nudge.
 *
 * Rule-based, not hand-placed: a page passes its OWN feature and the
 * component derives the destination — no per-page curation of "what's next".
 */

import { Link } from 'react-router-dom'
import type { Lang } from '../i18n'
import { FEATURE_NEXT, FEATURE_PRIMARY_PAGE, FEATURES, type FeatureId } from '../lib/features'
import { FeatureDot } from './FeatureDot'

interface Props {
  /** The current page's feature. Undefined (transparency/admin pages) →
   *  the nudge renders nothing. */
  feature: FeatureId | undefined
  lang: Lang
}

const COPY = {
  fr: { eyebrow: 'Continue le tour' },
  en: { eyebrow: 'Continue the tour' },
} as const

export function FeatureContinue({ feature, lang }: Props) {
  if (!feature) return null

  const next = FEATURE_NEXT[feature]
  const to = FEATURE_PRIMARY_PAGE[next][lang]
  const label = FEATURES[next].label[lang]
  const t = COPY[lang]

  return (
    <aside className="feature-continue" data-feature={next}>
      <span className="feature-continue__eyebrow mono">{t.eyebrow}</span>
      <Link className="feature-continue__link" to={to}>
        <FeatureDot
          feature={next}
          lang={lang}
          size="md"
          decorative
          className="feature-continue__dot"
        />
        <span className="feature-continue__label">{label}</span>
        <span className="feature-continue__arrow" aria-hidden="true">
          →
        </span>
      </Link>
    </aside>
  )
}
