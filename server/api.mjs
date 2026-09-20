// The whole HTTP API as one connect-style middleware: mounted inside Vite in dev and inside
// server/index.mjs in production.
import path from 'node:path'
import { DEFAULT_DATA_DIR } from './paths.mjs'
import { ConflictError, createStateStore } from './state.mjs'
import { createOpener, realFileUnder, resolveFolder } from './opener.mjs'
import { HARNESSES, harnessById } from './harnesses/index.mjs'
import { defaultHarness, harnessStatus, scanAll } from './scan.mjs'
import { createIssueStore, createPrStore, createReleaseStore } from './github.mjs'
import { createRepoStore } from './repo.mjs'
import { openInTerminal } from './terminal.mjs'
import { FILE_URL_SCHEMES, fileUrl } from './harnesses/vscode-family.mjs'

const MAX_BODY = 4 * 1024 * 1024
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

/** Hostname out of a `Host` header; '' when unparsable. */
export function hostnameOf(value) {
  if (typeof value !== 'string' || !value) return ''
  try {
    return new URL(`http://${value}`).hostname.toLowerCase()
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
 *   It must be this very origin, port and all, not just a local one: any page on localhost
 *   would pass that, such as the dev server of a repo you just cloned.
 * - Content-Type: application/json makes a cross-origin request preflighted, and the preflight
 *   is never answered, so a browser doesn't send the request at all.
 */
export function isLocalRequest(req, extraHosts = new Set()) {
  const allowed = (h) => LOCAL_HOSTS.has(h) || extraHosts.has(h)
  if (!allowed(hostnameOf(req.headers.host))) return false
  const method = (req.method || 'GET').toUpperCase()
  if (method === 'GET' || method === 'HEAD') return true
  const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase()
  return type === 'application/json' && Boolean(req.headers.origin) && req.headers.origin === originOf(req.headers.host)
}

/** The origin a page served under this `Host` sends, written the way browsers write it. */
function originOf(host) {
  try {
    return new URL(`http://${host}`).origin
  } catch {
    return ''
  }
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
  const repoStore = opts.repoStore ?? createRepoStore({ dataDir: opts.dataDir ?? DEFAULT_DATA_DIR })
  const releaseStore = opts.releaseStore ?? createReleaseStore({ dataDir: opts.dataDir ?? DEFAULT_DATA_DIR })
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
      // Where the adapter gave several links, the last one is the one that opens the chat in
      // whichever window is up by then. `only: 'chat'` sends that one again and nothing else, for
      // when the window came up too late to catch it — the page offers it on the toast.
      const links = Array.isArray(result.urls) ? result.urls : []
      const again = links.length > 1
      const launched = again && body?.only === 'chat' ? await opener.launch(links.at(-1)) : await launch(result)
      if (!launched.ok) return [500, { ok: false, error: launched.error }]
      return [200, { ok: true, url: result.url, where: result.where || '', note: result.note, chatAgain: again }]
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

    /**
     * What a thread changed on disk, read from its own records. POST for the same reason as the
     * transcript: it is private, and POST makes the page's Origin mandatory.
     */
    'POST /api/changes': async (body) => {
      const h = harnessById(body?.harness, harnesses)
      if (!h?.readChanges) return [400, { ok: false, error: 'This agent doesn’t record what it changed.' }]
      // `path` asks for one file's own before-and-after text; the harness decides what that means.
      const wanted = typeof body?.path === 'string' ? body.path.slice(0, 400) : ''
      const r = await h.readChanges(body?.ref, { detail: body?.detail === true, path: wanted })
      return [r.ok ? 200 : 404, r]
    },

    /**
     * One file of a repo, in the editor. The page names a folder and a path *inside* it, never a
     * path of its own choosing: the folder must still exist, the file must resolve under it, and
     * the link is built here from the resolved path. Nothing is executed — the OS resolves the URL.
     */
    'POST /api/open-file': async (body) => {
      const dir = await resolveFolder(body?.folder)
      if (!dir) return [400, { ok: false, error: 'That folder no longer exists.' }]
      const rel = typeof body?.path === 'string' ? body.path : ''
      if (!rel || path.isAbsolute(rel)) return [400, { ok: false, error: 'Not a path inside that folder.' }]
      const file = path.resolve(dir, rel)
      // `..` in the path, or a symlink pointing out of the repo, must not become a link.
      const real = await realFileUnder(file, dir)
      if (!real) return [400, { ok: false, error: 'That file is not in that folder any more.' }]
      const scheme = typeof body?.editor === 'string' && FILE_URL_SCHEMES.has(body.editor) ? body.editor : 'vscode'
      const launched = await opener.launch(fileUrl(scheme, real))
      return launched.ok ? [200, { ok: true }] : [500, launched]
    },

    'GET /api/prs': async () => [200, await prStore.get(await projectList())],

    'GET /api/issues': async () => [200, await issueStore.get(await projectList())],
    // Lines of code in each folder the scan found, for its landmark. Only those folders: the page can't name one.
    'GET /api/repos': async () => [200, await repoStore.get(await projectList())],

    // What is running against what has been published: `{ current, latest, url, newer }`. The page
    // asks for it only while the PR gardens or the issue boards are on, which is the switch that
    // says anything may leave this machine at all.
    'GET /api/version': async () => [200, await releaseStore.get()],

    /** Only GitHub pages, over https: this endpoint exists to open a PR or an issue, not arbitrary links. */
    'POST /api/open-url': async (body) => {
      let u
      try {
        u = new URL(String(body?.url || ''))
      } catch {
        return [400, { ok: false, error: 'Not a URL.' }]
      }
      if (u.protocol !== 'https:' || u.hostname !== 'github.com') return [400, { ok: false, error: 'Only GitHub links can be opened.' }]
      const launched = await opener.launch(u.href)
      return launched.ok ? [200, { ok: true }] : [500, launched]
    },

    'POST /api/reveal': async (body) => {
      const dir = await resolveFolder(body?.folder)
      if (!dir) return [400, { ok: false, error: 'That folder no longer exists.' }]
      const launched = await opener.reveal(dir)
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
