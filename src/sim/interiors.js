// The rooms a session can work in: where everything stands inside a building, in tile units. Pure,
// like the rest of src/sim — no DOM, no canvas — so a layout can be tested and a renderer only
// draws it.
//
// A room is the building's inside the way a sub-theme is its outside: each theme keeps its own
// rooms, in its own words, and a folder that has picked a look works in one of them. Which room a
// thread gets is a hash of its id, so it is the same room every time; what stands in the room is
// the same in all of them, because the room has to say the same things wherever it is. Every one
// has a board to read, a shelf for the files, a pinboard for the commits, a desk with the monitor
// on it, a chair to work in, a bed to sleep in, a rug to stand on and a door out. What changes is
// where they stand, how big the room is, and what else is in it.
import { hashString } from './rng.js'
import { themeOf } from './themes.js'

/** The room every theme starts from: wide enough for the board, a desk, a bed and a way between them. */
export const ROOM_W = 16
export const ROOM_H = 5
/** How much wall stands above the floor's back edge. Tall enough to hang the board on. */
export const WALL_H = 7
/**
 * The board is the same board in every room — one sprite, drawn at one size — so a layout moves it
 * about the wall rather than resizing it. In tiles.
 */
export const BOARD_W = 10
export const BOARD_H = 6

/**
 * What each piece takes up, in tiles: how wide it stands and how many rows it rises through,
 * counting up from the row it stands on. Heights are what a piece hides behind it, so a chair
 * (which stands in front of its desk) and a window (which sits above the floor line) are one row
 * even though their sprites are taller. Used to lay rooms out and to hold every layout to them.
 */
export const FOOTPRINT = {
  shelf: { w: 2, h: 3 },
  pinboard: { w: 3, h: 2 },
  window: { w: 1, h: 1 },
  door: { w: 1, h: 2 },
  desk: { w: 2, h: 2 },
  chair: { w: 1, h: 1 },
  bed: { w: 2, h: 2 },
  rug: { w: 3, h: 1 },
  table: { w: 2, h: 2 },
  stool: { w: 1, h: 1 },
  crate: { w: 2, h: 2 },
  stove: { w: 2, h: 3 },
  plant: { w: 2, h: 2 },
  lamp: { w: 1, h: 3 },
  hanging: { w: 2, h: 2 },
  ladder: { w: 1, h: 4 },
  drawers: { w: 2, h: 2 },
}

/** The pieces every room has, whatever else is in it: each one says something about the work. */
export const REQUIRED = ['pinboard', 'door', 'shelf', 'rug', 'desk', 'chair', 'bed']

/**
 * @typedef {object} Interior  One room's plan, in tiles. Floor tiles run y 0…h-1; the wall above
 *          the floor's back edge runs y -wallH…-1, and anything hung on it has a negative y.
 * @property {string} id
 * @property {string} label   what this room is called, in its theme's own words
 * @property {string} blurb   one line, for the panel that names it
 * @property {string[]} [subs]  the sub-themes it belongs to; a plot wearing one works in it
 * @property {number} w
 * @property {number} h
 * @property {number} wallH
 * @property {{ x: number, y: number }} board  where the board hangs; it is always BOARD_W × BOARD_H
 * @property {{ x: number, y: number }} pinboard
 * @property {{ x: number, y: number }} door
 * @property {{ x: number, y: number }} shelf
 * @property {{ x: number, y: number }} desk
 * @property {{ x: number, y: number }} chair
 * @property {{ x: number, y: number }} bed
 * @property {{ x: number, y: number }} rug    where a villager with nothing to do stands
 * @property {{ x: number, y: number }} stand  where it stands when it is waiting on you
 * @property {{ x: number, y: number }[]} windows
 * @property {{ kind: string, x: number, y: number, variant?: number }[]} extra  whatever else the
 *           room has in it: none of it means anything, all of it says where you are
 */

/** A room, with the size every theme starts from unless it says otherwise. */
const room = (id, label, blurb, plan) => ({ id, label, blurb, w: ROOM_W, h: ROOM_H, wallH: WALL_H, windows: [], extra: [], ...plan })

