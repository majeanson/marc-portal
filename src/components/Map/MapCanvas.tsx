/**
 * Canvas host — routes the active layer choice to the right layer
 * component. Each layer renders its own <svg> with its own viewBox; we
 * don't try to share a single canvas because the four layouts have very
 * different aspect ratios (tall grid vs wide columns vs HTML grid).
 */

import type { Lang } from '../../i18n'
import type { LayerId, MapData } from '../../lib/map/types'
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
}

export function MapCanvas({ layer, data, lang, isAdmin, activeJourneyId }: Props) {
  switch (layer) {
    case 'pages':
      return <PagesLayer data={data} lang={lang} />
    case 'data':
      return <DataLayer data={data} lang={lang} />
    case 'admin':
      return <AdminLayer lang={lang} isAdmin={isAdmin} />
    case 'journeys':
      return <JourneysLayer data={data} lang={lang} journeyId={activeJourneyId} />
  }
}
