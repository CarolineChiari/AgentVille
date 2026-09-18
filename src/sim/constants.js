// Sim units are ground tiles. A tile's centre is (x + 0.5, y + 0.5).

/**
 * The map is a grid of 12×12-tile cells. A repo's plot is a rectangle of them, laid out as one
 * courtyard (see shape.js): a road ring, a fence ring, houses round three sides of the yard, and a
 * field in the middle that is ploughed a row at a time as finished work lands in it.
 */
export const CELL_TILES = 12
export const MAX_CELLS = 12
export const MAX_RING = 12

/** The village square: where villagers arrive and leave. Never allocated to a plot. */
export const GATE_CELL = [0, 0]
export const GATE_TILE = { x: 6, y: 6.5 } // the arch's walk-through point inside the square
/** Where the square's lampposts stand, in tiles inside its cell: one near each corner. */
export const SQUARE_LAMPS = [[1, 1], [10, 1], [1, 10], [10, 10]]
/** Planters either side of the arch, two tiles out from its pillars. */
export const SQUARE_PLANTERS = [[2, 6], [9, 6]]

/** Road ring plus fence ring: the yard starts this many tiles in from a plot's edge. */
export const YARD_INSET = 2
/**
 * Houses stand one tile apart: 2 wide plus a path. Three, not four, because 12 is a multiple of 3,
 * so the path between two houses lands on columns 4 and 7 of every cell, where the fence has its gaps.
 */
export const SLOT_PITCH = 3
/** Pixel pitch of the flower grid, and its top margin inside the field; in tiles these are /16. */
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
