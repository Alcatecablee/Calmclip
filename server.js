import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const DIST = join(__dirname, 'dist')
const PORT = parseInt(process.env.PORT ?? '5000', 10)

const MIME = {
  '.html':    'text/html; charset=utf-8',
  '.js':      'application/javascript',
  '.mjs':     'application/javascript',
  '.css':     'text/css',
  '.png':     'image/png',
  '.jpg':     'image/jpeg',
  '.jpeg':    'image/jpeg',
  '.webp':    'image/webp',
  '.svg':     'image/svg+xml',
  '.ico':     'image/x-icon',
  '.json':    'application/json',
  '.wasm':    'application/wasm',
  '.ttf':     'font/ttf',
  '.woff':    'font/woff',
  '.woff2':   'font/woff2',
  '.txt':     'text/plain; charset=utf-8',
  '.xml':     'application/xml',
  '.lottie':  'application/octet-stream',
}

const COI_HEADERS = {
  'Cross-Origin-Opener-Policy':   'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
}

const NO_CACHE = ['index.html', 'manifest.json', 'sw.js', 'robots.txt', 'sitemap.xml']

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost')
    let pathname = normalize(url.pathname).replace(/^(\.\.[/\\])+/, '')
    if (pathname === '/') pathname = '/index.html'

    let filePath = join(DIST, pathname)

    try {
      const s = await stat(filePath)
      if (s.isDirectory()) filePath = join(filePath, 'index.html')
    } catch {
      filePath = join(DIST, 'index.html')
    }

    const ext = extname(filePath).toLowerCase()
    const base = filePath.split('/').pop() ?? ''
    const immutable = ext !== '.html' && !NO_CACHE.includes(base)
    const contentType = MIME[ext] ?? 'application/octet-stream'
    const content = await readFile(filePath)

    res.writeHead(200, {
      'Content-Type':   contentType,
      'Content-Length': content.length,
      'Cache-Control':  immutable
        ? 'public, max-age=31536000, immutable'
        : 'no-cache, no-store, must-revalidate',
      ...COI_HEADERS,
    })
    res.end(content)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...COI_HEADERS })
    res.end('Not found')
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`CalmClip production server listening on port ${PORT}`)
})
