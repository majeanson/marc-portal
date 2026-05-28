/**
 * Full-tour E2E — walks the whole public site the way a curious visitor
 * would, in a real browser, in BOTH languages, and asserts that every move
 * lands on a genuine page (never a 404 / error boundary).
 *
 * What this covers that the other specs don't:
 *  - smoke.spec.ts checks a few load-bearing wayfinding moves;
 *  - a11y / screenshot specs visit every route but never CLICK anything.
 * This spec is the click coverage: every navigation affordance the chrome
 * offers is exercised and its destination verified.
 *
 * The five things checked, end to end:
 *  1. Every public route (FR + EN) renders a real page.
 *  2. Header chrome — brand link, the five section links + their feature
 *     dots, the sign-in link, and the FR↔EN switch.
 *  3. Footer chrome — every legal/meta page link, their feature dots, and
 *     the hand-drawn FR↔EN arrow.
 *  4. Page outro — the "continue the tour" pointer and the "back to home"
 *     exit at the bottom of every content page, plus the two tour loops
 *     walked stop-by-stop until they close.
 *  5. Page mast — the folio (title-corner) link and the feature-cue dot.
 *  6. Hero bilingual line — the inline FR↔EN language link in the hero.
 *
 * "A real page is there" = the page mounts an <h1>, sets a non-empty
 * <title>, and renders NO `.error-panel` (the shared marker of both
 * NotFound and the RouteError boundary — see src/pages/NotFound.tsx).
 *
 * API mocks (mocks.ts) are installed so API-fed pages (projects, vouches,
 * home's featured strip) render populated content rather than empty states.
 */

import { expect, test, type Page } from '@playwright/test'
import { installApiMocks } from './mocks'
import { PUBLIC_ROUTES } from './routes'

/* ─── helpers ──────────────────────────────────────────────────────────── */

type Lang = 'fr' | 'en'

/**
 * Assert the current page is a genuine, fully-rendered page — not the 404
 * page and not the error boundary.
 */
async function expectRealPage(page: Page): Promise<void> {
  // NotFound and RouteError both render <section class="error-panel">.
  // A genuine page never does — this is the load-bearing "real page" gate.
  await expect(page.locator('.error-panel')).toHaveCount(0)
  // Every public page renders at least one heading once it has mounted —
  // an <h1> on most pages, an <h2> step title on the intake form. The
  // route-fallback skeleton has none, so this also catches a hung lazy
  // chunk rendering the empty <RouteFallback>.
  await expect(page.getByRole('heading').first()).toBeVisible()
  // Each page's mount effect sets a non-empty document.title.
  await expect(page).toHaveTitle(/\S/)
}

/** Does `url` point at `expected` (a path, optionally with a #hash)? */
function isPath(url: URL, expected: string): boolean {
  const want = new URL(expected, url.origin)
  const norm = (p: string) => p.replace(/\/+$/, '') || '/'
  return norm(url.pathname) === norm(want.pathname) && url.hash === want.hash
}

/** Wait for an SPA / full navigation to settle on `expected`. */
async function waitForPath(page: Page, expected: string): Promise<void> {
  await page.waitForURL((url) => isPath(url, expected))
}

/** The site-map route for a language — the slug differs by language. */
function mapPath(lang: Lang): string {
  return lang === 'fr' ? '/carte' : '/en/map'
}

/* ─── route-derived data ───────────────────────────────────────────────── */

/**
 * Pages that render a <FeatureContinue> outro, with where its two links go.
 * Mirrors FEATURE_NEXT + FEATURE_PRIMARY_PAGE + FEATURE_HOME_SECTION +
 * META_PAGE_NEXT in src/lib/features.ts — kept inline (like smoke.spec's
 * FUNNEL) so the E2E suite stays decoupled from app internals.
 *
 * `continueTo` is where "continue the tour" lands; `homeHref` is the exact
 * href the "back to home" exit link must carry.
 */
interface TourStop {
  name: string
  path: Record<Lang, string>
  continueTo: Record<Lang, string>
  homeHref: Record<Lang, string>
}

