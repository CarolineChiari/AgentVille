// createServer(): the built app plus the API on one port. `serve.mjs` wraps it for the CLI;
// an Electron main process can import it the same way later.
import http from 'node:http'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { createApiMiddleware } from './api.mjs'
import { HEADERS } from './headers.mjs'
import { DEFAULT_DATA_DIR, DEFAULT_DIST_DIR } from './paths.mjs'

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

/** A request path resolved inside `root`, or null if it tries to climb out. */
export function resolveInside(root, urlPath) {
  let decoded
  try {
    decoded = decodeURIComponent(urlPath)
  } catch {
    return null
  }
  const full = path.resolve(root, '.' + path.posix.normalize('/' + decoded))
  const rel = path.relative(root, full)
  return rel.startsWith('..') || path.isAbsolute(rel) ? null : full
}

async function serveStatic(distDir, req, res) {
  const url = new URL(req.url || '/', 'http://local')
  let file = resolveInside(distDir, url.pathname)
  if (!file) {
    res.statusCode = 400
    return res.end()
  }
  try {
    if ((await fsp.stat(file)).isDirectory()) file = path.join(file, 'index.html')
  } catch {
    file = path.join(distDir, 'index.html') // SPA fallback
  }
  try {
    const body = await fsp.readFile(file)
    res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream')
    // Vite fingerprints everything under /assets/, so those can be cached forever.
    res.setHeader('Cache-Control', url.pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache')
    res.end(body)
  } catch {
    res.statusCode = 404
    res.end('Not built yet — run `npm run build`.')
  }
}

export function createServer({ port = 5274, host = '127.0.0.1', dataDir = DEFAULT_DATA_DIR, distDir = DEFAULT_DIST_DIR, log = console.log, ...apiOpts } = {}) {
  const api = createApiMiddleware({ dataDir, ...apiOpts })
  const server = http.createServer((req, res) => {
    for (const [name, value] of Object.entries(HEADERS)) res.setHeader(name, value)
    if ((req.url || '').startsWith('/api/')) return api(req, res, null)
    serveStatic(distDir, req, res)
  })
  const ready = new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => {
      const addr = server.address()
      const shown = host === '127.0.0.1' || host === '::1' ? 'localhost' : host
      const url = `http://${shown}:${addr.port}`
      log?.(`AgentVille on ${url}`)
      resolve(url)
    })
  })
  return { server, ready, close: () => new Promise((r) => server.close(() => r())) }
}
