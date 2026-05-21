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
// Render-blocking CSS: prerendered content can only paint once the
// browser has the stylesheets — an external <link> still gates FCP behind
// a round-trip. So this script also INLINES every same-origin stylesheet
// (<link rel="stylesheet">) into a <style> tag. The CSP allows
// `style-src 'unsafe-inline'`, so this is safe; it removes the
// render-blocking request and lets the prerendered DOM paint as soon as
// the HTML arrives.
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

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { preview } from 'vite'

const DIST = join(process.cwd(), 'dist')
const INDEX = join(DIST, 'index.html')
const APP_SHELL = join(DIST, 'app.html')

// Pages to snapshot: URL path → the dist file to write the snapshot to.
const PAGES = [
  { path: '/', out: INDEX },
  { path: '/en', out: join(DIST, 'en', 'index.html') },
]

/**
 * Replace every same-origin `<link rel="stylesheet">` with an inline
 * `<style>` carrying the file's contents. Removes the render-blocking
 * round-trip so prerendered content paints as soon as the HTML is parsed.
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

/**
 * Load `url` in a real browser, wait until the homepage has fully painted,
 * and return its complete static HTML (doctype + rendered <html>), with
 * stylesheets inlined.
 */
async function snapshot(browser, url) {
  const page = await browser.newPage()
  try {
    // networkidle: the homepage fires /api/public/projects + /api/capacity;
    // `vite preview` has no Functions backend so those settle as failures —
    // which is fine, the components fall back gracefully. We just need the
    // requests to stop so the DOM is stable before we read it.
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })
    // The homepage root wrapper — present once <Home> has mounted.
    await page.waitForSelector('.app', { timeout: 30_000 })
    // Webfonts resolved, so the snapshot reflects the final layout.
    await page.evaluate(() => document.fonts.ready)
    // outerHTML omits the doctype — prepend it so the file is a valid
    // standards-mode document. The <script type="module"> tag stays in the
    // captured markup, so the SPA still boots and re-renders over the
    // snapshot. The post-useEffect <head> (title, meta description, og tags)
    // is baked in too — an SEO bonus for crawlers that don't run JS.
    const outer = await page.evaluate(() => document.documentElement.outerHTML)
    return inlineStylesheets('<!doctype html>\n' + outer)
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
      console.log(`prerender: captured ${path} (${html.length} bytes, CSS inlined)`)
    }
    for (const { out, html } of captured) writeAtomic(out, html)
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
