// Three-way merge of village.json, for when two tabs saved at once. The server refuses a stale
// write with 409 and hands back what is on disk; the tab merges its own changes onto that and
// tries again. The server never merges: it cannot know which of two layouts a person meant.

const SETS = ['archived', 'hiddenProjects']
const MAPS = ['archivedAt', 'plots', 'seen', 'viewedAt']

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/** What the other tab has, plus what this tab added, minus what this tab removed. */
export function mergeSet(base = [], local = [], remote = []) {
  const b = new Set(base)
  const l = new Set(local)
  const added = local.filter((x) => !b.has(x))
  const removed = new Set(base.filter((x) => !l.has(x)))
  return [...new Set([...remote, ...added])].filter((x) => !removed.has(x))
}

/** Key by key: this tab's value wins only where this tab changed it. */
export function mergeMap(base = {}, local = {}, remote = {}) {
  const out = { ...remote }
  for (const k of Object.keys(local)) if (!same(base[k], local[k])) out[k] = local[k]
  for (const k of Object.keys(base)) if (!(k in local)) delete out[k]
  return out
}

export function mergeState(base, local, remote) {
  const out = { ...remote }
  for (const k of SETS) out[k] = mergeSet(base?.[k], local?.[k], remote?.[k])
  for (const k of MAPS) out[k] = mergeMap(base?.[k], local?.[k], remote?.[k])
  out.settings = local?.settings ?? remote?.settings ?? null
  out.version = remote?.version ?? local?.version ?? 1
  out.updatedAt = remote?.updatedAt ?? 0
  return out
}
