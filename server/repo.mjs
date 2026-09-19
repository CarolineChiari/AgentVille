// How much code each repo holds: its lines, counted by reading its files. Read only, and nothing
// is ever run: the walk skips whatever the repo's .gitignore files say, never follows a link, and
// gives up past a limit rather than grinding through a giant tree. The counts are kept in
// data/repos.json and refreshed in the background, so a page load never waits for one.
//
// Only a git repository is counted. A session can be opened in any folder, and people open them
// in their home, Documents, Downloads, an external drive: walking those read thousands of private
// files for a number that meant nothing, and in an iCloud Drive folder every read can fetch a file
// down from the cloud.
import nodeFsp from 'node:fs/promises'
import path from 'node:path'
import { isIgnored, parseIgnore } from './ignore.mjs'

/**
 * - files: a repo's worth of hand-written files is a few thousand; past this it is vendored code
 *   or data, and the count is already far past what earns the landmark's most (LINES_CAP).
 * - ms: a walk this long is a huge tree or a slow network drive; better a partial count than a
 *   fan spinning. Checked between files, so one slow read can run a little past it.
 * - fileBytes: bigger text files are generated (bundles, fixtures, dumps), not written.
 * - sniff: a NUL byte this early means binary, as git decides it.
 */
export const LIMITS = { files: 20_000, ms: 20_000, fileBytes: 1_000_000, sniff: 8_000 }
/** data/repos.json's layout: 2 since only repositories are counted. */
const FILE_VERSION = 2

/** Never code, whatever a .gitignore says, and never worth the walk: other tools' stores. */
const SKIP_DIRS = new Set(['.git', '.hg', '.svn', 'node_modules', '.claude'])
/** Written by tools, not people, and long: lock files would outweigh the code they lock. */
const SKIP_FILES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lock', 'Cargo.lock', 'Gemfile.lock', 'poetry.lock', 'composer.lock',
  'go.sum', 'Pipfile.lock', 'uv.lock', 'flake.lock', 'mix.lock', 'pubspec.lock', 'Podfile.lock',
])
const SKIP_SUFFIX = ['.min.js', '.min.css', '.map']
/** Files read at once. More only queues up on the disk; fewer leaves it idle between reads. */
const PARALLEL = 8

const NEWLINE = 0x0a

/** Lines in a text file's bytes: one per newline, and one more for a last line without one. */
export function countLines(buf) {
  if (!buf.length) return 0
  let n = 0
  for (let i = buf.indexOf(NEWLINE); i >= 0; i = buf.indexOf(NEWLINE, i + 1)) n++
  return buf[buf.length - 1] === NEWLINE ? n : n + 1
}

const skipFile = (name) => SKIP_FILES.has(name) || SKIP_SUFFIX.some((s) => name.endsWith(s))

async function readRules(fsp, file) {
  try {
    return parseIgnore(await fsp.readFile(file, 'utf8'))
  } catch {
    return []
  }
}

/** Is `dir` the top of a git repository or worktree: does it hold `.git`, a folder or a pointer file? */
export async function isRepo(dir, fsp = nodeFsp) {
  try {
    const st = await fsp.stat(path.join(dir, '.git'))
    return st.isDirectory() || st.isFile()
  } catch {
    return false
  }
}

/**
 * Count the lines in the text files under `dir` that the repo does not ignore.
 * @param {string} dir  an absolute path
 * @returns {Promise<{ lines: number, files: number, skipped: number, truncated: boolean } | null>}
 *          `files` counted; `skipped` left out as binary or too big; `truncated` if a limit cut it
 *          short. Null for a folder that isn't a git repository, which is never walked.
 */
