/**
 * Search corpus — built from the /carte atlas.
 *
 * The map (src/lib/map) already maintains a curated, bilingual graph of
 * every page, section and service on the site: each MapNode carries a
 * label, a description and an href. That graph IS the search index — so
 * search and the atlas never drift, and adding a node to the map makes it
 * findable here for free.
 *
 * Each node is flattened into a SearchEntry with a `priority` weight so the
 * panel can lead with the destinations that matter (intake, pricing,
 * projects) instead of an alphabetic dump — both as empty-query suggestions
 * and as the tie-breaker when two entries match a query equally well.
 */

import { MAP_DATA } from '../map/data'
import type { Bi, MapNode, NodeKind, Visibility } from '../map/types'

export interface SearchEntry {
  id: string
  kind: NodeKind
  label: Bi
  /** May be empty ('') in both languages when the source node has no desc. */
  desc: Bi
  href?: Bi | string
  hrefExternal?: boolean
  feature?: string
  /** Friendly group name, for the result's context line. */
  group?: Bi
  visibility: Visibility
  /** Higher surfaces first. */
  priority: number
}

const EMPTY: Bi = { fr: '', en: '' }

// Base weight by node kind — what a visitor is most likely hunting for.
const KIND_PRIORITY: Record<NodeKind, number> = {
  page: 60,
  section: 42,
  service: 24,
  endpoint: 20,
  table: 16,
  binding: 12,
  'admin-tile': 8,
}

// Hand-tuned boosts for the conversion-critical destinations. An id absent
// from the map simply scores 0 here — harmless.
const ID_BOOST: Record<string, number> = {
  'page.home': 30,
  'page.intake': 45,
  'page.projects': 28,
  'page.tier-0': 26,
  'page.journey': 14,
  'page.vouches': 10,
  'home.pricing': 24,
  'home.vibe': 12,
}

function entryFor(node: MapNode, groupLabels: Map<string, Bi>): SearchEntry {
  return {
    id: node.id,
    kind: node.kind,
    label: node.label,
    desc: node.desc ?? EMPTY,
    href: node.href,
    hrefExternal: node.hrefExternal,
    feature: node.feature,
    group: node.group ? groupLabels.get(node.group) : undefined,
    visibility: node.visibility,
    priority: (KIND_PRIORITY[node.kind] ?? 10) + (ID_BOOST[node.id] ?? 0),
  }
}

/**
 * The full corpus — built once at module load. A node with no layers is an
 * edge-only stub (see MapNode.layers), never a real destination, so it is
 * dropped. Filter by viewer at query time via {@link visibleEntries}.
 */
export const SEARCH_CORPUS: SearchEntry[] = (() => {
  const groupLabels = new Map<string, Bi>()
  for (const g of MAP_DATA.groups) groupLabels.set(g.id, g.label)
  return MAP_DATA.nodes.filter((n) => n.layers.length > 0).map((n) => entryFor(n, groupLabels))
})()

/** Corpus slice the given viewer is allowed to see. */
export function visibleEntries(isAdmin: boolean): SearchEntry[] {
  return isAdmin ? SEARCH_CORPUS : SEARCH_CORPUS.filter((e) => e.visibility === 'public')
}