const TOUR_STOPS: TourStop[] = [
  // ── product arc: bring a project → talk → builds → price → keys → proof ──
  {
    name: 'tier-0',
    path: { fr: '/tier-0', en: '/en/tier-0' },
    continueTo: { fr: '/handoff', en: '/en/handoff' },
    homeHref: { fr: '/#pricing', en: '/en/#pricing' },
  },
  {
    name: 'handoff',
    path: { fr: '/handoff', en: '/en/handoff' },
    continueTo: { fr: '/vouches', en: '/en/vouches' },
    homeHref: { fr: '/#how', en: '/en/#how' },
  },
  {
    name: 'handoff-checklist',
    path: { fr: '/handoff/checklist', en: '/en/handoff/checklist' },
    continueTo: { fr: '/vouches', en: '/en/vouches' },
    homeHref: { fr: '/#how', en: '/en/#how' },
  },
  {
    name: 'journey',
    path: { fr: '/parcours', en: '/en/journey' },
    // conversation has no public page — the tour points at the #how anchor.
    continueTo: { fr: '/#how', en: '/en/#how' },
    homeHref: { fr: '/#vibe', en: '/en/#vibe' },
  },
  {
    name: 'projects',
    path: { fr: '/projects', en: '/en/projects' },
    continueTo: { fr: '/intake', en: '/en/intake' },
    homeHref: { fr: '/#featured', en: '/en/#featured' },
  },
  {
    name: 'vouches',
    path: { fr: '/vouches', en: '/en/vouches' },
    continueTo: { fr: '/intake', en: '/en/intake' },
    homeHref: { fr: '/#featured', en: '/en/#featured' },
  },
  // ── meta loop: map → under the hood → workshop → privacy → PIA → map ──
  {
    name: 'map',
    path: { fr: '/carte', en: '/en/map' },
    continueTo: { fr: '/meta', en: '/en/meta' },
    homeHref: { fr: '/#how', en: '/en/#how' },
  },
  {
    name: 'meta',
    path: { fr: '/meta', en: '/en/meta' },
    continueTo: { fr: '/atelier', en: '/en/atelier' },
    homeHref: { fr: '/#how', en: '/en/#how' },
  },
  {
    name: 'atelier',
    path: { fr: '/atelier', en: '/en/atelier' },
    continueTo: { fr: '/confidentialite', en: '/en/privacy' },
    homeHref: { fr: '/#how', en: '/en/#how' },
  },
  {
    name: 'privacy',
    path: { fr: '/confidentialite', en: '/en/privacy' },
    continueTo: { fr: '/pia', en: '/en/pia' },
    homeHref: { fr: '/#how', en: '/en/#how' },
  },
  {
    name: 'pia',
    path: { fr: '/pia', en: '/en/pia' },
    continueTo: { fr: '/carte', en: '/en/map' },
    homeHref: { fr: '/#how', en: '/en/#how' },
  },
]

/** Header marketing-nav links — mirrors NAV_LINKS in src/components/Header.tsx.
 *  `section` is the home anchor; `feature` is the colour its dot links to. */
const HEADER_NAV = [
  { section: 'featured', feature: 'shipped' },
  { section: 'how', feature: 'meta' },
  { section: 'vibe', feature: 'intake' },
  { section: 'pricing', feature: 'pricing' },
  { section: 'about', feature: 'meta' },
] as const

/** FR↔EN route pairs whose lang switch must keep the visitor on the same
 *  page. Includes the three slugs that differ across languages
 *  (parcours/journey, confidentialite/privacy, carte/map). */
const LANG_PAIRS: Record<Lang, string>[] = [
  { fr: '/', en: '/en' },
  { fr: '/handoff', en: '/en/handoff' },
  { fr: '/tier-0', en: '/en/tier-0' },
  { fr: '/projects', en: '/en/projects' },
  { fr: '/parcours', en: '/en/journey' },
  { fr: '/confidentialite', en: '/en/privacy' },
  { fr: '/carte', en: '/en/map' },
]

/** Content pages whose <PageMast> is passed a `feature` — so its folio AND
 *  feature-cue dot render as links to the site map. Mirrors the PageMast
 *  call sites in src/pages/. */
const PAGEMAST_PAGES: Record<Lang, string>[] = [
  { fr: '/tier-0', en: '/en/tier-0' },
  { fr: '/handoff', en: '/en/handoff' },
  { fr: '/parcours', en: '/en/journey' },
  { fr: '/projects', en: '/en/projects' },
  { fr: '/vouches', en: '/en/vouches' },
  { fr: '/meta', en: '/en/meta' },
  { fr: '/atelier', en: '/en/atelier' },
]

/* ─── shared setup ─────────────────────────────────────────────────────── */

test.beforeEach(async ({ page }) => {
  await installApiMocks(page)
})

/* ─── 1. every public route renders a real page ────────────────────────── */

