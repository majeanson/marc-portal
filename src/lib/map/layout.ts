/**
 * Layout — pure functions that turn MapData + a layer choice into
 * absolute (x,y,w,h) positions for nodes/groups and SVG `d` strings for
 * edges. No DOM, no React, no side effects: easy to snapshot-test.
 *
 * Two layers handled here:
 *   - Pages  — grouped grid stacked vertically. Three columns per group.
 *   - Data   — four labelled columns (Pages | Endpoints | Tables | Services)
 *              with Bézier edges between columns.
 *
 * The Admin layer reuses buildAdminSections() and is rendered with CSS
 * grid in AdminLayer.tsx — no SVG layout needed.
 *
 * Journeys layer reuses the Pages layout's node positions and draws a
 * polyline through them (see layoutJourney).
 */

import type { MapData, MapEdge, MapGroup, MapJourney, MapNode } from './types'

export interface PositionedNode {
  node: MapNode
  x: number
  y: number
  width: number
  height: number
}

export interface PositionedGroup {
  group: MapGroup
  x: number
  y: number
  width: number
  height: number
}

export interface PositionedEdge {
  edge: MapEdge
  d: string
  /** Midpoint of the path for placing label/arrow centerpoint marks. */
  midX: number
  midY: number
}

export interface LayerLayout {
  nodes: PositionedNode[]
  groups: PositionedGroup[]
  edges: PositionedEdge[]
  viewBox: { width: number; height: number }
}

// Tuning. Desktop-first; CSS scales the <svg> to fit narrower viewports.
// Bumped node + group dimensions in the 2026-05 polish pass — the previous
// 220×88 cards rendered as walls of cramped text on the live page.
const PAGES = {
  NODE_W: 260,
  NODE_H: 116,
  COLS: 3,
  COL_GAP: 20,
  ROW_GAP: 16,
  GROUP_HEADER_H: 48,
  GROUP_PAD_X: 20,
  GROUP_PAD_Y: 20,
  GROUP_GAP_Y: 36,
  PADDING: 32,
} as const

const DATA = {
  NODE_W: 240,
  NODE_H: 64,
  ROW_GAP: 14,
  COL_W: 260,
  COL_GAP: 96,
  COL_HEADER_H: 48,
  PADDING: 32,
} as const

function visibleNodesFor(group: MapGroup, nodeById: Map<string, MapNode>): MapNode[] {
  return group.nodeIds.map((id) => nodeById.get(id)).filter((n): n is MapNode => !!n)
}

export function layoutPages(data: MapData): LayerLayout {
  const groups = data.groups
    .filter((g) => g.layer === 'pages')
    .slice()
    .sort((a, b) => a.order - b.order)
  const nodeById = new Map(data.nodes.map((n) => [n.id, n]))

  const innerW = PAGES.COLS * PAGES.NODE_W + (PAGES.COLS - 1) * PAGES.COL_GAP
  const groupW = innerW + 2 * PAGES.GROUP_PAD_X
  const viewW = groupW + 2 * PAGES.PADDING

  const positionedNodes: PositionedNode[] = []
  const positionedGroups: PositionedGroup[] = []
  let cursorY = PAGES.PADDING

  for (const g of groups) {
    const nodes = visibleNodesFor(g, nodeById)
    if (nodes.length === 0) continue

    const rows = Math.ceil(nodes.length / PAGES.COLS)
    const contentH = rows * PAGES.NODE_H + (rows - 1) * PAGES.ROW_GAP
    const groupH = PAGES.GROUP_HEADER_H + contentH + 2 * PAGES.GROUP_PAD_Y

    positionedGroups.push({
      group: g,
      x: PAGES.PADDING,
      y: cursorY,
      width: groupW,
      height: groupH,
    })

    const contentX0 = PAGES.PADDING + PAGES.GROUP_PAD_X
    const contentY0 = cursorY + PAGES.GROUP_HEADER_H + PAGES.GROUP_PAD_Y

    for (let i = 0; i < nodes.length; i++) {
      const col = i % PAGES.COLS
      const row = Math.floor(i / PAGES.COLS)
      positionedNodes.push({
        node: nodes[i],
        x: contentX0 + col * (PAGES.NODE_W + PAGES.COL_GAP),
        y: contentY0 + row * (PAGES.NODE_H + PAGES.ROW_GAP),
        width: PAGES.NODE_W,
        height: PAGES.NODE_H,
      })
    }

    cursorY += groupH + PAGES.GROUP_GAP_Y
  }

  const viewH = Math.max(PAGES.PADDING * 2, cursorY - PAGES.GROUP_GAP_Y + PAGES.PADDING)

  const nodePosById = new Map(positionedNodes.map((p) => [p.node.id, p]))
  const edges = data.edges
    .filter((e) => e.layers.includes('pages'))
    .filter((e) => nodePosById.has(e.from) && nodePosById.has(e.to))
    .map((e) => arcEdge(e, nodePosById.get(e.from)!, nodePosById.get(e.to)!))

  return {
    nodes: positionedNodes,
    groups: positionedGroups,
    edges,
    viewBox: { width: viewW, height: viewH },
  }
}

