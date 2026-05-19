/**
 * Merge skeleton (auto-derived) + curated overlay → renderable MapData.
 *
 * Skeleton entries become baseline nodes; curated patches override fields
 * by id; curated extras (svc.*) are appended. We also fold PAGE_FOLIOS in
 * so the canonical magazine numbers ride along on page nodes without
 * having to be repeated in curated.ts.
 *
 * No I/O — pure function over the imported skeleton JSON + CURATED const.
 * Memo this if Map.tsx ever calls it on every render; today it's called
 * once at module top-level.
 */

import skeleton from '../../data/map-skeleton.json'
import { PAGE_FOLIOS } from '../folios'
import { CURATED } from './curated'
import type {
  CuratedOverlay,
  MapData,
  MapNode,
  OverlayPatch,
  Skeleton,
  SkeletonBinding,
  SkeletonEndpoint,
  SkeletonRoute,
  SkeletonTable,
} from './types'

const SKELETON = skeleton as Skeleton

function kebab(s: string): string {
  return s.replace(/([a-z\d])([A-Z])/g, '$1-$2').toLowerCase()
}

/** SessionPage has multiple routes (/session/:id + /admin/inbox/:id). Pick the
 *  shortest one as the canonical surface; the dual-context is shown via a
 *  curated `navigates` edge from page.admin-inbox. */
function preferShorter(a: string, b: string): string {
  return a.length <= b.length ? a : b
}

function pageNodesFromRoutes(routes: SkeletonRoute[]): MapNode[] {
  const byComp = new Map<
    string,
    { fr?: string; en?: string; dynamic: boolean; inAdminShell: boolean }
  >()
  for (const r of routes) {
    const acc = byComp.get(r.component) ?? { dynamic: false, inAdminShell: false }
    if (r.lang === 'fr') acc.fr = acc.fr ? preferShorter(acc.fr, r.path) : r.path
    if (r.lang === 'en') acc.en = acc.en ? preferShorter(acc.en, r.path) : r.path
    acc.dynamic = acc.dynamic || r.dynamic
    acc.inAdminShell = acc.inAdminShell || r.inAdminShell
    byComp.set(r.component, acc)
  }
  const nodes: MapNode[] = []
  for (const [component, info] of byComp) {
    if (component === 'Admin') continue // pure layout shell — no content
    const fr = info.fr ?? info.en ?? ''
    const en = info.en ?? info.fr ?? ''
    const id = `page.${kebab(component)}`
    nodes.push({
      id,
      kind: 'page',
      label: { fr: component, en: component }, // overridden in curated
      visibility: info.inAdminShell ? 'admin' : 'public',
      href: { fr, en },
      badge: info.dynamic ? 'dyn' : undefined,
      layers: info.inAdminShell ? ['pages', 'admin'] : ['pages'],
    })
  }
  return nodes
}

function endpointNodes(endpoints: SkeletonEndpoint[]): MapNode[] {
  // Endpoints are always admin-only in the map regardless of who can actually
  // call them — visitor view shows pages + services, not the internal API
  // surface. Skeleton still carries adminOnly so future tooling can use it.
  return endpoints.map((e) => ({
    id: e.id,
    kind: 'endpoint',
    label: { fr: e.path, en: e.path },
    badge: e.methods.join(' '),
    visibility: 'admin',
    layers: ['data'],
  }))
}

function tableNodes(tables: SkeletonTable[]): MapNode[] {
  return tables.map((t) => ({
    id: t.id,
    kind: 'table',
    label: { fr: t.name, en: t.name },
    badge: 'D1',
    visibility: 'admin',
    layers: ['data'],
  }))
}

function bindingNodes(bindings: SkeletonBinding[]): MapNode[] {
  return bindings.map((b) => ({
    id: b.id,
    kind: 'binding',
    label: { fr: b.binding, en: b.binding },
    badge: b.kind.toUpperCase(),
    visibility: 'admin',
    layers: ['data'],
  }))
}

const PAGE_FOLIO_BY_ID: Record<string, string> = {
  // PAGE_FOLIOS keys use the component dir-slug; map by node id.
  'page.tier0': PAGE_FOLIOS.tier0,
  'page.projects': PAGE_FOLIOS.projects,
  'page.vouches': PAGE_FOLIOS.vouches,
  'page.journey': PAGE_FOLIOS.journey,
  'page.meta': PAGE_FOLIOS.meta,
  'page.handoff': PAGE_FOLIOS.handoff,
}

function applyPatch(node: MapNode, patch: OverlayPatch): MapNode {
  // Defined fields on the patch win; the rest stays from the baseline.
  const merged: MapNode = { ...node }
  if (patch.label) merged.label = patch.label
  if (patch.desc) merged.desc = patch.desc
  if (patch.group) merged.group = patch.group
  if (patch.visibility) merged.visibility = patch.visibility
  if (patch.teaser !== undefined) merged.teaser = patch.teaser
  if (patch.folio) merged.folio = patch.folio
  if (patch.badge) merged.badge = patch.badge
  if (patch.layers) merged.layers = patch.layers
  if (patch.hrefExternal !== undefined) merged.hrefExternal = patch.hrefExternal
  return merged
}

export function buildMapData(
  skel: Skeleton = SKELETON,
  curated: CuratedOverlay = CURATED,
): MapData {
  const baseline: MapNode[] = [
    ...pageNodesFromRoutes(skel.routes),
    ...endpointNodes(skel.endpoints),
    ...tableNodes(skel.tables),
    ...bindingNodes(skel.bindings),
  ]

  const baselineIds = new Set(baseline.map((n) => n.id))
  const patchById = new Map(curated.patches.map((p) => [p.id, p]))

  // Warn (build/dev only) about curated patches that don't match any baseline
  // node — usually means a route was renamed and the overlay drifted.
  if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
    for (const p of curated.patches) {
      if (!baselineIds.has(p.id)) {
        console.warn(`[map] curated patch references unknown id "${p.id}"`)
      }
    }
  }

  const patched = baseline.map((n) => {
    const p = patchById.get(n.id)
    return p ? applyPatch(n, p) : n
  })

  // Fold in PAGE_FOLIOS for the pages that have one.
  for (const n of patched) {
    if (n.kind === 'page' && !n.folio && PAGE_FOLIO_BY_ID[n.id]) {
      n.folio = `№ ${PAGE_FOLIO_BY_ID[n.id]}`
    }
  }

  const nodes: MapNode[] = [...patched, ...curated.extras]

  return {
    nodes,
    edges: curated.edges,
    groups: curated.groups,
    journeys: curated.journeys,
  }
}

/** Pre-built default — most callers want this. */
export const MAP_DATA: MapData = buildMapData()
