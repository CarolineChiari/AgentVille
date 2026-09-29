// Pure: a repo's sessions in groups of the person's own making. Saved in village.json as `groups`,
// repo name → its groups in the order they were made, and `groupOf`, thread id → the id of the
// group it is in. A thread keeps its group while it is archived, so a restored one comes back to
// it. A harness's own files are never touched.
//
// Imports nothing: the desktop app ships the server with only the few files it needs from src/,
// and server/state.mjs cleans what it saves with this one.

/** Long enough to say what the work is about, short enough for a heading in a repo's panel. */
export const GROUP_NAME_MAX = 40
/** Bounds a hand-edited file; past this many headings a repo's panel is no longer a list you read. */
export const GROUP_MAX = 20
/**
 * A group flies one of the plots' accent colours, by index: ACCENTS in src/render/sprites/palette.js,
 * ACCENT_COUNT in src/sim/world.js. Counted here rather than imported, for the reason above.
 */
export const GROUP_COLORS = 10
const GROUP_ID = /^g-[a-z0-9-]{1,48}$/

export const isGroupId = (v) => typeof v === 'string' && GROUP_ID.test(v)
const isColor = (c) => Number.isInteger(c) && c >= 0 && c < GROUP_COLORS
const own = (o, k) => Boolean(o) && typeof o === 'object' && Object.hasOwn(o, k)

/** A group's name as it is kept: one line, trimmed, capped. '' means none. */
export function cleanGroupName(v) {
  if (typeof v !== 'string') return ''
  return v.replace(/\s+/g, ' ').trim().slice(0, GROUP_NAME_MAX).trim()
}

/** Two names for one group read the same whatever their case, so a repo can't have both. */
export const sameName = (a, b) => cleanGroupName(a).toLowerCase() === cleanGroupName(b).toLowerCase()

/** One group as saved, `{ id, name, color }`, or null when it isn't one. */
export function cleanGroup(g) {
  if (!g || typeof g !== 'object') return null
  const name = cleanGroupName(g.name)
  if (!isGroupId(g.id) || !name) return null
  return { id: g.id, name, color: isColor(g.color) ? g.color : 0 }
}

/** A repo's groups, cleaned, without a second of any id or name, at most GROUP_MAX. */
export function cleanGroups(list) {
  const out = []
  for (const g of Array.isArray(list) ? list : []) {
    const c = cleanGroup(g)
    if (!c || out.length >= GROUP_MAX || out.some((x) => x.id === c.id || sameName(x.name, c.name))) continue
    out.push(c)
  }
  return out
}

/** Repo name → its groups. A repo left with none is dropped rather than kept as []. */
export function cleanGroupMap(v) {
  const out = {}
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out
  for (const [k, list] of Object.entries(v)) {
    if (k === '__proto__') continue
    const ok = cleanGroups(list)
    if (ok.length) out[k] = ok
  }
  return out
}

/** Thread id → the id of its group, with anything that isn't one dropped. */
export function cleanGroupOf(v) {
  const out = {}
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out
  for (const [k, id] of Object.entries(v)) if (k !== '__proto__' && isGroupId(id)) out[k] = id
  return out
}

/**
 * A new group's id, from its name, unique among `taken`: the repo's groups and every id a thread
 * still names, so a new group never inherits the threads of one deleted before it.
 */
export function groupId(name, taken = []) {
  const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'group'
  const used = new Set(taken)
  let id = `g-${slug}`
  for (let n = 2; used.has(id); n++) id = `g-${slug}-${n}`
  return id
}

/**
 * The order a repo's new groups take their colours in, as steps round the accents from the plot's
 * own: across the wheel first, so two groups made one after the other never fly neighbouring
 * colours, and the plot's own last, so a group's flag stands out from the plot it flies over.
 */
const PICK = [5, 2, 8, 3, 7, 1, 6, 9, 4, 0]

/** The colour a new group flies: the first in PICK's order that no other group in the repo has. */
export function freeColor(groups = [], accent = 0) {
  const used = new Set(groups.map((g) => g.color))
  const from = Number.isInteger(accent) ? accent : 0
  const order = PICK.map((d) => (((from + d) % GROUP_COLORS) + GROUP_COLORS) % GROUP_COLORS)
  return order.find((c) => !used.has(c)) ?? order[groups.length % order.length]
}

/** The group thread `t` is in, `{ id, name, color }`, or null: only one its own repo still has. */
export function groupFor(t, groups = {}, groupOf = {}) {
  const id = own(groupOf, t?.id) ? groupOf[t.id] : ''
  const list = id && own(groups, t.project) ? groups[t.project] : null
  return (Array.isArray(list) && list.find((g) => g.id === id)) || null
}

/** Each thread wearing its group as `group`, or null for one in none. */
export function withGroups(threads, groups = {}, groupOf = {}) {
  return threads.map((t) => ({ ...t, group: groupFor(t, groups, groupOf) }))
}

/**
 * A repo's threads under its groups, in the order the groups were made, and the rest after them.
 * Each keeps the threads in the order they came. Every group is listed, empty or not.
 */
export function partition(threads, groups = []) {
  const byId = new Map(groups.map((g) => [g.id, { ...g, threads: [] }]))
  const rest = []
  for (const t of threads) (byId.get(t.group?.id)?.threads ?? rest).push(t)
  return { groups: [...byId.values()], rest }
}

/**
 * How long a new session started in a group is waited for: long enough to write a first prompt in
 * the editor it opened in, short enough that one started much later can't take its place.
 */
export const JOIN_WAIT_MS = 30 * 60 * 1000
/**
 * A new thread may be stamped a little before the page asked for it: a desktop record is written by
 * another process, on its own clock, and rounds down.
 */
export const JOIN_SLACK_MS = 60 * 1000

/**
 * Sessions started in a group take it up as they arrive: for each one waited for, the thread on its
 * repo made earliest since it was asked for that wasn't there when it was (`before`, the ids its
 * repo had then) and is in no group yet. Oldest ask first, so two started one after the other join
 * in the order they were started.
 * @param {{ project: string, group: string, at: number, before?: string[] }[]} waiting
 * @returns {{ joins: Record<string, string>, waiting: object[] }} thread id → group id, and what
 *          is still to come
 */
export function arrivals(waiting, threads, groupOf = {}, now = Date.now()) {
  const joins = {}
  const left = []
  const taken = new Set(Object.keys(groupOf))
  for (const w of [...waiting].sort((a, b) => a.at - b.at)) {
    if (now - w.at > JOIN_WAIT_MS) continue
    const there = new Set(w.before || [])
    const t = threads
      .filter((x) => x.project === w.project && !taken.has(x.id) && !there.has(x.id) && (x.createdAt || 0) >= w.at - JOIN_SLACK_MS)
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0) || (a.id < b.id ? -1 : 1))[0]
    if (!t) {
      left.push(w)
      continue
    }
    joins[t.id] = w.group
    taken.add(t.id)
  }
  return { joins, waiting: left }
}
