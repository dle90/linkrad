/**
 * Reproduce user-reported scenario:
 *
 *   1. Open CT (CHU VAN THANG equivalent)
 *   2. Switch to 3D mode (linkrad3D HP — 1 big 3D left + 3 MPR right)
 *   3. Open Mammo (TRAN THI VIET equivalent), pick CC bilateral
 *   4. Swap back to CT — should restore 3D mode with original layout/viewports
 *
 * After the fix, the snapshot captures currentMode='3d' + lastUserLayout=
 * {kind:'protocol', id:'linkrad3D'}, and applyRestoreState calls switchMode
 * to re-install the 3D HP (plus volume-loading overlay, plane pickers).
 */

const { chromium } = require('playwright')

const OHIF = 'http://localhost:3000'
const CT = '1.2.840.113619.2.417.3.2831206913.758.1777681355.167'
const MG = '123.147691040530748.1864223362884946'

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function readSnapshotState (page) {
  return page.evaluate(() => {
    const svcs = window.services
    const grid = svcs && svcs.viewportGridService && svcs.viewportGridService.getState && svcs.viewportGridService.getState()
    const hp = svcs && svcs.hangingProtocolService
    const active = hp && hp.getActiveProtocol && hp.getActiveProtocol()
    const ds = (svcs && svcs.displaySetService && svcs.displaySetService.getActiveDisplaySets && svcs.displaySetService.getActiveDisplaySets()) || []
    let viewportTypes = []
    try {
      const re = window.cornerstone.getRenderingEngines()[0]
      if (re) viewportTypes = re.getViewports().map(v => v.type)
    } catch {}
    return {
      hpId: active && active.protocol && active.protocol.id,
      layout: grid && (grid.layout || { numRows: grid.numRows, numCols: grid.numCols }),
      vpCount: viewportTypes.length,
      viewportTypes,
      studyUID: ds[0]?.StudyInstanceUID,
      modality: ds[0]?.Modality,
      bodyMammoMode: document.body.classList.contains('lr-mammo-mode'),
    }
  })
}

