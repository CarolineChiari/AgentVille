// A post mortem's words: what one finds, how it is kept, and the prompt that works through it. Pure,
// shared by the server that holds them (server/postmortem.mjs) and the page that shows them.
//
// A post mortem looks back at one conversation from two sides: the session itself, asked in a copy
// of it, and a reviewer that reads its transcript cold. Each gives the same five lists.

/** What a side finds, in the order the space shows them. */
export const KINDS = ['instructions', 'lessons', 'forYou', 'wentWell']
export const KIND_LABEL = {
  instructions: 'Changes to the instructions',
  lessons: 'Lessons learned',
  forYou: 'Feedback for you',
  wentWell: 'What went well',
}

/** Who said it: the session, asked about itself, or a reviewer reading its transcript. */
export const SOURCES = ['self', 'review']
export const SOURCE_LABEL = { self: 'the session', review: 'the reviewer' }

/** Where a post mortem is: both sides out, finished (one side may have come back empty), or neither came back. */
export const PM_PHASES = ['running', 'done', 'failed']
export const isPmRunning = (p) => p?.phase === 'running'

/** How long its findings may run. Lists are short on purpose: five honest lines beat twenty padded ones. */
export const LIST_MAX = 6
export const ITEM_MAX = 500
export const WHERE_MAX = 120
export const PM_SUMMARY_MAX = 600
export const NOTE_MAX = 300
// Longer than any folder's path; one that is isn't kept, and the work-through asks for a folder instead.
export const PATH_MAX = 1024

/** Post mortems kept. The oldest go first; the space is for working through, not an archive of its own. */
export const POSTMORTEM_MAX = 50

// Same shape as the foreman's: a post mortem is read back from data/postmortems.json, which a person could edit.
const ID_RE = /^[a-z][a-z0-9-]{0,30}:[A-Za-z0-9_.:-]{1,120}$/
export const isThreadId = (v) => typeof v === 'string' && ID_RE.test(v)

/** One finding's key, for ticking it off: `<source>.<kind>.<index>`. */
const KEY_RE = /^(self|review)\.(instructions|lessons|forYou|wentWell)\.[0-9]{1,2}$/
export const isItemKey = (v) => typeof v === 'string' && KEY_RE.test(v)

const text = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')
const list = (v) => (Array.isArray(v) ? v : [])

/** What one side found, as kept; null when there is nothing in it at all. */
export function cleanFindings(v) {
  if (!v || typeof v !== 'object') return null
  const lines = (a) => list(a).map((x) => text(x, ITEM_MAX)).filter(Boolean).slice(0, LIST_MAX)
  const out = {
    summary: text(v.summary, PM_SUMMARY_MAX),
    instructions: list(v.instructions)
      .map((x) => (x && typeof x === 'object' ? { where: text(x.where, WHERE_MAX), change: text(x.change, ITEM_MAX) } : null))
      .filter((x) => x?.change)
      .slice(0, LIST_MAX),
    lessons: lines(v.lessons),
    forYou: lines(v.forYou),
    wentWell: lines(v.wentWell),
  }
  return out.summary || KINDS.some((k) => out[k].length) ? out : null
}

/** One post mortem as kept, or null when it isn't one. */
export function cleanPostMortem(p) {
  if (!p || typeof p !== 'object' || !isThreadId(p.id)) return null
  const phase = PM_PHASES.includes(p.phase) ? p.phase : 'failed'
  return {
    id: p.id,
    title: text(p.title, 120),
    project: text(p.project, 120),
    // Where the work-through starts: a folder's name can be shared by two repos, its path can't.
    projectPath: typeof p.projectPath === 'string' && p.projectPath.length <= PATH_MAX ? p.projectPath : '',
    phase,
    startedAt: Number(p.startedAt) || 0,
    finishedAt: Number(p.finishedAt) || 0,
    error: text(p.error, NOTE_MAX),
    costUsd: Number(p.costUsd) || 0,
    self: cleanFindings(p.self),
    selfNote: text(p.selfNote, NOTE_MAX),
    review: cleanFindings(p.review),
    reviewNote: text(p.reviewNote, NOTE_MAX),
    done: [...new Set(list(p.done).filter(isItemKey))],
  }
}

/**
 * Every finding of a post mortem in one list, each with the key it is ticked off by: grouped by
 * kind, the session's own word before the reviewer's.
 * @returns {{ key: string, source: string, kind: string, text: string, where: string, done: boolean }[]}
 */
export function itemsOf(p) {
  const done = new Set(p?.done || [])
  const out = []
  for (const kind of KINDS) {
    for (const source of SOURCES) {
      list(p?.[source]?.[kind]).forEach((x, i) => {
        const key = `${source}.${kind}.${i}`
        const it = kind === 'instructions' ? { text: x.change, where: x.where } : { text: x, where: '' }
        out.push({ key, source, kind, ...it, done: done.has(key) })
      })
    }
  }
  return out
}

/** How many findings are still to work through: what went well needs no work. */
export const openCount = (p) => itemsOf(p).filter((i) => !i.done && i.kind !== 'wentWell').length

/**
 * The first prompt for a session that works through what a post mortem found: the changes to the
 * project's instructions, and the lessons worth writing down. `keys` narrows it to some; none is
 * every one not yet ticked off. Feedback for the person is theirs, not a session's, so it stays out.
 */
export function workPrompt(p, keys = []) {
  const only = new Set(keys)
  const items = itemsOf(p).filter((i) => (only.size ? only.has(i.key) : !i.done) && (i.kind === 'instructions' || i.kind === 'lessons'))
  if (!items.length) return ''
  const changes = items.filter((i) => i.kind === 'instructions').map((i) => `- ${i.where ? `${i.where}: ` : ''}${i.text}`)
  const lessons = items.filter((i) => i.kind === 'lessons').map((i) => `- ${i.text}`)
  return [
    `A post mortem of an earlier session in this project, “${p.title || 'Untitled'}”, suggested the improvements below.`,
    'Read the project’s current instructions first (CLAUDE.md, and any skills or docs they point to). For each suggestion, decide whether it is right and not already covered; write the ones that are into the instructions, in their voice and as briefly as they allow; and tell me which you left out and why. Show me the changes before committing anything.',
    changes.length ? `\nChanges to the instructions:\n${changes.join('\n')}` : '',
    lessons.length ? `\nLessons learned, worth writing down where the next session will see them:\n${lessons.join('\n')}` : '',
  ].filter(Boolean).join('\n')
}

/** A post mortem summed up in a sentence: the toast when it finishes. */
export function pmLine(p) {
  const who = `“${p?.title || 'Untitled'}”`
  if (p?.phase === 'failed') return `The post mortem of ${who} couldn’t finish: ${p.error || 'something went wrong.'}`
  const n = openCount(p)
  return `The post mortem of ${who} is in: ${n} thing${n === 1 ? '' : 's'} to work through.`
}
