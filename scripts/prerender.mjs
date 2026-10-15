// Page prerender — npm `postbuild`, runs automatically after `vite build`.
//
// The app is a client-rendered SPA: nothing meaningful paints until the JS
// bundle loads, parses and renders. This script snapshots the real
// browser-rendered DOM of the homepage (FR `/` and EN `/en`) and the public
// gallery (`/projects`, `/en/projects`) to static HTML so content paints
// immediately (FCP/LCP) and crawlers see real card titles; the SPA then
// boots over it. Gallery data comes from a build-time fetch of the live
// /api/public/projects, injected as a JSON seed the SPA also boots from
// (src/lib/prerenderSeed.ts) so snapshot and first render agree.
//
// Why a browser snapshot, not react-dom/server SSR: the app already runs
// perfectly in a browser, so this needs zero app refactor and risks no
// window/document-during-render crashes or hydration-mismatch debugging.
// `main.tsx` keeps `createRoot().render()` (not `hydrateRoot`) — the
// prerendered HTML gives the fast paint, then React re-renders `#root`.
//
// Render-blocking head resources are also folded out so the prerendered
// content paints on the first network response, with nothing blocking:
//
//   1. Critical CSS — `styles.css` builds into one ~236 KB stylesheet that
//      covers every route. A render-blocking <link> to it gates first paint
//      behind the whole bundle; inlining all of it just moves that weight
//      into the HTML. Instead `beasties` walks the prerendered DOM and
//      inlines ONLY the rules this page uses, then rewrites the <link> to
//      load the full sheet AFTER paint. Small first paint, the rest streams
//      in behind it.
//   2. theme-bootstrap.js — the render-blocking `<script src>` in <head> is
//      inlined too.
//
// The CSP `script-src` has no `'unsafe-inline'`, so every inlined script
// (theme-bootstrap, the CSS loader beasties injects) is authorised by its
// sha256 — computed here and patched into dist/_headers, self-maintaining.
//
// The SPA-fallback sharp edge: `public/_redirects` is `/* /index.html 200`,
// so every non-file route serves index.html. index.html is the prerendered
// FR homepage; `/en` has its own prerendered en/index.html. dist/app.html is
// the inlined clean shell — currently unused by routing (the `/app.html`
// fallback looped on Cloudflare's .html-stripping; see PLAN_PRERENDER.md),
// kept for the clean-shell follow-up.
//
// Fail-soft: if the snapshot fails for any reason, dist/index.html is left as
// the Vite-built shell and the script exits 0. A deploy must never be blocked
// by prerender — a slower-but-correct SPA homepage beats a failed deploy.

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import Beasties from 'beasties'
import { chromium } from 'playwright'
import { preview } from 'vite'

const DIST = join(process.cwd(), 'dist')
const INDEX = join(DIST, 'index.html')
const APP_SHELL = join(DIST, 'app.html')
const HEADERS = join(DIST, '_headers')
const THEME_BOOTSTRAP = join(DIST, 'theme-bootstrap.js')

// Pages to snapshot: URL path → the dist file to write the snapshot to.
// `waitFor` is the selector that proves the page's content has rendered.
// The gallery pages wait for a card when the projects seed is available,
// because that's the state the seed makes React render first.
const PAGES = [
  { path: '/', out: INDEX, waitFor: '.app' },
  { path: '/en', out: join(DIST, 'en', 'index.html'), waitFor: '.app' },
  { path: '/projects', out: join(DIST, 'projects', 'index.html'), waitFor: '.app' },
  { path: '/en/projects', out: join(DIST, 'en', 'projects', 'index.html'), waitFor: '.app' },
]

