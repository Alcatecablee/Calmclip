// CalmClip Service Worker v4
// Strategies:
//   - Same-origin navigation : Network First -> cached -> offline.html
//   - Same-origin assets     : Stale-While-Revalidate  (injects COI headers)
//   - CDN WASM / model files : Cache First              (large, immutable)
//   - Share target POST      : Read form data, cache file blob, redirect to /
//   - Everything else        : Network only

const PRECACHE   = 'calmclip-pre-v4'
const RUNTIME    = 'calmclip-run-v4'
const CDN_CACHE  = 'calmclip-cdn-v4'
// Injected by scripts/update-sitemap.mjs on every production build.
const SITEMAP_LASTMOD = '2026-06-06'
const SHARE_CACHE = 'calmclip-share'
const ALL_CACHES = [PRECACHE, RUNTIME, CDN_CACHE]
// SHARE_CACHE is intentionally not in ALL_CACHES: its entries are short-lived
// and consumed by the page on next load. Excluding it prevents accidental purge
// of a pending share before the page has read it.
const OFFLINE    = '/offline.html'

// CDN origins for WASM/model assets. Use exact match or subdomain check to
// avoid matching look-alike hostnames (e.g. nothuggingface.co).
const CDN_ORIGINS = [
  'cdn.jsdelivr.net',
  'huggingface.co',
  'cdn-lfs.huggingface.co',
  'cdn-lfs-us-1.huggingface.co',
  'cdn-lfs-us-2.huggingface.co',
]

// Inject COOP/COEP headers only when they are absent.
// Re-wrapping response.body in a new Response is unnecessary when the server
// (e.g. Vercel via vercel.json headers) already sends these headers, and can
// fail with a TypeError in edge cases (locked stream, opaque response body).
// Skipping the wrap when headers are already present avoids those failures.
function withCOI(response) {
  if (!response || response.status === 0) return response
  if (response.headers.get('Cross-Origin-Opener-Policy') === 'same-origin') {
    // Headers already present; return as-is, no body re-wrap needed.
    return response
  }
  const h = new Headers(response.headers)
  h.set('Cross-Origin-Opener-Policy',   'same-origin')
  h.set('Cross-Origin-Embedder-Policy', 'credentialless')
  try {
    return new Response(response.body, {
      status:     response.status,
      statusText: response.statusText,
      headers:    h,
    })
  } catch {
    // Body could not be re-wrapped (e.g. already locked or opaque).
    // Return the original response so the page still loads.
    return response
  }
}

// Exact hostname match or .<origin> suffix to prevent substring collisions.
function isCDN(url) {
  return CDN_ORIGINS.some(o => url.hostname === o || url.hostname.endsWith('.' + o))
}

// ---------------------------------------------------------------------------
// Install: precache offline shell; skip waiting only on fresh install
// ---------------------------------------------------------------------------

self.addEventListener('install', event => {
  const isFresh = !self.registration.active
  event.waitUntil(
    caches.open(PRECACHE)
      .then(c => c.addAll([OFFLINE, '/manifest.json', '/icon-192.png', '/icon-512.png']))
      .then(() => {
        if (isFresh) return self.skipWaiting()
        return self.clients
          .matchAll({ includeUncontrolled: true })
          .then(clients => clients.forEach(c => c.postMessage({ type: 'SW_WAITING' })))
      })
  )
})

// ---------------------------------------------------------------------------
// Activate: purge stale caches, claim all clients, notify of update
// ---------------------------------------------------------------------------

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(k => !ALL_CACHES.includes(k) && k !== SHARE_CACHE)
            .map(k => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
      .then(() =>
        self.clients
          .matchAll({ includeUncontrolled: true })
          .then(clients => clients.forEach(c => c.postMessage({ type: 'SW_ACTIVATED' })))
      )
  )
})

// ---------------------------------------------------------------------------
// Message: allow clients to trigger skipWaiting on demand
// ---------------------------------------------------------------------------

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

// ---------------------------------------------------------------------------
// Fetch routing
// ---------------------------------------------------------------------------

