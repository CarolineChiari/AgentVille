// Pure: which threads stand in the village, and which repos are hidden, folded or archived away.
import { applyViewed, statusFor } from '../sim/status.js'

export const isArchived = (t, state) => Boolean(t.archived || t.archivedHere || state.archived.includes(t.id))

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Has this thread slept so long that it archives itself? Never one with no known last activity (an
 * empty date would read as 1970), and never one the person restored by hand: `kept` remembers
 * those, or the next poll would archive them again.
 */
export const isStale = (t, state, days, now = Date.now()) =>
  days > 0 && Boolean(t.lastActivityAt) && now - t.lastActivityAt > days * DAY_MS && !(state.kept || []).includes(t.id)

export function hideProject(state, name) {
  return state.hiddenProjects.includes(name) ? state : { ...state, hiddenProjects: [...state.hiddenProjects, name] }
}
export function unhideProject(state, name) {
  return state.hiddenProjects.includes(name) ? { ...state, hiddenProjects: state.hiddenProjects.filter((n) => n !== name) } : state
}

/**
 * Sort the scan into what stands on the map and what does not.
 * A repo rests (folds its villagers away) when `hideDormant` is on and every thread is asleep
 * *and reviewed*: work you haven't looked at yet keeps its repo on the map, so nothing
 * disappears before you've seen it. Never every repo, because an empty village with a count of
 * forty is worse than a sleepy one. With `archiveAfterDays`, a thread asleep longer than that is
 * archived too (`auto` names them); archiving is only this app's own list, never the harness's files.
 */
export function classify(threads, state, { hideDormant = true, archiveAfterDays = 0, now = Date.now() } = {}) {
  const hidden = new Set(state.hiddenProjects)
  const archived = []
  const auto = [] // ids archived by the clock rather than by hand
  const hiddenThreads = []
  const byProject = new Map()
  for (const raw of threads) {
    if (isArchived(raw, state)) {
      archived.push(raw)
      continue
    }
    if (isStale(raw, state, archiveAfterDays, now)) {
      archived.push(raw)
      auto.push(raw.id)
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
    for (const [name, list] of byProject) if (list.every((t) => t.status === 'sleeping' && !t.unread)) dormant.add(name)
    if (dormant.size === byProject.size) dormant.clear()
  }
  const live = []
  const folded = []
  for (const [name, list] of byProject) (dormant.has(name) ? folded : live).push(...list)
  return { live, folded, hidden: hiddenThreads, archived, dormant: [...dormant], auto }
}
