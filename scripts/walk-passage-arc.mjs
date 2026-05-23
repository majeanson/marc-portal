// One-shot Playwright walker. Visits each ton-passage page in both
// languages, sets sessionStorage for the ritual branch where needed,
// and writes screenshots into .walk-screenshots/. Not a test — no
// pass/fail assertions, just a visual sweep for the human reviewer.
//
// Usage: node scripts/walk-passage-arc.mjs
// (requires npm run dev to be running on :5173)

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const BASE = process.env.WALK_BASE || 'http://localhost:5173'
const OUT = resolve(process.cwd(), '.walk-screenshots')
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })

const shots = [
  { name: '01-passage-fr', url: '/passage' },
  { name: '02-passage-en', url: '/en/passage' },
  { name: '03-dossier-signed-out-fr', url: '/me/dossier' },
  { name: '04-dossier-signed-out-en', url: '/en/me/dossier' },
  { name: '05-au-revoir-direct-fr', url: '/au-revoir' },
  { name: '06-au-revoir-direct-en', url: '/en/goodbye' },
  // Ritual branch — set the flag before navigating. New page per shot
  // so the flag is consumed exactly once and the lazy-initializer
  // captures it.
  { name: '07-au-revoir-ritual-fr', url: '/au-revoir', ritual: true },
  { name: '08-au-revoir-ritual-en', url: '/en/goodbye', ritual: true },
]

for (const shot of shots) {
  const page = await ctx.newPage()
  if (shot.ritual) {
    // sessionStorage is origin-scoped; seed it on the same origin before
    // navigating to the destination so the lazy useState reads '1' on mount.
    await page.goto(BASE + '/')
    await page.evaluate(() => sessionStorage.setItem('mp_just_erased', '1'))
  }
  await page.goto(BASE + shot.url, { waitUntil: 'networkidle' })
  // Give the token-fade enough time to settle (~3s) for the ritual shot;
  // a render-time grab catches the labels mid-fade and reads as broken.
  if (shot.ritual) await page.waitForTimeout(3500)
  await page.screenshot({ path: `${OUT}/${shot.name}.png`, fullPage: true })
  console.log(`✓ ${shot.name}`)
  await page.close()
}

await browser.close()
console.log(`done — ${shots.length} screenshots in ${OUT}`)