test.describe('full tour — every public route renders a real page', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route.name} (${route.lang})`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: 'networkidle' })
      await expectRealPage(page)
      // The route's language is also proven by the URL prefix: EN routes
      // live under /en, FR routes never do.
      const onEn = route.path === '/en' || route.path.startsWith('/en/')
      expect(onEn).toBe(route.lang === 'en')
    })
  }
})

/* ─── 2. header chrome ─────────────────────────────────────────────────── */

test.describe('full tour — header chrome', () => {
  for (const lang of ['fr', 'en'] as const) {
    const home = lang === 'fr' ? '/' : '/en'
    // A content page that carries the full marketing header in this language.
    const start = lang === 'fr' ? '/handoff' : '/en/handoff'
    const prefix = lang === 'fr' ? '' : '/en'

    test(`brand link returns home (${lang})`, async ({ page }) => {
      await page.goto(start)
      await page.locator('.brand').click()
      await waitForPath(page, home)
      await expectRealPage(page)
    })

    for (const { section } of HEADER_NAV) {
      test(`nav link → #${section} (${lang})`, async ({ page }) => {
        // The header section nav is display:none below 640px by design —
        // mobile navigates via the sticky CTA + scrolling, not anchor links
        // (styles.css "Hide the section nav entirely on phones"). Nothing to
        // click there, so this interaction only applies above the breakpoint.
        test.skip(
          (page.viewportSize()?.width ?? 0) < 640,
          'header section nav is hidden on phone by design',
        )
        await page.goto(start)
        const href = `${prefix}/#${section}`
        await page.locator(`.site-header__section-link[href="${href}"]`).click()
        await waitForPath(page, href)
        await expectRealPage(page)
      })
    }

    for (const { section, feature } of HEADER_NAV) {
      test(`nav dot on #${section} → site map filtered to ${feature} (${lang})`, async ({
        page,
      }) => {
        // Same as the nav link above: the section nav (dots included) is
        // hidden below 640px, so this interaction is desktop/tablet only.
        test.skip(
          (page.viewportSize()?.width ?? 0) < 640,
          'header section nav is hidden on phone by design',
        )
        await page.goto(start)
        const to = lang === 'fr' ? `/carte?feature=${feature}` : `/en/map?feature=${feature}`
        // `meta` appears on two sections (how + about) — both dots carry the
        // same destination, so .first() reaches a correct one either way.
        await page.locator(`.site-header__section-dot[href="${to}"]`).first().click()
        await waitForPath(page, mapPath(lang))
        await expect(page).toHaveURL(new RegExp(`feature=${feature}`))
        await expectRealPage(page)
      })
    }

    test(`sign-in link → login (${lang})`, async ({ page }) => {
      await page.goto(start)
      // Logged-out (no auth cookie) → the auth cluster shows a sign-in link.
      await page.locator(`.site-header__auth-link[href="${prefix}/login"]`).click()
      await waitForPath(page, `${prefix}/login`)
      await expectRealPage(page)
    })
  }

  // FR↔EN switch: clicking the other-language tab must keep the visitor on
  // the conceptually-same page (the slug is translated where it differs).
  for (const pair of LANG_PAIRS) {
    test(`lang switch FR→EN keeps the page (${pair.fr})`, async ({ page }) => {
      await page.goto(pair.fr)
      await page.locator('nav.lang a', { hasText: 'EN' }).click()
      await waitForPath(page, pair.en)
      await expectRealPage(page)
    })

    test(`lang switch EN→FR keeps the page (${pair.en})`, async ({ page }) => {
      await page.goto(pair.en)
      await page.locator('nav.lang a', { hasText: 'FR' }).click()
      await waitForPath(page, pair.fr)
      await expectRealPage(page)
    })
  }
})

/* ─── 3. footer chrome ─────────────────────────────────────────────────── */

