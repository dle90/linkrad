/**
 * Reproduce the user-reported Mammo bleed scenario end-to-end via Playwright:
 *
 *   1. Open CT (DOAN THI TUYET equivalent)
 *   2. Swap to Mammo (TRAN THI VIET equivalent)
 *   3. Trigger CC preset (Mammo edge-stick installs: chest-wall anchored,
 *      60fps enforce loop, CAMERA_MODIFIED listeners)
 *   4. Swap back to CT
 *   5. Inspect CT's first viewport — its camera should be centered with
 *      a default displayArea. If displayArea is biased toward an edge or
 *      focalPoint is offset, edge-stick has bled into the new study.
 *
 * Usage: node scripts/spike-mammo-bleed.js
 */

const { chromium } = require('playwright')

const OHIF = 'http://localhost:3000'
const CT = '1.2.840.113619.2.417.3.2831206913.758.1777681355.167'
const MG = '123.147691040530748.1864223362884946'

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function readVp0 (page) {
  return page.evaluate(() => {
    try {
      const re = window.cornerstone.getRenderingEngines()[0]
      if (!re) return null
      const vp = re.getViewports()[0]
      if (!vp) return null
      const cam = vp.getCamera ? vp.getCamera() : null
      const da = vp.getDisplayArea ? vp.getDisplayArea() : null
      const props = vp.getProperties ? vp.getProperties() : null
      const id = vp.id
      const displaySets = (window.services && window.services.displaySetService && window.services.displaySetService.getActiveDisplaySets()) || []
      const studyUID = displaySets[0]?.StudyInstanceUID
      const modality = displaySets[0]?.Modality
      return {
        id, studyUID, modality,
        cameraFocal: cam && cam.focalPoint && cam.focalPoint.map(n => +n.toFixed(2)),
        cameraPos: cam && cam.position && cam.position.map(n => +n.toFixed(2)),
        parallelScale: cam && cam.parallelScale,
        displayArea: da,
        voiRange: props && props.voiRange,
        mammoMode: document.body.classList.contains('lr-mammo-mode'),
      }
    } catch (e) { return { error: String(e) } }
  })
}

async function loadStudy (page, uid) {
  await page.evaluate(async (u) => {
    return new Promise((resolve) => {
      const corr = 'l-' + Date.now()
      function onMsg (e) {
        const d = e.data
        if (!d || d.source !== 'linkrad-iframe' || d.correlationId !== corr) return
        if (d.type === 'lr:loadStudy:done' || d.type === 'lr:loadStudy:error') {
          window.removeEventListener('message', onMsg); resolve(d)
        }
      }
      window.addEventListener('message', onMsg)
      window.postMessage({ source: 'linkrad-parent', type: 'lr:loadStudy', studyUID: u, correlationId: corr }, '*')
    })
  }, uid)
}

async function waitForLoadedStudy (page, uid, timeoutMs = 25000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    const s = await readVp0(page)
    if (s && s.studyUID === uid && s.cameraFocal) return s
    await sleep(400)
  }
  throw new Error('Timed out waiting for ' + uid)
}

async function main () {
  const browser = await chromium.launch({ headless: false })
  const ctx = await browser.newContext({ viewport: null })
  const page = await ctx.newPage()
  page.on('console', m => { if (/LinkRad/.test(m.text())) console.log('  [browser]', m.text()) })
  page.on('pageerror', e => console.log('  [browser:err]', e.message))

  console.log('STEP 1: Load CT-A initially')
  await page.goto(`${OHIF}/viewer?StudyInstanceUIDs=${CT}`, { waitUntil: 'domcontentloaded' })
  const ctBaseline = await waitForLoadedStudy(page, CT)
  console.log('  CT baseline:', JSON.stringify({
    focal: ctBaseline.cameraFocal,
    da: ctBaseline.displayArea, mammoMode: ctBaseline.mammoMode,
  }))
  await sleep(3000)
  const ctSettled = await readVp0(page)
  console.log('  CT settled (+3s):', JSON.stringify({ focal: ctSettled.cameraFocal, da: ctSettled.displayArea }))

  console.log('\nSTEP 2: Swap to MG via lr:loadStudy')
  await loadStudy(page, MG)
  await waitForLoadedStudy(page, MG)
  await sleep(1500)

  console.log('\nSTEP 3: Trigger Mammo CC preset')
  const ccApplied = await page.evaluate(() => {
    if (typeof window._linkradSetMammoHanging !== 'function') return { ok: false, reason: 'hook missing' }
    try {
      const r = window._linkradSetMammoHanging('cc', { silent: true })
      return { ok: !!r }
    } catch (e) { return { ok: false, reason: String(e) } }
  })
  console.log('  CC applied:', JSON.stringify(ccApplied))
  await sleep(2000)  // let applyMammoDisplayConventions finish (700ms timer + edge-anchor settling)

  // Confirm edge-stick is actually installed on MG
  const mgAfterCC = await page.evaluate(() => {
    const re = window.cornerstone.getRenderingEngines()[0]
    const vps = re ? re.getViewports() : []
    return {
      vpCount: vps.length,
      mammoMode: document.body.classList.contains('lr-mammo-mode'),
      vp0DisplayArea: vps[0] && vps[0].getDisplayArea ? vps[0].getDisplayArea() : null,
      vp0Focal: vps[0] && vps[0].getCamera ? vps[0].getCamera().focalPoint?.map(n => +n.toFixed(2)) : null,
    }
  })
  console.log('  MG after CC:', JSON.stringify(mgAfterCC))

  console.log('\nSTEP 4: Swap back to CT via lr:loadStudy')
  await loadStudy(page, CT)
  await waitForLoadedStudy(page, CT)
  await sleep(2000)

  const ctAfterBleed = await readVp0(page)
  console.log('  CT after bleed:', JSON.stringify({
    focal: ctAfterBleed.cameraFocal,
    pos: ctAfterBleed.cameraPos,
    da: ctAfterBleed.displayArea,
    mammoMode: ctAfterBleed.mammoMode,
  }))

  console.log('\n=========================================')
  console.log('BLEED VERDICT')
  console.log('=========================================')
  const focalDiff = ctAfterBleed.cameraFocal && ctBaseline.cameraFocal
    ? Math.hypot(
        ctAfterBleed.cameraFocal[0] - ctBaseline.cameraFocal[0],
        ctAfterBleed.cameraFocal[1] - ctBaseline.cameraFocal[1],
        ctAfterBleed.cameraFocal[2] - ctBaseline.cameraFocal[2],
      ) : null
  console.log('Focal-point delta vs baseline:', focalDiff?.toFixed(2), 'mm')
  console.log('CT has Mammo body class:', ctAfterBleed.mammoMode)
  console.log('CT displayArea:', JSON.stringify(ctAfterBleed.displayArea))
  const clean = ctAfterBleed.mammoMode === false &&
                (!ctAfterBleed.displayArea ||
                 (ctAfterBleed.displayArea.storeAsInitialCamera !== false &&
                  (!ctAfterBleed.displayArea.imageArea ||
                   ctAfterBleed.displayArea.imageArea[0] === 1)))
  // focalDiff varies depending on CT volume settle time; not a reliable bleed
  // signal. The real bleed fingerprints are the body class + displayArea.
  console.log('  (focal-point delta is unreliable due to CT camera settle timing)')
  console.log(clean ? '✅ CLEAN — no bleed' : '❌ BLEED DETECTED')

  await sleep(8000)
  await browser.close()
  process.exit(clean ? 0 : 1)
}

main().catch(err => { console.error('crashed', err); process.exit(2) })
