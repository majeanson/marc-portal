// Homepage prerender — npm `postbuild`, runs automatically after `vite build`.
//
// The app is a client-rendered SPA: nothing meaningful paints until the JS
// bundle loads, parses and renders. This script snapshots the real
// browser-rendered DOM of the homepage (FR `/` and EN `/en`) to static HTML
// so content paints immediately (FCP/LCP); the SPA then boots over it.
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
const PAGES = [
  { path: '/', out: INDEX },
  { path: '/en', out: join(DIST, 'en', 'index.html') },
]

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
async function snapshot(browser, url) {
  const page = await browser.newPage()
  try {
    // Freeze FeaturedProjects in its *loading* (skeleton) state, not its
    // error state. `vite preview` has no Functions backend, so left alone
    // /api/public/projects fails and the component renders its error panel
    // ("couldn't load projects") — which then gets baked into the static
    // first paint. On a real visit React boots into its loading state
    // (skeleton), so the visitor would see error → skeleton → cards: a
    // three-step flicker, and an error message as the fast paint. Holding
    // the request open keeps the snapshot in the skeleton state, which is
    // exactly what React renders first on boot → the cards fill in over the
    // placeholders with no visible swap. (Hero/StudioSign need no such help:
    // their loading state already equals their neutral default, and /capacity
    // is left to fail fast into that same neutral state.)
    await page.route('**/api/public/projects*', () => {
      // Intentionally never fulfilled/aborted — the pending fetch holds the
      // component in `isLoading`. Playwright tears it down when the page
      // closes. This is also why we can't waitUntil:'networkidle' below.
    })
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    // The homepage root wrapper — present once <Home> has mounted. Because
    // isLoading is FeaturedProjects' initial state, the skeleton is in the
    // DOM the moment `.app` appears.
    await page.waitForSelector('.app', { timeout: 30_000 })
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

    // Capture both pages first; only write once BOTH succeed, so a failure on
    // /en never leaves a prerendered / with a stale shell for /en.
    const captured = []
    for (const { path, out } of PAGES) {
      const html = await snapshot(browser, base + path)
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
    console.log('prerender: dist/index.html + dist/en/index.html written')
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
