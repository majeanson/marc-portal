/**
 * Guard tests for the /carte atlas.
 *
 * 1. Skeleton integrity — minimum counts + load-bearing ids are present.
 *    Catches accidental route renames or migration deletions in PR diffs.
 *
 * 2. Curated overlay coherence — every patch matches a baseline node,
 *    every group/journey references real ids, every edge connects real
 *    nodes. Curated drift here would silently log a warning in dev but
 *    is a hard fail in CI.
 *
 * 3. Filter sanity — visitor view drops every admin-only node and the
 *    remaining edges/groups/journeys still reference live ids only.
 */

import { describe, expect, it } from 'vitest'
import skeleton from '../../data/map-skeleton.json'
import { buildMapData } from './data'
import { filterForViewer } from './filter'
import { CURATED } from './curated'
import {
  FEATURE_IDS,
  FEATURE_PRIMARY_PAGE,
  HOME_SECTION_ORDER,
  META_PAGE_LINK,
  PAGE_FEATURE,
  PRODUCT_FEATURE_IDS,
  isFeatureId,
} from '../features'

describe('map skeleton', () => {
  it('has at least the load-bearing route components', () => {
    const components = new Set(skeleton.routes.map((r) => r.component))
    for (const c of [
      'RootByTemplate',
      'Intake',
      'Login',
      'MagicLinkSent',
      'MePortal',
      'SessionPage',
      'AdminHub',
      'AdminInbox',
      'AdminRunbook',
      'MapPage',
    ]) {
      expect(components, `route component ${c} missing — was it renamed?`).toContain(c)
    }
  })

  it('has at least the load-bearing endpoints', () => {
    const ids = new Set(skeleton.endpoints.map((e) => e.id))
    for (const id of [
      'api.auth.request-link',
      'api.auth.verify',
      'api.sessions.index',
      'api.payments.webhook',
      'api.me',
    ]) {
      expect(ids, `endpoint ${id} missing`).toContain(id)
    }
  })

  it('has at least the load-bearing D1 tables', () => {
    const ids = new Set(skeleton.tables.map((t) => t.id))
    for (const id of [
      'table.sessions',
      'table.messages',
      'table.magic_link_tokens',
      'table.payments',
    ]) {
      expect(ids, `table ${id} missing`).toContain(id)
    }
  })

  it('records the DB + STRIPE_CUSTODIAN_PRICE_ID bindings', () => {
    const ids = new Set(skeleton.bindings.map((b) => b.id))
    expect(ids).toContain('binding.DB')
    expect(ids).toContain('binding.STRIPE_CUSTODIAN_PRICE_ID')
  })

  it('only flags /api/admin/* endpoints as adminOnly', () => {
    // Anything else marked admin-only is a regression of the URL-prefix
    // heuristic that replaced the brittle isAdmin() content scan.
    for (const e of skeleton.endpoints) {
      if (e.adminOnly) {
        expect(
          e.path.startsWith('/api/admin/'),
          `endpoint ${e.id} marked adminOnly but path is ${e.path}`,
        ).toBe(true)
      }
    }
  })

  it('has a minimum scale (won’t catch a single rename but blocks a half-empty skeleton)', () => {
    expect(skeleton.routes.length).toBeGreaterThanOrEqual(60)
    expect(skeleton.endpoints.length).toBeGreaterThanOrEqual(25)
    expect(skeleton.tables.length).toBeGreaterThanOrEqual(15)
  })
})

