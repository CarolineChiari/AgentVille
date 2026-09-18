// The whole HTTP API as one connect-style middleware: mounted inside Vite in dev and inside
// server/index.mjs in production.
import { DEFAULT_DATA_DIR } from './paths.mjs'
import { ConflictError, createStateStore } from './state.mjs'
import { createOpener, resolveFolder } from './opener.mjs'
import { HARNESSES, harnessById } from './harnesses/index.mjs'
import { defaultHarness, harnessStatus, scanAll } from './scan.mjs'
import { createIssueStore, createPrStore } from './github.mjs'
import { openInTerminal } from './terminal.mjs'

const MAX_BODY = 4 * 1024 * 1024
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

/** Hostname out of a `Host` header or an `Origin` URL; '' when unparsable. */
export function hostnameOf(value, isOrigin = false) {
  if (typeof value !== 'string' || !value) return ''
  try {
    return new URL(isOrigin ? value : `http://${value}`).hostname.toLowerCase()
  } catch {
    return ''
  }
}

/**
 * Binding to loopback is not enough on its own.
 * - Host: a domain an attacker controls can resolve to 127.0.0.1 (DNS rebinding) and reach
 *   us as a same-origin page, but it still arrives with `Host: their-domain`.
 * - Origin: a cross-site `fetch` with a text/plain body is not preflighted, so any open page
 *   could POST here. Browsers always send Origin on POST/PUT, so a missing one is refused too.
 */
export function isLocalRequest(req, extraHosts = new Set()) {
  const allowed = (h) => LOCAL_HOSTS.has(h) || extraHosts.has(h)
  if (!allowed(hostnameOf(req.headers.host))) return false
  const method = (req.method || 'GET').toUpperCase()
  if (method === 'GET' || method === 'HEAD') return true
  return allowed(hostnameOf(req.headers.origin, true))
}

function send(res, status, body) {
  const text = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(text)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('Body too large'), { status: 413 }))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => {
      if (!chunks.length) return resolve({})
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(Object.assign(new Error('Body is not JSON'), { status: 400 }))
      }
    })
    req.on('error', reject)
  })
}

/** Every string inside `ref`, so an archive recorded under one id survives the thread re-keying. */
function refStrings(ref) {
  const out = []
  const walk = (v) => {
    if (typeof v === 'string') out.push(v)
    else if (Array.isArray(v)) v.forEach(walk)
    else if (v && typeof v === 'object') Object.values(v).forEach(walk)
  }
  walk(ref)
  return out
}

/**
 * @param {{ dataDir?: string, harnesses?: object[], opener?: object, stateStore?: object }} [opts]
 */
