/**
 * Spike runner: validate that OHIF v3.8.3 supports in-place study swap
 * via window.history.pushState + popstate dispatch (no React tree remount).
 *
 * Prereqs:
 *   docker compose -f linkrad-app/pacs/docker-compose.yml up -d
 *   (Orthanc on :8042 with studies seeded, OHIF on :3000 with
 *    linkrad-toolbar.js volume-mounted from linkrad-app/pacs/ohif/)
 *
 * Usage: node scripts/spike-study-swap.js
 *
 * What it does:
 *   1. Launches headed Chromium so we can eyeball the swap visually.
 *   2. Opens /viewer?StudyInstanceUIDs=<A>.
 *   3. Waits until OHIF is fully rendered (services + displaySet for A).
 *   4. Snapshots "before" state (toolbar element, services, displaySet UIDs).
 *   5. Calls window._linkradLoadStudy(<B>) — does pushState + popstate.
 *   6. Polls every 500ms for up to 12s, watching toolbar survival +
 *      displaySet UID switch.
 *   7. Reports verdict: success / partial / failure with reason.
 */

const { chromium } = require('playwright')

const OHIF_URL = 'http://localhost:3000'
const STUDY_CT_A = '1.2.840.113619.2.417.3.2831206913.758.1777681355.167'   // CT chest
const STUDY_CT_B = '1.2.840.113619.2.417.3.2831206913.16.1773879871.127'    // CT chest #2
const STUDY_MG   = '123.147691040530748.1864223362884946'                   // Mammo
const STUDY_MR   = '123.147691040530748.1864217785911779'                   // MR brain

const POLL_MS = 500
const POLL_MAX_MS = 15000

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function readState (page) {
  return await page.evaluate(() => {
    const svc = window.services && window.services.displaySetService
    const ds = (svc && svc.getActiveDisplaySets && svc.getActiveDisplaySets()) || []
    const uids = [...new Set(ds.map(d => d.StudyInstanceUID))]
    const modalities = [...new Set(ds.map(d => d.Modality).filter(Boolean))]
    const grid = window.services && window.services.viewportGridService &&
                 window.services.viewportGridService.getState && window.services.viewportGridService.getState()
    const layout = grid ? { rows: grid.layout?.numRows ?? grid.numRows, cols: grid.layout?.numCols ?? grid.numCols } : null
    // Read first viewport's VOI via Cornerstone3D for state-bleed check
    let firstVoi = null
    try {
      const cs = window.cornerstone || (window.services && window.services.cornerstoneViewportService && window.services.cornerstoneViewportService.getCornerstoneViewport?.bind)
      const renderers = (window.cornerstone && window.cornerstone.getRenderingEngines && window.cornerstone.getRenderingEngines()) || []
      if (renderers[0]) {
        const vps = renderers[0].getViewports()
        if (vps[0] && vps[0].getProperties) {
          const p = vps[0].getProperties()
          if (p && p.voiRange) firstVoi = { lower: Math.round(p.voiRange.lower), upper: Math.round(p.voiRange.upper) }
        }
      }
    } catch (e) {}
    const toolbar = document.getElementById('linkrad-toolbar')
    return {
      url: window.location.search,
      displaySets: ds.length,
      studyUIDs: uids,
      modalities,
      layout,
      firstVoi,
      toolbarAlive: !!toolbar,
      toolbarChildren: toolbar ? toolbar.children.length : 0,
      hasLoadStudy: typeof window._linkradLoadStudy === 'function',
      servicesAlive: !!window.services,
      extMgrAlive: !!window.extensionManager,
      cmdMgrAlive: !!window.commandsManager,
    }
  })
}

async function waitForStudyLoaded (page, studyUID, timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const s = await readState(page)
    if (s.hasLoadStudy && s.displaySets > 0 && s.studyUIDs.length === 1 && s.studyUIDs[0] === studyUID) {
      // Also wait for first viewport to actually render (have a VOI)
      if (s.firstVoi) return s
    }
    await sleep(500)
  }
  throw new Error(`Timed out waiting for study ${studyUID} to load`)
}

async function swapAndWait (page, fromUID, toUID, label) {
  console.log(`\n--- ${label} ---`)
  const before = await readState(page)
  console.log('  BEFORE:', JSON.stringify({ uids: before.studyUIDs, mod: before.modalities, layout: before.layout, voi: before.firstVoi, toolbar: before.toolbarAlive }))
  await page.evaluate((uid) => window._linkradLoadStudy(uid), toUID)
  const t0 = Date.now()
  let last = null
  while (Date.now() - t0 < POLL_MAX_MS) {
    await sleep(POLL_MS)
    const s = await readState(page)
    last = s
    if (!s.toolbarAlive) return { ok: false, reason: 'Toolbar disappeared', before, last: s, ms: Date.now() - t0 }
    if (s.studyUIDs.length === 1 && s.studyUIDs[0] === toUID && s.firstVoi) {
      const ms = Date.now() - t0
      console.log(`  ✓ swap completed in ${ms}ms`)
      console.log('  AFTER:', JSON.stringify({ uids: s.studyUIDs, mod: s.modalities, layout: s.layout, voi: s.firstVoi, toolbar: s.toolbarAlive }))
      return { ok: true, before, last: s, ms }
    }
  }
  return { ok: false, reason: `Timed out at ${POLL_MAX_MS}ms`, before, last, ms: POLL_MAX_MS }
}

