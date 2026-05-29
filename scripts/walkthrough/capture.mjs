// scripts/walkthrough/capture.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Regenerates the walkthrough's FRAMES + ANCHOR BOXES from the LIVE app.
// Run on every build (CI step below). It does NOT touch timeline.js — that's
// the stable creative layer. It only refreshes what the product actually looks
// like right now and where each named anchor sits.
//
//   node scripts/walkthrough/capture.mjs
//
// Env:
//   BASE_URL            default http://localhost:4173 (vite preview)
//   MP_SESSION_COOKIE   "name=value" of a signed-in session cookie (for /me,/session)
//   MP_SESSION_ID       an existing session id that HAS a Marc reply (for /session)
//
// Output:
//   public/walkthrough/frames/<key>__<state>.png   full-page screenshots @1620w
//   public/walkthrough/manifest.json               { frames: { key__state: {src,w,h,anchors} } }
//
// NOTE ON SELECTORS: the CONFIG block below is the only thing you should need
// to touch if the product DOM changes. Each anchor is a CSS selector; missing
// anchors are skipped (the player pins the camera to page-top for those).
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from 'playwright'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const COOKIE = process.env.MP_SESSION_COOKIE || ''
const SESSION_ID = process.env.MP_SESSION_ID || ''
const OUT = 'public/walkthrough'
const FRAMES = path.join(OUT, 'frames')
const VIEW_W = 1620
const VISITOR_MSG =
  'Au café, on jongle avec les quarts dans un groupe texto pis ça vire au chaos. ' +
  'J’aimerais que le monde voie qui prend quel quart, sans que j’aie à tout retaper.'

// The capture plan. `anchors` are the named boxes timeline.js aims at.
const CONFIG = {
  home: {
    url: '/',
    states: { default: async () => {} },
    anchors: { cta: 'a.hero__cta--primary, .hero__cta' },
  },
  intake: {
    url: '/intake',
    // Drive vibe → account → type → form. Verified against the real step
    // components (VibeGate / AccountStep / TypePicker / TypeForm). If those
    // DOMs change, this is the block to re-check.
    setup: async (page) => {
      // Each state re-runs setup, and the intake autosaves its draft + the
      // vibe-accepted flag to localStorage. Left in place, the second state
      // would mount mid-flow with a "resume your draft?" prompt over the
      // form. Wipe per-tab storage and reload so every capture starts clean
      // at the vibe gate and the click-through below is deterministic.
      await page.evaluate(() => {
        try {
          localStorage.clear()
          sessionStorage.clear()
        } catch {}
      })
      await page.reload({ waitUntil: 'networkidle' })
      await page.waitForTimeout(300)
      // VibeGate → account. Scope to <button>: the checkbox <label> reads
      // "…je continue." too, and clickByText takes the first DOM match —
      // matching the label only ticks the (non-blocking) box, it never fires
      // onAccept, so the gate wouldn't advance. The CTA is "Continuer →".
      await clickByText(page, 'button', /continuer/i)
      // AccountStep → type. A valid email enables the CTA. When a session
      // cookie is attached the step is the signed-in card (no email input);
      // the bounded fill no-ops and the same "Continuer…" CTA advances.
      await page
        .locator('input[type="email"]')
        .first()
        .fill('marie@cafedunord.ca', { timeout: 3000 })
        .catch(() => {})
      await clickByText(page, 'button', /continuer/i)
      // TypePicker → form. Each card prints its raw slug in a mono label, so
      // matching "paperasse" selects that card; onPick lands straight on the
      // form (its first field is the description textarea — the `field` anchor).
      await clickByText(page, 'button', /paperasse/i)
    },
    states: {
      empty: async () => {},
      filled: async (page) => {
        await page
          .locator('textarea')
          .first()
          .fill(VISITOR_MSG)
          .catch(() => {})
      },
    },
    // `field` = the description textarea (paperasse's first field). `submit` =
    // the form's "Soumettre →" button: it's the .hero__cta inside .form__actions
    // (the sibling .link-btn is "back"). Plain CSS only — rect() resolves
    // anchors with document.querySelector, which doesn't understand Playwright's
    // :has-text().
    anchors: { field: 'textarea', submit: '.form__actions .hero__cta' },
  },
  login: {
    url: '/login',
    states: {
      empty: async () => {},
      filled: async (page) => {
        await page
          .locator('#email, input[type="email"]')
          .first()
          .fill('marie@cafedunord.ca')
          .catch(() => {})
      },
    },
    anchors: { field: '#email, input[type="email"]', submit: 'button[type="submit"], .hero__cta' },
  },
  magic: {
    url: '/login/sent?email=marie@cafedunord.ca',
    states: { default: async () => {} },
    anchors: { mark: '.magic-link__mark, .magic-link h1' },
  },
  me: {
    url: '/me',
    auth: true,
    states: { default: async () => {} },
    anchors: { card: '.me-portal__card-link', cardOpen: '.me-portal__open' },
  },
  session: {
    url: () => `/session/${SESSION_ID}`,
    auth: true,
    needsSessionId: true,
    states: {
      // pending = thread without Marc's reply (hide it); reply = full thread.
      pending: async (page) => {
        await page.evaluate(() => {
          document.querySelectorAll('.thread__msg--marc').forEach((n) => n.remove())
        })
      },
      reply: async () => {},
    },
    anchors: { visitor: '.thread__msg--visitor, .thread__msg', marc: '.thread__msg--marc' },
  },
}

