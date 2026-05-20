/**
 * PACS edge-cache warmer — client-side (speedup plan #6, "Path 1").
 *
 * Walks today's Ca Đọc worklist in the background and fetches every DICOM
 * frame through the Cloudflare Worker, so the Vietnam CF PoP is pre-populated.
 * The first doctor to open the worklist each day warms the cache for everyone:
 * subsequent viewers — and re-reads / QA — then hit X-LR-Cache:HIT and load
 * ~20x faster (8.4MB frame: 4.3s -> 0.2s).
 *
 * Runs entirely in the doctor's browser, which is in Vietnam, so it warms the
 * exact PoP the doctors hit — no server infrastructure. Self-throttling:
 *   - one study at a time, frames fetched at low priority, capped concurrency
 *   - a per-session byte budget so it never pre-downloads the whole day
 *   - pauses while a case is open (real reads own the bandwidth) or tab hidden
 *   - probes frame 0 per study; skips studies already warmed by someone else
 *
 * KNOWN v1 limitation: a study interrupted mid-warm is re-warmed in full next
 * pass (frame 0 re-fetched as a fast HIT) — tracked via the `partial` set so
 * it is never falsely skipped. Acceptable; see speedup memory for the rest.
 */

// MUST match wadoRoot in linkrad-app/pacs/ohif/ohif-config.js.
const WADO_BASE = 'https://linkrad-pacs-cache.linkrad.workers.dev/wado'
// Accept header OHIF's wadors loader uses for frames — keep identical so the
// Worker (cache key = URL only) stores exactly what OHIF will later request.
const FRAME_ACCEPT = 'multipart/related; type="application/octet-stream"'

const BYTE_BUDGET = 2 * 1024 * 1024 * 1024 // 2 GB per session — tunable
const FRAME_CONCURRENCY = 4                // parallel frame fetches per study
const START_DELAY_MS = 4000                // let OHIF boot before warming

const warmed = new Set()  // studyUIDs fully warmed (or confirmed warm) this session
const partial = new Set() // studyUIDs that started warming but were interrupted
const queue = []          // studyUIDs waiting to be warmed, worklist order
let running = false
let paused = false
let bytesWarmed = 0
let abort = null          // AbortController for the study currently warming
let startTimer = null

const log = (...a) => { try { console.log('[pacsWarmer]', ...a) } catch {} }
const canRun = () =>
  !paused && bytesWarmed < BYTE_BUDGET &&
  (typeof document === 'undefined' || document.visibilityState !== 'hidden')

// Pull one DICOM JSON value: obj['0020000E'].Value[0]
const tagValue = (obj, tag) => obj && obj[tag] && obj[tag].Value && obj[tag].Value[0]

// Enumerate every frame URL of a study from its WADO-RS metadata.
async function frameUrls (studyUID) {
  const r = await fetch(
    `${WADO_BASE}/studies/${encodeURIComponent(studyUID)}/metadata`,
    { headers: { Accept: 'application/dicom+json' }, signal: abort.signal })
  if (!r.ok) throw new Error('metadata HTTP ' + r.status)
  const instances = await r.json()
  const urls = []
  for (const inst of instances) {
    const series = tagValue(inst, '0020000E') // SeriesInstanceUID
    const sop = tagValue(inst, '00080018')    // SOPInstanceUID
    if (!series || !sop) continue
    const frames = parseInt(tagValue(inst, '00280008'), 10) || 1 // NumberOfFrames
    const base = `${WADO_BASE}/studies/${encodeURIComponent(studyUID)}` +
      `/series/${encodeURIComponent(series)}/instances/${encodeURIComponent(sop)}/frames/`
    for (let f = 1; f <= frames; f++) urls.push(base + f)
  }
  return urls
}

// Fetch one frame through the Worker (which caches it). Returns its cache state.
async function warmFrame (url) {
  const r = await fetch(url, {
    headers: { Accept: FRAME_ACCEPT },
    signal: abort.signal,
    priority: 'low', // ignored by browsers that don't support it
  })
  const buf = await r.arrayBuffer() // read fully so the transfer completes
  bytesWarmed += buf.byteLength
  return r.headers.get('x-lr-cache') || '-'
}

async function warmStudy (studyUID) {
  const urls = await frameUrls(studyUID)
  if (!urls.length) return
  const forceFull = partial.has(studyUID)
  // Frame 0 doubles as a probe: if it's already a HIT (and this study wasn't
  // interrupted earlier), someone has warmed it — skip the rest.
  const first = await warmFrame(urls[0])
  if (!forceFull && first === 'HIT') { log('skip (already warm):', studyUID); return }
  partial.add(studyUID)
  let next = 1
  const worker = async () => {
    while (next < urls.length) {
      if (!canRun()) return
      const idx = next++
      try { await warmFrame(urls[idx]) }
      catch (e) { if (e.name === 'AbortError') return; /* else skip frame */ }
    }
  }
  await Promise.all(Array.from({ length: FRAME_CONCURRENCY }, worker))
  if (next >= urls.length) {
    partial.delete(studyUID)
    log('warmed', studyUID, '—', urls.length, 'frames,',
      (bytesWarmed / 1048576).toFixed(0), 'MB session total')
  }
}

async function run () {
  if (running) return
  running = true
  try {
    while (queue.length && canRun()) {
      const studyUID = queue.shift()
      if (!studyUID || warmed.has(studyUID)) continue
      abort = new AbortController()
      try {
        await warmStudy(studyUID)
        if (!partial.has(studyUID)) warmed.add(studyUID)
      } catch (e) {
        if (e.name !== 'AbortError') log('failed', studyUID, e.message)
        // interrupted study stays out of `warmed`; next load() re-queues it
      }
    }
    if (bytesWarmed >= BYTE_BUDGET) log('byte budget reached — warming stopped')
  } finally {
    running = false
  }
}

/**
 * Queue today's worklist study UIDs for background warming (worklist order =
 * priority). Safe to call repeatedly — already-warmed/queued UIDs are skipped.
 */
export function warmWorklist (studyUIDs) {
  for (const u of studyUIDs || []) {
    if (u && !warmed.has(u) && !queue.includes(u)) queue.push(u)
  }
  if (running || paused || !queue.length || startTimer) return
  startTimer = setTimeout(() => { startTimer = null; run() }, START_DELAY_MS)
}

/** Pause warming and abort the in-flight study — call when a case is opened. */
export function pauseWarming () {
  paused = true
  if (abort) { try { abort.abort() } catch {} }
}

/** Resume warming — call when the doctor returns to the worklist. */
export function resumeWarming () {
  if (!paused) return
  paused = false
  if (queue.length && !running) run()
}

// Resume automatically when the tab regains focus.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !paused && !running && queue.length) run()
  })
}
