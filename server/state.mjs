// data/village.json: the only file AgentVille writes, anywhere.
import fsp from 'node:fs/promises'
import path from 'node:path'
import { cleanTasks } from '../src/game/tasks.js'

export const STATE_VERSION = 1
const FILE = 'village.json'

export function emptyState() {
  return {
    version: STATE_VERSION,
    archived: [],
    archivedAt: {},
    plots: {},
    seen: {},
    hiddenProjects: [],
    viewedAt: {},
    tasks: {},
    looks: {},
    spots: {},
    progress: {},
    settings: null,
    updatedAt: 0,
  }
}

const strings = (v) => (Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === 'string'))] : [])
const numberMap = (v) => {
  const out = {}
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const [k, n] of Object.entries(v)) if (typeof n === 'number' && Number.isFinite(n)) out[k] = n
  }
  return out
}
const plotMap = (v) => {
  const out = {}
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const [k, cells] of Object.entries(v)) {
      if (!Array.isArray(cells)) continue
      const ok = cells.filter((c) => Array.isArray(c) && c.length === 2 && c.every(Number.isInteger))
      if (ok.length) out[k] = ok.map(([x, y]) => [x, y])
    }
  }
  return out
}

/** Repo name → its own tasks. An emptied list is dropped rather than kept as []. */
const taskMap = (v) => {
  const out = {}
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const [k, list] of Object.entries(v)) {
      const ok = cleanTasks(list)
      if (ok.length) out[k] = ok
    }
  }
  return out
}

/**
 * A theme or sub-theme id, as THEME_ID in src/sim/themes.js has it. Copied rather than imported:
 * the desktop app ships the server with only the few files it needs from src/.
 */
const THEME_ID = /^[a-z][a-z0-9-]{0,31}$/

const isId = (s) => typeof s === 'string' && THEME_ID.test(s)

/**
 * Repo name → the look that folder picked for itself: `{ theme, sub }`, a sub-theme of any theme.
 * Ids only; the page ignores any it doesn't know, so a theme that went away costs nothing.
 *
 * `old` is what v0.21 and v0.22 saved instead, `subthemes`: repo → { theme: sub-theme }, a pick
 * within each theme. A folder with no look yet takes the first of those as its look.
 */
const lookMap = (v, old) => {
  const out = {}
  const add = (k, theme, sub) => {
    if (k !== '__proto__' && !Object.hasOwn(out, k) && isId(theme) && isId(sub)) out[k] = { theme, sub }
  }
  if (v && typeof v === 'object' && !Array.isArray(v)) for (const [k, l] of Object.entries(v)) if (l && typeof l === 'object') add(k, l.theme, l.sub)
  if (old && typeof old === 'object' && !Array.isArray(old)) {
    for (const [k, picks] of Object.entries(old)) {
      if (!picks || typeof picks !== 'object' || Array.isArray(picks)) continue
      for (const [t, s] of Object.entries(picks)) add(k, t, s)
    }
  }
  return out
}

/**
 * Where a folder can stand its landmark in its field, as LANDMARK_SPOTS in src/sim/shape.js has
 * them. Copied rather than imported, for the same reason as THEME_ID.
 */
const SPOTS = new Set(['top', 'middle', 'bottom'])

/** Repo name → where that folder stands its landmark, where it picked somewhere of its own. */
const spotMap = (v) => {
  const out = {}
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out
  for (const [k, spot] of Object.entries(v)) if (k !== '__proto__' && SPOTS.has(spot)) out[k] = spot
  return out
}

/**
 * The highest tier of landmark, as MAX_TIER in src/sim/progress.js has it. Copied rather than
 * imported, for the same reason as THEME_ID.
 */
const MAX_TIER = 5

/** Repo name → the tier its landmark has reached and when: `{ tier, at }`. */
const progressMap = (v) => {
  const out = {}
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out
  for (const [k, p] of Object.entries(v)) {
    if (k === '__proto__' || !p || typeof p !== 'object') continue
    const { tier, at } = p
    if (!Number.isInteger(tier) || tier < 1 || tier > MAX_TIER) continue
    out[k] = { tier, at: typeof at === 'number' && Number.isFinite(at) ? at : 0 }
  }
  return out
}

/** Every field coerced to its type; unknown fields dropped. A hand-edited file cannot crash the page. */
export function normalizeState(raw) {
  const s = raw && typeof raw === 'object' ? raw : {}
  return {
    version: STATE_VERSION,
    archived: strings(s.archived),
    archivedAt: numberMap(s.archivedAt),
    plots: plotMap(s.plots),
    seen: numberMap(s.seen),
    hiddenProjects: strings(s.hiddenProjects),
    viewedAt: numberMap(s.viewedAt),
    tasks: taskMap(s.tasks),
    looks: lookMap(s.looks, s.subthemes),
    spots: spotMap(s.spots),
    progress: progressMap(s.progress),
    settings: s.settings && typeof s.settings === 'object' && !Array.isArray(s.settings) ? s.settings : null,
    updatedAt: typeof s.updatedAt === 'number' && Number.isFinite(s.updatedAt) ? s.updatedAt : 0,
  }
}

export class ConflictError extends Error {
  constructor(current) {
    super('State changed since it was read')
    this.current = current
  }
}

/**
 * Reads and writes are serialised through one promise chain, and each write goes to its own
 * temp file before an atomic rename. Both halves matter: two overlapping writes sharing one
 * temp name, or a read landing mid-write, each lost data before.
 */
export function createStateStore(dataDir) {
  const file = path.join(dataDir, FILE)
  let chain = Promise.resolve()
  let seq = 0
  let lastStamp = 0

  const serial = (fn) => {
    const run = chain.then(fn, fn)
    chain = run.catch(() => {})
    return run
  }

  async function readRaw() {
    try {
      return normalizeState(JSON.parse(await fsp.readFile(file, 'utf8')))
    } catch {
      return emptyState()
    }
  }

  const read = () => serial(readRaw)

  /**
   * Write the whole state. With `baseUpdatedAt`, refuse unless it matches what is on disk —
   * by *inequality*, not "older than", because a file restored from backup moves backwards too.
   */
  function write(next, { baseUpdatedAt } = {}) {
    return serial(async () => {
      const current = await readRaw()
      if (baseUpdatedAt !== undefined && baseUpdatedAt !== null && baseUpdatedAt !== current.updatedAt) {
        throw new ConflictError(current)
      }
      const out = normalizeState(next)
      // Strictly increasing even when two writes land in the same millisecond.
      out.updatedAt = lastStamp = Math.max(Date.now(), lastStamp + 1, current.updatedAt + 1)
      await fsp.mkdir(dataDir, { recursive: true })
      const tmp = `${file}.${process.pid}.${++seq}.tmp`
      await fsp.writeFile(tmp, JSON.stringify(out, null, 2) + '\n')
      await fsp.rename(tmp, file)
      return out
    })
  }

  return { file, read, write }
}