describe('curated overlay coherence', () => {
  const data = buildMapData()
  const nodeIds = new Set(data.nodes.map((n) => n.id))

  it('every patch matches a real baseline node', () => {
    for (const p of CURATED.patches) {
      expect(nodeIds, `curated patch ${p.id} doesn’t match any skeleton-derived node`).toContain(
        p.id,
      )
    }
  })

  it('every group references real node ids', () => {
    for (const g of CURATED.groups) {
      for (const id of g.nodeIds) {
        expect(nodeIds, `group ${g.id} references missing node ${id}`).toContain(id)
      }
    }
  })

  it('every edge connects real nodes', () => {
    for (const e of CURATED.edges) {
      expect(nodeIds, `edge ${e.id} from-id ${e.from} not found`).toContain(e.from)
      expect(nodeIds, `edge ${e.id} to-id ${e.to} not found`).toContain(e.to)
    }
  })

  it('every journey step references a real node', () => {
    for (const j of CURATED.journeys) {
      for (const s of j.steps) {
        expect(nodeIds, `journey ${j.id} step ${s.nodeId} not found`).toContain(s.nodeId)
      }
    }
  })

  it('ships at least one journey', () => {
    expect(data.journeys.length).toBeGreaterThanOrEqual(1)
  })

  it('ships a Vision layer with 4–8 bubbles, ≤5 words each', () => {
    expect(data.vision.length).toBeGreaterThanOrEqual(4)
    expect(data.vision.length).toBeLessThanOrEqual(8)
    for (const b of data.vision) {
      for (const lang of ['fr', 'en'] as const) {
        const words = b.label[lang].split(/\s+/).filter(Boolean)
        expect(
          words.length,
          `vision bubble ${b.id} [${lang}] is ${words.length} words`,
        ).toBeLessThanOrEqual(5)
      }
    }
  })

  it('Vision bubble indexes form a 1..N sequence', () => {
    const indexes = data.vision.map((b) => b.index).sort((a, b) => a - b)
    for (let i = 0; i < indexes.length; i++) {
      expect(indexes[i]).toBe(i + 1)
    }
  })

  it('every Vision bubble carries a valid FeatureId', () => {
    for (const b of data.vision) {
      expect(
        isFeatureId(b.feature),
        `vision ${b.id} feature ${b.feature} is not a real FeatureId`,
      ).toBe(true)
    }
  })

  it('Vision bubbles cover every PRODUCT feature exactly once', () => {
    // Vision = the product pitch — one bubble per PRODUCT feature. `meta`
    // (the backstage layer) deliberately has no bubble.
    const features = new Set(data.vision.map((b) => b.feature))
    expect(features.size).toBe(PRODUCT_FEATURE_IDS.length)
    for (const fid of PRODUCT_FEATURE_IDS) {
      expect(features, `product feature ${fid} has no Vision bubble`).toContain(fid)
    }
    expect(features, 'meta should not have a Vision bubble').not.toContain('meta')
  })

  it('every group.feat-{FeatureId} group inherits the matching FeatureId', () => {
    for (const g of data.groups) {
      if (g.layer !== 'pages') continue
      const m = /^group\.feat-(\w+)$/.exec(g.id)
      // group.feat-{realFeatureId} should match its FeatureId; group.feat-operator
      // (admin console — not a feature) and group.transparency stay unfeatured.
      if (m && isFeatureId(m[1])) {
        expect(g.feature, `${g.id} should have feature ${m[1]}`).toBe(m[1])
      } else {
        expect(g.feature, `${g.id} should not carry a feature accent`).toBeUndefined()
      }
    }
  })

  it('page nodes inherit feature from their group via data.ts merge', () => {
    const groupsByFeature = new Map<string, Set<string>>()
    for (const g of data.groups) {
      if (!g.feature) continue
      groupsByFeature.set(g.feature, new Set(g.nodeIds))
    }
    for (const n of data.nodes) {
      if (n.kind !== 'page') continue
      // Find which featured group (if any) this node belongs to.
      let expected: string | undefined
      for (const [fid, ids] of groupsByFeature) {
        if (ids.has(n.id)) {
          expected = fid
          break
        }
      }
      expect(n.feature, `${n.id} should have feature ${expected ?? '(none)'}`).toBe(expected)
    }
  })

  it('every PAGE_FEATURE entry resolves to a real page node', () => {
    const pageIds = new Set(data.nodes.filter((n) => n.kind === 'page').map((n) => n.id))
    for (const [pageId] of Object.entries(PAGE_FEATURE)) {
      expect(pageIds, `PAGE_FEATURE has ${pageId} but no such page node exists`).toContain(pageId)
    }
  })

  it('every FEATURE_PRIMARY_PAGE route resolves to a real route', () => {
    // The continue-nudge lands here; a stale route would 404 the visitor.
    // FEATURE_PRIMARY_PAGE is keyed by the six product features only.
    // A stop may be a home-section anchor ('/en/#how') for a feature with
    // no dedicated page — split off the '#section' and validate each part:
    // the base must be a real route, the anchor a real home section.
    const frPaths = new Set(skeleton.routes.filter((r) => r.lang === 'fr').map((r) => r.path))
    const enPaths = new Set(skeleton.routes.filter((r) => r.lang === 'en').map((r) => r.path))
    const sections = new Set<string>(HOME_SECTION_ORDER)
    const check = (full: string, routes: Set<string>, fid: string) => {
      const hashIdx = full.indexOf('#')
      const hash = hashIdx === -1 ? undefined : full.slice(hashIdx + 1)
      let base = hashIdx === -1 ? full : full.slice(0, hashIdx)
      // '/en/#how' → base '/en/'; normalise the trailing slash (keep root '/').
      if (base.length > 1 && base.endsWith('/')) base = base.slice(0, -1)
      expect(routes, `${fid} primary page ${full} → base ${base} is not a known route`).toContain(
        base,
      )
      if (hash !== undefined) {
        expect(
          sections,
          `${fid} primary page ${full} → anchor #${hash} is not a home section`,
        ).toContain(hash)
      }
    }
    for (const fid of PRODUCT_FEATURE_IDS) {
      const page = FEATURE_PRIMARY_PAGE[fid]
      check(page.fr, frPaths, fid)
      check(page.en, enPaths, fid)
    }
  })

  it('every META_PAGE_LINK route resolves to a real route', () => {
    // The backstage continue-pointer lands here; a stale route would 404.
    const frPaths = new Set(skeleton.routes.filter((r) => r.lang === 'fr').map((r) => r.path))
    const enPaths = new Set(skeleton.routes.filter((r) => r.lang === 'en').map((r) => r.path))
    for (const [id, link] of Object.entries(META_PAGE_LINK)) {
      expect(frPaths, `${id} → ${link.path.fr} is not a known route`).toContain(link.path.fr)
      expect(enPaths, `${id} → ${link.path.en} is not a known route`).toContain(link.path.en)
    }
  })

  it('every feature has at least one page so the FeatureIndex is never empty', () => {
    // Clicking a Vision bubble opens its feature in the FeatureIndex panel.
    // A feature with zero pages would render an empty panel — a dead end.
    for (const fid of FEATURE_IDS) {
      const pages = data.nodes.filter((n) => n.kind === 'page' && n.feature === fid)
      expect(
        pages.length,
        `feature ${fid} has no page — FeatureIndex would be empty`,
      ).toBeGreaterThanOrEqual(1)
    }
  })
})

describe('visitor filter', () => {
  const data = buildMapData()
  const visitor = filterForViewer(data, false)

  it('hides every admin-only node', () => {
    for (const n of visitor.nodes) {
      expect(n.visibility).toBe('public')
    }
  })

  it('leaves every remaining edge pointing at live nodes', () => {
    const ids = new Set(visitor.nodes.map((n) => n.id))
    for (const e of visitor.edges) {
      expect(ids.has(e.from) && ids.has(e.to), `dangling edge ${e.id}`).toBe(true)
    }
  })

  it('keeps the visitor journey usable end-to-end', () => {
    const ids = new Set(visitor.nodes.map((n) => n.id))
    expect(visitor.journeys.length).toBeGreaterThanOrEqual(1)
    for (const j of visitor.journeys) {
      for (const s of j.steps) {
        expect(ids, `journey ${j.id} step ${s.nodeId} dangling`).toContain(s.nodeId)
      }
    }
  })

  it('still shows the external service teasers', () => {
    const ids = new Set(visitor.nodes.map((n) => n.id))
    for (const id of ['svc.stripe', 'svc.resend', 'svc.sentry', 'svc.cloudflare']) {
      expect(ids, `service teaser ${id} missing in visitor view`).toContain(id)
    }
  })
})
