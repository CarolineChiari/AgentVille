// Pure: which of a repo's open issues its notice board shows. A filter is a short string, saved per
// repo in village.json as `boardFilters`: '' (all), 'mine', 'unassigned' or 'label:<name>'. The board
// keeps the whole list; the filter only decides what the map, the count and the card show.
//
// Imports nothing: server/state.mjs cleans what it saves with this one.

export const FILTER_MINE = 'mine'
export const FILTER_UNASSIGNED = 'unassigned'
const LABEL = 'label:'
/** GitHub caps a label at 50 characters; the cap also bounds a hand-edited file. */
const LABEL_MAX = 50

/** A filter as it is kept, or '' (show all) when it isn't one. */
export function cleanFilter(v) {
  if (v === FILTER_MINE || v === FILTER_UNASSIGNED) return v
  if (typeof v !== 'string' || !v.startsWith(LABEL)) return ''
  const name = v.slice(LABEL.length).trim().slice(0, LABEL_MAX)
  return name ? LABEL + name : ''
}

export const labelFilter = (name) => cleanFilter(LABEL + String(name ?? ''))

/** The label a filter picks, or '' when it picks something else. */
export const filterLabel = (f) => (cleanFilter(f).startsWith(LABEL) ? cleanFilter(f).slice(LABEL.length) : '')

/** Repo name → its filter; entries that show everything are not kept. */
export function cleanFilterMap(v) {
  const out = {}
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out
  for (const [k, f] of Object.entries(v)) {
    const clean = k === '__proto__' ? '' : cleanFilter(f)
    if (clean) out[k] = clean
  }
  return out
}

/**
 * The issues a filter lets through, in their order. `login` is the person's GitHub login: with it
 * unknown (gh isn't signed in), 'mine' matches nothing rather than everything.
 */
export function filterIssues(issues, filter, login = '') {
  const f = cleanFilter(filter)
  if (!f || !Array.isArray(issues)) return Array.isArray(issues) ? issues : []
  const who = String(login || '').toLowerCase()
  const assignees = (i) => (Array.isArray(i.assignees) ? i.assignees : [])
  if (f === FILTER_MINE) return issues.filter((i) => who && assignees(i).some((a) => String(a).toLowerCase() === who))
  if (f === FILTER_UNASSIGNED) return issues.filter((i) => !assignees(i).length)
  const label = f.slice(LABEL.length).toLowerCase()
  return issues.filter((i) => Array.isArray(i.labels) && i.labels.some((l) => String(l).toLowerCase() === label))
}

/** Every label on these issues, most used first, for the picker. */
export function labelsOf(issues) {
  const n = new Map()
  for (const i of Array.isArray(issues) ? issues : []) for (const l of i.labels || []) n.set(l, (n.get(l) || 0) + 1)
  return [...n].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([l]) => l)
}
