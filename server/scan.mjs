// Harness-agnostic: ask every detected harness for its threads, merge, disambiguate, sort.
import { HARNESSES, detectedHarnesses, harnessById } from './harnesses/index.mjs'
import { basename } from './harnesses/thread.mjs'

const SEP_RE = /[\\/]/
// A drive letter or a UNC share: a path Windows owns, whichever machine is reading it.
const WIN_RE = /^(?:[A-Za-z]:|[\\/]{2}[^\\/])/

/**
 * One way of writing a folder. On Windows the same repo arrives as `C:\x` from Claude Code,
 * `C:/x` from an editor's `file://` URI and `c:\x` from Cursor, so a Windows path gets `\`,
 * an upper-case drive and no trailing separator. A POSIX path only loses its trailing `/`.
 */
export function normalizePath(p) {
  const s = String(p || '')
  if (!WIN_RE.test(s)) return s.length > 1 ? s.replace(/\/+$/, '') : s
  const joined = s.split(SEP_RE).filter(Boolean).join('\\')
  if (/^[\\/]{2}/.test(s)) return `\\\\${joined}`
  const out = joined[0].toUpperCase() + joined.slice(1)
  return /^[A-Z]:$/.test(out) ? `${out}\\` : out
}

/** Which folder a path is. Windows ignores case, so `GitHub\App` and `github\app` are one. */
export function pathKey(p) {
  const s = normalizePath(p)
  return WIN_RE.test(s) ? s.toLowerCase() : s
}

/**
 * Every thread in one folder gets the same `projectPath` — the first spelling met, normalized —
 * and so the same plot. Left alone, each spelling looked like a different repo with the same
 * name, and the renaming below spelled every one of them out in full.
 */
function unifyPaths(threads) {
  const spelling = new Map() // pathKey → projectPath
  for (const t of threads) {
    if (t.projectPath && !spelling.has(pathKey(t.projectPath))) spelling.set(pathKey(t.projectPath), normalizePath(t.projectPath))
  }
  return threads.map((t) => {
    if (!t.projectPath) return t
    const p = spelling.get(pathKey(t.projectPath))
    if (p === t.projectPath) return t
    // The name follows the spelling too, unless the harness called the folder something else.
    const named = String(t.project || '').toLowerCase() === basename(t.projectPath).toLowerCase()
    return { ...t, projectPath: p, project: named ? basename(p) : t.project }
  })
}

/**
 * Plots are keyed by folder *name*, and that key is also where a saved layout lives. When two
 * different paths share a name (`~/a/foo`, `~/b/foo`), only those grow leftward — `a/foo`,
 * `b/foo` — until they differ. Renaming everything would move every plot on the map.
 */
export function disambiguateProjects(input) {
  const threads = unifyPaths(input)
  const pathsByName = new Map()
  for (const t of threads) {
    if (!t.project || !t.projectPath) continue
    const set = pathsByName.get(t.project) || new Set()
    set.add(t.projectPath)
    pathsByName.set(t.project, set)
  }
  const rename = new Map() // projectPath → new name
  for (const [, set] of pathsByName) {
    if (set.size < 2) continue
    const parts = [...set].map((p) => ({ p, segs: p.split(SEP_RE).filter(Boolean) }))
    for (let depth = 2; ; depth++) {
      const names = parts.map(({ segs }) => segs.slice(-depth).join('/'))
      const longest = Math.max(...parts.map(({ segs }) => segs.length))
      if (new Set(names).size === names.length || depth >= longest) {
        parts.forEach(({ p }, i) => rename.set(p, names[i]))
        break
      }
    }
  }
  if (!rename.size) return threads
  return threads.map((t) => {
    const name = rename.get(t.projectPath)
    return name ? { ...t, project: name } : t
  })
}

/**
 * @param {{ harnesses?: object[] }} [opts]
 * @returns {Promise<{ threads: object[], warnings: string[] }>}
 */
export async function scanAll({ harnesses = HARNESSES } = {}) {
  const warnings = []
  const detected = await detectedHarnesses(harnesses)
  const lists = await Promise.all(
    detected.map(async (h) => {
      try {
        const threads = await h.scanThreads()
        return threads.map((t) => ({ ...t, harness: h.id, harnessName: h.name }))
      } catch (err) {
        // One broken adapter costs its own threads and nothing else.
        warnings.push(`${h.name}: ${err?.message || err}`)
        return []
      }
    }),
  )
  const threads = disambiguateProjects(lists.flat())
  threads.sort((a, b) => (b.lastActivityAt || 0) - (a.lastActivityAt || 0))
  return { threads, warnings }
}

export async function scanThreads(opts) {
  return (await scanAll(opts)).threads
}

/** Every harness, whether it is on this machine, and — only if it is — where it can start a session. */
export async function harnessStatus({ harnesses = HARNESSES } = {}) {
  return Promise.all(
    harnesses.map(async (h) => {
      const detected = await h.detect().catch(() => false)
      const targets = detected && h.targets ? await h.targets().catch(() => []) : []
      return { id: h.id, name: h.name, detected, targets }
    }),
  )
}

export async function defaultHarness({ harnesses = HARNESSES } = {}) {
  return (await detectedHarnesses(harnesses))[0] || harnesses[0] || null
}

export { harnessById }
