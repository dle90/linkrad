import { useState, useEffect } from 'react'

// Single source of truth for the mobile/desktop layout split. 767px is the top
// of Tailwind's `md` breakpoint, so JS-driven layout (the OHIF viewer slot, the
// sidebar drawer) stays in sync with class-driven `md:` utilities — a component
// that branches on this hook and a sibling that uses `md:` never disagree.
const MOBILE_QUERY = '(max-width: 767px)'

export default function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches
  )
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY)
    const onChange = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', onChange)
    // Re-sync in case the viewport changed between initial state and effect.
    setIsMobile(mq.matches)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return isMobile
}
