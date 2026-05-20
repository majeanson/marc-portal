import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1280, height: 1600 } })
async function shot(url, file, sel) {
  await p.goto('http://localhost:4317' + url, { waitUntil: 'networkidle' })
  await p.waitForTimeout(700)
  if (sel) {
    const el = await p.$(sel)
    if (el) { await el.screenshot({ path: file }); return }
  }
  await p.screenshot({ path: file, fullPage: false })
}
await shot('/carte', 'shot-map.png')
await shot('/', 'shot-home.png')
await b.close()
console.log('done')
