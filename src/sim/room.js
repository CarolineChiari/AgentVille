// Inside one building: the room a session works in, laid out in tile units. Pure, like the rest
// of src/sim — no DOM, no canvas — so the layout can be tested and a renderer only draws it.
//
// The room is the same room every time for the same thread: what is in it changes with the work,
// where it stands does not. Nothing here knows a colour; `style` is the building's own, so a
// stone tower and a timber cottage are furnished from different materials.
//
// The change log is in here too, on the board across the back wall — the work is what the room is
// about, so it is read in the room rather than in a panel beside it.
import { hashString } from './rng.js'
import { countDiff, diffLines, foldContext } from './diff.js'
import { BOARD_H, BOARD_W, interiorFor } from './interiors.js'

// The room's own plan — how big it is and where everything in it stands — is one of its theme's,
// in src/sim/interiors.js. The default room's size is re-exported here because it is what a room
// is measured against.
export { ROOM_H, ROOM_W, WALL_H } from './interiors.js'

/** Books a shelf holds per row, and how many rows it has: one spine per file, oldest pushed off. */
const SHELF_COLS = 7
const SHELF_ROWS = 3
export const SHELF_MAX = SHELF_COLS * SHELF_ROWS
/** Notes a pinboard holds: one per commit, newest first. */
export const PIN_MAX = 8
/** Lines of log the board holds at once. Past that it scrolls. */
export const BOARD_ROWS = 14
/**
 * Lines the board holds when it is read close up, reviewing one file's changes. The board is the
 * same board; it is only that you have walked up to it, so the writing can be smaller.
 */
export const REVIEW_ROWS = 28
/** Edits shown under one unfolded file: the last few are the ones you came to read. */
const EDITS_OPEN = 8
/** What burns when the room's lamp is on, so a room lights up all at once or not at all. */
const BURNS = new Set(['stove', 'lamp'])

/** How tall a spine is: a file worked over many times has more in it. 0 is a thin one. */
const spineFor = (f) => ({
  // A path's own hash picks its colour, so the same file is the same book every time it is drawn.
  color: hashString(`spine:${f.path}`) % 8,
  tall: Math.min(2, Math.floor(Math.log2(Math.max(1, f.edits)))),
  path: f.path,
})

/**
 * Where the villager is and what it is doing in here, in the room it is in. The room says the same
 * thing its building says from the street: working is at the desk, waiting is on its feet with a
 * question, asleep is in bed. Anything else is standing about on the rug.
 */
function villagerAt(status, plan) {
  if (status === 'working') return { ...plan.chair, facing: 'n', anim: 'sit', inBed: false }
  if (status === 'waiting' || status === 'blocked') return { ...plan.stand, facing: 's', anim: 'idle', inBed: false }
  // Asleep, it is under the covers: the bed shows that, and a `z` floats over it.
  if (status === 'sleeping') return { ...plan.bed, facing: 's', anim: null, inBed: true }
  return { ...plan.rug, facing: 's', anim: 'idle', inBed: false }
}

/**
 * How long ago, in the fewest words that fit on a board. The renderer is handed the words rather
 * than the time, so it never has to work out what "now" is.
 */
export function since(at, now = Date.now()) {
  if (!at) return ''
  const s = Math.max(0, Math.round((now - at) / 1000))
  if (s < 60) return 'now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.round(m / 60)
  if (h < 48) return `${h}h`
  return `${Math.round(h / 24)}d`
}

/** Everything that happened, in the order it happened, with each commit after the edits it committed. */
export function timeline(log) {
  const items = [
    ...(log?.entries || []).map((e) => ({ ...e, row: 'entry' })),
    ...(log?.commits || []).map((c) => ({ ...c, row: 'commit' })),
  ]
  return items.sort((a, b) => a.at - b.at || (a.row === 'commit' ? 1 : -1))
}

/**
 * The lines on the board: what it says, in order, already cut to the page being looked at. A line
 * with an `act` is one worth clicking — `fold` opens a file's own edits, `open` opens the file.
 *
 * @param {object} log      what the harness read back: { ok, files, entries, commits, more }
 * @param {{ view?: 'files'|'order', scroll?: number, open?: string, rows?: number, now?: number }} opts
 * @returns {{ lines: object[], total: number, scroll: number, rows: number }}
 */
