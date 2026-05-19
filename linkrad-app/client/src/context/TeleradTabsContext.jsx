import React, { createContext, useContext, useState, useCallback, useRef } from 'react'

// Open-case tabs for Ca đọc (Teleradiology). Lives at App level so tabs survive
// in-app route changes (e.g. bacsi clicks Đăng ký and comes back). Resets on
// full page refresh, which is fine — studies reload from the server anyway.
//
// Also owns:
//   - viewerSlotRect: where <PersistentOHIFHost>'s pinned iframe should sit,
//     published by Teleradiology via useLayoutEffect + ResizeObserver. Null
//     means "no slot active" (e.g. user is on /inventory) → iframe hides.
//   - undockedWindowRef: the open() handle for an undocked viewer window.
//     Subsequent "undock" actions reuse the same window via lr:loadStudy
//     instead of cold-starting a fresh OHIF — same one-cold-start-per-session
//     principle as the docked iframe.

const TeleradTabsContext = createContext(null)

export const SYS_WORKLIST = '__worklist__'

export function TeleradTabsProvider({ children }) {
  const [openCases, setOpenCases] = useState([])
  const [activeCaseId, setActiveCaseId] = useState(SYS_WORKLIST)
  const [viewerSlotRect, setViewerSlotRect] = useState(null)
  // undockedWindowRef.current === { win, caseId } | null
  const undockedRef = useRef(null)
  // Set by PersistentOHIFHost once the iframe is ready: a function that
  // posts lr:prefetch into the iframe to warm Orthanc + R2 + browser HTTP
  // caches for a study the user has shown intent to open (e.g. selected a
  // worklist row). Teleradiology calls prefetchStudy(studyUID); a no-op
  // until the iframe exists.
  const prefetchRef = useRef(null)
  const prefetchStudy = useCallback((studyUID) => {
    if (typeof prefetchRef.current === 'function') prefetchRef.current(studyUID)
  }, [])
  // Warm-up seed: Teleradiology publishes the first ready-to-read study UID
  // after loading the worklist. PersistentOHIFHost uses it to mount the
  // iframe early (parked off-screen) so the OHIF bundle is booted before the
  // doctor clicks "Mở ca". Cleared on logout/refresh — the iframe survives
  // route navigation regardless.
  const [warmupStudyUID, setWarmupStudyUID] = useState(null)

  const openCase = useCallback((study) => {
    setOpenCases(cs => cs.find(c => c._id === study._id) ? cs : [...cs, study])
    setActiveCaseId(study._id)
  }, [])

  const closeCase = useCallback((id) => {
    setOpenCases(cs => cs.filter(c => c._id !== id))
    setActiveCaseId(prev => prev === id ? SYS_WORKLIST : prev)
  }, [])

  // Refresh open tab data against a freshly-loaded study list (status may have
  // changed server-side while the user was away).
  const syncWithStudies = useCallback((studies) => {
    setOpenCases(cs => cs.map(c => studies.find(s => s._id === c._id) || c))
  }, [])

  return (
    <TeleradTabsContext.Provider value={{
      openCases, activeCaseId, setActiveCaseId, openCase, closeCase, syncWithStudies,
      viewerSlotRect, setViewerSlotRect,
      undockedRef,
      prefetchRef, prefetchStudy,
      warmupStudyUID, setWarmupStudyUID,
    }}>
      {children}
    </TeleradTabsContext.Provider>
  )
}

export function useTeleradTabs() {
  const ctx = useContext(TeleradTabsContext)
  if (!ctx) throw new Error('useTeleradTabs must be used inside TeleradTabsProvider')
  return ctx
}