async function main () {
  console.log('Launching Chromium…')
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] })
  const context = await browser.newContext({ viewport: null })
  const page = await context.newPage()

  // Stream browser console to our terminal — especially [LinkRad SPIKE] lines
  page.on('console', (msg) => {
    const t = msg.type()
    const text = msg.text()
    if (/LinkRad/.test(text) || t === 'error') {
      console.log(`  [browser:${t}] ${text}`)
    }
  })
  page.on('pageerror', (err) => console.log(`  [browser:pageerror] ${err.message}`))

  const urlA = `${OHIF_URL}/viewer?StudyInstanceUIDs=${STUDY_CT_A}`
  console.log(`Opening: ${urlA}`)
  await page.goto(urlA, { waitUntil: 'domcontentloaded' })

  console.log('Waiting for OHIF to fully load study CT-A…')
  await waitForStudyLoaded(page, STUDY_CT_A)
  await sleep(1500) // let HP settle

  const results = []

  // ── Scenario 1: same-modality swap (baseline) ──────────────────────────────
  results.push({ name: 'Same-modality (CT → CT)',
    ...(await swapAndWait(page, STUDY_CT_A, STUDY_CT_B, 'Scenario 1: same-modality CT → CT')) })

  // ── Scenario 2: cross-modality swap (CT → MG) ──────────────────────────────
  results.push({ name: 'Cross-modality (CT → MG)',
    ...(await swapAndWait(page, STUDY_CT_B, STUDY_MG, 'Scenario 2: cross-modality CT → Mammo')) })

  // ── Scenario 2b: same swap, but via postMessage protocol ────────────────────
  // Simulates what PersistentOHIFHost will do from the parent app side.
  console.log('\n--- Scenario 2b: postMessage protocol round-trip (parent → iframe) ---')
  const postMsgResult = await page.evaluate(async (toUID) => {
    const corr = 'spike-' + Math.random().toString(36).slice(2)
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('postMessage timeout')), 15000)
      function listener(e) {
        const d = e.data
        if (!d || d.source !== 'linkrad-iframe') return
        if (d.correlationId !== corr) return
        if (d.type === 'lr:loadStudy:done') {
          clearTimeout(timeout); window.removeEventListener('message', listener)
          resolve({ ok: true, studyUID: d.studyUID })
        } else if (d.type === 'lr:loadStudy:error') {
          clearTimeout(timeout); window.removeEventListener('message', listener)
          resolve({ ok: false, error: d.error })
        }
      }
      window.addEventListener('message', listener)
      window.postMessage({
        source: 'linkrad-parent', type: 'lr:loadStudy',
        studyUID: toUID, correlationId: corr,
      }, '*')
    })
  }, STUDY_CT_B)
  console.log('  postMessage result:', JSON.stringify(postMsgResult))
  const afterPostMsg = await readState(page)
  console.log('  state after:', JSON.stringify({ uids: afterPostMsg.studyUIDs, toolbar: afterPostMsg.toolbarAlive }))
  results.push({ name: 'postMessage round-trip', ok: postMsgResult.ok && afterPostMsg.studyUIDs[0] === STUDY_CT_B,
                 ms: 0, reason: postMsgResult.ok ? '' : ('postMessage failed: ' + postMsgResult.error) })

  // ── Scenario 2c: snapshot + restore round-trip ──────────────────────────────
  console.log('\n--- Scenario 2c: snapshot CT-B state, swap to MG, swap back with restore ---')
  // Mutate CT-B's W/L so we have a non-default state worth restoring
  await page.evaluate(() => {
    const vps = window.cornerstone.getRenderingEngines()[0].getViewports()
    if (vps[0] && vps[0].setProperties) {
      vps[0].setProperties({ voiRange: { lower: -1000, upper: -200 } })
      vps[0].render()
    }
  })
  await sleep(500)
  const snap = await page.evaluate(() => new Promise((resolve) => {
    const corr = 'snap-' + Math.random().toString(36).slice(2)
    function listener(e) {
      const d = e.data
      if (!d || d.source !== 'linkrad-iframe' || d.correlationId !== corr) return
      if (d.type === 'lr:snapshotState:result') {
        window.removeEventListener('message', listener)
        resolve(d.state)
      }
    }
    window.addEventListener('message', listener)
    window.postMessage({ source: 'linkrad-parent', type: 'lr:snapshotState', correlationId: corr }, '*')
  }))
  console.log('  snapshot:', JSON.stringify({
    studyUID: snap.studyUID, layout: snap.layout,
    voi: snap.viewportStates[0]?.runtime?.voiRange,
    bindings: snap.bindings.length,
  }))
  // Swap to MG
  await swapAndWait(page, STUDY_CT_B, STUDY_MG, 'jump to MG (forget state on purpose)')
  // Now swap back to CT-B WITH restore
  console.log('  Swapping back to CT-B with snapshot restore…')
  const restoreResult = await page.evaluate(async ({ uid, restore }) => {
    return new Promise((resolve) => {
      const corr = 'restore-' + Math.random().toString(36).slice(2)
      function listener(e) {
        const d = e.data
        if (!d || d.source !== 'linkrad-iframe' || d.correlationId !== corr) return
        if (d.type === 'lr:loadStudy:done' || d.type === 'lr:loadStudy:error') {
          window.removeEventListener('message', listener)
          resolve(d)
        }
      }
      window.addEventListener('message', listener)
      window.postMessage({ source: 'linkrad-parent', type: 'lr:loadStudy',
                          studyUID: uid, restore: restore, correlationId: corr }, '*')
    })
  }, { uid: STUDY_CT_B, restore: snap })
  await sleep(1500)
  const afterRestore = await readState(page)
  const restoredVoi = afterRestore.firstVoi
  const restoredOk = restoredVoi && restoredVoi.lower < -500 && restoredVoi.upper < 0
  console.log('  Restore result:', JSON.stringify(restoreResult).slice(0, 100))
  console.log('  After-restore VOI:', JSON.stringify(restoredVoi), restoredOk ? '✓ restored lung W/L' : '⚠ not restored')
  results.push({ name: 'Snapshot + restore round-trip', ok: restoredOk, ms: 0,
                 reason: restoredOk ? '' : ('VOI not restored: ' + JSON.stringify(restoredVoi)) })

  // ── Scenario 3: state bleed — back to CT, mutate W/L + layout, swap to MR ──
  console.log('\n--- Scenario 3: state-bleed check (mutate W/L + layout, then swap) ---')
  // Reset to a CT first
  await swapAndWait(page, STUDY_MG, STUDY_CT_A, 'Scenario 3a: back to CT-A')
  // Mutate W/L on first viewport + change layout to 2×1
  console.log('  Mutating: W/L 800/-600 (lung) on viewport 0, layout → 2×1')
  await page.evaluate(() => {
    const renderers = window.cornerstone.getRenderingEngines()
    const vps = renderers[0].getViewports()
    if (vps[0] && vps[0].setProperties) {
      vps[0].setProperties({ voiRange: { lower: -1000, upper: -200 } })
      vps[0].render()
    }
    // setViewportGridLayout lives in the DEFAULT context, not CORNERSTONE.
    // Matches what the LinkRad sidebar's setMammoHanging uses.
    window.commandsManager.run({
      commandName: 'setViewportGridLayout',
      commandOptions: { numRows: 2, numCols: 1 },
      context: 'DEFAULT',
    })
  })
  await sleep(1500)
  const mutated = await readState(page)
  console.log('  After mutation:', JSON.stringify({ layout: mutated.layout, voi: mutated.firstVoi }))

  // Now swap to MR — does layout reset? Does VOI bleed?
  const bleedResult = await swapAndWait(page, STUDY_CT_A, STUDY_MR, 'Scenario 3b: swap CT-A (2×1, lung W/L) → MR')
  // Did the layout reset to 1×1 (clean) or stay 2×1 (bled)?
  // Did the VOI come from MR's default or carry CT lung W/L?
  const bleedAnalysis = {
    layoutBled: bleedResult.last?.layout?.rows === 2 && bleedResult.last?.layout?.cols === 1,
    voiInLungRange: bleedResult.last?.firstVoi?.lower < -500,
  }
  console.log('  Analysis:')
  console.log(`    Layout bled (still 2×1):     ${bleedAnalysis.layoutBled ? '⚠ YES — HP did not reset layout' : '✓ NO — layout reset by HP'}`)
  console.log(`    VOI bled (still lung range): ${bleedAnalysis.voiInLungRange ? '⚠ YES — W/L survived swap' : '✓ NO — fresh VOI from MR'}`)
  results.push({ name: 'State bleed', ...bleedResult, bleedAnalysis })

  // ── Verdict ─────────────────────────────────────────────────────────────────
  console.log('\n=========================================')
  console.log('SPIKE RESULTS')
  console.log('=========================================')
  results.forEach(r => {
    const flag = r.ok ? '✅' : '❌'
    console.log(`${flag} ${r.name}: ${r.ok ? `swapped in ${r.ms}ms` : r.reason}`)
  })
  if (results[results.length - 1].bleedAnalysis) {
    const b = results[results.length - 1].bleedAnalysis
    console.log(`\nState-bleed flags: layout=${b.layoutBled ? 'BLED' : 'clean'}, VOI=${b.voiInLungRange ? 'BLED' : 'clean'}`)
  }
  console.log('=========================================')

  console.log('\nLeaving browser open for 6s…')
  await sleep(6000)
  await browser.close()
  const anyFailed = results.some(r => !r.ok)
  process.exit(anyFailed ? 1 : 0)
}

main().catch((err) => {
  console.error('Spike runner crashed:', err)
  process.exit(2)
})
