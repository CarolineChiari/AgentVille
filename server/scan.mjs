// Harness-agnostic: ask every detected harness for its threads, merge, disambiguate, sort.
import { HARNESSES, detectedHarnesses, harnessById } from './harnesses/index.mjs'

const SEP_RE = /[\\/]/

/** `c:\x` and `C:\x` are one path, not a collision. Trailing separators don't count either. */
export function canonicalPath(p) {
  let s = String(p || '').replace(/[\\/]+$/, '')
  if (/^[a-z]:/.test(s)) s = s[0].toUpperCase() + s.slice(1)
  return s
}

/**
 * Plots are keyed by folder *name*, and that key is also where a saved layout lives. When two
 * different paths share a name (`~/a/foo`, `~/b/foo`), only those grow leftward — `a/foo`,
 * `b/foo` — until they differ. Renaming everything would move every plot on the map.
 */
export function disambiguateProjects(threads) {
  const pathsByName = new Map()
  for (const t of threads) {
    if (!t.project || !t.projectPath) continue
    const set = pathsByName.get(t.project) || new Set()
    set.add(canonicalPath(t.projectPath))
    pathsByName.set(t.project, set)
  }
  const rename = new Map() // canonical path → new name
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
    const name = rename.get(canonicalPath(t.projectPath))
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

export async function harnessStatus({ harnesses = HARNESSES } = {}) {
  return Promise.all(
    harnesses.map(async (h) => ({ id: h.id, name: h.name, detected: await h.detect().catch(() => false) })),
  )
}

export async function defaultHarness({ harnesses = HARNESSES } = {}) {
  return (await detectedHarnesses(harnesses))[0] || harnesses[0] || null
}

export { harnessById }
