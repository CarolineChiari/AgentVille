// Pull requests, for the gardens: merged ones bloom, open ones wait as glittering buds. Open
// issues, for each plot's notice board.
// This is the one part of AgentVille that talks to the network, and it does so only through the
// `gh` CLI the user has already signed in to — no tokens are read or stored here. Results are
// cached in data/prs.json and data/issues.json so a reload is instant and works offline.
import { spawn as nodeSpawn } from 'node:child_process'
import fsp from 'node:fs/promises'
import path from 'node:path'

/** How long a repo's list is trusted before it is fetched again. PRs merge a few times a day at most. */
export const PR_TTL_MS = 10 * 60 * 1000
/** Enough to fill a big field (a 2×2 plot's holds nearly a thousand flowers), few enough to be quick. */
export const PR_LIMIT = 500
const GH_TIMEOUT_MS = 30_000
const FIELDS = 'number,title,labels,state,isDraft,createdAt,mergedAt,author,url,additions,deletions,headRefName'
/** Issues are opened and closed about as often as PRs; one clock for both is simpler. */
export const ISSUE_TTL_MS = PR_TTL_MS
/** Six notes fit on a board and the card lists a page; two hundred counts a backlog honestly without a slow fetch. */
export const ISSUE_LIMIT = 200
// Not `comments`: gh answers that with every comment's body, not a count, and a busy repo would
// blow the timeout. Not `body` either: it is never shown and can be huge.
export const ISSUE_FIELDS = 'number,title,labels,state,createdAt,updatedAt,author,url,assignees,milestone'
const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/

/** `owner/repo` from any common GitHub remote form, else null. */
export function parseGithubRemote(url) {
  const s = String(url || '').trim()
  const m =
    /^(?:https?:\/\/)(?:[^@/]+@)?github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i.exec(s) ||
    /^(?:ssh:\/\/)?git@github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?\/?$/i.exec(s)
  if (!m) return null
  const slug = `${m[1]}/${m[2]}`
  return REPO_RE.test(slug) ? slug : null
}

/**
 * The GitHub repo a folder's `origin` points at, read straight from .git/config (no git process).
 * A worktree's `.git` is a file pointing at the real git dir; that is followed too.
 */
