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
//   . F . . # L L # . . F .     L  the landmark: at the head of the field where the field is
//   . F . . # L L # . . F .        deep enough, here pushed down by a shallow one; work grows round it
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
/** The landmark's footprint in tiles, the same as a house's. */
export const LANDMARK_W = 2
export const LANDMARK_H = 2
/**
 * Rows of field kept between the top walkway and the landmark. Its tallest tier is 72 px, two and
 * a half tiles above its footprint; two rows keep that clear of the walkway row where the top
 * houses' doors are, and of whoever stands at them.
 */
const LANDMARK_CLEAR = 2
/**
 * The band above the landmark's footprint its sprite fills, in tiles: the tallest tier is 72 px
 * (LANDMARK_HEIGHTS in src/render/sprites/landmarks.js), of which two rows stand on the footprint,
 * plus the 2 px a flower's sprite hangs below its own spot. A flower whose spot is in that band,
 * in the two columns the landmark is wide, stands behind it and is hidden by it.
 */
const LANDMARK_RISE = (72 - LANDMARK_H * PX + 2) / PX
/**
 * Where a landmark stands in its field. At its head by default: the strip it can hide is then the
 * one between it and the top walkway, and the field grows away from it, in front of it.
 */
export const LANDMARK_SPOTS = ['top', 'middle', 'bottom']
export const DEFAULT_SPOT = LANDMARK_SPOTS[0]
/** Is this one of our spots? A saved setting, or a folder's own pick, is not to be trusted. */
export const isSpot = (spot) => typeof spot === 'string' && LANDMARK_SPOTS.includes(spot)
/** A spot, if it is one of ours; the default otherwise. */
export const landmarkSpotOf = (spot) => (isSpot(spot) ? spot : DEFAULT_SPOT)
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
 * @param {string} [spot] where its landmark stands in the field; one of LANDMARK_SPOTS
 */
export function shapeOf({ cx, cy, w, h }, spot = DEFAULT_SPOT) {
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
  // The landmark: across the middle of the field, and as far down it as `spot` asks, but never so
  // near the top walkway that its tallest tier reaches the doorsteps above. A field too shallow
  // for the spot asked takes the lowest row that fits, so the walkway always wins.
  const down = { top: LANDMARK_CLEAR, middle: Math.floor((bed.h - LANDMARK_H) / 2), bottom: bed.h - LANDMARK_H }
  const landmark = {
    x: bed.x + Math.floor((bed.w - LANDMARK_W) / 2),
    y: Math.min(bed.y + bed.h - LANDMARK_H, Math.max(bed.y + LANDMARK_CLEAR, bed.y + down[landmarkSpotOf(spot)])),
    w: LANDMARK_W,
    h: LANDMARK_H,
  }
  // Every spot in the field a flower can stand, in the order they fill: a row at a time, left to
  // right. None on the landmark's footprint, and the ones in the band its tallest tier rises
  // through come last, so nothing is planted out of sight behind it while the field has open ground.
  const spots = []
  const behind = []
  for (let row = 0; row < flowers.rows; row++) {
    for (let col = 0; col < flowers.cols; col++) {
      const x = bed.x + (col * FLOWER_PITCH + FLOWER_PITCH / 2) / PX
      const y = bed.y + (FLOWER_TOP + row * FLOWER_PITCH + FLOWER_PITCH - 1) / PX
      const under = x >= landmark.x && x < landmark.x + landmark.w
      if (under && y >= landmark.y && y < landmark.y + landmark.h) continue
      ;(under && y > landmark.y - LANDMARK_RISE && y < landmark.y ? behind : spots).push({ x, y, row })
    }
  }
  spots.push(...behind)
  // How deep the field is worked once each spot is taken: not its own row, since the spots kept
  // for last are back up the field, on ground ploughed long before.
  let deep = 0
  for (const s of spots) s.deep = deep = Math.max(deep, s.row)
  return {
    x0, y0, w: W, h: H, yard, walkTop, walkBottom, bed, slots, flowers, landmark, spots,
    // On the bottom walkway, one in from the corner: column x0+2 sits right inside the side gap.
    board: { x: yard.x + 1, y: walkBottom },
    label: { x: x0 + W / 2, y: y0 + 1 },
  }
}

const capacities = new Map()
/**
 * How many houses and flowers a plot of w×h cells holds. It holds the same wherever its landmark
 * stands: the footprint covers a whole number of flower rows and columns, and the spots the
 * landmark hides are kept, only taken last. test/shape.test.mjs holds that true, and if it ever
 * parts this and layout.js have to be told where each plot's landmark stands.
 */
