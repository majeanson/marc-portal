/**
 * Visitor / admin visibility filter.
 *
 * The atlas ships the full MapData to every client (the structural names
 * aren't secrets — see the security note in the plan). Filtering happens
 * in the browser before render: admin-only nodes/edges/groups/journeys are
 * dropped when the viewer isn't admin.
 *
 * Nodes flagged `teaser: true` would survive the filter as muted pills,
 * but the current curated overlay doesn't use that yet — kept here so
 * future "Operator console — sign in" hints have a hook.
 */

import type { MapData } from './types'

export function filterForViewer(data: MapData, isAdmin: boolean): MapData {
  if (isAdmin) return data

  const keep = (vis: 'public' | 'admin') => vis === 'public'

  const nodes = data.nodes.filter((n) => keep(n.visibility))
  const nodeIds = new Set(nodes.map((n) => n.id))

  // Drop edges whose either endpoint vanished. (An admin-only node referenced
  // by a public edge means the curated data is inconsistent — silent drop is
  // the safest behavior for now; a later vitest can flag these.)
  const edges = data.edges
    .filter((e) => keep(e.visibility))
    .filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to))

  const groups = data.groups
    .filter((g) => keep(g.visibility))
    .map((g) => ({ ...g, nodeIds: g.nodeIds.filter((id) => nodeIds.has(id)) }))

  const journeys = data.journeys
    .filter((j) => keep(j.visibility))
    .filter((j) => j.steps.every((s) => nodeIds.has(s.nodeId)))

  // Vision bubbles are all public by design — pass through. If we ever ship
  // an admin-only vision bubble, gate it the same way as nodes.
  return { nodes, edges, groups, journeys, vision: data.vision }
}