export function logRows(log, { view = 'files', scroll = 0, open = '', rows = BOARD_ROWS, now = Date.now() } = {}) {
  const all = []
  if (!log || !log.ok) {
    all.push({ type: 'note', text: log ? log.error || 'Nothing to read.' : 'Reading the log…' })
  } else if (view === 'files') {
    const files = [...(log.files || [])].sort((a, b) => b.at - a.at)
    if (!files.length) all.push({ type: 'note', text: 'This session hasn’t changed a file yet.' })
    for (const f of files) {
      const unfolded = f.path === open
      all.push({ type: 'file', path: f.path, kind: f.kind, count: f.edits, when: since(f.at, now), outside: f.outside, open: unfolded, act: 'fold' })
      if (!unfolded) continue
      for (const e of (log.entries || []).filter((x) => x.path === f.path).slice(-EDITS_OPEN)) {
        all.push({ type: 'edit', kind: e.kind, text: e.excerpt || e.tool, when: since(e.at, now) })
      }
      all.push({ type: 'review', path: f.path, act: 'review', text: `read the ${f.edits === 1 ? 'change' : `${f.edits} changes`}` })
      all.push({ type: 'open', path: f.path, outside: f.outside, act: f.outside ? '' : 'open', text: f.outside ? 'outside this repo' : 'open this file in the editor' })
    }
  } else {
    const items = timeline(log)
    if (!items.length) all.push({ type: 'note', text: 'Nothing written down yet.' })
    for (const it of items) {
      if (it.row === 'commit') all.push({ type: 'commit', text: it.message || '(no message)', when: since(it.at, now) })
      else all.push({ type: 'entry', path: it.path, kind: it.kind, text: it.excerpt || it.tool, when: since(it.at, now), outside: it.outside, act: 'review' })
    }
  }
  if (log?.more) all.push({ type: 'note', text: `${log.more} more not shown.` })
  // Clamped here rather than by whoever scrolls, so the board can never be scrolled past its end.
  const max = Math.max(0, all.length - rows)
  const from = Math.max(0, Math.min(Math.round(scroll), max))
  return { lines: all.slice(from, from + rows), total: all.length, scroll: from, rows }
}

/**
 * The lines of one file's changes, read close up: each edit the session made to it, in order, as
 * the diff between what it matched and what it put there. A `Write` replaced nothing, so it reads
 * as a file arriving whole.
 *
 * @param {{ ok?: boolean, path?: string, edits?: object[], error?: string }} file  from readChanges
 * @param {{ scroll?: number, rows?: number, now?: number }} opts
 */
export function reviewRows(file, { scroll = 0, rows = REVIEW_ROWS, now = Date.now() } = {}) {
  const all = [{ type: 'back', text: '← back to the log', act: 'back' }]
  if (!file) all.push({ type: 'note', text: 'Reading the changes…' })
  else if (!file.ok) all.push({ type: 'note', text: file.error || 'Nothing to read.' })
  else if (!file.edits?.length) all.push({ type: 'note', text: 'Nothing was written to this file that can be read back.' })
  else {
    // Newest first: the last thing done to a file is the thing you came to look at.
    const edits = [...file.edits].reverse()
    for (const [i, e] of edits.entries()) {
      const rowsOf = e.hunks.map((h) => foldContext(diffLines(h.before, h.after)))
      const sum = rowsOf.reduce((acc, r) => {
        const c = countDiff(r)
        return { added: acc.added + c.added, removed: acc.removed + c.removed }
      }, { added: 0, removed: 0 })
      all.push({
        type: 'edit-head',
        text: `${e.tool}${e.hunks.length > 1 ? ` · ${e.hunks.length} places` : ''}`,
        when: since(e.at, now),
        added: sum.added,
        removed: sum.removed,
      })
      for (const [h, hunk] of rowsOf.entries()) {
        if (h) all.push({ type: 'hunk', text: '⋯' })
        for (const line of hunk) all.push({ type: 'diff', sign: line.sign, text: line.text })
      }
      if (i < edits.length - 1) all.push({ type: 'gap', text: '' })
    }
  }
  const max = Math.max(0, all.length - rows)
  const from = Math.max(0, Math.min(Math.round(scroll), max))
  return { lines: all.slice(from, from + rows), total: all.length, scroll: from, rows }
}

