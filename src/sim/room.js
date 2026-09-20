// Inside one building: the room a session works in, laid out in tile units. Pure, like the rest
// of src/sim — no DOM, no canvas — so the layout can be tested and a renderer only draws it.
//
// The room is the same room every time for the same thread: what is in it changes with the work,
// where it stands does not. Nothing here knows a colour; `style` is the building's own, so a
// stone tower and a timber cottage are furnished from different materials.
import { hashString } from './rng.js'

/** The floor, in tiles. Wide enough for a desk, a bed and a way between them. */
export const ROOM_W = 11
export const ROOM_H = 6
/** How much wall stands above the floor's back edge, in tiles. */
export const WALL_H = 2

/** Books a shelf holds per row, and how many rows it has: one spine per file, oldest pushed off. */
const SHELF_COLS = 7
const SHELF_ROWS = 3
export const SHELF_MAX = SHELF_COLS * SHELF_ROWS
/** Notes a pinboard holds: one per commit, newest first. */
export const PIN_MAX = 8

/** Where each fixed piece stands: tile (x, y) of the tile it occupies, nearest the back wall first. */
const SPOTS = {
  shelf: { x: 1, y: 0 },
  pinboard: { x: 7, y: -1 }, // on the wall, not the floor
  window: [{ x: 3, y: -1 }, { x: 9, y: -1 }],
  desk: { x: 3, y: 2 },
  chair: { x: 3, y: 3 },
  bed: { x: 8, y: 2 },
  rug: { x: 5, y: 4 },
  // In the back wall, where you can see it: the way in is the way out, and it is what you click
  // to leave. A door in the near wall would be behind the camera in this view.
  door: { x: 5, y: -1 },
}

/** How tall a spine is: a file worked over many times has more in it. 0 is a thin one. */
const spineFor = (f) => ({
  // A path's own hash picks its colour, so the same file is the same book every time it is drawn.
  color: hashString(`spine:${f.path}`) % 8,
  tall: Math.min(2, Math.floor(Math.log2(Math.max(1, f.edits)))),
  path: f.path,
})

/**
 * Where the villager is and what it is doing in here. The room says the same thing its building
 * says from the street: working is at the desk, waiting is on its feet with a question, asleep is
 * in bed. Anything else is standing about on the rug.
 */
function villagerAt(status) {
  if (status === 'working') return { ...SPOTS.chair, facing: 'n', anim: 'sit', inBed: false }
  if (status === 'waiting' || status === 'blocked') return { x: 6, y: 4, facing: 's', anim: 'idle', inBed: false }
  // Asleep, it is under the covers: the bed shows that, and a `z` floats over it.
  if (status === 'sleeping') return { ...SPOTS.bed, facing: 's', anim: null, inBed: true }
  return { ...SPOTS.rug, facing: 's', anim: 'idle', inBed: false }
}

/**
 * The room of one thread.
 *
 * @param {object} thread            the Thread; only its status and id are read
 * @param {object} opts
 * @param {object} opts.style        the building's plot style (src/sim/style.js)
 * @param {object} opts.look         the villager's look, for drawing whoever lives here
 * @param {number} opts.variant      the building's variant, so its room varies with it
 * @param {object[]} opts.files      what the session changed, from the harness's readChanges
 * @param {object[]} opts.commits    the commits it made
 * @param {number} opts.night        0 in daylight, 1 in the dark: the window, and the lamp
 * @returns {RoomFrame}
 */
export function roomFrame(thread, { style, look = null, variant = 0, files = [], commits = [], night = 0 } = {}) {
  const status = thread?.status || 'idle'
  // Newest last on the shelf, so a long session's oldest files are the ones pushed off the end.
  const shelved = files.slice(0, SHELF_MAX).map(spineFor)
  const props = [
    { kind: 'shelf', ...SPOTS.shelf, books: shelved, cols: SHELF_COLS, rows: SHELF_ROWS },
    { kind: 'pinboard', ...SPOTS.pinboard, notes: commits.slice(-PIN_MAX).map((c, i) => ({ seed: i, message: c.message })) },
    ...SPOTS.window.map((w) => ({ kind: 'window', ...w, night })),
    { kind: 'rug', ...SPOTS.rug, variant },
    { kind: 'desk', ...SPOTS.desk, on: status === 'working' },
    { kind: 'chair', ...SPOTS.chair },
    { kind: 'bed', ...SPOTS.bed, slept: status === 'sleeping' },
    { kind: 'door', ...SPOTS.door },
  ]
  return {
    id: thread?.id || '',
    w: ROOM_W,
    h: ROOM_H,
    wallH: WALL_H,
    style,
    variant,
    status,
    night,
    // A lamp is on whenever the room is dark or its villager is up and working.
    lamp: night > 0.35 || status === 'working' || status === 'waiting',
    door: { ...SPOTS.door },
    props: props.sort((a, b) => a.y - b.y),
    villager: { ...villagerAt(status), look, status },
    counts: { files: files.length, commits: commits.length, shelved: shelved.length },
  }
}

/**
 * Is a tile the door? The way out is the way in, so a click on it leaves — the room has no other
 * exit, and Esc does the same.
 */
export const isDoor = (room, tx, ty) => Math.floor(tx) === room.door.x && Math.floor(ty) === room.door.y