self.addEventListener('fetch', event => {
  const req = event.request
  const url = new URL(req.url)
  if (!url.protocol.startsWith('http')) return

  // Share target: POST to /?share-target (declared in manifest share_target)
  if (req.method === 'POST' && url.searchParams.has('share-target')) {
    event.respondWith(handleShareTarget(req))
    return
  }

  if (req.method !== 'GET') return

  if (isCDN(url)) { event.respondWith(cdnCacheFirst(req)); return }
  if (url.origin !== self.location.origin) return
  if (url.pathname === '/sitemap.xml') { event.respondWith(sitemapWithLastModified(req)); return }
  if (req.mode === 'navigate') { event.respondWith(navigationFirst(req)); return }
  event.respondWith(staleWhileRevalidate(req))
})

// ---------------------------------------------------------------------------
// Share target: read video from POST body, cache blob, redirect to app
// ---------------------------------------------------------------------------

async function handleShareTarget(req) {
  try {
    const data  = await req.formData()
    const entry = data.get('video')
    if (entry instanceof File && entry.type.startsWith('video/')) {
      const cache = await caches.open(SHARE_CACHE)
      const resp  = new Response(await entry.arrayBuffer(), {
        headers: {
          'Content-Type': entry.type,
          'X-File-Name':  entry.name,
        },
      })
      await cache.put('/share-data', resp)
    }
  } catch (err) {
    console.error('[CalmClip SW] share target read failed:', err)
  }
  return Response.redirect('/?share-target', 303)
}

// ---------------------------------------------------------------------------
// Cache First: CDN (FFmpeg WASM, Whisper, onnxruntime)
// ---------------------------------------------------------------------------

async function cdnCacheFirst(req) {
  const cache  = await caches.open(CDN_CACHE)
  const cached = await cache.match(req)
  if (cached) return cached
  try {
    const res = await fetch(req)
    // Status 0 = opaque cross-origin response; cache it anyway
    if (res.status === 0 || res.status === 200) cache.put(req, res.clone()).catch(() => {})
    return res
  } catch (err) {
    console.error('[CalmClip SW] CDN fetch failed:', err)
    return Response.error()
  }
}

// ---------------------------------------------------------------------------
// Network First: navigation with offline fallback
// ---------------------------------------------------------------------------

async function navigationFirst(req) {
  const cache = await caches.open(RUNTIME)
  try {
    const res     = await fetch(req)
    // withCOI returns res unchanged if headers are already present.
    // Clone before handing to cache so both the browser and cache can read.
    const patched = withCOI(res)
    cache.put(req, patched.clone()).catch(() => {})
    return patched
  } catch (err) {
    console.error('[CalmClip SW] navigation fetch failed:', err)
    // ignoreSearch so /?source=pwa matches a cached / entry
    const cached  = await cache.match(req, { ignoreSearch: true })
    if (cached) return cached
    const offline = await caches.match(OFFLINE, { cacheName: PRECACHE })
    return offline ?? Response.error()
  }
}

// ---------------------------------------------------------------------------
// Sitemap: network fetch + inject Last-Modified header from build constant
// ---------------------------------------------------------------------------

async function sitemapWithLastModified(req) {
  const cache = await caches.open(RUNTIME)
  try {
    const res = await fetch(req)
    if (!res.ok) return res
    const h = new Headers(res.headers)
    h.set('Last-Modified', new Date(SITEMAP_LASTMOD + 'T00:00:00Z').toUTCString())
    const patched = new Response(res.body, { status: res.status, statusText: res.statusText, headers: h })
    cache.put(req, patched.clone()).catch(() => {})
    return patched
  } catch {
    const cached = await cache.match(req)
    return cached ?? Response.error()
  }
}

// ---------------------------------------------------------------------------
// Stale-While-Revalidate: same-origin assets
// ---------------------------------------------------------------------------

async function staleWhileRevalidate(req) {
  // Browsers sometimes issue 'only-if-cached' with mode != 'same-origin' which
  // throws when passed to fetch(). Pass it straight to the network instead.
  if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') {
    return fetch(req).catch(() => Response.error())
  }
  const cache  = await caches.open(RUNTIME)
  const cached = await cache.match(req)
  const networkPromise = fetch(req)
    .then(res => {
      if (res.status === 200) cache.put(req, withCOI(res.clone())).catch(() => {})
      return withCOI(res)
    })
    .catch(() => null)
  return cached ?? (await networkPromise) ?? Response.error()
}