// The live gallery data, fetched from production at build time. With it, the
// prerendered pages carry the real cards (titles + taglines — the SEO
// content), and the same JSON is injected into every snapshot as
// <script id="projects-seed" type="application/json"> so React's first
// render (src/lib/prerenderSeed.ts) matches the snapshot exactly. Without it
// (first-ever deploy, prod unreachable from CI), everything falls back to
// the old skeleton-freeze behavior — fail-soft, never a blocked deploy.
// Two origins, tried in order. The custom domain sits behind the zone's bot
// protection, which 403'd the GitHub-runner fetch on the first deploy (Node
// default UA + datacenter IP); the pages.dev origin serves the same
// Functions outside those rules and is a seeded tenant domain. A browser-ish
// UA is sent either way — this is our own build fetching our own public
// endpoint, not a scraper.
const PROJECTS_API_ORIGINS = ['https://marcportal.com', 'https://marc-portal.pages.dev']

async function fetchProjectsSeed() {
  for (const origin of PROJECTS_API_ORIGINS) {
    try {
      const res = await fetch(`${origin}/api/public/projects`, {
        signal: AbortSignal.timeout(15_000),
        headers: {
          'user-agent': 'Mozilla/5.0 (prerender; +https://marcportal.com) marc-portal-build',
          accept: 'application/json',
        },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = await res.text()
      const parsed = JSON.parse(body)
      if (!Array.isArray(parsed?.projects)) throw new Error('unexpected shape')
      console.log(
        `prerender: projects seed fetched from ${origin} (${parsed.projects.length} cards)`,
      )
      return body
    } catch (err) {
      console.warn(
        `prerender: projects seed fetch from ${origin} failed:`,
        err instanceof Error ? err.message : String(err),
      )
    }
  }
  console.warn('prerender: no seed origin answered, falling back to skeleton freeze')
  return null
}

/** Inject the seed as a non-executable JSON script tag. `<` is escaped so
 *  payload content can never close the tag; application/json is inert, so
 *  no CSP hash is needed (inlineScriptHashes skips non-JS types). */
function injectProjectsSeed(html, payload) {
  if (!payload) return html
  const tag = `<script id="projects-seed" type="application/json">${payload.replace(/</g, '\\u003c')}</script>`
  return html.replace('</body>', `${tag}</body>`)
}

/**
 * Replace every same-origin `<link rel="stylesheet">` with an inline
 * `<style>` carrying the file's contents. Used only for the app.html clean
 * shell — the real prerendered pages get critical-CSS treatment instead.
 * A stylesheet that can't be read locally is left as a <link> untouched.
 */
function inlineStylesheets(html) {
  return html.replace(/<link\b[^>]*>/gi, (tag) => {
    if (!/\brel\s*=\s*["']?stylesheet\b/i.test(tag)) return tag
    const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]
    // Only same-origin, root-absolute asset paths map to a dist file.
    if (!href || !href.startsWith('/')) return tag
    try {
      const css = readFileSync(join(DIST, href.split('?')[0]), 'utf8')
      return `<style>${css}</style>`
    } catch {
      return tag
    }
  })
}

/** Replace the render-blocking `<script src="/theme-bootstrap.js">` with an
 *  inline copy. Returns the html unchanged if the tag isn't present. */
function inlineThemeBootstrap(html, js) {
  return html.replace(
    /<script\b[^>]*\bsrc=["']\/theme-bootstrap\.js["'][^>]*><\/script>/i,
    () => `<script>${js}</script>`,
  )
}

/**
 * Inline the page's critical CSS and defer the full stylesheet.
 *
 * webfonts.css is inlined whole, up front, as critical: it is only ~3 KB of
 * @font-face and gates text paint. Beasties can't tell those families are
 * used — the app reaches them through CSS variables (var(--display) etc.) —
 * so left to itself it would defer the entire font layer. We inline it and
 * pass `reduceInlineStyles: false` so beasties leaves that <style> alone.
 *
 * Beasties then walks the prerendered DOM, inlines only the app-CSS rules
 * the page actually uses, and (preload: 'js-lazy') rewrites the <link> to
 * load the rest after paint via a tiny injector <script> — the loaded sheet
 * starts at `media="print"` so it never blocks, then swaps to `media="all"`.
 *
 * allowRules force-keeps the night-theme rules: the snapshot is captured in
 * day mode, so `[data-theme="night"]` selectors match nothing in the DOM —
 * without this a night-mode visitor would flash cream before the deferred
 * sheet lands. Same for the scroll-direction header states.
 */
async function applyCriticalCss(html) {
  const withFonts = html.replace(/<link\b[^>]*\bhref=["']\/fonts\/webfonts\.css["'][^>]*>/i, () => {
    try {
      return `<style>${readFileSync(join(DIST, 'fonts', 'webfonts.css'), 'utf8')}</style>`
    } catch {
      return '' // fail-soft: drop the tag rather than ship a dangling ref
    }
  })
  const beasties = new Beasties({
    path: DIST,
    publicPath: '',
    preload: 'js-lazy',
    reduceInlineStyles: false,
    pruneSource: false,
    allowRules: [/\[data-theme/, /\[data-scroll-direction/, /\[data-lang-nudge/],
    logLevel: 'warn',
  })
  return beasties.process(withFonts)
}

/**
 * Load `url` in a real browser, wait until the homepage has fully painted,
 * and return its complete static HTML (doctype + rendered <html>). The
 * stylesheet <link> is left intact for applyCriticalCss to process.
 */
async function snapshot(browser, url, { waitFor, projectsPayload }) {
  const page = await browser.newPage()
  const origin = new URL(url).origin
  try {
    // One route handler owns all request policy:
    //
    //   1. Cross-origin → abort. With seeded cards, the gallery pages mount
    //      live iframes to the showcased builds; a prerender must not fan
    //      out network calls to eight external apps (slow, nondeterministic,
    //      and a CI leak). Aborted frames fail fast; the cards keep their
    //      OG-image layer, which is the state a crawler should see anyway.
    //   2. /api/public/projects → fulfilled with the build-time payload, so
    //      the snapshot carries the real cards. When the seed fetch failed,
    //      the request is held pending instead (never fulfilled/aborted):
    //      that freezes FeaturedProjects/Projects in their *loading*
    //      skeleton — matching React's seedless first render — rather than
    //      the backendless error panel. (This hold is also why
    //      waitUntil:'networkidle' can't be used below.)
    //   3. Everything else same-origin → continue; the other backendless
    //      fetches (/capacity, /vouches, /tenant) fail fast into their
    //      neutral frozen states.
    await page.route('**/*', (route) => {
      const reqUrl = new URL(route.request().url())
      if (reqUrl.origin !== origin) return route.abort()
      if (reqUrl.pathname.startsWith('/api/public/projects')) {
        if (projectsPayload) {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: projectsPayload,
          })
        }
        return // hold pending — see above
      }
      return route.continue()
    })
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForSelector(waitFor, { timeout: 30_000 })
    // Webfonts resolved, so the snapshot reflects the final layout.
    await page.evaluate(() => document.fonts.ready)
    // Let the other backendless fetches (/capacity, /vouches, /tenant) reject
    // and settle into their neutral frozen states before we read the DOM —
    // networkidle used to give us this for free.
    await page.waitForTimeout(600)
    // outerHTML omits the doctype — prepend it so the file is a valid
    // standards-mode document. The <script type="module"> tag stays in the
    // captured markup, so the SPA still boots and re-renders over the
    // snapshot. The post-useEffect <head> (title, meta description, og tags)
    // is baked in too — an SEO bonus for crawlers that don't run JS.
    const outer = await page.evaluate(() => document.documentElement.outerHTML)
    return '<!doctype html>\n' + outer
  } finally {
    await page.close()
  }
}

/** Write `html` to `out` atomically — a temp file renamed into place, so a
 *  crash mid-write can never leave a half-written HTML file in dist/. */
function writeAtomic(out, html) {
  mkdirSync(join(out, '..'), { recursive: true })
  const tmp = out + '.tmp'
  writeFileSync(tmp, html, 'utf8')
  renameSync(tmp, out)
}

/** sha256-… for every inline, executable `<script>` in `html`. The strict
 *  CSP `script-src` has no `'unsafe-inline'`, so each inlined script —
 *  theme-bootstrap and the CSS loader beasties injects — must be hash-listed.
 *  Skips `src=` scripts (`'self'` covers them) and non-JS data blocks like
 *  `application/ld+json`, which `script-src` does not gate. */
function inlineScriptHashes(html) {
  const hashes = []
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
  let m
  while ((m = re.exec(html))) {
    const attrs = m[1]
    if (/\bsrc=/i.test(attrs)) continue
    const type = /\btype=["']?([^"'\s>]+)/i.exec(attrs)?.[1]?.toLowerCase()
    if (type && !['module', 'text/javascript', 'application/javascript'].includes(type)) {
      continue
    }
    hashes.push('sha256-' + createHash('sha256').update(m[2]).digest('base64'))
  }
  return hashes
}

/** Add any not-yet-present `'sha256-…'` to the CSP `script-src` in
 *  dist/_headers so the inlined scripts pass the strict policy. */
function addCspHashes(hashes) {
  let headers
  try {
    headers = readFileSync(HEADERS, 'utf8')
  } catch {
    return
  }
  const missing = [...new Set(hashes)].filter((h) => !headers.includes(h))
  if (missing.length === 0) return
  const inject = missing.map((h) => `'${h}'`).join(' ') + ' '
  writeFileSync(HEADERS, headers.replace(/(script-src )/, `$1${inject}`), 'utf8')
}

async function main() {
  // Phase 1a — write the clean shell FIRST: the Vite-built index.html with
  // stylesheets inlined, empty #root. Done before anything else so a later
  // failure can't leave it missing.
  writeAtomic(APP_SHELL, inlineStylesheets(readFileSync(INDEX, 'utf8')))
  console.log('prerender: dist/app.html written (inlined clean shell)')

  let server
  let browser
  try {
    // `vite preview` serves dist/ exactly as built, with the SPA fallback —
    // so `/en` (no file yet) serves index.html and the router renders the EN
    // homepage, just as Cloudflare Pages will once en/index.html is missing.
    server = await preview({
      preview: { port: 4173, strictPort: false },
      logLevel: 'warn',
    })
    const base = server.resolvedUrls?.local?.[0]?.replace(/\/$/, '')
    if (!base) throw new Error('vite preview did not resolve a local URL')

    browser = await chromium.launch()

    const projectsPayload = await fetchProjectsSeed()

    // Capture every page first; only write once ALL succeed, so a failure on
    // one route never leaves a half-updated set of prerendered shells.
    const captured = []
    for (const { path, out, waitFor } of PAGES) {
      let html = await snapshot(browser, base + path, { waitFor, projectsPayload })
      html = injectProjectsSeed(html, projectsPayload)
      captured.push({ out, html })
      console.log(`prerender: captured ${path} (${html.length} bytes)`)
    }

    // Inline critical CSS + theme-bootstrap. Done only here, on the success
    // path: a fail-soft shell keeps the external <link>/<script src>, which
    // the CSP already allows.
    const themeJs = readFileSync(THEME_BOOTSTRAP, 'utf8')
    const processed = []
    for (const { out, html } of captured) {
      let page = await applyCriticalCss(html)
      page = inlineThemeBootstrap(page, themeJs)
      processed.push({ out, html: page })
      console.log(`prerender: processed ${out} (${page.length} bytes, critical CSS inlined)`)
    }

    // Authorise every inlined script (theme-bootstrap + the beasties CSS
    // loader) in the CSP before the HTML that depends on it goes live.
    addCspHashes(processed.flatMap((p) => inlineScriptHashes(p.html)))
    for (const { out, html } of processed) writeAtomic(out, html)
    console.log(`prerender: ${PAGES.length} page shells written (/, /en, /projects, /en/projects)`)
  } catch (err) {
    // Fail-soft. dist/index.html is still the Vite-built shell (we only
    // overwrite it at the very end, after both snapshots succeed), so the
    // site stays correct as a plain SPA. Never block the deploy.
    console.warn('prerender: snapshot failed, leaving the Vite-built shell in place')
    console.warn(err instanceof Error ? err.stack : String(err))
  } finally {
    if (browser) await browser.close()
    if (server) await new Promise((resolve) => server.httpServer.close(resolve))
  }
}

await main()
process.exit(0)
