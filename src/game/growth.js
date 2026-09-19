// What each repo's work adds up to, from what the page already has: its threads, its garden, and
// the size of its code. Pure, so it runs under node --test. See src/sim/progress.js for the points.
import { MAX_TIER, THREAD_BYTES_CAP, nextFor, progressOf } from '../sim/progress.js'

/**
 * Each repo's work, as progressOf wants it.
 * @param {{ project?: string, sizeBytes?: number }[]} threads  every thread the scan found, live or archived
 * @param {Map<string, { open?: boolean }[]>} gardens  each repo's finished work; an open PR's bud is not finished yet
 * @param {Record<string, { lines?: number }>} [counted]  each repo's code, as the server counted it
 * @param {Iterable<string>} [hidden]  repos put away: they grow nothing while they are
 * @returns {Map<string, import('../sim/progress.js').Growth>}
 */
export function growthInputs(threads, gardens, counted = {}, hidden = []) {
  const off = new Set(hidden)
  const out = new Map()
  const of = (name) => {
    if (!out.has(name)) out.set(name, { sessions: 0, finished: 0, bytes: 0, lines: 0 })
    return out.get(name)
  }
  for (const t of threads) {
    if (!t.project || off.has(t.project)) continue
    const g = of(t.project)
    g.sessions++
    g.bytes += Math.min(THREAD_BYTES_CAP, Math.max(0, Number(t.sizeBytes) || 0))
  }
  for (const [name, list] of gardens) {
    if (off.has(name)) continue
    of(name).finished = list.filter((f) => !f.open).length
  }
  for (const [name, g] of out) {
    const c = counted?.[name]
    if (c?.repo !== false && Number.isFinite(c?.lines) && c.lines > 0) g.lines = c.lines
  }
  return out
}

/**
 * The saved tiers, raised wherever a repo's work now reaches higher. A tier is a high-water mark:
 * a landmark never comes down because PR gardens were switched off or old transcripts were
 * cleaned up, and each tier is reached, and celebrated, once.
 * @param {Record<string, { tier: number, at: number }>} saved  from village.json
 * @param {Map<string, number>} reached  each repo's tier from its work now
 * @returns {{ progress: Record<string, { tier: number, at: number }>, changed: boolean }}
 */
export function highWater(saved, reached, now) {
  const progress = { ...saved }
  let changed = false
  for (const [name, tier] of reached) {
    const t = Math.min(MAX_TIER, Math.max(0, Math.floor(tier)))
    if (t <= (progress[name]?.tier ?? 0)) continue
    progress[name] = { tier: t, at: now }
    changed = true
  }
  return { progress, changed }
}

/**
 * Everything the panel says about a repo's landmark: its points and where they came from, the tier
 * standing (the saved one, which may be above what the points reach now), and how far to the next.
 */
export function standing(growth, saved) {
  const p = progressOf(growth || {})
  const tier = Math.max(p.tier, saved?.tier ?? 0)
  return { ...p, tier, next: nextFor(p.points, tier), since: saved?.at ?? 0 }
}