/**
 * Every theme's rooms. The first of a theme's is the one a plot works in when nothing else fits,
 * so the village's study — the room every session had before there were rooms — stays first.
 * @type {Record<string, Interior[]>}
 */
export const INTERIORS = {
  village: [
    room('study', 'Study', 'A cottage room: the board over the desk, books along the wall', {
      board: { x: 5, y: -7 },
      pinboard: { x: 1, y: -3 },
      windows: [{ x: 5, y: -1 }, { x: 14, y: -1 }],
      door: { x: 3, y: -1 },
      shelf: { x: 1, y: 0 },
      desk: { x: 4, y: 2 },
      chair: { x: 4, y: 3 },
      bed: { x: 12, y: 2 },
      rug: { x: 8, y: 3 },
      stand: { x: 9, y: 3 },
    }),
    room('parlour', 'Parlour', 'The good room: a stove at one end, the board at the other', {
      subs: ['market-town', 'tudor-lane'],
      board: { x: 6, y: -7 },
      pinboard: { x: 2, y: -3 },
      windows: [{ x: 5, y: -1 }, { x: 11, y: -1 }],
      door: { x: 1, y: -1 },
      shelf: { x: 13, y: 1 },
      desk: { x: 6, y: 2 },
      chair: { x: 6, y: 3 },
      bed: { x: 9, y: 2 },
      rug: { x: 1, y: 3 },
      stand: { x: 2, y: 3 },
      extra: [
        { kind: 'stove', x: 3, y: 2 },
        { kind: 'plant', x: 14, y: 3, variant: 1 },
      ],
    }),
    room('loft', 'Loft room', 'Up under the roof, a ladder through the floor and the eaves for shelves', {
      subs: ['farmstead', 'stone-hamlet'],
      wallH: 8,
      board: { x: 5, y: -8 },
      pinboard: { x: 1, y: -2 },
      windows: [{ x: 6, y: -1 }, { x: 13, y: -1 }],
      door: { x: 4, y: -1 },
      shelf: { x: 0, y: 1 },
      desk: { x: 5, y: 2 },
      chair: { x: 5, y: 3 },
      bed: { x: 11, y: 2 },
      rug: { x: 7, y: 3 },
      stand: { x: 8, y: 3 },
      extra: [
        { kind: 'ladder', x: 15, y: 0 },
        { kind: 'crate', x: 2, y: 2 },
        { kind: 'lamp', x: 10, y: 3, variant: 1 },
      ],
    }),
  ],
  construction: [
    room('site-cabin', 'Site cabin', 'A cabin on blocks: drawings on the wall, a camp bed in the corner', {
      subs: ['new-homes', 'roadworks'],
      board: { x: 3, y: -7 },
      pinboard: { x: 13, y: -3 },
      windows: [{ x: 5, y: -1 }, { x: 14, y: -1 }],
      door: { x: 2, y: -1 },
      shelf: { x: 0, y: 1 },
      desk: { x: 3, y: 2 },
      chair: { x: 3, y: 3 },
      bed: { x: 12, y: 2 },
      rug: { x: 8, y: 3 },
      stand: { x: 11, y: 3 },
      extra: [
        { kind: 'hanging', x: 0, y: -4, variant: 1 },
        { kind: 'crate', x: 6, y: 2 },
        { kind: 'crate', x: 14, y: 3, variant: 1 },
      ],
    }),
    room('drawing-office', 'Drawing office', 'A board, a drawing board and a plan chest under the window', {
      subs: ['high-rise', 'restoration'],
      board: { x: 5, y: -7 },
      pinboard: { x: 1, y: -3 },
      windows: [{ x: 6, y: -1 }, { x: 13, y: -1 }],
      door: { x: 3, y: -1 },
      shelf: { x: 1, y: 0 },
      desk: { x: 6, y: 2 },
      chair: { x: 6, y: 3 },
      bed: { x: 12, y: 2 },
      rug: { x: 3, y: 3 },
      stand: { x: 4, y: 3 },
      extra: [
        { kind: 'drawers', x: 14, y: 2, variant: 1 },
        { kind: 'table', x: 9, y: 2, variant: 1 },
        { kind: 'stool', x: 9, y: 3 },
      ],
    }),
    room('container', 'Container office', 'A fitted-out container: long, low, and warm at one end', {
      subs: ['industrial'],
      w: 18,
      h: 4,
      board: { x: 6, y: -7 },
      pinboard: { x: 1, y: -3 },
      windows: [{ x: 5, y: -1 }, { x: 16, y: -1 }],
      door: { x: 4, y: -1 },
      shelf: { x: 0, y: 1 },
      desk: { x: 6, y: 1 },
      chair: { x: 6, y: 2 },
      bed: { x: 14, y: 1 },
      rug: { x: 8, y: 3 },
      stand: { x: 12, y: 2 },
      extra: [
        { kind: 'stove', x: 2, y: 2 },
        { kind: 'crate', x: 10, y: 1 },
        { kind: 'hanging', x: 16, y: -4, variant: 1 },
      ],
    }),
  ],
  elvish: [
    room('flet', 'Flet', 'A platform in the branches, open to the wood on three sides', {
      subs: ['greenwood', 'goldenbough'],
      wallH: 8,
      board: { x: 4, y: -8 },
      pinboard: { x: 0, y: -2 },
      windows: [{ x: 1, y: -1 }, { x: 8, y: -1 }, { x: 13, y: -1 }],
      door: { x: 3, y: -1 },
      shelf: { x: 14, y: 1 },
      desk: { x: 5, y: 2 },
      chair: { x: 5, y: 3 },
      bed: { x: 11, y: 2 },
      rug: { x: 7, y: 3 },
      stand: { x: 9, y: 3 },
      extra: [
        { kind: 'plant', x: 2, y: 2, variant: 2 },
        { kind: 'lamp', x: 9, y: 2 },
      ],
    }),
    room('scriptorium', 'Scriptorium', 'Where the copying is done: a lectern, a lamp and shelves to the ceiling', {
      subs: ['silverwood', 'riverhall'],
      board: { x: 3, y: -7 },
      pinboard: { x: 13, y: -3 },
      windows: [{ x: 0, y: -1 }, { x: 14, y: -1 }],
      door: { x: 1, y: -1 },
      shelf: { x: 2, y: 1 },
      desk: { x: 8, y: 2 },
      chair: { x: 8, y: 3 },
      bed: { x: 12, y: 2 },
      rug: { x: 4, y: 3 },
      stand: { x: 10, y: 3 },
      extra: [
        { kind: 'drawers', x: 14, y: 2 },
        { kind: 'table', x: 5, y: 2, variant: 1 }, // the lectern the copying is done at
        { kind: 'lamp', x: 7, y: 2 },
      ],
    }),
    room('starlit-hall', 'Starlit hall', 'A long hall with the sky down one side and a light left burning', {
      subs: ['thornhold'],
      w: 18,
      wallH: 8,
      board: { x: 5, y: -8 },
      pinboard: { x: 1, y: -2 },
      windows: [{ x: 0, y: -1 }, { x: 4, y: -1 }, { x: 9, y: -1 }, { x: 15, y: -1 }],
      door: { x: 13, y: -1 },
      shelf: { x: 16, y: 1 },
      desk: { x: 6, y: 2 },
      chair: { x: 6, y: 3 },
      bed: { x: 12, y: 2 },
      rug: { x: 8, y: 3 },
      stand: { x: 11, y: 3 },
      extra: [
        { kind: 'hanging', x: 15, y: -3, variant: 2 },
        { kind: 'lamp', x: 9, y: 2 },
        { kind: 'plant', x: 2, y: 2, variant: 2 },
      ],
    }),
  ],
  halloween: [
    room('witch-kitchen', "Witch's kitchen", 'Something on the boil, and jars of it along the wall', {
      subs: ['witchs-hollow', 'pumpkin-patch'],
      board: { x: 5, y: -7 },
      pinboard: { x: 1, y: -3 },
      windows: [{ x: 4, y: -1 }, { x: 15, y: -1 }],
      door: { x: 3, y: -1 },
      shelf: { x: 0, y: 1 },
      desk: { x: 4, y: 2 },
      chair: { x: 4, y: 3 },
      bed: { x: 12, y: 2 },
      rug: { x: 6, y: 3 },
      stand: { x: 9, y: 3 },
      extra: [
        { kind: 'stove', x: 7, y: 2, variant: 1 },
        { kind: 'crate', x: 10, y: 2 },
        { kind: 'plant', x: 2, y: 2, variant: 1 },
      ],
    }),
    room('attic', 'Cobwebbed attic', 'Whatever the house is done with, and a bed pushed under the eaves', {
      subs: ['haunted-manor', 'trick-or-treat'],
      wallH: 8,
      board: { x: 5, y: -8 },
      pinboard: { x: 1, y: -2 },
      windows: [{ x: 2, y: -1 }, { x: 13, y: -1 }],
      door: { x: 4, y: -1 },
      shelf: { x: 0, y: 1 },
      desk: { x: 3, y: 2 },
      chair: { x: 3, y: 3 },
      bed: { x: 11, y: 2 },
      rug: { x: 7, y: 3 },
      stand: { x: 9, y: 3 },
      extra: [
        { kind: 'ladder', x: 15, y: 0 },
        { kind: 'crate', x: 5, y: 2 },
        { kind: 'lamp', x: 10, y: 3, variant: 1 },
      ],
    }),
    room('crypt', 'Crypt', 'Under the church: stone, candles, and something laid out along the wall', {
      subs: ['graveyard'],
      h: 4,
      board: { x: 4, y: -7 },
      pinboard: { x: 0, y: -3 },
      windows: [{ x: 2, y: -1 }],
      door: { x: 3, y: -1 },
      shelf: { x: 14, y: 1 },
      desk: { x: 4, y: 1 },
      chair: { x: 4, y: 2 },
      bed: { x: 10, y: 1 },
      rug: { x: 6, y: 2 },
      stand: { x: 9, y: 2 },
      extra: [
        { kind: 'hanging', x: 14, y: -4, variant: 2 },
        { kind: 'lamp', x: 8, y: 1, variant: 1 },
        { kind: 'crate', x: 0, y: 1, variant: 1 },
      ],
    }),
  ],
  seaside: [
    room('net-loft', 'Net loft', 'Over the quay, long enough to mend a net in, warm at the far end', {
      subs: ['fishing-harbour', 'boatyard'],
      w: 18,
      board: { x: 6, y: -7 },
      pinboard: { x: 1, y: -3 },
      windows: [{ x: 4, y: -1 }, { x: 9, y: -1 }, { x: 16, y: -1 }],
      door: { x: 5, y: -1 },
      shelf: { x: 0, y: 1 },
      desk: { x: 6, y: 2 },
      chair: { x: 6, y: 3 },
      bed: { x: 12, y: 2 },
      rug: { x: 3, y: 3 },
      stand: { x: 11, y: 3 },
      extra: [
        { kind: 'crate', x: 2, y: 2, variant: 2 },
        { kind: 'table', x: 9, y: 2 },
        { kind: 'stove', x: 16, y: 2 },
        { kind: 'lamp', x: 15, y: 3 },
      ],
    }),
    room('cabin', 'Boat cabin', 'A cabin you can cross in three steps, with the water past the portholes', {
      subs: ['beach-huts', 'cliff-cottages'],
      w: 14,
      h: 4,
      board: { x: 0, y: -7 },
      pinboard: { x: 11, y: -3 },
      windows: [{ x: 10, y: -1 }, { x: 12, y: -1 }],
      door: { x: 13, y: -1 },
      shelf: { x: 0, y: 1 },
      desk: { x: 2, y: 1 },
      chair: { x: 2, y: 2 },
      bed: { x: 8, y: 1 },
      rug: { x: 4, y: 2 },
      stand: { x: 7, y: 2 },
      extra: [
        { kind: 'crate', x: 5, y: 1, variant: 2 },
        { kind: 'lamp', x: 11, y: 1 },
      ],
    }),
    room('light-room', 'Light room', 'The room under the lamp, with the sea round three sides of it', {
      subs: ['lighthouse-point'],
      wallH: 8,
      board: { x: 3, y: -8 },
      pinboard: { x: 13, y: -2 },
      windows: [{ x: 0, y: -1 }, { x: 2, y: -1 }, { x: 13, y: -1 }],
      door: { x: 1, y: -1 },
      shelf: { x: 14, y: 1 },
      desk: { x: 4, y: 2 },
      chair: { x: 4, y: 3 },
      bed: { x: 11, y: 2 },
      rug: { x: 8, y: 3 },
      stand: { x: 7, y: 3 },
      extra: [
        { kind: 'lamp', x: 8, y: 1 },
        { kind: 'table', x: 6, y: 2 },
        { kind: 'crate', x: 1, y: 2, variant: 1 },
      ],
    }),
  ],
  farm: [
    room('farm-kitchen', 'Farmhouse kitchen', 'The range at one end, the board over the table, apples in from the orchard', {
      subs: ['red-barn', 'dairy'],
      board: { x: 6, y: -7 },
      pinboard: { x: 2, y: -3 },
      windows: [{ x: 5, y: -1 }, { x: 11, y: -1 }],
      door: { x: 1, y: -1 },
      shelf: { x: 13, y: 1 },
      desk: { x: 6, y: 2 },
      chair: { x: 6, y: 3 },
      bed: { x: 9, y: 2 },
      rug: { x: 1, y: 3 },
      stand: { x: 2, y: 3 },
      extra: [
        { kind: 'stove', x: 3, y: 2 },
        { kind: 'crate', x: 14, y: 3, variant: 2 },
      ],
    }),
    room('hayloft', 'Hay loft', 'Up over the barn, bales along one end and a lantern on its hook', {
      subs: ['grain-farm', 'orchard'],
      w: 18,
      board: { x: 6, y: -7 },
      pinboard: { x: 1, y: -3 },
      windows: [{ x: 4, y: -1 }, { x: 9, y: -1 }, { x: 16, y: -1 }],
      door: { x: 5, y: -1 },
      shelf: { x: 0, y: 1 },
      desk: { x: 6, y: 2 },
      chair: { x: 6, y: 3 },
      bed: { x: 12, y: 2 },
      rug: { x: 3, y: 3 },
      stand: { x: 11, y: 3 },
      extra: [
        { kind: 'crate', x: 2, y: 2, variant: 0 },
        { kind: 'table', x: 9, y: 2 },
        { kind: 'crate', x: 16, y: 2, variant: 1 },
        { kind: 'lamp', x: 15, y: 3, variant: 2 },
      ],
    }),
    room('potting-shed', 'Potting shed', 'A bench of seed trays under the window, cuttings in jars, a sack of compost', {
      subs: ['market-garden'],
      wallH: 8,
      board: { x: 3, y: -8 },
      pinboard: { x: 13, y: -2 },
      windows: [{ x: 0, y: -1 }, { x: 2, y: -1 }, { x: 13, y: -1 }],
      door: { x: 1, y: -1 },
      shelf: { x: 14, y: 1 },
      desk: { x: 4, y: 2 },
      chair: { x: 4, y: 3 },
      bed: { x: 11, y: 2 },
      rug: { x: 8, y: 3 },
      stand: { x: 7, y: 3 },
      extra: [
        { kind: 'lamp', x: 8, y: 1 },
        { kind: 'table', x: 6, y: 2 },
        { kind: 'plant', x: 1, y: 2, variant: 1 },
      ],
    }),
  ],
}

/** Every room of every theme, for the tests and the settings. */
export const ALL_INTERIORS = Object.values(INTERIORS).flat()

/** A theme's rooms; the village's for a theme with none of its own. */
export const interiorsOf = (theme) => INTERIORS[themeOf(theme)] || INTERIORS.village

/**
 * The room one thread works in: one of its plot's theme's, preferring the ones its sub-theme
 * keeps, and the same one every time for the same thread.
 *
 * @param {{ theme?: string, sub?: string } | null} style  the plot's style
 * @param {string} seed  the thread's id: what makes its room its own
 */
export function interiorFor(style, seed = '') {
  const rooms = interiorsOf(style?.theme)
  const kept = rooms.filter((r) => r.subs?.includes(style?.sub))
  const from = kept.length ? kept : rooms
  return from[hashString(`interior:${style?.theme || ''}:${seed}`) % from.length]
}

/** A room by id, whichever theme it belongs to: what a saved or asked-for room means. */
export const interiorById = (id) => ALL_INTERIORS.find((r) => r.id === id) || null
