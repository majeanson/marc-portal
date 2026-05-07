import type { Lang } from '../i18n'

type FeatureStatus = 'draft' | 'active' | 'frozen' | 'deprecated'

export interface FeatureDecision {
  decision: string
  rationale: string
  recommendation?: string
  date?: string
}

export interface FeatureLineage {
  parent?: string | null
  children?: string[]
}

export interface StatusTransition {
  from: FeatureStatus
  to: FeatureStatus
  date: string
  reason?: string
}

export interface FeatureRevision {
  date: string
  author: string
  fields_changed: string[]
  reason: string
  /**
   * Git short SHA of the commit that introduced this revision. Optional —
   * older revisions predating this convention won't have one. When present,
   * a GitHub commit link is rendered alongside the entry.
   */
  commit?: string
  /**
   * Cloudflare Pages preview URL for the deployment that shipped this
   * revision (e.g. https://5285cfb8.marc-portal.pages.dev). When set,
   * RevisionLog renders a "view this build" toggle that opens an iframe
   * pointed at <buildUrl><iframePath> — letting visitors time-travel through
   * the actual rendered demo at that point in history.
   */
  buildUrl?: string
}

export interface FeatureJson {
  featureKey: string
  title: string
  status: FeatureStatus
  domain?: string
  problem: string
  analysis?: string
  decisions?: FeatureDecision[]
  successCriteria?: string
  knownLimitations?: string[]
  tags?: string[]
  lineage?: FeatureLineage
  statusHistory?: StatusTransition[]
  revisions?: FeatureRevision[]
  annotations?: FeatureAnnotation[]
}

export type EngagementStage = 'intake' | 'triage' | 'plan' | 'build' | 'review' | 'shipped'

export interface EngagementEvent {
  stage: EngagementStage
  date: string | null
  completed: boolean
  label: { fr: string; en: string }
}

export type Tier = 'Tier 0' | 'Tier 1' | 'Tier 2' | 'Tier 3'

export interface ShowcaseDecision {
  decision: { fr: string; en: string }
  rationale: { fr: string; en: string }
}

export interface ShowcaseData {
  slug: string
  tier: Tier
  price: string
  hours: string
  shippedDate: string | null
  targetShipDate?: string | null
  liveUrl: string | null
  sourceUrl: string | null
  primaryLang: Lang
  title: { fr: string; en: string }
  summary: { fr: string; en: string }
  compositeDisclosure?: { fr: string; en: string }
  engagement: EngagementEvent[]
  decisions?: ShowcaseDecision[]
}

export interface ShowcaseAnnotation {
  id: string
  type: 'showcase'
  date: string
  author: string
  body: string
  data: ShowcaseData
}

interface OtherAnnotation {
  id: string
  type: string
  date: string
  author: string
  body: string
  [key: string]: unknown
}

export type FeatureAnnotation = ShowcaseAnnotation | OtherAnnotation

export interface ShowcaseEntry {
  feature: FeatureJson
  showcase: ShowcaseData
}

import rootFeature from '../../feature.json'

const childModules = import.meta.glob<FeatureJson>('../../feat-*/feature.json', {
  eager: true,
  import: 'default',
})

const ALL_FEATURES: FeatureJson[] = [
  rootFeature as unknown as FeatureJson,
  ...Object.values(childModules),
]

function isShowcaseAnnotation(a: FeatureAnnotation): a is ShowcaseAnnotation {
  return a.type === 'showcase' && 'data' in a
}

function buildEntries(): ShowcaseEntry[] {
  const entries: ShowcaseEntry[] = []
  for (const feature of ALL_FEATURES) {
    const showcase = feature.annotations?.find(isShowcaseAnnotation)?.data
    if (showcase) entries.push({ feature, showcase })
  }
  return entries.sort((a, b) => {
    const ad = a.showcase.shippedDate ?? a.showcase.targetShipDate ?? ''
    const bd = b.showcase.shippedDate ?? b.showcase.targetShipDate ?? ''
    return bd.localeCompare(ad)
  })
}

const SHOWCASES = buildEntries()

export function listShowcases(): ShowcaseEntry[] {
  return SHOWCASES
}

export function getShowcaseBySlug(slug: string): ShowcaseEntry | null {
  return SHOWCASES.find((e) => e.showcase.slug === slug) ?? null
}

export function getChildFeatures(parentKey: string): FeatureJson[] {
  return ALL_FEATURES.filter((f) => f.lineage?.parent === parentKey).sort((a, b) =>
    a.featureKey.localeCompare(b.featureKey),
  )
}

export function getRevisions(feature: FeatureJson): FeatureRevision[] {
  return [...(feature.revisions ?? [])].sort((a, b) => b.date.localeCompare(a.date))
}

export function getStatusHistory(feature: FeatureJson): StatusTransition[] {
  return [...(feature.statusHistory ?? [])].sort((a, b) => a.date.localeCompare(b.date))
}

export function getCreatedDate(feature: FeatureJson): string | null {
  const revs = feature.revisions ?? []
  if (revs.length === 0) return null
  return revs.reduce((min, r) => (r.date < min ? r.date : min), revs[0].date)
}

export function getLastRevisionDate(feature: FeatureJson): string | null {
  const revs = feature.revisions ?? []
  if (revs.length === 0) return null
  return revs.reduce((max, r) => (r.date > max ? r.date : max), revs[0].date)
}
