/**
 * Deterministic API + asset fixtures for the screenshot suite.
 *
 * `vite preview` serves the static SPA but no Pages Functions, so the
 * public read endpoints 404 and pages render their error/empty states.
 * These mocks fulfil those requests with fixed fixture data so the
 * baselines show representative content — and stay byte-stable, since
 * every timestamp and string here is constant.
 *
 * Only PUBLIC read endpoints are mocked. `/api/tenant` is deliberately
 * left unmocked: the portal's real, no-tenant default IS marc.portal, so
 * imposing a fake tenant would screenshot the wrong site.
 */

import type { Page } from '@playwright/test'

// Fixed 2025 epoch-seconds timestamps. Kept in the past year so the Hero's
// "shipped this year" counter (which compares against the current year)
// stays deterministically hidden instead of drifting each January.
const SEP_2025 = 1_757_462_400
const JUL_2025 = 1_752_192_000
const MAY_2025 = 1_747_008_000
const MAR_2025 = 1_740_787_200

const PROJECTS = {
  projects: [
    {
      id: 'demo-cafe',
      showcasedAt: SEP_2025,
      title: 'Réservations Café Brûlé',
      tagline: 'Prise de rendez-vous en ligne pour un café de quartier — fini le téléphone.',
      status: 'shipped',
      tier: 2,
      currentBuild: {
        label: 'v3 — créneaux + rappels',
        body: 'Réservation en deux étapes, rappel courriel la veille.',
        buildUrl: null,
        iframePath: null,
        date: SEP_2025,
      },
    },
    {
      id: 'demo-atelier',
      showcasedAt: JUL_2025,
      title: 'Inventaire Atelier Nord',
      tagline: 'Suivi de stock pour un atelier d’ébénisterie à deux personnes.',
      status: 'shipped',
      tier: 1,
      currentBuild: {
        label: 'v2 — lecture code-barres',
        body: 'Scan au téléphone, écarts visibles en temps réel.',
        buildUrl: null,
        iframePath: null,
        date: JUL_2025,
      },
    },
    {
      id: 'demo-benevoles',
      showcasedAt: MAY_2025,
      title: 'Portail bénévoles Maison Verte',
      tagline: 'Inscription aux quarts de bénévolat pour un organisme communautaire.',
      status: 'active',
      tier: 3,
      currentBuild: null,
    },
    {
      id: 'demo-toiture',
      showcasedAt: MAR_2025,
      title: 'Devis express Toiture Pro',
      tagline: 'Estimation de toiture à partir de quelques photos.',
      status: 'shipped',
      tier: 0,
      currentBuild: {
        label: 'v1 — formulaire photo',
        body: 'Le client envoie des photos, reçoit une fourchette de prix.',
        buildUrl: null,
        iframePath: null,
        date: MAR_2025,
      },
    },
  ],
}

const VOUCHES = {
  vouches: [
    {
      id: 'demo-vouch-1',
      author_name: 'Sophie Tremblay',
      author_relationship: 'client',
      body: 'Marc a compris mon besoin en une conversation. La démo à chaque étape m’a évité les mauvaises surprises — j’ai toujours su où on s’en allait.',
      link_url: null,
      session_id: null,
      created_at: SEP_2025,
    },
    {
      id: 'demo-vouch-2',
      author_name: 'Marc-André Côté',
      author_relationship: 'colleague',
      body: 'Travailler en async avec lui est reposant : tout est écrit, rien ne se perd. Le fil par projet garde le contexte au même endroit.',
      link_url: null,
      session_id: null,
      created_at: JUL_2025,
    },
    {
      id: 'demo-vouch-3',
      author_name: 'Julie Bouchard',
      author_relationship: 'client',
      body: 'Prix annoncé, prix payé. J’avais déjà été échaudée par une agence — ici le forfait était clair avant de commencer et on s’y est tenus.',
      link_url: null,
      session_id: null,
      created_at: MAY_2025,
    },
  ],
}

const CAPACITY = {
  active: 1,
  triage: 0,
  cap: 1,
  activeCap: 1,
  triageCap: 2,
  atCap: false,
}

// 1200×630 placeholder for the per-project OG thumbnail (/og/share/:id).
// A soft card so project previews read as intentional, not broken images.
const OG_PLACEHOLDER =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">' +
  '<rect width="1200" height="630" fill="#ece6d9"/>' +
  '<rect x="48" y="48" width="1104" height="534" fill="none" stroke="#cabfa6" stroke-width="3"/>' +
  '</svg>'

/**
 * Install the public-endpoint mocks on a page. Must be called before
 * `page.goto` so the first fetch is intercepted.
 */
export async function installApiMocks(page: Page): Promise<void> {
  // Pre-dismiss the EnglishNudge banner on the FR home. EnglishNudge renders
  // whenever `navigator.language` starts with "en" and the dismissal flag is
  // unset — Playwright's Chromium ships en-US by default, so the banner
  // flickers on/off depending on whether React mounts before the screenshot
  // settles. That race makes the FR home's full-page height non-deterministic
  // (the banner is ~139px tall), and `maxDiffPixelRatio` cannot rescue a
  // dimension mismatch. Forcing the dismissed flag fixes the screenshot
  // baseline at "no banner" — the nudge's own behaviour is exercised
  // separately in unit tests, so muting it here has no coverage cost.
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('mp_en_nudge_dismissed', '1')
    } catch {
      // Private-browsing storage block — the nudge degrades to its
      // not-dismissed branch, which is also a valid screenshot state.
      // The fallback path on a real visitor's machine is identical.
    }
  })
  await page.route('**/api/public/projects', (route) => route.fulfill({ json: PROJECTS }))
  await page.route('**/api/public/vouches**', (route) => route.fulfill({ json: VOUCHES }))
  await page.route('**/api/capacity', (route) => route.fulfill({ json: CAPACITY }))
  await page.route('**/og/share/**', (route) =>
    route.fulfill({ contentType: 'image/svg+xml', body: OG_PLACEHOLDER }),
  )
}