test.describe('full tour — footer chrome', () => {
  for (const lang of ['fr', 'en'] as const) {
    const start = lang === 'fr' ? '/handoff' : '/en/handoff'

    test(`every footer page link reaches a real page (${lang})`, async ({ page }) => {
      // Six links, each clicked from a fresh load of `start` — comfortably
      // more navigations than fit in the default per-test budget.
      test.slow()
      await page.goto(start)
      // The text page link only — `:not(.feature-dot)` excludes the sibling
      // dot, which is itself an <a> pointing at the site map.
      const links = page.locator('.site-footer__page a:not(.feature-dot)')
      // `start` is a lazy route — wait for the footer to mount before the
      // (non-auto-waiting) evaluateAll reads hrefs.
      await expect(links.first()).toBeVisible()
      const hrefs = await links.evaluateAll((els) =>
        els.map((el) => (el as HTMLAnchorElement).getAttribute('href') ?? ''),
      )
      expect(hrefs.length).toBeGreaterThan(0)
      for (const href of hrefs) {
        expect(href, 'footer link has an href').toBeTruthy()
        await page.goto(start)
        await page.locator(`.site-footer__page a:not(.feature-dot)[href="${href}"]`).click()
        await waitForPath(page, href)
        await expectRealPage(page)
      }
    })

    test(`footer feature dot opens the site map (${lang})`, async ({ page }) => {
      await page.goto(start)
      await page.locator('.site-footer__page .feature-dot').first().click()
      await waitForPath(page, mapPath(lang))
      await expect(page).toHaveURL(/feature=/)
      await expectRealPage(page)
    })

    test(`footer language arrow switches language (${lang})`, async ({ page }) => {
      await page.goto(start)
      await page.locator('.site-footer__lang').click()
      const other = lang === 'fr' ? '/en/handoff' : '/handoff'
      await waitForPath(page, other)
      await expectRealPage(page)
    })
  }
})

/* ─── 4. page outro — continue the tour + back home ────────────────────── */

test.describe('full tour — page outro (continue / back home)', () => {
  for (const stop of TOUR_STOPS) {
    for (const lang of ['fr', 'en'] as const) {
      test(`${stop.name} outro: continue + back-home (${lang})`, async ({ page }) => {
        await page.goto(stop.path[lang], { waitUntil: 'networkidle' })

        // "Back to home" exit — verify its href before we navigate away.
        const homeLink = page.locator('.feature-continue__home')
        await expect(homeLink).toBeVisible()
        await expect(homeLink).toHaveAttribute('href', stop.homeHref[lang])

        // "Continue the tour" — click it and confirm the destination is real.
        const continueLink = page.locator('.feature-continue__link')
        await expect(continueLink).toBeVisible()
        await continueLink.click()
        await waitForPath(page, stop.continueTo[lang])
        await expectRealPage(page)
      })
    }
  }

  // The meta loop is fully clickable — five "continue" hops close back on
  // the site map. Walk the whole ring in one go.
  for (const lang of ['fr', 'en'] as const) {
    test(`the meta tour loop closes (${lang})`, async ({ page }) => {
      const ring =
        lang === 'fr'
          ? ['/carte', '/meta', '/atelier', '/confidentialite', '/pia', '/carte']
          : ['/en/map', '/en/meta', '/en/atelier', '/en/privacy', '/en/pia', '/en/map']
      await page.goto(ring[0], { waitUntil: 'networkidle' })
      for (let i = 1; i < ring.length; i++) {
        await page.locator('.feature-continue__link').click()
        await waitForPath(page, ring[i])
        await expectRealPage(page)
      }
    })

    // The product arc is clickable from tier-0 down to the intake form.
    test(`the product tour arc walks tier-0 → intake (${lang})`, async ({ page }) => {
      const arc =
        lang === 'fr'
          ? ['/tier-0', '/handoff', '/vouches', '/intake']
          : ['/en/tier-0', '/en/handoff', '/en/vouches', '/en/intake']
      await page.goto(arc[0], { waitUntil: 'networkidle' })
      for (let i = 1; i < arc.length; i++) {
        await page.locator('.feature-continue__link').click()
        await waitForPath(page, arc[i])
        await expectRealPage(page)
      }
    })
  }
})

/* ─── 5. page mast — folio + feature-cue dot ───────────────────────────── */

test.describe('full tour — page mast (title-corner links)', () => {
  for (const pageRow of PAGEMAST_PAGES) {
    for (const lang of ['fr', 'en'] as const) {
      const path = pageRow[lang]

      test(`${path}: folio link opens the site map`, async ({ page }) => {
        await page.goto(path, { waitUntil: 'networkidle' })
        await page.locator('.page-mast__folio').click()
        await waitForPath(page, mapPath(lang))
        await expect(page).toHaveURL(/feature=/)
        await expectRealPage(page)
      })

      test(`${path}: feature-cue dot opens the site map`, async ({ page }) => {
        await page.goto(path, { waitUntil: 'networkidle' })
        await page.locator('.page-mast__feature-cue .feature-dot').click()
        await waitForPath(page, mapPath(lang))
        await expect(page).toHaveURL(/feature=/)
        await expectRealPage(page)
      })
    }
  }
})

/* The hero's inline FR↔EN bilingual link was removed in the R3 design pass;
   language switching now lives solely in the header FR/EN toggle, which is
   covered by the "lang switch FR→EN / EN→FR keeps the page" tests above. */
