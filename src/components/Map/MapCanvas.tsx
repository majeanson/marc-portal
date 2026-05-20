/**
 * Canvas host — routes the active layer choice to the right layer
 * component. Each layer renders its own <svg> with its own viewBox; we
 * don't try to share a single canvas because the four layouts have very
 * different aspect ratios (tall grid vs wide columns vs HTML grid).
 *
 * activeFeature is the cross-cutting filter (?feature=X in the URL).
 * Layers that show feature-tagged elements use it to dim non-matching
 * ones; layers that don't (Data, Admin) ignore it.
 */

import type { Lang } from '../../i18n'
import type { FeatureId } from '../../lib/features'
import type { LayerId, MapData } from '../../lib/map/types'
import { VisionLayer } from './layers/VisionLayer'
import { PagesLayer } from './layers/PagesLayer'
import { DataLayer } from './layers/DataLayer'
import { AdminLayer } from './layers/AdminLayer'
import { JourneysLayer } from './layers/JourneysLayer'

interface Props {
  layer: LayerId
  data: MapData
  lang: Lang
  isAdmin: boolean
  activeJourneyId?: string
  activeFeature?: FeatureId | null
  /** Open a feature from a Vision bubble — switches layer + applies filter. */
  onSelectFeature: (feature: FeatureId) => void
}

export function MapCanvas({
  layer,
  data,
  lang,
  isAdmin,
  activeJourneyId,
  activeFeature,
  onSelectFeature,
}: Props) {
  switch (layer) {
    case 'vision':
      return (
        <VisionLayer
          data={data}
          lang={lang}
          activeFeature={activeFeature ?? null}
          onSelectFeature={onSelectFeature}
        />
      )
    case 'pages':
      return <PagesLayer data={data} lang={lang} activeFeature={activeFeature ?? null} />
    case 'data':
      return <DataLayer data={data} lang={lang} />
    case 'admin':
      return <AdminLayer lang={lang} isAdmin={isAdmin} />
    case 'journeys':
      return <JourneysLayer data={data} lang={lang} journeyId={activeJourneyId} />
  }
}
