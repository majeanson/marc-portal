import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })
await p.goto('http://localhost:4317/carte', { waitUntil: 'networkidle' })
await p.waitForTimeout(500)
await p.screenshot({ path: 'shot-header.png', clip: { x: 0, y: 0, width: 1280, height: 60 } })
// open a feature to see FeatureIndex header dot
await p.goto('http://localhost:4317/carte?feature=keys', { waitUntil: 'networkidle' })
await p.waitForTimeout(800)
await p.screenshot({ path: 'shot-index.png', clip: { x: 0, y: 60, width: 1280, height: 360 } })
await b.close()
console.log('done')
