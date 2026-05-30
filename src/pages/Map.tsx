/**
 * /carte (fr) + /en/map (en) — layered atlas of the whole site.
 *
 * Four togglable layers (Pages, Data flow, Journeys, Admin) share a
 * single curated MapData. Visitors see public surfaces + service teasers
 * with admin nodes filtered out; admins see everything. The filter
 * reuses the same `previewAsUser` sessionStorage flag the rest of the
 * chrome uses, so toggling here matches toggling from the header.
 *
 * The page itself is 100% static after the prebuild script runs —
 * no analytics, no third-party fonts, no remote fetch. Honors the
 * project's Loi 25 posture (see docs/loi-25-pia.md).
 */

import { useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Lang } from '../i18n'
import { useAuth } from '../lib/authContext'
import { isFeatureId, PAGE_FEATURE, type FeatureId } from '../lib/features'
import { PAGE_FOLIOS } from '../lib/folios'
import { MAP_DATA } from '../lib/map/data'
import { filterForViewer } from '../lib/map/filter'
import type { LayerId } from '../lib/map/types'
import { FeatureContinue } from '../components/FeatureContinue'
import { FeatureFolioLink } from '../components/FeatureFolioLink'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { MapCanvas } from '../components/Map/MapCanvas'
import { MapLegend } from '../components/Map/MapLegend'
import { FeatureIndex } from '../components/Map/FeatureIndex'
import { WalkthroughFilm } from '../components/Map/WalkthroughFilm'

const COPY = {
  fr: {
    eyebrow: 'CARTE',
    title: 'Le site, vu d’en haut',
    sub: 'Pages, données, parcours, console admin — quatre lentilles sur la même structure. Bascule entre elles, ou aperçu visiteur si tu es opérateur.',
    crumb: 'Carte',
    previewBanner:
      'Aperçu visiteur — tu vois ce que voit un visiteur non connecté. Clique « Quitter aperçu » pour revenir.',
    journeyOn: 'Parcours :',
  },
  en: {
    eyebrow: 'MAP',
    title: 'The site, from above',
    sub: 'Pages, data, journeys, admin console — four lenses on the same structure. Toggle between them, or preview as visitor if you’re the operator.',
    crumb: 'Map',
    previewBanner:
      'Previewing as visitor — you’re seeing what a signed-out visitor sees. Click “Exit preview” to return.',
    journeyOn: 'Journey:',
  },
} as const

const VALID_LAYERS = new Set<LayerId>(['vision', 'pages', 'data', 'admin', 'journeys'])

