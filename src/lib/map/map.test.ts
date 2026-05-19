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
