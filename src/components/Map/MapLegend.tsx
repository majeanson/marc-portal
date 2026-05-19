/**
 * Legend strip — layer toggle (radio: one active at a time), journey
 * selector (visible only on the journeys layer), and a "preview as
 * visitor" affordance for admins. Reuses the existing previewAsUser
 * sessionStorage key from AuthProvider so toggling here matches
 * toggling from the header.
 *
 * Layer chips follow the WAI-ARIA radiogroup pattern: keys live on the
 * buttons themselves, only the active chip is tabbable, and arrow-key
 * presses advance both selection and focus to the next chip.
 */

import { useRef } from 'react'
import type { Lang } from '../../i18n'
import type { LayerId, MapData } from '../../lib/map/types'

interface Props {
  lang: Lang
  layer: LayerId
  setLayer: (l: LayerId) => void
  data: MapData
  activeJourneyId?: string
  setActiveJourneyId: (id: string) => void
  realIsAdmin: boolean
  previewAsUser: boolean
  setPreviewAsUser: (v: boolean) => void
}

const LAYER_LABELS = {
  fr: {
    vision: 'Vue d’ensemble',
    pages: 'Pages',
    data: 'Flux de données',
    journeys: 'Parcours',
    admin: 'Admin',
    previewAsUser: 'Voir comme visiteur',
    exitPreview: 'Quitter aperçu',
    journey: 'Parcours :',
  },
  en: {
    vision: 'Big picture',
    pages: 'Pages',
    data: 'Data flow',
    journeys: 'Journeys',
    admin: 'Admin',
    previewAsUser: 'Preview as visitor',
    exitPreview: 'Exit preview',
    journey: 'Journey:',
  },
} as const

// Render order, left → right. `vision` first because it's the entry point;
// other layers drill down from there.
const LAYER_ORDER: LayerId[] = ['vision', 'pages', 'data', 'journeys', 'admin']

export function MapLegend({
  lang,
  layer,
  setLayer,
  data,
  activeJourneyId,
  setActiveJourneyId,
  realIsAdmin,
  previewAsUser,
  setPreviewAsUser,
}: Props) {
  const t = LAYER_LABELS[lang]
  const chipRefs = useRef<Array<HTMLButtonElement | null>>([])

  function handleChipKey(e: React.KeyboardEvent<HTMLButtonElement>, idx: number) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const dir = e.key === 'ArrowRight' ? 1 : -1
    const nextIdx = (idx + dir + LAYER_ORDER.length) % LAYER_ORDER.length
    setLayer(LAYER_ORDER[nextIdx])
    // Move keyboard focus to the newly-selected chip on the next tick so
    // React has time to flip tabIndex on the rendered buttons first.
    queueMicrotask(() => chipRefs.current[nextIdx]?.focus())
  }

  return (
    <div className="map-legend">
      <div
        className="map-legend__layers"
        role="group"
        aria-label={lang === 'en' ? 'Map layer' : 'Couche de la carte'}
      >
        {LAYER_ORDER.map((id, idx) => (
          <button
            key={id}
            ref={(el) => {
              chipRefs.current[idx] = el
            }}
            type="button"
            role="radio"
            aria-checked={layer === id}
            tabIndex={layer === id ? 0 : -1}
            className={`map-legend__chip${layer === id ? ' map-legend__chip--active' : ''}`}
            onClick={() => setLayer(id)}
            onKeyDown={(e) => handleChipKey(e, idx)}
          >
            {t[id]}
          </button>
        ))}
      </div>

      {layer === 'journeys' && data.journeys.length > 1 && (
        <label className="map-legend__journey">
          <span className="mono">{t.journey}</span>
          <select
            value={activeJourneyId ?? data.journeys[0]?.id ?? ''}
            onChange={(e) => setActiveJourneyId(e.target.value)}
          >
            {data.journeys.map((j) => (
              <option key={j.id} value={j.id}>
                {j.label[lang]}
              </option>
            ))}
          </select>
        </label>
      )}

      {realIsAdmin && (
        <button
          type="button"
          className={`map-legend__preview${previewAsUser ? ' map-legend__preview--on' : ''}`}
          onClick={() => setPreviewAsUser(!previewAsUser)}
          aria-pressed={previewAsUser}
        >
          {previewAsUser ? t.exitPreview : t.previewAsUser}
        </button>
      )}
    </div>
  )
}
