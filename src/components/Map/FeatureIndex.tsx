/**
 * FeatureIndex — the textual companion to the ?feature= filter. When a
 * feature is open on /carte it lists EVERY surface that carries that
 * colour, exhaustively:
 *
 *   - Pages          — from the viewer-filtered map graph
 *   - Home sections  — from HOME_SECTION_FEATURE  (linked /#anchor)
 *   - FAQ items      — from FAQ_FEATURE           (linked /#faq-slug)
 *   - Session tabs   — from SESSION_TAB_FEATURE   (contextual, no link:
 *                      a tab needs a live session id, so it's listed as
 *                      "where this colour also shows up", not a target)
 *
 * This is what makes a Vision bubble click answer "show me ALL of
 * pricing" — pages, sections, FAQ, and the in-session tab — instead of
 * dropping the visitor on one page.
 *
 * Pages come from the already-viewer-filtered MapData, so a logged-out
 * visitor never sees an admin-only page leak into the list.
 */

import { Link } from 'react-router-dom'
import type { Lang } from '../../i18n'
import {
  FAQ_FEATURE,
  FAQ_LABEL,
  FEATURES,
  HOME_SECTION_FEATURE,
  HOME_SECTION_LABEL,
  SESSION_TAB_FEATURE,
  SESSION_TAB_LABEL,
  type FeatureId,
} from '../../lib/features'
import { FeatureGlyph } from '../../lib/featureGlyphs'
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
    faq: 'FAQ',
    tabs: 'Dans une session',
    tabsHint: 'Onglets — visibles dans n’importe quelle session.',
    clear: 'Tout afficher',
    surface: 'surface',
    surfacePlural: 'surfaces',
    empty: 'Aucune surface publique pour cette couleur.',
  },
  en: {
    eyebrow: 'Active filter',
    pages: 'Pages',
    sections: 'Home sections',
    faq: 'FAQ',
    tabs: 'Inside a session',
    tabsHint: 'Tabs — shown in any session.',
    clear: 'Show all',
    surface: 'surface',
    surfacePlural: 'surfaces',
    empty: 'No public surface for this colour.',
  },
} as const

function nodeHref(node: MapNode, lang: Lang): string {
  if (!node.href) return '#'
  return typeof node.href === 'string' ? node.href : node.href[lang]
}

function slugsFor(map: Record<string, FeatureId | undefined>, feature: FeatureId): string[] {
  return Object.entries(map)
    .filter(([, fid]) => fid === feature)
    .map(([slug]) => slug)
}

export function FeatureIndex({ feature, lang, data, onClear }: Props) {
  const t = COPY[lang]
  const langPrefix = lang === 'en' ? '/en' : ''

  const pages = data.nodes
    .filter((n) => n.kind === 'page' && n.feature === feature)
    .sort((a, b) => a.label[lang].localeCompare(b.label[lang]))
  const sections = slugsFor(HOME_SECTION_FEATURE, feature)
  const faqs = slugsFor(FAQ_FEATURE, feature)
  const tabs = slugsFor(SESSION_TAB_FEATURE, feature)

  const total = pages.length + sections.length + faqs.length + tabs.length

  return (
    <section
      className="feature-index"
      data-feature={feature}
      aria-label={FEATURES[feature].label[lang]}
    >
      <header className="feature-index__head">
        <span className="feature-index__dot" aria-hidden="true">
          <FeatureGlyph feature={feature} />
        </span>
        <div className="feature-index__heading">
          <span className="feature-index__eyebrow mono">{t.eyebrow}</span>
          <h2 className="feature-index__title">{FEATURES[feature].label[lang]}</h2>
        </div>
        <span className="feature-index__count mono">
          {total} {total === 1 ? t.surface : t.surfacePlural}
        </span>
        <button type="button" className="feature-index__clear mono" onClick={onClear}>
          {t.clear} ×
        </button>
      </header>

      {total === 0 ? (
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
          {faqs.length > 0 && (
            <div className="feature-index__col">
              <h3 className="feature-index__col-title mono">{t.faq}</h3>
              <ul className="feature-index__items">
                {faqs.map((slug) => (
                  <li key={slug}>
                    <a className="feature-index__item" href={`${langPrefix}/#faq-${slug}`}>
                      {FAQ_LABEL[slug]?.[lang] ?? slug}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {tabs.length > 0 && (
            <div className="feature-index__col">
              <h3 className="feature-index__col-title mono">{t.tabs}</h3>
              <ul className="feature-index__items">
                {tabs.map((slug) => (
                  <li key={slug}>
                    {/* Not a link — a session tab needs a live session id.
                        Listed so the feature's footprint is exhaustive. */}
                    <span className="feature-index__item feature-index__item--static">
                      {SESSION_TAB_LABEL[slug]?.[lang] ?? slug}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="feature-index__col-hint">{t.tabsHint}</p>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
