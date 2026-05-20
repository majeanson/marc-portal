/**
 * FeatureIndex — the textual companion to the ?feature= filter. When a
 * feature is open on /carte it lists EVERY surface that carries that
 * colour: the pages (from the map graph) and the home anchor sections
 * (from HOME_SECTION_FEATURE). This is what makes a Vision bubble click
 * answer "show me all of pricing" instead of dropping you on one page.
 *
 * Pages come from the already-viewer-filtered MapData, so a logged-out
 * visitor never sees an admin-only page leak into the list.
 */

import { Link } from 'react-router-dom'
import type { Lang } from '../../i18n'
import {
  FEATURES,
  HOME_SECTION_FEATURE,
  HOME_SECTION_LABEL,
  type FeatureId,
} from '../../lib/features'
import type { MapData, MapNode } from '../../lib/map/types'

interface Props {
  feature: FeatureId
  lang: Lang
  /** Viewer-filtered map data — pages are read from here. */
  data: MapData
  onClear: () => void
}

const COPY = {
  fr: {
    eyebrow: 'Filtre actif',
    pages: 'Pages',
    sections: 'Sections d’accueil',
    clear: 'Tout afficher',
    page: 'page',
    pagePlural: 'pages',
    section: 'section',
    sectionPlural: 'sections',
    empty: 'Aucune surface publique pour cette couleur.',
  },
  en: {
    eyebrow: 'Active filter',
    pages: 'Pages',
    sections: 'Home sections',
    clear: 'Show all',
    page: 'page',
    pagePlural: 'pages',
    section: 'section',
    sectionPlural: 'sections',
    empty: 'No public surface for this colour.',
  },
} as const

function nodeHref(node: MapNode, lang: Lang): string {
  if (!node.href) return '#'
  return typeof node.href === 'string' ? node.href : node.href[lang]
}

export function FeatureIndex({ feature, lang, data, onClear }: Props) {
  const t = COPY[lang]
  const langPrefix = lang === 'en' ? '/en' : ''

  const pages = data.nodes
    .filter((n) => n.kind === 'page' && n.feature === feature)
    .sort((a, b) => a.label[lang].localeCompare(b.label[lang]))

  const sections = Object.entries(HOME_SECTION_FEATURE)
    .filter(([, fid]) => fid === feature)
    .map(([slug]) => slug)

  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

  return (
    <section
      className="feature-index"
      data-feature={feature}
      aria-label={FEATURES[feature].label[lang]}
    >
      <header className="feature-index__head">
        <span className="feature-index__dot" aria-hidden="true" />
        <div className="feature-index__heading">
          <span className="feature-index__eyebrow mono">{t.eyebrow}</span>
          <h2 className="feature-index__title">{FEATURES[feature].label[lang]}</h2>
        </div>
        <span className="feature-index__count mono">
          {count(pages.length, t.page, t.pagePlural)}
          {sections.length > 0 && ` · ${count(sections.length, t.section, t.sectionPlural)}`}
        </span>
        <button type="button" className="feature-index__clear mono" onClick={onClear}>
          {t.clear} ×
        </button>
      </header>

      {pages.length === 0 && sections.length === 0 ? (
        <p className="feature-index__empty">{t.empty}</p>
      ) : (
        <div className="feature-index__lists">
          {pages.length > 0 && (
            <div className="feature-index__col">
              <h3 className="feature-index__col-title mono">{t.pages}</h3>
              <ul className="feature-index__items">
                {pages.map((p) => (
                  <li key={p.id}>
                    <Link className="feature-index__item" to={nodeHref(p, lang)}>
                      {p.label[lang]}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {sections.length > 0 && (
            <div className="feature-index__col">
              <h3 className="feature-index__col-title mono">{t.sections}</h3>
              <ul className="feature-index__items">
                {sections.map((slug) => (
                  <li key={slug}>
                    <a className="feature-index__item" href={`${langPrefix}/#${slug}`}>
                      {HOME_SECTION_LABEL[slug]?.[lang] ?? slug}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
