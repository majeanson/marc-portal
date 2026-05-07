/**
 * RootByTemplate — branches the root route by the resolved tenant's templateId.
 *
 * Marc's tenant (templateId='marc-portal') → marketing Home page (existing
 * behavior, no change for visitors of lifeascode.app or marc-portal.pages.dev).
 *
 * SND-template tenants (templateId='snd') → the buyer-facing SndApp at /.
 *
 * Unknown / not-yet-resolved → render Home as the safe default. The tenant
 * provider's loading window is short (single API call); rendering Home
 * briefly is preferable to flicker or a blank screen.
 */

import type { Lang } from '../i18n'
import { useTenant } from '../lib/tenantContext'
import { Home } from './Home'
import { SndApp } from './SndApp'

export function RootByTemplate({ lang }: { lang: Lang }) {
  const { tenant } = useTenant()
  if (tenant?.templateId === 'snd') {
    return <SndApp lang={lang} />
  }
  return <Home lang={lang} />
}