export function Map({ lang }: { lang: Lang }) {
  const { isAdmin, realIsAdmin, previewAsUser, setPreviewAsUser } = useAuth()
  const [params, setParams] = useSearchParams()

  // URL is the source of truth for layer + journey so /carte?layer=data is
  // bookmarkable and refresh-safe. Default to vision — the entry layer that
  // explains the whole idea before any drill-down.
  const layer: LayerId = (() => {
    const v = params.get('layer') as LayerId | null
    return v && VALID_LAYERS.has(v) ? v : 'vision'
  })()
  const activeJourneyId = params.get('journey') ?? undefined

  // Cross-cutting feature filter — set by clicking a feature dot anywhere on
  // the site. When active, non-matching bubbles/groups/nodes get a "dim"
  // class so the user sees only their feature's territory. Cleared via the
  // filter pill.
  const activeFeatureRaw = params.get('feature')
  const activeFeature: FeatureId | null = isFeatureId(activeFeatureRaw) ? activeFeatureRaw : null

  const clearFeature = useCallback(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('feature')
        return next
      },
      { replace: true },
    )
  }, [setParams])

  // Opening a feature (clicking a Vision bubble) drops the visitor on the
  // Pages layer filtered to that feature — they see every page in the
  // colour, and the FeatureIndex panel lists pages + home sections. Not a
  // `replace` so the browser back button returns to the Vision view.
  const selectFeature = useCallback(
    (f: FeatureId) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set('layer', 'pages')
        next.set('feature', f)
        return next
      })
    },
    [setParams],
  )

  const setLayer = useCallback(
    (l: LayerId) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          // 'vision' is the default — keep the URL clean when on it.
          if (l === 'vision') next.delete('layer')
          else next.set('layer', l)
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )
  const setActiveJourneyId = useCallback(
    (id: string) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set('journey', id)
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const t = COPY[lang]
  useEffect(() => {
    document.title = `${t.crumb} — Marc`
  }, [t])

  // Search hand-off: /carte?node=<id> (set by a site-search result's "on the
  // map" link) scrolls the atlas to that node's card and pulses it, so a
  // pinpoint lookup expands into context. The id is map-controlled, but the
  // regex guard keeps the attribute selector safe from anything unexpected.
  const focusNodeId = params.get('node')
  useEffect(() => {
    if (!focusNodeId || !/^[\w.-]+$/.test(focusNodeId)) return
    const tid = window.setTimeout(() => {
      const el = document.querySelector(`[data-search-node="${focusNodeId}"]`)
      if (!(el instanceof HTMLElement)) return
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('map-card-row--found')
      window.setTimeout(() => el.classList.remove('map-card-row--found'), 2400)
    }, 150)
    return () => window.clearTimeout(tid)
  }, [focusNodeId, layer])

  const filtered = useMemo(() => filterForViewer(MAP_DATA, isAdmin), [isAdmin])

  // When on the journeys layer with exactly one journey, surface its label
  // so the user isn't staring at a polyline with no name.
  const activeJourney =
    layer === 'journeys'
      ? (filtered.journeys.find((j) => j.id === activeJourneyId) ?? filtered.journeys[0])
      : undefined

  return (
    <div className="app">
      <Header lang={lang} />
      <main id="main-content">
        {/* Map is wider than the 880px reading column other content pages
            use (the layered atlas needs room), so it sits directly inside
            <main> with its own .map-page max-width + centering. */}
        <article className="map-page">
          <header className="map-page__head">
            <div className="section__eyebrow">{t.eyebrow}</div>
            <FeatureFolioLink feature={PAGE_FEATURE['page.map-page']} lang={lang} withDot>
              № {PAGE_FOLIOS.map}
            </FeatureFolioLink>
            <h1 className="map-page__title">{t.title}</h1>
            <p className="map-page__sub">{t.sub}</p>
          </header>

          {realIsAdmin && previewAsUser && (
            <div className="map-page__preview-banner" role="status">
              {t.previewBanner}
            </div>
          )}

          {activeFeature && (
            <FeatureIndex
              feature={activeFeature}
              lang={lang}
              data={filtered}
              onClear={clearFeature}
            />
          )}

          <MapLegend
            lang={lang}
            layer={layer}
            setLayer={setLayer}
            data={filtered}
            activeJourneyId={activeJourneyId}
            setActiveJourneyId={setActiveJourneyId}
            realIsAdmin={realIsAdmin}
            previewAsUser={previewAsUser}
            setPreviewAsUser={setPreviewAsUser}
          />

          {activeJourney && (
            <p className="map-page__journey-title">
              <span className="mono">{t.journeyOn}</span> {activeJourney.label[lang]}
            </p>
          )}

          <div
            className="surface map-page__canvas"
            data-active-feature={activeFeature ?? undefined}
            data-layer={layer}
          >
            {/* Mobile scroll hint — visible only on narrow screens AND
                only on layers that horizontally scroll (Pages, Data,
                Journeys). Vision swaps to a vertical card stack on
                mobile so it doesn't need the hint; Admin is an HTML
                grid that reflows naturally. */}
            {(layer === 'pages' || layer === 'data' || layer === 'journeys') && (
              <p className="map-page__scroll-hint mono" aria-hidden="true">
                {lang === 'en' ? '← scroll to pan →' : '← glisser pour voir →'}
              </p>
            )}
            <MapCanvas
              layer={layer}
              data={filtered}
              lang={lang}
              isAdmin={isAdmin}
              activeJourneyId={activeJourneyId}
              activeFeature={activeFeature}
              onSelectFeature={selectFeature}
            />
          </div>

          {/* The atlas is the static structure; this is the same journey
              played out. Sits below the canvas as a coda so the interactive
              map stays the page's lead. */}
          <WalkthroughFilm lang={lang} />
        </article>
      </main>
      <FeatureContinue page="page.map-page" lang={lang} />
      <Footer lang={lang} />
    </div>
  )
}
