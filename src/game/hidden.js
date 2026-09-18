// Pure: which threads stand in the village, and which repos are hidden, folded or archived away.
import { applyViewed, statusFor } from '../sim/status.js'

export const isArchived = (t, state) => Boolean(t.archived || t.archivedHere || state.archived.includes(t.id))

export function hideProject(state, name) {
  return state.hiddenProjects.includes(name) ? state : { ...state, hiddenProjects: [...state.hiddenProjects, name] }
}
export function unhideProject(state, name) {
  return state.hiddenProjects.includes(name) ? { ...state, hiddenProjects: state.hiddenProjects.filter((n) => n !== name) } : state
}

/**
 * Sort the scan into what stands on the map and what does not.
 * A repo where every thread is asleep folds away when `hideDormant` is on — but never every
 * repo, because an empty village with a count of forty is worse than a sleepy one.
 */
export function classify(threads, state, { hideDormant = true, now = Date.now() } = {}) {
  const hidden = new Set(state.hiddenProjects)
  const archived = []
  const hiddenThreads = []
  const byProject = new Map()
  for (const raw of threads) {
    if (isArchived(raw, state)) {
      archived.push(raw)
      continue
    }
    const t = applyViewed(raw, state.viewedAt)
    const entry = { ...t, status: statusFor(t, now) }
    if (hidden.has(t.project)) {
      hiddenThreads.push(entry)
      continue
    }
    if (!byProject.has(t.project)) byProject.set(t.project, [])
    byProject.get(t.project).push(entry)
  }
  const dormant = new Set()
  if (hideDormant) {
    for (const [name, list] of byProject) if (list.every((t) => t.status === 'sleeping')) dormant.add(name)
    if (dormant.size === byProject.size) dormant.clear()
  }
  const live = []
  const folded = []
  for (const [name, list] of byProject) (dormant.has(name) ? folded : live).push(...list)
  return { live, folded, hidden: hiddenThreads, archived, dormant: [...dormant] }
}
