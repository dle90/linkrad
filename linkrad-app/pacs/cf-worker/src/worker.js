/**
 * LinkRad PACS edge cache — Cloudflare Worker
 *
 * Sits in front of the Railway-hosted Orthanc (Singapore) and caches immutable
 * DICOM bytes at Cloudflare PoPs. VN clients hit the HCM/HAN PoP at local-ISP
 * bandwidth instead of paying VN<->SG RTT + bandwidth on every frame.
 *
 * Caching policy:
 *   - CACHE  GET /wado/studies/<UID>/series/<UID>/instances/<UID>
 *            GET .../instances/<UID>/frames/<N>
 *            SOPInstanceUIDs are immutable by DICOM spec — pixel data and
 *            per-instance metadata never change once Orthanc holds the
 *            instance, so a 1-year immutable TTL is safe.
 *   - BYPASS GET /wado/studies?...          (QIDO — result set changes as
 *            GET .../studies/<UID>/metadata  studies/series are added)
 *            GET .../series/<UID>/metadata
 *   - BYPASS every non-GET (Orthanc hard-delete DELETE must reach origin).
 *
 * Response is decorated with CORS + CORP headers so the OHIF page (a
 * different origin, loaded under COEP: require-corp) can fetch cross-origin.
 * X-LR-Cache: HIT | MISS | BYPASS is added for probing/observability.
 */

// Matches /wado/studies/<UID>/series/<UID>/instances/<UID> and the
// multi-frame variant .../instances/<UID>/frames/<N>. Mirrors the regex
// location in ohif-nginx.conf so cache scope stays identical to nginx's.
const IMMUTABLE_RE =
  /^\/wado\/studies\/[^/]+\/series\/[^/]+\/instances\/[^/]+(?:\/frames\/[^/]+)?\/?$/;

const IMMUTABLE_TTL = 'public, max-age=31536000, immutable';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
    'Access-Control-Expose-Headers': '*',
    // COEP: require-corp on the OHIF page demands this on every subresource.
    'Cross-Origin-Resource-Policy': 'cross-origin',
  };
}

/**
 * Overwrite CORS/CORP headers (delete-then-set so we never emit a duplicate
 * header alongside the one the origin nginx already adds) and tag cache state.
 */
function decorate(resp, cacheState) {
  const h = new Headers(resp.headers);
  for (const [k, v] of Object.entries(corsHeaders())) {
    h.delete(k);
    h.set(k, v);
  }
  h.set('X-LR-Cache', cacheState);
  return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: h });
}

/**
 * Build a minimal forward-header set. Critically we DROP the inbound Host
 * header — Railway routes by Host, so forwarding `pacs.creanova.tech` would
 * loop the edge router. fetch() derives the correct Host from the target URL.
 */
function forwardHeaders(request) {
  const h = new Headers();
  const accept = request.headers.get('Accept');
  if (accept) h.set('Accept', accept);
  const enc = request.headers.get('Accept-Encoding');
  if (enc) h.set('Accept-Encoding', enc);
  const range = request.headers.get('Range');
  if (range) h.set('Range', range);
  return h;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = (env.ORIGIN || '').replace(/\/$/, '');
    if (!origin) {
      return new Response('ORIGIN not configured', { status: 500 });
    }
    const originUrl = origin + url.pathname + url.search;

    // CORS preflight — answer at the edge, never round-trip to origin.
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const cacheable =
      request.method === 'GET' && IMMUTABLE_RE.test(url.pathname);

    // Pass-through: QIDO, metadata, and every non-GET method.
    if (!cacheable) {
      const resp = await fetch(originUrl, {
        method: request.method,
        headers: forwardHeaders(request),
        body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      });
      return decorate(resp, 'BYPASS');
    }

    // Immutable resource — PoP-local cache, keyed by the origin URL so the
    // key is stable regardless of which custom domain fronts the Worker.
    const cache = caches.default;
    const cacheKey = new Request(originUrl, { method: 'GET' });

    const hit = await cache.match(cacheKey);
    if (hit) {
      return decorate(hit, 'HIT');
    }

    const originResp = await fetch(originUrl, {
      method: 'GET',
      headers: forwardHeaders(request),
    });

    // Only cache a clean success. Errors/redirects fall through uncached so a
    // transient origin blip never gets pinned for a year.
    if (originResp.status === 200) {
      const h = new Headers(originResp.headers);
      h.set('Cache-Control', IMMUTABLE_TTL);
      h.delete('Set-Cookie');
      const stored = new Response(originResp.body, {
        status: 200,
        statusText: originResp.statusText,
        headers: h,
      });
      ctx.waitUntil(cache.put(cacheKey, stored.clone()));
      return decorate(stored, 'MISS');
    }

    return decorate(originResp, 'MISS');
  },
};