async function clickByText(page, sel, re) {
  const els = await page.locator(sel).all()
  for (const e of els) {
    const txt = ((await e.textContent().catch(() => '')) || '').trim()
    if (re.test(txt)) {
      await e.click().catch(() => {})
      await page.waitForTimeout(250)
      return true
    }
  }
  return false
}
async function rect(page, selector) {
  return page.evaluate((sel) => {
    const e = document.querySelector(sel.split(',')[0].trim()) || document.querySelector(sel)
    if (!e) return null
    const r = e.getBoundingClientRect()
    return [
      Math.round(r.left + scrollX),
      Math.round(r.top + scrollY),
      Math.round(r.width),
      Math.round(r.height),
    ]
  }, selector)
}

async function main() {
  await rm(FRAMES, { recursive: true, force: true })
  await mkdir(FRAMES, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: VIEW_W, height: 1100 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'reduce', // freeze entry animations so frames are stable
  })
  // The cookie is applied PER ROUTE, not once on the context. The public funnel
  // (home, intake, login, magic) is the logged-OUT half of the flow — a real
  // visitor hasn't signed in yet. Attaching the session there makes /login
  // render its already-signed-in state instead of the email form, erasing the
  // "type your email → magic link" beat. Only the authed surfaces (auth:true:
  // /me, /session) carry it.
  const cookieHost = new URL(BASE).hostname
  function sessionCookie() {
    const [name, ...v] = COOKIE.split('=')
    return { name, value: v.join('='), domain: cookieHost, path: '/' }
  }
  const page = await context.newPage()
  const frames = {}

  for (const [key, cfg] of Object.entries(CONFIG)) {
    if (cfg.needsSessionId && !SESSION_ID) {
      console.warn(`[skip] ${key}: set MP_SESSION_ID`)
      continue
    }
    if (cfg.auth && !COOKIE) {
      console.warn(`[skip] ${key}: set MP_SESSION_COOKIE`)
      continue
    }
    await context.clearCookies()
    if (cfg.auth && COOKIE) await context.addCookies([sessionCookie()])
    const url = BASE + (typeof cfg.url === 'function' ? cfg.url() : cfg.url)
    for (const [state, apply] of Object.entries(cfg.states)) {
      try {
        await page.goto(url, { waitUntil: 'networkidle' })
        await page.waitForTimeout(400)
        if (cfg.setup) await cfg.setup(page)
        await apply(page)
        await page.waitForTimeout(300)
        const name = `${key}__${state}`
        const file = path.join(FRAMES, name + '.png')
        await page.screenshot({ path: file, fullPage: true })
        const dims = await page.evaluate(() => [
          document.documentElement.scrollWidth,
          document.documentElement.scrollHeight,
        ])
        const anchors = {}
        for (const [an, sel] of Object.entries(cfg.anchors || {})) {
          const r = await rect(page, sel)
          if (r) anchors[an] = r
          else console.warn(`[anchor] ${name}: "${an}" (${sel}) not found`)
        }
        frames[name] = { src: `frames/${name}.png`, w: VIEW_W, h: dims[1], anchors }
        console.log(
          `[ok] ${name}  ${dims[0]}x${dims[1]}  anchors=${Object.keys(anchors).join(',') || '-'}`,
        )
      } catch (e) {
        console.warn(`[fail] ${key}__${state}: ${e.message}`)
      }
    }
  }

  await writeFile(
    path.join(OUT, 'manifest.json'),
    JSON.stringify({ viewportW: VIEW_W, generatedAt: new Date().toISOString(), frames }, null, 2),
  )
  await browser.close()
  console.log(`\nWrote ${Object.keys(frames).length} frames + manifest.json`)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
