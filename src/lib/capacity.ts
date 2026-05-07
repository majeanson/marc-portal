import type { Lang } from '../i18n'
import capacityData from '../../public/data/capacity.json'

export interface Capacity {
  activeBuilds: number
  inTriage: number
  waitlist: number
  nextOpening: { fr: string; en: string }
  atCap: boolean
  lastUpdated: string
}

const CAPACITY: Capacity = {
  activeBuilds: capacityData.activeBuilds,
  inTriage: capacityData.inTriage,
  waitlist: capacityData.waitlist,
  nextOpening: capacityData.nextOpening,
  atCap: capacityData.atCap,
  lastUpdated: capacityData.lastUpdated,
}

export function getCapacity(): Capacity {
  return CAPACITY
}

export function nextOpeningText(lang: Lang): string {
  return CAPACITY.nextOpening[lang]
}