export function capacityOf(w, h) {
  const k = `${w}x${h}`
  if (!capacities.has(k)) {
    const s = shapeOf({ cx: 0, cy: 0, w, h })
    capacities.set(k, { slots: s.slots.length, flowers: s.spots.length })
  }
  return capacities.get(k)
}

/**
 * Where flower `i` stands (its base, in tiles). The field fills a row at a time, left to right,
 * round the landmark, so it is ploughed from the top down as work lands.
 */
export function flowerAt(shape, i) {
  const { x, y } = shape.spots[i]
  return { x, y }
}

/**
 * How many tile rows of the field are ploughed for `n` flowers: the rows they fill and one more,
 * so the next flower always has soil waiting. The rest of the field is grass until it is needed.
 */
export function tilledRows(shape, n) {
  const { bed, flowers, spots } = shape
  const filled = Math.min(n, spots.length)
  const rows = filled > 0 ? Math.min(flowers.rows, spots[filled - 1].deep + 2) : 1
  const last = rows - 1
  return Math.min(bed.h, Math.floor((FLOWER_TOP + last * FLOWER_PITCH + FLOWER_PITCH - 1) / PX) + 1)
}

/**
 * What a plot's landmark has brought with it, tier by tier: a lamp, a bench, planters, a gateway,
 * another lamp. The yard has no tile to spare (houses, doorsteps, walkways, the field, the board),
 * so each stands in the fence line in place of the fence, where nobody walks anyway; the gateway
 * stands over the bottom gap nearest the middle, and everybody walks under it. Each tier keeps
 * everything the tiers below it brought.
 *
 * Sprites are `static.<sprite>`, drawn in the plot's theme. Each prop's (x, y) is the tile it
 * stands on, its bottom one; `tiles` are the fence tiles it takes; `walk` if people pass under it.
 * @returns {{ sprite: string, variant: number, x: number, y: number, tiles: number[][], walk?: boolean }[]}
 */
export function propsOf(shape, tier) {
  const { x0, y0, w: W, h: H, walkBottom } = shape
  const left = x0 + 1
  const right = x0 + W - 2
  const top = y0 + 1
  const bottom = y0 + H - 2
  const at = (sprite, variant, x, y, tiles = [[x, y]], walk = false) => ({ sprite, variant, x, y, tiles, ...(walk ? { walk } : {}) })
  // The bottom gap nearest the middle; of two as near, the one on the right, clear of the board.
  let gate = null
  for (let lx = 0; lx < W; lx++) {
    if (!FENCE_GAPS.has(lx % CELL_TILES)) continue
    if (!gate || Math.abs(lx + 0.5 - W / 2) <= Math.abs(gate + 0.5 - W / 2)) gate = lx
  }
  const all = [
    [at('yardlamp', 0, left, bottom)],
    [at('yardbench', 0, left, walkBottom - 1, [[left, walkBottom - 2], [left, walkBottom - 1]])],
    [at('yardplanter', 0, left, top), at('yardplanter', 1, right, top)],
    [at('gateway', 0, x0 + gate, bottom, [], true)],
    [at('yardlamp', 0, right, bottom)],
  ]
  return all.slice(0, Math.max(0, Math.min(all.length, tier))).flat()
}

/**
 * Is the tile at plot-local (lx, ly) worn into a trail? The two walkways, from side gap to side
 * gap, and the paths from the top and bottom fence gaps to them: everywhere feet go. Never the
 * field, whose top row sits right under the top walkway.
 */
export function isTrail(shape, lx, ly) {
  const { w: W, h: H, y0, walkTop, walkBottom } = shape
  const ring = Math.min(lx, ly, W - 1 - lx, H - 1 - ly)
  if (ring === 0) return false
  const y = y0 + ly
  if (y === walkTop || y === walkBottom) return ring > 1 || isFenceGap(shape, lx, ly)
  if (!FENCE_GAPS.has(lx % CELL_TILES)) return false
  return y < walkTop || ly === H - 2
}

/** Is the ring-1 tile at plot-local (lx, ly) left open in the fence? */
export function isFenceGap(shape, lx, ly) {
  const { w: W, h: H, y0, walkTop, walkBottom } = shape
  if (ly === 1 || ly === H - 2) return FENCE_GAPS.has(lx % CELL_TILES)
  if (lx === 1 || lx === W - 2) return y0 + ly === walkTop || y0 + ly === walkBottom
  return false
}
