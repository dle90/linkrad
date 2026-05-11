/**
 * Reproduce + visually confirm the "2D bleed after volume mode" bug:
 *   1. Load CT in 2D
 *   2. Switch to 3D → wait
 *   3. Switch back to 2D → wait
 *   4. Set 2-up layout → wait
 *   5. Compare viewport 0 vs viewport 1 pixel histograms
 *
 * Each step screenshots the iframe so we can eyeball the result. A binarized
 * viewport shows up in the histogram as a U-shape (mostly pure black + white,
 * no mid-greys); a healthy viewport shows a roughly-normal distribution.
 *
 * Output:
 *   /tmp/lr-bleed-1-2d-baseline.png
 *   /tmp/lr-bleed-2-3d.png
 *   /tmp/lr-bleed-3-back-to-2d.png
 *   /tmp/lr-bleed-4-2up.png
 *   + histogram analysis printed to stdout
 */
const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')

const OHIF = 'http://localhost:3000'
const CT = '1.2.840.113619.2.417.3.2831206913.758.1777681355.167'
const OUT = path.join(require('os').tmpdir(), 'lr-bleed')
fs.mkdirSync(OUT, { recursive: true })

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function inspectViewports (page) {
  return page.evaluate(() => {
    const re = window.cornerstone && window.cornerstone.getRenderingEngines && window.cornerstone.getRenderingEngines()[0]
    if (!re) return null
    const vps = re.getViewports()
    return vps.map(vp => {
      let voi = null
      let props = null
      try {
        const p = vp.getProperties && vp.getProperties()
        voi = p && p.voiRange ? { lower: Math.round(p.voiRange.lower), upper: Math.round(p.voiRange.upper) } : null
        props = p && {
          invert: p.invert,
          colormap: p.colormap,
          voiLUTFunction: p.voiLUTFunction,
          preset: p.preset && p.preset.name,
          interpolationType: p.interpolationType,
          rotation: p.rotation,
        }
      } catch {}
      // Build a 10-bucket histogram of pixel intensities in the centre region
      // of the viewport canvas. Healthy CT renders fill most buckets; binarized
      // ones cluster in just bucket 0 and bucket 9.
      let hist = null
      try {
        const c = vp.canvas
        if (c && c.width && c.height) {
          const tmp = document.createElement('canvas')
          tmp.width = c.width
          tmp.height = c.height
          tmp.getContext('2d').drawImage(c, 0, 0)
          const d = tmp.getContext('2d').getImageData(
            Math.floor(c.width * 0.2), Math.floor(c.height * 0.2),
            Math.floor(c.width * 0.6), Math.floor(c.height * 0.6),
          ).data
          const buckets = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
          for (let i = 0; i < d.length; i += 4) {
            const gray = Math.round((d[i] + d[i + 1] + d[i + 2]) / 3)
            const bi = Math.min(9, Math.floor(gray / 25.6))
            buckets[bi]++
          }
          const total = buckets.reduce((a, b) => a + b, 0)
          hist = buckets.map(b => Math.round((b / total) * 100))
        }
      } catch {}
      return { id: vp.id, type: vp.type, voi, props, hist }
    })
  })
}

async function screenshotIframe (page, label) {
  const file = path.join(OUT, label + '.png')
  await page.screenshot({ path: file, fullPage: false })
  return file
}

