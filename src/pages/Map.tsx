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
import { MAP_DATA } from '../lib/map/data'
import { filterForViewer } from '../lib/map/filter'
import type { LayerId } from '../lib/map/types'
import { MapCanvas } from '../components/Map/MapCanvas'
import { MapLegend } from '../components/Map/MapLegend'

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

const VALID_LAYERS = new Set<LayerId>(['pages', 'data', 'admin', 'journeys'])

export function Map({ lang }: { lang: Lang }) {
  const { isAdmin, realIsAdmin, previewAsUser, setPreviewAsUser } = useAuth()
  const [params, setParams] = useSearchParams()

  // URL is the source of truth for layer + journey so /carte?layer=data is
  // bookmarkable and refresh-safe. Default to pages when missing or invalid.
  const layer: LayerId = (() => {
    const v = params.get('layer') as LayerId | null
    return v && VALID_LAYERS.has(v) ? v : 'pages'
  })()
  const activeJourneyId = params.get('journey') ?? undefined

  const setLayer = useCallback(
    (l: LayerId) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (l === 'pages') next.delete('layer')
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

  const filtered = useMemo(() => filterForViewer(MAP_DATA, isAdmin), [isAdmin])

  // When on the journeys layer with exactly one journey, surface its label
  // so the user isn't staring at a polyline with no name.
  const activeJourney =
    layer === 'journeys'
      ? (filtered.journeys.find((j) => j.id === activeJourneyId) ?? filtered.journeys[0])
      : undefined

  return (
    <article className="map-page">
      <header className="map-page__head">
        <div className="section__eyebrow">{t.eyebrow}</div>
        <h1 className="map-page__title">{t.title}</h1>
        <p className="map-page__sub">{t.sub}</p>
      </header>

      {realIsAdmin && previewAsUser && (
        <div className="map-page__preview-banner" role="status">
          {t.previewBanner}
        </div>
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

      <div className="map-page__canvas">
        <MapCanvas
          layer={layer}
          data={filtered}
          lang={lang}
          isAdmin={isAdmin}
          activeJourneyId={activeJourneyId}
        />
      </div>
    </article>
  )
}
