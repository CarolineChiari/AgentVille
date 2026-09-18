// Sim units are ground tiles. A tile's centre is (x + 0.5, y + 0.5).

/**
 * One plot cell is 12×12 tiles: a 1-tile road ring, a 1-tile fence ring, and an 8×8 yard. The top
 * of the yard holds three 2×2 buildings over a walkway; the bottom is a garden bed where finished
 * threads bloom, with a second walkway below it.
 */
export const CELL_TILES = 12
export const SLOTS_PER_CELL = 3
export const MAX_CELLS = 12
export const MAX_RING = 12

/** The village square: where villagers arrive and leave. Never allocated to a plot. */
export const GATE_CELL = [0, 0]
export const GATE_TILE = { x: 6, y: 6.5 } // the arch's walk-through point inside the square

/** Building top-left corners inside a cell, most central first so a small plot looks full. */
export const SLOT_LOCAL = [[5, 2], [2, 2], [8, 2]]

/** The garden bed, in cell-local tiles. Flowers sit on an 8-px grid inside it, 7 to a column. */
export const BED = { x: 2, y: 5, w: 8, h: 4 }
export const FLOWER_ROWS = 7
export const FLOWER_COLS = 16
export const FLOWERS_PER_CELL = FLOWER_ROWS * FLOWER_COLS
/** Pixel pitch of the flower grid, and the bed's top margin; in tiles these are /16. */
export const FLOWER_PITCH = 8
export const FLOWER_TOP = 4
export const BUILDING_W = 2
export const BUILDING_H = 2

export const STALE_MS = 3 * 24 * 60 * 60 * 1000

export const WALK_SPEED = 2.4 // tiles/s
export const STROLL_SPEED = 1.5
export const ARRIVE = 0.12
export const BUILD_SECONDS = 6 // a brand-new building goes foundation → roof in this long
export const MAX_ENTERING = 6
