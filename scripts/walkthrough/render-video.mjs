// scripts/walkthrough/render-video.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Records the walkthrough player to video — one full cut + one short per page.
// Runs after capture.mjs (which produces the frames + manifest the player needs).
//
//   node scripts/walkthrough/render-video.mjs
//
// Env: BASE_URL (default http://localhost:4173). The player must be served at
//      ${BASE_URL}/walkthrough/player.html (it is, once built — it's in public/).
//
// Output: public/walkthrough/video/<name>.webm   (full, home, intake, …)
// Convert to mp4 if you like:
//   ffmpeg -i public/walkthrough/video/full.webm -c:v libx264 -pix_fmt yuv420p full.mp4
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from 'playwright'
import { mkdir, rename, rm, readdir } from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.BASE_URL || 'http://localhost:4173'
// Caption language baked into this render. The /carte embed uses the live
// player (which picks language per visitor), so these exported videos are only
// for sharing — run once per language (WALK_LANG=en) if you need both.
const LANG = process.env.WALK_LANG === 'en' ? 'en' : 'fr'
const OUT = 'public/walkthrough/video'
const W = 1920,
  H = 1080
const TARGETS = ['full', 'home', 'intake', 'login', 'magic', 'me', 'session']

async function record(name) {
  const dir = path.join(OUT, '_tmp_' + name)
  await mkdir(dir, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    recordVideo: { dir, size: { width: W, height: H } },
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()
  const q = (name === 'full' ? '?record=1' : `?record=1&scene=${name}`) + `&lang=${LANG}`
  await page.goto(`${BASE}/walkthrough/player.html${q}`, { waitUntil: 'load' })
  // Wait until the player signals the one-shot playthrough finished.
  await page.waitForFunction(() => window.__MP_DONE === true, { timeout: 120000 }).catch(() => {})
  await page.waitForTimeout(300)
  await context.close() // flushes the video file
  await browser.close()
  // Move the single produced webm to <name>.webm
  const files = (await readdir(dir)).filter((f) => f.endsWith('.webm'))
  if (files[0]) await rename(path.join(dir, files[0]), path.join(OUT, name + '.webm'))
  await rm(dir, { recursive: true, force: true })
  console.log(`[video] ${name}.webm`)
}

async function main() {
  await mkdir(OUT, { recursive: true })
  for (const t of TARGETS) {
    try {
      await record(t)
    } catch (e) {
      console.warn(`[skip] ${t}: ${e.message}`)
    }
  }
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
