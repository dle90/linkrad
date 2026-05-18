import React, { useState, useEffect, useRef, useCallback } from 'react'
import api from '../api'
import { useTeleradTabs, SYS_WORKLIST } from '../context/TeleradTabsContext'
import { postLoadStudy, postSnapshotState, postPurgeStudy, postPrefetchStudy } from '../lib/ohifProtocol'

// Single OHIF iframe that lives at App level so the doctor pays the cold-start
// cost exactly once per session. The Teleradiology page publishes its desired
// viewer rect into TeleradTabsContext.viewerSlotRect; this component pins the
// iframe over that rect via position:fixed. When there is no rect (user
// navigated to /inventory etc.) the iframe is parked off-screen but stays
// mounted, so coming back to /teleradiology is instant.
//
// Tab-switch flow inside Teleradiology:
//   1. snapshotState(prevCase) → cache the prev viewport state
//   2. loadStudy(nextCase, restore?) → swap study inside the iframe
//   3. (case closed) purgeStudy(closedCase) → free volume cache
//
// Spike proved this works: scripts/spike-study-swap.js round-trips snapshot +
// restore in ~600ms with no React tree remount.

export default function PersistentOHIFHost () {
  const { openCases, activeCaseId, viewerSlotRect, prefetchRef } = useTeleradTabs()
  const [iframeSrc, setIframeSrc] = useState(null)
  const [iframeReady, setIframeReady] = useState(false)

  const iframeRef = useRef(null)
  const queueRef = useRef(Promise.resolve())
  const prevActiveRef = useRef(SYS_WORKLIST)
  const prevOpenCasesRef = useRef([])
  const viewerStatesRef = useRef(new Map())   // caseId -> snapshot
  const currentStudyUIDRef = useRef(null)

  // Listen for the iframe's emits: lr:ready (one-shot) and lr:api (RPC for
  // the iframe to call HIS-RIS API endpoints through the parent's auth
  // session — used by Key Image flagging, soft-hide, hard-delete, etc.)
  useEffect(() => {
    function onMsg (e) {
      const d = e.data
      if (!d || d.source !== 'linkrad-iframe') return
      if (d.type === 'lr:ready') {
        console.log('[OHIFHost] iframe lr:ready')
        setIframeReady(true)
        return
      }
      if (d.type === 'lr:download') {
        // Iframe asked us to trigger an authenticated download. We can't use
        // a bare <a download> because LinkRad auth is bearer-token in
        // localStorage — anchor navigation skips axios interceptors so the
        // server returns 401. Instead: fetch the bytes via api (bearer
        // injected), then create an Object URL and click a synthetic anchor.
        ;(async () => {
          try {
            // Strip the /api prefix; api instance prepends it.
            const path = String(d.url || '').replace(/^\/api/, '')
            const r = await api.get(path, { responseType: 'blob' })
            const blobUrl = URL.createObjectURL(r.data)
            const a = document.createElement('a')
            a.href = blobUrl
            if (d.filename) a.download = d.filename
            a.style.display = 'none'
            document.body.appendChild(a)
            a.click()
            setTimeout(() => { try { a.remove(); URL.revokeObjectURL(blobUrl) } catch {} }, 5000)
          } catch (err) {
            console.warn('[OHIFHost] download failed', err)
            alert('Tải về thất bại: ' + (err?.response?.data?.error || err.message))
          }
        })()
        return
      }
      if (d.type === 'lr:api') {
        const corr = d.correlationId
        const target = iframeRef.current?.contentWindow
        const reply = (payload) => {
          try { target && target.postMessage({ source: 'linkrad-parent', type: 'lr:api:result', correlationId: corr, ...payload }, '*') } catch {}
        }
        ;(async () => {
          try {
            const method = (d.method || 'GET').toUpperCase()
            const url    = d.path // e.g. '/ris/key-images', '/ris/studies/abc/hide'
            const opts = { method }
            if (d.body !== undefined) opts.data = d.body
            const r = await api.request({ url, ...opts })
            reply({ ok: true, status: r.status, data: r.data })
          } catch (err) {
            reply({ ok: false, status: err?.response?.status || 0, error: err?.response?.data?.error || err.message })
          }
        })()
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  const target = useCallback(() => iframeRef.current?.contentWindow || null, [])

  const enqueue = useCallback((fn) => {
    queueRef.current = queueRef.current.then(fn).catch(err => {
      console.warn('[OHIFHost] op failed', err)
    })
    return queueRef.current
  }, [])

  // Publish a debounced prefetch fn into the context so Teleradiology can
  // call it from its onSelect handler. Debounce prevents firing a network
  // burst when the user arrows quickly through the worklist; only fires
  // after they pause on a row for 300ms (typical "consider opening" intent).
  useEffect(() => {
    if (!prefetchRef) return
    let timer = null
    let lastUID = null
    prefetchRef.current = (studyUID) => {
      if (!studyUID || studyUID === lastUID) return
      if (studyUID === currentStudyUIDRef.current) return // already loaded
      lastUID = studyUID
      clearTimeout(timer)
      timer = setTimeout(() => {
        const t = target()
        if (t) postPrefetchStudy(t, studyUID)
      }, 300)
    }
    return () => {
      clearTimeout(timer)
      prefetchRef.current = null
    }
  }, [prefetchRef, target, iframeReady])

  // Lazy iframe-src mount on first real case
  useEffect(() => {
    if (iframeSrc) return
    if (openCases.length === 0) return
    const seed = openCases.find(c => c._id === activeCaseId) || openCases[0]
    if (!seed || !seed.studyUID) return
    let cancelled = false
    api.get(`/ris/orthanc/viewer-url/${encodeURIComponent(seed.studyUID)}`)
      .then(r => {
        if (cancelled) return
        if (r.data?.found === false) return
        currentStudyUIDRef.current = seed.studyUID
        prevActiveRef.current = seed._id
        setIframeSrc(r.data.url)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [openCases, activeCaseId, iframeSrc])

  // Snapshot + load on activeCaseId change (once iframe ready)
  useEffect(() => {
    if (!iframeReady) return
    const prev = prevActiveRef.current
    const next = activeCaseId
    if (prev === next) return
    prevActiveRef.current = next

    const prevCase = openCases.find(c => c._id === prev) || prevOpenCasesRef.current.find(c => c._id === prev)
    const nextCase = openCases.find(c => c._id === next)

    enqueue(async () => {
      const oldStudyUID = currentStudyUIDRef.current
      if (prevCase && prevCase.studyUID && oldStudyUID === prevCase.studyUID) {
        try {
          const snap = await postSnapshotState(target())
          if (snap) viewerStatesRef.current.set(prev, snap)
        } catch (err) { console.warn('[OHIFHost] snapshot failed', err) }
      }
      if (!nextCase || !nextCase.studyUID) return

      const restore = viewerStatesRef.current.get(next) || null
      try {
        await postLoadStudy(target(), nextCase.studyUID, restore)
        currentStudyUIDRef.current = nextCase.studyUID
        // Deferred purge: a study closed while it was the active study is
        // skipped by the purge effect (can't yank volumes from a viewport
        // that's still rendering them). Now that we've swapped to another
        // study, the old one is safe to free if no tab still references it.
        if (oldStudyUID && oldStudyUID !== nextCase.studyUID &&
            !openCases.some(c => c.studyUID === oldStudyUID)) {
          postPurgeStudy(target(), oldStudyUID)
        }
      } catch (err) { console.warn('[OHIFHost] load failed', err) }
    })
  }, [activeCaseId, openCases, iframeReady, enqueue, target])

  // Purge volumes + drop cached state when a case is closed
  useEffect(() => {
    const prev = prevOpenCasesRef.current
    const closed = prev.filter(p => !openCases.find(c => c._id === p._id))
    prevOpenCasesRef.current = openCases
    if (!closed.length || !iframeReady) return
    closed.forEach(c => {
      viewerStatesRef.current.delete(c._id)
      if (c.studyUID && c.studyUID !== currentStudyUIDRef.current) {
        postPurgeStudy(target(), c.studyUID)
      }
    })
  }, [openCases, iframeReady, target])

  if (!iframeSrc) return null

  // Visible iff we have a slot AND active case is a real case.
  // Otherwise the iframe stays mounted but parked off-screen.
  const visible = !!viewerSlotRect && openCases.some(c => c._id === activeCaseId)
  const style = visible ? {
    position: 'fixed',
    top: viewerSlotRect.top,
    left: viewerSlotRect.left,
    width: viewerSlotRect.width,
    height: viewerSlotRect.height,
    border: 0,
    zIndex: 5,
    background: '#0f1115',
  } : {
    position: 'fixed',
    top: 0, left: 0, width: 1, height: 1,
    border: 0,
    visibility: 'hidden',
    pointerEvents: 'none',
    zIndex: -1,
  }

  return (
    <iframe
      ref={iframeRef}
      src={iframeSrc}
      title="DICOM Viewer"
      allow="fullscreen; clipboard-read; clipboard-write; cross-origin-isolated"
      style={style}
    />
  )
}