async function loadStudyWithRestore (page, uid) {
  return page.evaluate(async (u) => {
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

async function snapshotState (page) {
  return page.evaluate(async () => {
    return new Promise((resolve) => {
      const corr = 's-' + Date.now()
      function onMsg (e) {
        const d = e.data
        if (!d || d.source !== 'linkrad-iframe' || d.correlationId !== corr) return
        if (d.type === 'lr:snapshotState:result') {
          window.removeEventListener('message', onMsg); resolve(d.state)
        }
      }
      window.addEventListener('message', onMsg)
      window.postMessage({ source: 'linkrad-parent', type: 'lr:snapshotState', correlationId: corr }, '*')
    })
  })
}

async function loadStudyExplicit (page, uid, restoreState) {
  return page.evaluate(async ({ u, r }) => {
    return new Promise((resolve) => {
      const corr = 'lr-' + Date.now()
      function onMsg (e) {
        const d = e.data
        if (!d || d.source !== 'linkrad-iframe' || d.correlationId !== corr) return
        if (d.type === 'lr:loadStudy:done' || d.type === 'lr:loadStudy:error') {
          window.removeEventListener('message', onMsg); resolve(d)
        }
      }
      window.addEventListener('message', onMsg)
      window.postMessage({ source: 'linkrad-parent', type: 'lr:loadStudy', studyUID: u, restore: r, correlationId: corr }, '*')
    })
  }, { u: uid, r: restoreState })
}

async function main () {
  const browser = await chromium.launch({ headless: false })
  const ctx = await browser.newContext({ viewport: null })
  const page = await ctx.newPage()
  page.on('console', m => { if (/LinkRad/.test(m.text())) console.log('  [browser]', m.text()) })
  page.on('pageerror', e => console.log('  [browser:err]', e.message))

  console.log('STEP 1: Load CT initially')
  await page.goto(`${OHIF}/viewer?StudyInstanceUIDs=${CT}`, { waitUntil: 'domcontentloaded' })
  await sleep(5000)
  let s = await readSnapshotState(page)
  console.log('  CT baseline:', JSON.stringify(s))

  console.log('\nSTEP 2: Switch to 3D mode')
  await page.evaluate(() => {
    // Simulate clicking the 3D mode tab — find the button by aria/text
    const btn = Array.from(document.querySelectorAll('.lr-mode-tab, [data-mode="3d"], button'))
      .find(b => b.textContent && b.textContent.trim().match(/^3D$/i))
    if (btn) { btn.click(); return 'clicked' }
    return 'not-found'
  })
  await sleep(8000)  // 3D mode takes longer (volume load + plane pickers)
  s = await readSnapshotState(page)
  console.log('  After 3D click:', JSON.stringify(s))
  const inThreeD = s.hpId === 'linkrad3D' || s.vpCount === 4
  console.log('  3D active?', inThreeD)

  console.log('\nSTEP 2.5: Mutate the 3D viewport (rotate camera + set VRT preset)')
  const mutated = await page.evaluate(() => {
    const re = window.cornerstone.getRenderingEngines()[0]
    const vps = re.getViewports()
    const vol3d = vps.find(v => v.type === 'volume3d')
    if (!vol3d) return { ok: false, reason: 'no volume3d viewport' }
    const before = vol3d.getCamera()
    // Rotate by changing position/focal/viewUp meaningfully
    vol3d.setCamera({
      focalPoint: [50, 50, 50],
      position: [200, 300, 100],
      viewUp: [0, 0, 1],
      parallelScale: before.parallelScale,
    })
    let presetTried = null
    try {
      vol3d.setProperties({ preset: 'CT-Bone' })
      presetTried = 'CT-Bone'
    } catch {}
    vol3d.render()
    const after = vol3d.getCamera()
    const props = vol3d.getProperties ? vol3d.getProperties() : null
    return { ok: true, before, after, presetTried, props: props && { preset: props.preset } }
  })
  console.log('  Mutated:', JSON.stringify({
    camAfter: mutated.after && {
      focal: mutated.after.focalPoint?.map(n => +n.toFixed(1)),
      pos: mutated.after.position?.map(n => +n.toFixed(1)),
    },
    presetTried: mutated.presetTried,
    propPreset: mutated.props?.preset,
  }))
  await sleep(1500)

  console.log('\nSTEP 3: Snapshot CT-3D state (parent would do this on tab switch)')
  const ctSnapshot = await snapshotState(page)
  console.log('  Snapshot:', JSON.stringify({
    hpId: ctSnapshot.hpId,
    currentMode: ctSnapshot.currentMode,
    lastUserLayout: ctSnapshot.lastUserLayout,
    layout: ctSnapshot.layout,
    bindings: ctSnapshot.bindings.length,
  }))

  console.log('\nSTEP 4: Swap to MG, pick CC')
  await loadStudyWithRestore(page, MG)
  await sleep(3000)
  await page.evaluate(() => window._linkradSetMammoHanging && window._linkradSetMammoHanging('cc', { silent: true }))
  await sleep(2500)
  s = await readSnapshotState(page)
  console.log('  MG-CC state:', JSON.stringify(s))

  console.log('\nSTEP 5: Swap back to CT with restore=CT-3D-snapshot')
  const t0 = Date.now()
  await loadStudyExplicit(page, CT, ctSnapshot)
  const tLoad = Date.now() - t0
  console.log(`  lr:loadStudy:done ack received in ${tLoad}ms`)
  // Poll for the moment when the 3D viewport is back at the saved position
  let firstAt3D = null
  const cmpStart = Date.now()
  while (Date.now() - cmpStart < 15000) {
    const v = await page.evaluate(() => {
      const re = window.cornerstone.getRenderingEngines()[0]
      const vp = re ? re.getViewports().find(v => v.type === 'volume3d') : null
      if (!vp) return null
      const c = vp.getCamera ? vp.getCamera() : null
      return c && c.position
    })
    if (v && Math.abs(v[0] - 200) < 5) {
      firstAt3D = Date.now() - t0
      break
    }
    await sleep(150)
  }
  console.log(`  Camera at saved position by +${firstAt3D}ms (from lr:loadStudy fire)`)
  await sleep(3000)
  const finalState = await readSnapshotState(page)
  console.log('  CT after restore:', JSON.stringify(finalState))

  // Inspect the restored 3D viewport's actual camera + preset
  const finalVol = await page.evaluate(() => {
    const re = window.cornerstone.getRenderingEngines()[0]
    const vps = re ? re.getViewports() : []
    const vol3d = vps.find(v => v.type === 'volume3d')
    if (!vol3d) return null
    const cam = vol3d.getCamera ? vol3d.getCamera() : null
    const props = vol3d.getProperties ? vol3d.getProperties() : null
    return {
      cam: cam && {
        focal: cam.focalPoint?.map(n => +n.toFixed(1)),
        pos: cam.position?.map(n => +n.toFixed(1)),
        viewUp: cam.viewUp?.map(n => +n.toFixed(2)),
      },
      preset: props && props.preset,
    }
  })
  console.log('  Volume3D after restore:', JSON.stringify(finalVol))
  // Compare to what we set before swap
  const cameraRestored = mutated.after && finalVol && finalVol.cam &&
    Math.hypot(
      (mutated.after.position[0] || 0) - (finalVol.cam.pos[0] || 0),
      (mutated.after.position[1] || 0) - (finalVol.cam.pos[1] || 0),
      (mutated.after.position[2] || 0) - (finalVol.cam.pos[2] || 0),
    ) < 5
  console.log('  Camera position restored?', cameraRestored)
  console.log('  Preset restored?', finalVol?.preset === mutated.presetTried)

  console.log('\n=========================================')
  console.log('VERDICT')
  console.log('=========================================')
  const restored3D = (finalState.hpId === 'linkrad3D') ||
                     (finalState.vpCount === 4 && finalState.viewportTypes.some(t => t && /volume3d|volume_3d/i.test(t)))
  const noMammoMode = finalState.bodyMammoMode === false
  console.log('Final hpId:', finalState.hpId)
  console.log('Final viewports:', finalState.vpCount, finalState.viewportTypes)
  console.log('mammoMode body class:', finalState.bodyMammoMode)
  console.log(restored3D && noMammoMode
    ? '✅ 3D MODE RESTORED — no bleed'
    : '❌ FAILED — 3D not restored or Mammo state bled in')

  await sleep(10000)
  await browser.close()
  process.exit(restored3D && noMammoMode ? 0 : 1)
}

main().catch(err => { console.error('crashed', err); process.exit(2) })