/**
 * The room of one thread.
 *
 * @param {object} thread            the Thread; its status, title and facts are read
 * @param {object} opts
 * @param {object} opts.style        the building's plot style (src/sim/style.js)
 * @param {object} opts.look         the villager's look, for drawing whoever lives here
 * @param {number} opts.variant      the building's variant, so its room varies with it
 * @param {object} opts.log          what the session changed, from the harness's readChanges
 * @param {{ view?: string, scroll?: number, open?: string }} opts.board  which page of the log is up
 * @param {number} opts.night        0 in daylight, 1 in the dark: the window, and the lamp
 * @param {object} opts.interior     the room's plan (src/sim/interiors.js); left out, the one its
 *                                   plot's theme keeps for this thread
 * @returns {RoomFrame}
 */
export function roomFrame(thread, { style, look = null, variant = 0, log = null, board = {}, night = 0, interior = null, now = Date.now() } = {}) {
  const status = thread?.status || 'idle'
  const files = log?.files || []
  const commits = log?.commits || []
  const plan = interior || interiorFor(style, thread?.id || '')
  // A lamp is on whenever the room is dark or its villager is up and working. What burns in the
  // room burns with it: a stove is out and a candle unlit in an empty room in daylight.
  const lamp = night > 0.35 || status === 'working' || status === 'waiting'
  // Newest last on the shelf, so a long session's oldest files are the ones pushed off the end.
  const shelved = files.slice(0, SHELF_MAX).map(spineFor)
  const props = [
    { kind: 'pinboard', ...plan.pinboard, notes: commits.slice(-PIN_MAX).map((c, i) => ({ seed: i, message: c.message })) },
    ...plan.windows.map((w) => ({ kind: 'window', ...w, night })),
    { kind: 'door', ...plan.door },
    { kind: 'shelf', ...plan.shelf, books: shelved, cols: SHELF_COLS, rows: SHELF_ROWS },
    { kind: 'rug', ...plan.rug, variant },
    { kind: 'desk', ...plan.desk, on: status === 'working' },
    { kind: 'chair', ...plan.chair },
    { kind: 'bed', ...plan.bed, slept: status === 'sleeping' },
    ...plan.extra.map((e) => ({ variant: 0, ...e, ...(BURNS.has(e.kind) ? { lit: lamp } : {}) })),
  ]
  const view = board.view === 'order' ? 'order' : 'files'
  // Reviewing one file takes the board over: you are standing at it, reading the changes.
  const review = board.review || ''
  const page = review
    ? reviewRows(board.file, { scroll: board.scroll ?? 0, now })
    : logRows(log, { view, scroll: board.scroll ?? 0, open: board.open ?? '', now })
  return {
    id: thread?.id || '',
    w: plan.w,
    h: plan.h,
    wallH: plan.wallH,
    style,
    variant,
    status,
    night,
    /** Which of its theme's rooms this is: its id, and what that theme calls it. */
    interior: { id: plan.id, label: plan.label, blurb: plan.blurb },
    lamp,
    /** Where the lamplight pools, in tiles: over the desk, wherever the desk stands. */
    lampAt: { x: plan.desk.x + 0.5, y: plan.desk.y + 1 },
    door: { ...plan.door },
    props: props.sort((a, b) => a.y - b.y),
    villager: { ...villagerAt(status, plan), look, status },
    counts: { files: files.length, commits: commits.length, shelved: shelved.length },
    /** The board on the wall: where it hangs, what it says, and which page of it is up. */
    board: {
      ...plan.board,
      w: BOARD_W,
      h: BOARD_H,
      view,
      review,
      open: board.open ?? '',
      heading: review || thread?.title || 'Untitled',
      sub: review
        ? `${thread?.project || ''}${board.file?.edits?.length ? ` · ${board.file.edits.length} change${board.file.edits.length === 1 ? '' : 's'}` : ''}`
        : [thread?.project, thread?.gitBranch, thread?.model, since(thread?.lastActivityAt, now)].filter(Boolean).join(' · '),
      tabs: review ? [] : [
        { key: 'files', label: `By file${files.length ? ` (${files.length})` : ''}`, on: view === 'files' },
        { key: 'order', label: `In order${commits.length ? ` · ${commits.length} commit${commits.length === 1 ? '' : 's'}` : ''}`, on: view === 'order' },
      ],
      ...page,
    },
  }
}

/**
 * Is a tile the door? The way out is the way in, so a click on it leaves — the room has no other
 * exit, and Esc does the same.
 */
export const isDoor = (room, tx, ty) => Math.floor(tx) === room.door.x && Math.floor(ty) === room.door.y
