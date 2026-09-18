// A plot's courtyard, worked out from its rectangle of cells and nothing else. This is the one
// place that knows where a plot's houses, field, walkways, fence gaps and notice board go.
//
//   R R R R R R R R R R R R     R  road ring           a 1×1 plot; wider and taller plots
//   . F F F _ F F _ F F F .     F  fence, _ a gap      stretch the same pattern
//   . F H H . H H . H H F .     H  a house (a slot)
//   . F H H . H H . H H F .
//   _ . . . . . . . . . . _     the top walkway: every top house's door opens onto it
//   . F H H # # # # H H F .     #  the field; side houses stand either side of it
//   . F H H # # # # H H F .
//   . F . . # # # # . . F .
//   . F . . # # # # . . F .
//   _ . . B . . . . . . . _     the bottom walkway; B the notice board
//   . F F F _ F F _ F F F .
//   R R R R R R R R R R R R
//
// Every house faces down, so houses go along the top and down both sides but never along the
// bottom: a house there would open its door onto the fence.
import { BUILDING_H, BUILDING_W, CELL_TILES, FLOWER_PITCH, FLOWER_TOP, SLOT_PITCH, YARD_INSET } from './constants.js'
import { key } from './grid.js'

/** A tile is 16 px; the flower grid is laid out in pixels so it lines up with the soil sprite. */
const PX = 16
/**
 * Columns of the top and bottom fence left open, in each cell. They land on the paths between
 * top-row houses (columns 4, 7, 10, … of the plot), so a gap never opens onto a wall.
 */
const FENCE_GAPS = new Set([4, 7])

/** The bounding rectangle of some cells, in cells. */
export function rectOf(cells) {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const [x, y] of cells) {
    x0 = Math.min(x0, x)
    y0 = Math.min(y0, y)
    x1 = Math.max(x1, x)
    y1 = Math.max(y1, y)
  }
  return { cx: x0, cy: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}

/** Do these cells fill their bounding rectangle, each exactly once? */
export function isRect(cells) {
  if (!cells.length) return false
  const { w, h } = rectOf(cells)
  return w * h === cells.length && new Set(cells.map(([x, y]) => key(x, y))).size === cells.length
}

/**
 * The courtyard of a rectangle of cells, in world tiles.
 * @param {{ cx: number, cy: number, w: number, h: number }} rect  in cells
 */
export function shapeOf({ cx, cy, w, h }) {
  const x0 = cx * CELL_TILES
  const y0 = cy * CELL_TILES
  const W = w * CELL_TILES
  const H = h * CELL_TILES
  const yard = { x: x0 + YARD_INSET, y: y0 + YARD_INSET, w: W - 2 * YARD_INSET, h: H - 2 * YARD_INSET }
  const right = yard.x + yard.w - 1
  const walkTop = yard.y + BUILDING_H
  const walkBottom = yard.y + yard.h - 1
  // Between the side houses and from the top walkway down to the one above the bottom walkway.
  const bed = { x: yard.x + BUILDING_W, y: walkTop + 1, w: yard.w - 2 * BUILDING_W, h: walkBottom - walkTop - 1 }

  const slots = []
  for (let x = yard.x; x + BUILDING_W - 1 <= right; x += SLOT_PITCH) slots.push({ x, y: yard.y })
  // A side house needs its door row clear of the bottom walkway, or the board and the gaps crowd it.
  for (let y = walkTop + 1; y + BUILDING_H < walkBottom; y += SLOT_PITCH) {
    slots.push({ x: yard.x, y })
    slots.push({ x: right - BUILDING_W + 1, y })
  }
  // Newcomers take the house nearest the middle first, so a few houses gather round the field
  // instead of lining up along one side. Ties go to the top, then the left, so the order is fixed.
  const mx = x0 + W / 2
  const my = y0 + H / 2
  const d = (s) => (s.x + BUILDING_W / 2 - mx) ** 2 + (s.y + BUILDING_H / 2 - my) ** 2
  slots.sort((a, b) => d(a) - d(b) || a.y - b.y || a.x - b.x)

  const flowers = {
    cols: Math.floor((bed.w * PX) / FLOWER_PITCH),
    rows: Math.floor((bed.h * PX - FLOWER_TOP) / FLOWER_PITCH),
  }
  return {
    x0, y0, w: W, h: H, yard, walkTop, walkBottom, bed, slots, flowers,
    // On the bottom walkway, one in from the corner: column x0+2 sits right inside the side gap.
    board: { x: yard.x + 1, y: walkBottom },
    label: { x: x0 + W / 2, y: y0 + 1 },
  }
}

const capacities = new Map()
/** How many houses and flowers a plot of w×h cells holds. */
export function capacityOf(w, h) {
  const k = `${w}x${h}`
  if (!capacities.has(k)) {
    const s = shapeOf({ cx: 0, cy: 0, w, h })
    capacities.set(k, { slots: s.slots.length, flowers: s.flowers.cols * s.flowers.rows })
  }
  return capacities.get(k)
}

/**
 * Where flower `i` stands (its base, in tiles). The field fills a row at a time, left to right,
 * so it is ploughed from the top down as work lands.
 */
export function flowerAt(shape, i) {
  const { bed, flowers } = shape
  const row = Math.floor(i / flowers.cols)
  const col = i % flowers.cols
  return {
    x: bed.x + (col * FLOWER_PITCH + FLOWER_PITCH / 2) / PX,
    y: bed.y + (FLOWER_TOP + row * FLOWER_PITCH + FLOWER_PITCH - 1) / PX,
  }
}

/**
 * How many tile rows of the field are ploughed for `n` flowers: the rows they fill and one more,
 * so the next flower always has soil waiting. The rest of the field is grass until it is needed.
 */
export function tilledRows(shape, n) {
  const { bed, flowers } = shape
  const rows = Math.max(1, Math.min(flowers.rows, Math.ceil(n / flowers.cols) + 1))
  const last = rows - 1
  return Math.min(bed.h, Math.floor((FLOWER_TOP + last * FLOWER_PITCH + FLOWER_PITCH - 1) / PX) + 1)
}

/** Is the ring-1 tile at plot-local (lx, ly) left open in the fence? */
export function isFenceGap(shape, lx, ly) {
  const { w: W, h: H, y0, walkTop, walkBottom } = shape
  if (ly === 1 || ly === H - 2) return FENCE_GAPS.has(lx % CELL_TILES)
  if (lx === 1 || lx === W - 2) return y0 + ly === walkTop || y0 + ly === walkBottom
  return false
}