async function main () {
  const browser = await chromium.launch({ headless: false })
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1000 } })
  const page = await ctx.newPage()
  page.on('console', m => { if (/LinkRad/.test(m.text())) console.log('  [browser]', m.text()) })
  page.on('pageerror', e => console.log('  [browser:err]', e.message))

  console.log('STEP 1: Load CT in 2D')
  await page.goto(`${OHIF}/viewer?StudyInstanceUIDs=${CT}`, { waitUntil: 'domcontentloaded' })
  await sleep(6000)
  let s = await inspectViewports(page)
  console.log('  2D baseline:', JSON.stringify(s, null, 2))
  console.log('  Saved:', await screenshotIframe(page, '1-2d-baseline'))

  console.log('\nSTEP 2: Switch to 3D')
  await page.evaluate(() => window._linkradSwitchMode('3d'))
  await sleep(10000)
  s = await inspectViewports(page)
  console.log('  3D state:', JSON.stringify(s, null, 2))
  console.log('  Saved:', await screenshotIframe(page, '2-3d'))

  console.log('\nSTEP 3: Switch back to 2D')
  await page.evaluate(() => window._linkradSwitchMode('2d'))
  await sleep(4000)
  s = await inspectViewports(page)
  console.log('  Back-to-2D state:', JSON.stringify(s, null, 2))
  console.log('  Saved:', await screenshotIframe(page, '3-back-to-2d'))

  console.log('\nSTEP 4: Set 2-up layout (where bleed reportedly appears)')
  await page.evaluate(() => {
    window.commandsManager.run({
      commandName: 'setViewportGridLayout',
      commandOptions: { numRows: 1, numCols: 2 },
      context: 'DEFAULT',
    })
  })
  await sleep(3500)
  s = await inspectViewports(page)
  console.log('  2-up state:', JSON.stringify(s, null, 2))
  console.log('  Saved:', await screenshotIframe(page, '4-2up'))

  // Diagnose: viewport 0 and 1 histograms should look similar (both healthy)
  if (s && s.length >= 2 && s[0].hist && s[1].hist) {
    const distinct0 = s[0].hist.filter(v => v > 2).length
    const distinct1 = s[1].hist.filter(v => v > 2).length
    console.log(`\n  Histogram distinct buckets — vp0: ${distinct0}, vp1: ${distinct1}`)
    console.log('  vp0:', s[0].hist.join(' '))
    console.log('  vp1:', s[1].hist.join(' '))
    const vp0Binarized = distinct0 <= 3
    const vp1Binarized = distinct1 <= 3
    console.log('  ', vp0Binarized ? '❌ vp0 appears BINARIZED' : '✅ vp0 looks healthy')
    console.log('  ', vp1Binarized ? '❌ vp1 appears BINARIZED' : '✅ vp1 looks healthy')
  }

  // ── Experiments: which user-callable command fixes the bleed? ──
  console.log('\nSTEP 5: probe — try resetViewport on viewport-0')
  await page.evaluate(() => {
    const grid = window.services.viewportGridService.getState()
    window.services.viewportGridService.setActiveViewportId('default')
    window.commandsManager.run({ commandName: 'resetViewport', context: 'CORNERSTONE' })
  })
  await sleep(2000)
  let probe = await inspectViewports(page)
  console.log('  After resetViewport on vp0 — vp0 hist:', probe[0].hist.join(' '), 'distinct:', probe[0].hist.filter(v => v > 2).length)
  console.log('  Saved:', await screenshotIframe(page, '5-after-resetViewport'))

  console.log('\nSTEP 6: probe — try restoreDefaultWL on viewport-0')
  await page.evaluate(() => {
    window.services.viewportGridService.setActiveViewportId('default')
    window._linkradRestoreDefaultWL()
  })
  await sleep(2000)
  probe = await inspectViewports(page)
  console.log('  After restoreDefaultWL on vp0 — vp0 hist:', probe[0].hist.join(' '), 'distinct:', probe[0].hist.filter(v => v > 2).length)
  console.log('  Saved:', await screenshotIframe(page, '6-after-restoreDefaultWL'))

  console.log('\nSTEP 7: probe — try setViewportColormap Grayscale on viewport-0')
  await page.evaluate(() => {
    const dsUID = window.services.displaySetService.getActiveDisplaySets()[0].displaySetInstanceUID
    window.commandsManager.run({
      commandName: 'setViewportColormap',
      commandOptions: { viewportId: 'default', displaySetInstanceUID: dsUID, colormap: { name: 'Grayscale' }, immediate: true },
      context: 'CORNERSTONE',
    })
  })
  await sleep(2000)
  probe = await inspectViewports(page)
  console.log('  After setViewportColormap — vp0 hist:', probe[0].hist.join(' '), 'distinct:', probe[0].hist.filter(v => v > 2).length)
  console.log('  vp0 props:', JSON.stringify(probe[0].props))
  console.log('  Saved:', await screenshotIframe(page, '7-after-setColormap'))

  console.log('\nSTEP 8: probe — re-bind displaySet on viewport-0 (same UID)')
  await page.evaluate(() => {
    const allDS = window.services.displaySetService.getActiveDisplaySets()
    window.services.viewportGridService.setDisplaySetsForViewports([
      { viewportId: 'default', displaySetInstanceUIDs: [allDS[0].displaySetInstanceUID] },
    ])
  })
  await sleep(2500)
  probe = await inspectViewports(page)
  console.log('  After re-bind — vp0 hist:', probe[0].hist.join(' '), 'distinct:', probe[0].hist.filter(v => v > 2).length)
  console.log('  vp0 voi:', JSON.stringify(probe[0].voi), 'vp1 voi:', JSON.stringify(probe[1].voi))
  console.log('  Saved:', await screenshotIframe(page, '8-after-rebind'))

  console.log('\nSTEP 9: probe — flip to another displaySet then back')
  await page.evaluate(() => {
    const allDS = window.services.displaySetService.getActiveDisplaySets()
    if (allDS.length < 2) return
    window.services.viewportGridService.setDisplaySetsForViewports([
      { viewportId: 'default', displaySetInstanceUIDs: [allDS[1].displaySetInstanceUID] },
    ])
  })
  await sleep(1500)
  await page.evaluate(() => {
    const allDS = window.services.displaySetService.getActiveDisplaySets()
    window.services.viewportGridService.setDisplaySetsForViewports([
      { viewportId: 'default', displaySetInstanceUIDs: [allDS[0].displaySetInstanceUID] },
    ])
  })
  await sleep(2500)
  probe = await inspectViewports(page)
  console.log('  After flip-and-back — vp0 hist:', probe[0].hist.join(' '), 'distinct:', probe[0].hist.filter(v => v > 2).length)
  console.log('  Saved:', await screenshotIframe(page, '9-after-flip'))

  await sleep(6000)
  await browser.close()
}

main().catch(err => { console.error('crashed', err); process.exit(2) })
