// data/village.json: the only file AgentVille writes, anywhere.
import fsp from 'node:fs/promises'
import path from 'node:path'

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