export function createApiMiddleware(opts = {}) {
  const harnesses = opts.harnesses ?? HARNESSES
  const store = opts.stateStore ?? createStateStore(opts.dataDir ?? DEFAULT_DATA_DIR)
  const opener = opts.opener ?? createOpener()
  const terminal = opts.terminal ?? ((spec) => openInTerminal(spec, { dataDir: opts.dataDir ?? DEFAULT_DATA_DIR }))
  const extraHosts = new Set(opts.extraHosts ?? [])
  const prStore = opts.prStore ?? createPrStore({ dataDir: opts.dataDir ?? DEFAULT_DATA_DIR })
  const issueStore = opts.issueStore ?? createIssueStore({ dataDir: opts.dataDir ?? DEFAULT_DATA_DIR })
  // Repo name → folder, from the latest scan: the PR and issue lookups read each folder's git remote.
  let projects = new Map()
  const remember = (threads) => {
    projects = new Map()
    for (const t of threads) if (t.project && t.projectPath && !projects.has(t.project)) projects.set(t.project, t.projectPath)
  }
  const projectList = async () => {
    if (!projects.size) remember((await scanAll({ harnesses })).threads)
    return [...projects].map(([name, dir]) => ({ name, path: dir }))
  }

  // An adapter may hand back several URLs to open in order (folder first, then session), or a
  // terminal window to run a command in.
  const launch = async (result) => {
    if (result.terminal) return terminal(result.terminal)
    return Array.isArray(result.urls) && result.urls.length > 1 && opener.launchAll
      ? opener.launchAll(result.urls)
      : opener.launch(result.urls?.[0] ?? result.url)
  }

  /** Start `h` in `dir`, on the asked-for target only if this harness offers it on this machine right now. */
  const startIn = async (h, dir, { target: asked, prompt = '', model = '', effort = '' }) => {
    const offered = h.targets ? (await h.targets()).map((t) => t.id) : []
    const target = typeof asked === 'string' && offered.includes(asked) ? asked : offered[0]
    if (!target) return [400, { ok: false, error: `${h.name} has no way to start a session on this machine.` }]
    const result = await h.newSession(dir, { target, prompt, model, effort })
    if (!result?.ok) return [400, { ok: false, error: result?.error || 'Cannot start a session here.' }]
    const launched = await launch(result)
    if (!launched.ok) return [500, { ok: false, error: launched.error }]
    // A terminal knows whether the prompt made it (Windows can't take one); otherwise the adapter says.
    const promptPassed = result.terminal ? Boolean(launched.promptPassed) : Boolean(result.promptPassed)
    return [200, { ok: true, url: result.url, where: result.where || '', promptPassed }]
  }

  const routes = {
    'GET /api/threads': async () => {
      const [{ threads, warnings }, state] = await Promise.all([scanAll({ harnesses }), store.read()])
      remember(threads)
      const archived = new Set(state.archived)
      for (const t of threads) {
        if (!t.archived && (archived.has(t.id) || refStrings(t.ref).some((s) => archived.has(`${t.harness}:${s}`)))) {
          t.archivedHere = true
        }
      }
      return [200, { threads, scannedAt: Date.now(), warnings }]
    },

    'GET /api/harnesses': async () => [200, { harnesses: await harnessStatus({ harnesses }), platform: opener.platform }],

    'GET /api/state': async () => [200, await store.read()],

    'PUT /api/state': async (body) => {
      const { baseUpdatedAt, ...next } = body || {}
      try {
        return [200, await store.write(next, { baseUpdatedAt })]
      } catch (err) {
        if (err instanceof ConflictError) return [409, err.current]
        throw err
      }
    },

    'POST /api/open': async (body) => {
      const h = harnessById(body?.harness, harnesses)
      if (!h) return [400, { ok: false, error: 'Unknown harness.' }]
      const target = body?.target === 'vscode' ? 'vscode' : 'app'
      const result = await h.openThread(body?.ref, { target })
      if (!result?.ok) return [400, { ok: false, error: result?.error || 'Cannot open this thread.' }]
      const launched = await launch(result)
      if (!launched.ok) return [500, { ok: false, error: launched.error }]
      return [200, { ok: true, url: result.url, where: result.where || '', note: result.note }]
    },

    'POST /api/new-session': async (body) => {
      const dir = await resolveFolder(body?.folder)
      if (!dir) return [400, { ok: false, error: 'That folder no longer exists.' }]
      const h = body?.harness ? harnessById(body.harness, harnesses) : await defaultHarness({ harnesses })
      if (!h) return [400, { ok: false, error: 'No harness to start a session with.' }]
      const str = (v) => (typeof v === 'string' ? v : '')
      return startIn(h, dir, { target: body?.target, prompt: str(body?.prompt), model: str(body?.model), effort: str(body?.effort) })
    },

    /**
     * A task for an existing thread: into the thread itself where its harness can resume it with a
     * prompt, else as a new session in the thread's folder. `continued` says which happened.
     */
    'POST /api/task': async (body) => {
      const h = harnessById(body?.harness, harnesses)
      if (!h) return [400, { ok: false, error: 'Unknown harness.' }]
      const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''
      if (!prompt) return [400, { ok: false, error: 'Nothing to send.' }]
      if (h.continueThread) {
        const result = await h.continueThread(body?.ref, { prompt })
        if (result?.ok) {
          const launched = await launch(result)
          if (!launched.ok) return [500, { ok: false, error: launched.error }]
          return [200, { ok: true, continued: true, where: result.where || '', promptPassed: result.terminal ? Boolean(launched.promptPassed) : Boolean(result.promptPassed) }]
        }
      }
      const dir = await resolveFolder(body?.folder)
      if (!dir) return [400, { ok: false, error: 'That folder no longer exists.' }]
      const [status, out] = await startIn(h, dir, { target: body?.target, prompt })
      return [status, { ...out, continued: false }]
    },

    /** POST although it only reads: a transcript is private, and POST makes the page's Origin mandatory. */
    'POST /api/transcript': async (body) => {
      const h = harnessById(body?.harness, harnesses)
      if (!h?.readTranscript) return [400, { ok: false, error: 'This harness has no transcripts to show.' }]
      const r = await h.readTranscript(body?.ref, { limit: body?.limit })
      return [r.ok ? 200 : 404, r]
    },

    'GET /api/prs': async () => [200, await prStore.get(await projectList())],

    'GET /api/issues': async () => [200, await issueStore.get(await projectList())],

    /** Only GitHub pages, over https: this endpoint exists to open a PR or an issue, not arbitrary links. */
    'POST /api/open-url': async (body) => {
      let u
      try {
        u = new URL(String(body?.url || ''))
      } catch {
        return [400, { ok: false, error: 'Not a URL.' }]
      }
      if (u.protocol !== 'https:' || u.hostname !== 'github.com') return [400, { ok: false, error: 'Only GitHub links can be opened.' }]
      const launched = opener.launch(u.href)
      return launched.ok ? [200, { ok: true }] : [500, launched]
    },

    'POST /api/reveal': async (body) => {
      const dir = await resolveFolder(body?.folder)
      if (!dir) return [400, { ok: false, error: 'That folder no longer exists.' }]
      const launched = opener.reveal(dir)
      return launched.ok ? [200, { ok: true }] : [500, launched]
    },
  }

  return async function apiMiddleware(req, res, next) {
    const url = new URL(req.url || '/', 'http://local')
    if (!url.pathname.startsWith('/api/')) return next ? next() : send(res, 404, { error: 'Not found' })
    if (!isLocalRequest(req, extraHosts)) {
      return send(res, 403, { error: 'AgentVille only answers its own page on this machine.' })
    }
    const handler = routes[`${(req.method || 'GET').toUpperCase()} ${url.pathname}`]
    if (!handler) return send(res, 404, { error: 'Not found' })
    try {
      const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req)
      const [status, payload] = await handler(body)
      send(res, status, payload)
    } catch (err) {
      send(res, err?.status || 500, { error: String(err?.message || err) })
    }
  }
}
