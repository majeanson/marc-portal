/**
 * FeatureContinue — the page-outro "where next" pointer. Sits at the bottom
 * of every content page so no page is a dead end and the visitor always
 * knows two concrete ways to keep moving: onward through the tour, or back
 * to the matching section of the home page.
 *
 * Two arcs, one component:
 *  - Product pages ride the FEATURE_NEXT loop: bring a project → talk → see
 *    builds → pricing → keys → proof → back to bring a project. The loop
 *    closes on intake so the proof pages double as a conversion nudge.
 *  - Backstage (`meta`) pages ride the META_PAGE_NEXT loop: site map → under
 *    the hood → privacy → PIA → back to the map.
 *
 * Both arcs also carry a "back to home" exit (FEATURE_HOME_SECTION) so the
 * loop is never a trap — the visitor can always drop back to the main page.
 *
 * The page passes only its own page-id; the component derives the feature,
 * the destination and the colour. No per-page curation of "what's next".
 */

import { Link } from 'react-router-dom'
import type { Lang } from '../i18n'
import {
  FEATURE_HOME_SECTION,
  FEATURE_NEXT,
  FEATURE_PRIMARY_PAGE,
  FEATURES,
  HOME_SECTION_LABEL,
  META_PAGE_LINK,
  META_PAGE_NEXT,
  PAGE_FEATURE,
} from '../lib/features'
import { FeatureDot } from './FeatureDot'

interface Props {
  /** The current page's node id, e.g. 'page.handoff' or 'page.privacy'.
   *  An id with no PAGE_FEATURE entry renders nothing. */
  page: string
  lang: Lang
}

const COPY = {
  fr: {
    tourEyebrow: 'Continue le tour',
    tourHint:
      'Le site fait une boucle : six fonctionnalités, chacune reliée par sa couleur. Suis la pastille pour passer à la suivante.',
    metaEyebrow: 'Les coulisses',
    metaHint:
      'Les pages qui montrent comment le site est bâti et comment tes données sont protégées. Continue, ou reviens à la carte quand tu veux.',
    backHome: 'Retour à l’accueil',
  },
  en: {
    tourEyebrow: 'Continue the tour',
    tourHint:
      'The site loops: six features, each linked by colour. Follow the dot to reach the next one.',
    metaEyebrow: 'Behind the scenes',
    metaHint:
      'The pages that show how the site is built and how your data is protected. Keep going, or head back to the map any time.',
    backHome: 'Back to home',
  },
} as const

export function FeatureContinue({ page, lang }: Props) {
  const feature = PAGE_FEATURE[page]
  if (!feature) return null
  const t = COPY[lang]
  const langPrefix = lang === 'en' ? '/en' : ''

  // Back-to-home exit — lands on the home section that matches THIS page's
  // feature, so neither tour loop is ever a trap.
  const homeSection = FEATURE_HOME_SECTION[feature]
  const homeLink = (
    <Link className="feature-continue__home" to={`${langPrefix}/#${homeSection}`}>
      <span aria-hidden="true">←</span> {t.backHome} · {HOME_SECTION_LABEL[homeSection][lang]}
    </Link>
  )

  // Backstage pages: walk the META_PAGE_NEXT loop instead of the product arc.
  if (feature === 'meta') {
    const nextPage = META_PAGE_NEXT[page]
    const link = nextPage ? META_PAGE_LINK[nextPage] : undefined
    if (!link) return null
    return (
      <aside className="feature-continue" data-feature="meta">
        <span className="feature-continue__eyebrow mono">{t.metaEyebrow}</span>
        <p className="feature-continue__hint">{t.metaHint}</p>
        <Link className="feature-continue__link" to={link.path[lang]}>
          <FeatureDot
            feature="meta"
            lang={lang}
            size="md"
            decorative
            className="feature-continue__dot"
          />
          <span className="feature-continue__label">{link.label[lang]}</span>
          <span className="feature-continue__arrow" aria-hidden="true">
            →
          </span>
        </Link>
        {homeLink}
      </aside>
    )
  }

  // Product pages: `feature` is now narrowed to a ProductFeatureId, so the
  // FEATURE_NEXT lookup is total.
  const next = FEATURE_NEXT[feature]
  const to = FEATURE_PRIMARY_PAGE[next][lang]
  const label = FEATURES[next].label[lang]

  return (
    <aside className="feature-continue" data-feature={next}>
      <span className="feature-continue__eyebrow mono">{t.tourEyebrow}</span>
      <p className="feature-continue__hint">{t.tourHint}</p>
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
      {homeLink}
    </aside>
  )
}