export function layoutData(data: MapData): LayerLayout {
  const cols = data.groups
    .filter((g) => g.layer === 'data')
    .slice()
    .sort((a, b) => a.order - b.order)
  const nodeById = new Map(data.nodes.map((n) => [n.id, n]))

  const positionedNodes: PositionedNode[] = []
  const positionedGroups: PositionedGroup[] = []
  let maxRows = 0

  for (let ci = 0; ci < cols.length; ci++) {
    const g = cols[ci]
    const nodes = visibleNodesFor(g, nodeById)
    if (nodes.length > maxRows) maxRows = nodes.length

    const colX = DATA.PADDING + ci * (DATA.COL_W + DATA.COL_GAP)
    const colY = DATA.PADDING
    const contentH = nodes.length * DATA.NODE_H + Math.max(0, nodes.length - 1) * DATA.ROW_GAP
    const colH = DATA.COL_HEADER_H + contentH

    positionedGroups.push({ group: g, x: colX, y: colY, width: DATA.COL_W, height: colH })

    const nodeX = colX + (DATA.COL_W - DATA.NODE_W) / 2
    for (let i = 0; i < nodes.length; i++) {
      positionedNodes.push({
        node: nodes[i],
        x: nodeX,
        y: colY + DATA.COL_HEADER_H + i * (DATA.NODE_H + DATA.ROW_GAP),
        width: DATA.NODE_W,
        height: DATA.NODE_H,
      })
    }
  }

  const nodePosById = new Map(positionedNodes.map((p) => [p.node.id, p]))
  const edges = data.edges
    .filter((e) => e.layers.includes('data'))
    .filter((e) => nodePosById.has(e.from) && nodePosById.has(e.to))
    .map((e) => columnEdge(e, nodePosById.get(e.from)!, nodePosById.get(e.to)!))

  const viewW =
    DATA.PADDING * 2 + cols.length * DATA.COL_W + Math.max(0, cols.length - 1) * DATA.COL_GAP
  const viewH =
    DATA.PADDING * 2 +
    DATA.COL_HEADER_H +
    maxRows * DATA.NODE_H +
    Math.max(0, maxRows - 1) * DATA.ROW_GAP

  return {
    nodes: positionedNodes,
    groups: positionedGroups,
    edges,
    viewBox: { width: viewW, height: viewH },
  }
}

/** Build the polyline for one journey overlaid on the Pages layer. */
export interface JourneyOverlay {
  journey: MapJourney
  d: string
  steps: {
    nodeId: string
    x: number
    y: number
    index: number
    note?: { fr: string; en: string }
  }[]
}

export function layoutJourney(pages: LayerLayout, journey: MapJourney): JourneyOverlay {
  const nodePosById = new Map(pages.nodes.map((n) => [n.node.id, n]))
  const points: { x: number; y: number }[] = []
  const steps: JourneyOverlay['steps'] = []

  journey.steps.forEach((step, i) => {
    const p = nodePosById.get(step.nodeId)
    if (!p) return
    const cx = p.x + p.width / 2
    const cy = p.y + p.height / 2
    points.push({ x: cx, y: cy })
    steps.push({ nodeId: step.nodeId, x: cx, y: cy, index: i + 1, note: step.note })
  })

  const d =
    points.length === 0
      ? ''
      : `M ${points[0].x} ${points[0].y}` +
        points
          .slice(1)
          .map((p) => ` L ${p.x} ${p.y}`)
          .join('')

  return { journey, d, steps }
}

// ─── Edge geometry helpers ────────────────────────────────────────────────────

function arcEdge(edge: MapEdge, a: PositionedNode, b: PositionedNode): PositionedEdge {
  const ax = a.x + a.width / 2
  const ay = a.y + a.height / 2
  const bx = b.x + b.width / 2
  const by = b.y + b.height / 2
  // Quadratic curve through a midpoint nudged perpendicular to the segment so
  // long edges don't pass over labels.
  const mx = (ax + bx) / 2
  const my = (ay + by) / 2
  const dx = bx - ax
  const dy = by - ay
  const len = Math.hypot(dx, dy) || 1
  // Perpendicular offset proportional to length (capped). Positive offset
  // arcs above-right for left-to-right edges; visually pleasant default.
  const offset = Math.min(40, len * 0.18)
  const px = -dy / len
  const py = dx / len
  const cx = mx + px * offset
  const cy = my + py * offset
  return {
    edge,
    d: `M ${ax} ${ay} Q ${cx} ${cy} ${bx} ${by}`,
    midX: cx,
    midY: cy,
  }
}

function columnEdge(edge: MapEdge, a: PositionedNode, b: PositionedNode): PositionedEdge {
  // Right edge of `a` → left edge of `b` with horizontal Bézier handles.
  const ax = a.x + a.width
  const ay = a.y + a.height / 2
  const bx = b.x
  const by = b.y + b.height / 2
  const handle = Math.max(40, (bx - ax) * 0.45)
  return {
    edge,
    d: `M ${ax} ${ay} C ${ax + handle} ${ay}, ${bx - handle} ${by}, ${bx} ${by}`,
    midX: (ax + bx) / 2,
    midY: (ay + by) / 2,
  }
}