export async function githubRepoOf(dir) {
  if (typeof dir !== 'string' || !path.isAbsolute(dir)) return null
  let gitDir = path.join(dir, '.git')
  try {
    const st = await fsp.stat(gitDir)
    if (st.isFile()) {
      const m = /gitdir:\s*(.+)/.exec(await fsp.readFile(gitDir, 'utf8'))
      if (!m) return null
      gitDir = path.resolve(dir, m[1].trim())
      // A worktree's own git dir holds `commondir`, which leads back to the shared config.
      try {
        const common = (await fsp.readFile(path.join(gitDir, 'commondir'), 'utf8')).trim()
        gitDir = path.resolve(gitDir, common)
      } catch {}
    }
    const config = await fsp.readFile(path.join(gitDir, 'config'), 'utf8')
    const section = /\[remote "origin"\]([^[]*)/.exec(config)
    const url = section && /url\s*=\s*(.+)/.exec(section[1])
    return url ? parseGithubRemote(url[1]) : null
  } catch {
    return null
  }
}

/** Keep only what the page shows, typed. `gh` output is trusted to be JSON, not to be well-formed. */
export function normalizePr(p) {
  const n = Number(p?.number)
  if (!Number.isInteger(n) || n <= 0) return null
  const state = String(p.state || '').toUpperCase()
  // Closed without merging is work that didn't land: no flower for it.
  if (state !== 'MERGED' && state !== 'OPEN') return null
  const url = typeof p.url === 'string' && /^https:\/\/github\.com\//.test(p.url) ? p.url : ''
  return {
    number: n,
    title: String(p.title || '').slice(0, 300),
    labels: Array.isArray(p.labels) ? p.labels.map((l) => String(l?.name || '')).filter(Boolean).slice(0, 20) : [],
    state,
    draft: Boolean(p.isDraft),
    createdAt: Date.parse(p.createdAt) || 0,
    mergedAt: Date.parse(p.mergedAt) || 0,
    author: String(p.author?.login || ''),
    url,
    additions: Number(p.additions) || 0,
    deletions: Number(p.deletions) || 0,
    branch: String(p.headRefName || ''),
  }
}

/** An open issue, typed. Anything closed, or without a real number, is dropped. */
export function normalizeIssue(p) {
  const n = Number(p?.number)
  if (!Number.isInteger(n) || n <= 0) return null
  if (String(p.state || '').toUpperCase() !== 'OPEN') return null
  const url = typeof p.url === 'string' && /^https:\/\/github\.com\//.test(p.url) ? p.url : ''
  const names = (list, key, max) => (Array.isArray(list) ? list.map((x) => String(x?.[key] || '')).filter(Boolean).slice(0, max) : [])
  // Counted if gh ever hands the comments over; ISSUE_FIELDS doesn't ask for them today.
  const comments = Array.isArray(p.comments) ? p.comments.length : Number(p.comments?.totalCount ?? p.comments) || 0
  return {
    number: n,
    title: String(p.title || '').slice(0, 300),
    labels: names(p.labels, 'name', 20),
    state: 'OPEN',
    createdAt: Date.parse(p.createdAt) || 0,
    updatedAt: Date.parse(p.updatedAt) || 0,
    author: String(p.author?.login || ''),
    url,
    assignees: names(p.assignees, 'login', 10),
    comments,
    milestone: String(p.milestone?.title || '').slice(0, 100),
  }
}

/** Run `gh` with an argv array and no shell; resolve its stdout, or reject with a short reason. */
export function runGh(args, { spawn = nodeSpawn, timeoutMs = GH_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    let child
    try {
      child = spawn('gh', args, { shell: false, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    } catch (err) {
      return reject(err)
    }
    let out = ''
    let err = ''
    const timer = setTimeout(() => {
      child.kill?.()
      reject(new Error('gh took too long'))
    }, timeoutMs)
    child.stdout?.on('data', (d) => (out += d))
    child.stderr?.on('data', (d) => (err += d))
    child.on('error', (e) => {
      clearTimeout(timer)
      reject(e.code === 'ENOENT' ? Object.assign(new Error('gh is not installed'), { code: 'ENOENT' }) : e)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve(out)
      else reject(new Error(err.trim().split('\n')[0] || `gh exited with ${code}`))
    })
  })
}

// Every gh call in this process goes through one lane: gh is a process per call, and the PR and
// issue stores must not race each other for it.
let lane = Promise.resolve()

/**
 * A cache of one kind of GitHub list per repo, kept in `dataDir/file`, refreshed in the background.
 * @param {{ dataDir: string, file: string, key: string, argv: (slug: string) => string[], normalize: (x: any) => object|null,
 *           gh?: (args: string[]) => Promise<string>, now?: () => number, ttlMs: number }} opts
 */
function createGhStore({ dataDir, file: name, key, argv, normalize, gh = runGh, now = Date.now, ttlMs }) {
  const file = path.join(dataDir, name)
  let cache = null // { [slug]: { fetchedAt, [key]: [...], error } }
  // Per store, not per process: a test's missing gh must not switch off every other store.
  let available = true
  const inFlight = new Set()
  let seq = 0

  async function load() {
    if (cache) return cache
    try {
      const raw = JSON.parse(await fsp.readFile(file, 'utf8'))
      cache = raw && typeof raw === 'object' && raw.repos && typeof raw.repos === 'object' ? raw.repos : {}
    } catch {
      cache = {}
    }
    return cache
  }

  async function save() {
    await fsp.mkdir(dataDir, { recursive: true })
    const tmp = `${file}.${process.pid}.${++seq}.tmp`
    await fsp.writeFile(tmp, JSON.stringify({ version: 1, repos: cache }) + '\n')
    await fsp.rename(tmp, file)
  }

  /** One repo at a time: `gh` is a process per call, and nobody needs twenty at once. */
  function refresh(slug) {
    if (inFlight.has(slug) || !available) return
    inFlight.add(slug)
    // Everything inside the try: a job that throws would wedge the lane for every store.
    lane = lane.then(async () => {
      try {
        const out = await gh(argv(slug))
        const list = JSON.parse(out).map(normalize).filter(Boolean)
        cache[slug] = { fetchedAt: now(), [key]: list, error: '' }
      } catch (err) {
        if (err.code === 'ENOENT') available = false
        // Keep whatever we had; note the failure so the next try waits a full TTL rather than hammering.
        cache[slug] = { ...(cache[slug] || { [key]: [] }), fetchedAt: now(), error: String(err.message || err) }
      } finally {
        inFlight.delete(slug)
      }
      await save().catch(() => {})
    })
    return lane
  }

  /**
   * What we know for these repos, right now, plus a background refresh of anything stale.
   * @param {{ name: string, path: string }[]} projects
   */
  async function get(projects) {
    await load()
    const repos = {}
    const warnings = []
    const seen = new Set()
    for (const { name, path: dir } of projects) {
      const slug = await githubRepoOf(dir)
      if (!slug) continue
      const entry = cache[slug]
      if (!seen.has(slug) && (!entry || now() - entry.fetchedAt > ttlMs)) refresh(slug)
      seen.add(slug)
      if (entry?.error) warnings.push(`${slug}: ${entry.error}`)
      repos[name] = { slug, [key]: entry?.[key] || [] }
    }
    return { repos, updating: inFlight.size > 0, available, warnings }
  }

  return { get, refresh, settle: () => lane, file }
}

/** Every PR, merged or open, per repo: `{ repos: { [project]: { slug, prs } }, updating, available, warnings }`. */
export const createPrStore = ({ ttlMs = PR_TTL_MS, ...opts }) =>
  createGhStore({
    ...opts, ttlMs, file: 'prs.json', key: 'prs', normalize: normalizePr,
    argv: (slug) => ['pr', 'list', '--repo', slug, '--state', 'all', '--limit', String(PR_LIMIT), '--json', FIELDS],
  })

/** Open issues per repo: `{ repos: { [project]: { slug, issues } }, updating, available, warnings }`. */
export const createIssueStore = ({ ttlMs = ISSUE_TTL_MS, ...opts }) =>
  createGhStore({
    ...opts, ttlMs, file: 'issues.json', key: 'issues', normalize: normalizeIssue,
    argv: (slug) => ['issue', 'list', '--repo', slug, '--state', 'open', '--limit', String(ISSUE_LIMIT), '--json', ISSUE_FIELDS],
  })
