// Parent ↔ OHIF iframe protocol helpers.
// The OHIF iframe runs linkrad-toolbar.js which listens for lr:* messages
// and replies with correlationId-tagged responses. Same protocol works for
// the docked iframe (contentWindow) and the undocked window (window.open
// reference), so callers pass whichever target they own.
//
// All postX() helpers return a Promise that resolves on the matching reply
// or rejects on timeout / error reply.

const DEFAULT_TIMEOUT_MS = 20000

function nextCorrelationId (prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function sendAndWait (target, message, replyTypes, timeoutMs) {
  if (!target || typeof target.postMessage !== 'function') {
    return Promise.reject(new Error('ohifProtocol: invalid target'))
  }
  const corr = message.correlationId || nextCorrelationId(message.type || 'lr')
  const fullMsg = { ...message, source: 'linkrad-parent', correlationId: corr }
  const expect = Array.isArray(replyTypes) ? replyTypes : [replyTypes]

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(`ohifProtocol: ${message.type} timed out after ${timeoutMs}ms`))
    }, timeoutMs ?? DEFAULT_TIMEOUT_MS)

    function onMessage (e) {
      const d = e.data
      if (!d || d.source !== 'linkrad-iframe') return
      if (d.correlationId !== corr) return
      if (!expect.includes(d.type)) return
      cleanup()
      if (d.type.endsWith(':error')) reject(new Error(d.error || message.type + ' failed'))
      else resolve(d)
    }
    function cleanup () {
      clearTimeout(timer)
      window.removeEventListener('message', onMessage)
    }
    window.addEventListener('message', onMessage)
    target.postMessage(fullMsg, '*')
  })
}

export function postLoadStudy (target, studyUID, restore = null, opts = {}) {
  return sendAndWait(
    target,
    { type: 'lr:loadStudy', studyUID, restore },
    ['lr:loadStudy:done', 'lr:loadStudy:error'],
    opts.timeoutMs,
  )
}

export function postSnapshotState (target, opts = {}) {
  return sendAndWait(
    target,
    { type: 'lr:snapshotState' },
    'lr:snapshotState:result',
    opts.timeoutMs ?? 8000,
  ).then((r) => r.state)
}

// Fire-and-forget — purging is best-effort and the parent doesn't block on it.
export function postPurgeStudy (target, studyUID) {
  try {
    target.postMessage({ source: 'linkrad-parent', type: 'lr:purgeStudy', studyUID }, '*')
  } catch {}
}

// Fire-and-forget — tells the iframe to warm Orthanc + R2 caches for a study
// the user has shown intent to open (e.g. clicked in the worklist). The iframe
// issues background QIDO/metadata fetches; subsequent loadStudy then hits the
// browser HTTP cache + warm Orthanc cache and renders much faster.
export function postPrefetchStudy (target, studyUID) {
  if (!target || !studyUID) return
  try {
    target.postMessage({ source: 'linkrad-parent', type: 'lr:prefetch', studyUID }, '*')
  } catch {}
}

// Legacy "tab-activated" ping kept for compat with the layout watchdog.
export function postTabActivated (target) {
  try {
    target.postMessage({ source: 'linkrad-parent', type: 'tab-activated' }, '*')
  } catch {}
}
