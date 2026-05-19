/**
 * Types for the /carte + /en/map layered atlas.
 *
 * Two data shapes live here:
 *   1. The *skeleton* — exactly what scripts/build-map-skeleton.mjs emits
 *      into src/data/map-skeleton.json. Raw routes/endpoints/tables/bindings,
 *      no labels, no semantics.
 *   2. The *map* — what curated.ts merges into. Has display labels, groups,
 *      visibility flags, and the inter-node edges that turn a list of items
 *      into an actual graph.
 *
 * The merge happens in data.ts. filter.ts then prunes by visibility (visitor
 * vs admin). Layers (layout.ts) only ever read the post-filter MapData.
 */

import type { Lang } from '../../i18n'
import type { FeatureId } from '../features'

export type { Lang }

export type Visibility = 'public' | 'admin'

/** Which overlays a node/edge participates in. A node can live on multiple.
 *  `vision` is the entry layer — 5–6 hand-positioned bubbles summarizing the
 *  whole idea in ≤ 5 words each; pages/data/admin/journeys drill in from there. */
export type LayerId = 'vision' | 'pages' | 'data' | 'admin' | 'journeys'

export interface Bi {
  fr: string
  en: string
}

export type NodeKind =
  | 'page' // React route — visitor or admin surface
  | 'endpoint' // Pages Function under /api/*
  | 'table' // D1 table
  | 'binding' // wrangler.toml binding (D1/R2/var)
  | 'service' // External service (Stripe, Resend, Sentry, R2 bucket)
  | 'admin-tile' // Entry in AdminHub's grouped tile index

export interface MapNode {
  /** Stable id. Pattern: `page.<comp>`, `api.<path>`, `table.<name>`,
   *  `binding.<binding>`, `svc.<vendor>`, `tile.<slug>`. */
  id: string
  kind: NodeKind
  label: Bi
  desc?: Bi
  /** Group id (PageGroup or DataColumn). */
  group?: string
  visibility: Visibility
  /** When true (visitor view only), the node renders as a muted pill instead
   *  of a full card. Used for "Operator console — sign in" hints. */
  teaser?: boolean
  /** Magazine-style folio badge ("№ 02"). */
  folio?: string
  /** Tiny mono corner badge ("D1", "POST", "dyn", "live"). */
  badge?: string
  /** Active-language URL. Bi for in-app routes, plain string for external. */
  href?: Bi | string
  /** Forces target=_blank rel=noreferrer. Inferred true when href is a string
   *  starting with `http`. */
  hrefExternal?: boolean
  /** Layers this node appears on. Empty array hides it from the map entirely
   *  while keeping the id reachable for edges (rare). */
  layers: LayerId[]
  /** Cross-cutting feature accent (sage/cool/ochre/...). Stamped by data.ts
   *  from group membership — never set by hand on a node. Nodes whose group
   *  isn't a feat-* group (e.g. transparency, operator console) have none. */
  feature?: FeatureId
}

export interface MapEdge {
  id: string
  from: string
  to: string
  kind: 'reads' | 'writes' | 'navigates' | 'calls' | 'depends'
  label?: Bi
  visibility: Visibility
  layers: LayerId[]
}

export interface MapGroup {
  id: string
  label: Bi
  layer: LayerId
  visibility: Visibility
  /** Render order within the layer. Lower = first. */
  order: number
  /** Node ids in render order. Curated supplies this; nodes not listed here
   *  fall into a trailing "Other" bucket per layer. */
  nodeIds: string[]
  /** Cross-cutting feature accent — derived by data.ts from the group's id
   *  (matches `group.feat-{id}` against FEATURE_IDS). Groups outside the
   *  feature taxonomy (transparency, operator console) have none. */
  feature?: FeatureId
}

export interface MapJourney {
  id: string
  label: Bi
  visibility: Visibility
  /** Ordered list of node ids. The polyline is drawn through their centers
   *  in the Pages layer. */
  steps: { nodeId: string; note?: Bi }[]
}

/** A single Vision-layer bubble — represents one product feature.
 *
 *  Each bubble holds:
 *    - a short feature title (≤ 5 words per language)
 *    - up to 3–4 sub-items naming the concrete sub-features inside
 *    - a primary href that opens the most representative page for that feature
 *
 *  Sub-items are descriptive only (separated by middot in render); they don't
 *  individually navigate in v1. The whole bubble is one click target. */
export interface VisionBubble {
  id: string
  /** ≤ 5 words per language. Enforced by the map.test.ts word-count guard. */
  label: Bi
  /** Optional one-line elaboration shown on hover (SVG <title>). */
  desc?: Bi
  /** One short sentence describing what the user gets / can do — not a list
   *  of internal pages. Keep under ~85 characters so it wraps to ≤ 3 lines
   *  inside a md bubble. The "what's in it for me" promise. */
  sub?: Bi
  /** Visual emphasis (drives bubble radius). 'lg' for the headline idea. */
  size: 'sm' | 'md' | 'lg'
  /** Position in 0–100 percent of the canvas, so the same layout reads on any
   *  width. The exact values are picked by hand for an organic, napperon feel. */
  pos: { x: number; y: number }
  /** Sequence number (1..N) drawn as a small mark next to the bubble. */
  index: number
  /** Optional in-app navigation target. When set, the bubble becomes a real
   *  link (cursor pointer, role=link, Enter/Space activates). Use the FR
   *  path on the FR side, EN path on the EN side. Validated by the map test:
   *  every href must match a real route in the skeleton. */
  href?: Bi
  /** The feature this bubble represents — one bubble per FeatureId. Drives
   *  the bubble's accent color via --feat-{feature}-color / -soft tokens
   *  and ties the bubble to the matching Pages-layer group. */
  feature: FeatureId
}

export interface MapData {
  nodes: MapNode[]
  edges: MapEdge[]
  groups: MapGroup[]
  journeys: MapJourney[]
  vision: VisionBubble[]
}

// ─── Skeleton (what build-map-skeleton.mjs emits) ─────────────────────────────

export interface SkeletonRoute {
  path: string
  component: string
  lang: Lang
  dynamic: boolean
  inAdminShell: boolean
}
export interface SkeletonEndpoint {
  id: string
  path: string
  methods: string[]
  adminOnly: boolean
  file: string
}
export interface SkeletonTable {
  id: string
  name: string
  firstMigration: string
}
export interface SkeletonBinding {
  id: string
  kind: 'd1' | 'r2' | 'var'
  binding: string
  name?: string | null
}
export interface Skeleton {
  routes: SkeletonRoute[]
  endpoints: SkeletonEndpoint[]
  tables: SkeletonTable[]
  bindings: SkeletonBinding[]
}

// ─── Curated overlay ──────────────────────────────────────────────────────────

/** Override fields on a node derived from the skeleton (matched by id). */
export interface OverlayPatch {
  id: string
  label?: Bi
  desc?: Bi
  group?: string
  visibility?: Visibility
  teaser?: boolean
  folio?: string
  badge?: string
  layers?: LayerId[]
  hrefExternal?: boolean
}

/** A synthesized node (no skeleton equivalent — e.g. external services). */
export type OverlayNode = MapNode

export interface CuratedOverlay {
  patches: OverlayPatch[]
  extras: OverlayNode[]
  edges: MapEdge[]
  groups: MapGroup[]
  journeys: MapJourney[]
  vision: VisionBubble[]
}