export async function countRepo(dir, { fsp = nodeFsp, now = Date.now, limits = LIMITS } = {}) {
  if (!(await isRepo(dir, fsp))) return null
  const start = now()
  const out = { lines: 0, files: 0, skipped: 0, truncated: false }
  // The repo's own excludes count like a .gitignore at its top.
  const top = [...(await readRules(fsp, path.join(dir, '.git', 'info', 'exclude'))), ...(await readRules(fsp, path.join(dir, '.gitignore')))]
  const stack = [{ rel: '', sets: top.length ? [{ base: '', rules: top }] : [] }]
  const over = () => out.files + out.skipped >= limits.files || now() - start > limits.ms

  const count = async (file) => {
    let fh
    try {
      fh = await fsp.open(file, 'r')
      const { size } = await fh.stat()
      if (size > limits.fileBytes) return out.skipped++
      const buf = Buffer.alloc(size)
      const { bytesRead } = await fh.read(buf, 0, size, 0)
      const data = buf.subarray(0, bytesRead)
      if (data.subarray(0, limits.sniff).includes(0)) return out.skipped++
      out.lines += countLines(data)
      out.files++
    } catch {
      out.skipped++
    } finally {
      await fh?.close().catch(() => {})
    }
  }

  while (stack.length) {
    if (over()) {
      out.truncated = true
      break
    }
    const { rel, sets } = stack.pop()
    const abs = rel ? path.join(dir, ...rel.split('/')) : dir
    let entries
    try {
      entries = await fsp.readdir(abs, { withFileTypes: true })
    } catch {
      continue
    }
    // A nested .gitignore speaks for its own folder and everything under it.
    let here = sets
    if (rel && entries.some((e) => e.name === '.gitignore' && e.isFile())) {
      const rules = await readRules(fsp, path.join(abs, '.gitignore'))
      if (rules.length) here = [...sets, { base: rel, rules }]
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    const files = []
    const dirs = []
    for (const e of entries) {
      // Links could lead anywhere, even back up the tree; sockets and devices are no one's code.
      if (e.isSymbolicLink() || (!e.isFile() && !e.isDirectory())) continue
      const childRel = rel ? `${rel}/${e.name}` : e.name
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name) && !isIgnored(here, childRel, true)) dirs.push({ rel: childRel, sets: here })
      } else if (!skipFile(e.name) && !isIgnored(here, childRel, false)) files.push(path.join(abs, e.name))
    }
    for (let i = 0; i < files.length; i += PARALLEL) {
      if (over()) {
        out.truncated = true
        break
      }
      await Promise.all(files.slice(i, i + PARALLEL).map(count))
    }
    if (out.truncated) break
    // Popped last in, first out: reversed, so folders are walked in name order.
    for (let i = dirs.length - 1; i >= 0; i--) stack.push(dirs[i])
  }
  return out
}

/**
 * The line counts, kept in `dataDir/repos.json` by folder, refreshed in the background one repo at a
 * time. A count is a while out of date at worst, which is fine for how big a landmark stands.
 * @param {{ dataDir: string, ttlMs?: number, count?: typeof countRepo, now?: () => number }} opts
 */
export function createRepoStore({ dataDir, ttlMs = 30 * 60 * 1000, count = countRepo, now = Date.now }) {
  const file = path.join(dataDir, 'repos.json')
  let cache = null // { [folder]: { countedAt, repo, lines, files, skipped, truncated, error } }
  let lane = Promise.resolve()
  const inFlight = new Set()
  let seq = 0

  async function load() {
    if (cache) return cache
    try {
      const raw = JSON.parse(await nodeFsp.readFile(file, 'utf8'))
      // Version 1 counted any folder, not only repositories: its counts are thrown away and redone.
      const ok = raw && typeof raw === 'object' && raw.version === FILE_VERSION && raw.repos && typeof raw.repos === 'object' && !Array.isArray(raw.repos)
      cache = ok ? raw.repos : {}
    } catch {
      cache = {}
    }
    return cache
  }

  async function save() {
    await nodeFsp.mkdir(dataDir, { recursive: true })
    const tmp = `${file}.${process.pid}.${++seq}.tmp`
    await nodeFsp.writeFile(tmp, JSON.stringify({ version: FILE_VERSION, repos: cache }) + '\n')
    await nodeFsp.rename(tmp, file)
  }

  function refresh(dir) {
    if (inFlight.has(dir)) return lane
    inFlight.add(dir)
    // Everything inside the try: a count that throws would wedge the lane for every repo after it.
    lane = lane.then(async () => {
      try {
        const c = await count(dir)
        cache[dir] = c
          ? { countedAt: now(), repo: true, lines: c.lines, files: c.files, skipped: c.skipped, truncated: c.truncated, error: '' }
          : { countedAt: now(), repo: false, lines: 0, files: 0, skipped: 0, truncated: false, error: '' }
      } catch (err) {
        // Keep the last count; note the failure so the next try waits a full TTL.
        cache[dir] = { repo: true, lines: 0, files: 0, skipped: 0, truncated: false, ...cache[dir], countedAt: now(), error: String(err?.message || err) }
      } finally {
        inFlight.delete(dir)
      }
      await save().catch(() => {})
    })
    return lane
  }

  /**
   * What is known for these repos now, and a background count of any that is stale. Only folders the
   * scan found are ever counted; the page cannot name one.
   * @param {{ name: string, path: string }[]} projects
   */
  async function get(projects) {
    await load()
    const repos = {}
    for (const { name, path: dir } of projects) {
      if (typeof dir !== 'string' || !path.isAbsolute(dir)) continue
      const entry = cache[dir]
      if (!entry || now() - entry.countedAt > ttlMs) refresh(dir)
      // A recount that failed still has the last good count, if there was one. A folder that isn't
      // a repository is listed as one, so the page can say why it has no lines.
      if (entry && (!entry.error || entry.lines > 0)) {
        repos[name] = { repo: entry.repo !== false, lines: entry.lines, files: entry.files, skipped: entry.skipped, truncated: entry.truncated, countedAt: entry.countedAt }
      }
    }
    return { repos, updating: inFlight.size > 0 }
  }

  return { get, refresh, settle: () => lane, file }
}
