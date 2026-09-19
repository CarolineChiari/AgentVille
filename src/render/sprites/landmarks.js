// Landmarks: what stands in the middle of each plot's field, as high as the work done in that repo
// has raised it (src/sim/progress.js). In the village: a campfire, a well, a market cross, a
// chapel, a town hall, a keep. 32 px wide like a building, bottom row on the ground, each tier
// taller than the one before so a repo's progress reads from across the village.
//
// Stages as a building's: 0 the ground set out, 1 a footing and a frame, 2 the landmark without
// its top in scaffolding, 3 finished. A new tier goes up through all four in front of you.
//
// Params: `accent` the plot's colour, for banners, flags and doors; `wall` and `roofs` its style,
// so a chapel is built like the houses round it; `lit` its windows after dark while somebody on
// the plot is in; `busy` that somebody is in, day or night, which is when a campfire burns.
import { PALETTE as P, shade } from './palette.js'
import { PixelCanvas } from './pixel.js'
import { BUILDING_W, ROOF_FAMILIES, drawDoor, drawGableRoof, drawWalls, drawWindow } from './buildings.js'
import { mulberry32 } from '../../sim/rng.js'
import { WALLS } from '../../sim/style.js'

export const LANDMARK_W = BUILDING_W
/**
 * Height by tier. 72 at most: the footprint stands two rows down the field (LANDMARK_CLEAR in
 * src/sim/shape.js), and anything taller would reach the doorsteps of the houses above it.
 */
export const LANDMARK_HEIGHTS = [24, 40, 48, 56, 64, 72]
const TOP_TIER = LANDMARK_HEIGHTS.length - 1

const tierOf = (tier) => Math.max(0, Math.min(TOP_TIER, Math.floor(Number(tier) || 0)))

export const heightOf = (tier) => LANDMARK_HEIGHTS[tierOf(tier)]
/** A campfire lies flat and casts none; the rest as wide as they stand. */
export const shadowOf = (tier) => [0, 24, 22, 30, 34, 34][tierOf(tier)]
/** A campfire's flame flickers and a keep's flag flies; the rest stand still. */
export const landmarkFrames = (tier, stage) => (stage >= 3 && (tierOf(tier) === 0 || tierOf(tier) === TOP_TIER) ? 2 : 1)

// ---------- going up ----------

/** Stages 0 and 1, for every tier: pegs and a string line, then a footing and the first posts. */
function groundwork(pc, H, stage, rand) {
  const g = H - 4
  pc.ellipse(16, g, 15.5, 3.5, P.dirt)
  for (let i = 0; i < 12; i++) pc.px(2 + Math.floor(rand() * 28), g - 2 + Math.floor(rand() * 5), P.dirtDark)
  if (stage === 0) {
    for (const x of [3, 28]) pc.vline(x, H - 11, H - 3, P.wood)
    pc.hline(3, 28, H - 10, P.white)
    pc.rect(5, H - 6, 7, 3, P.stone)
    pc.hline(6, 10, H - 7, P.stone)
    pc.px(7, H - 7, P.stoneLight)
    pc.px(9, H - 5, P.stoneDark)
    for (let y = H - 7; y <= H - 3; y++) pc.hline(18, 27, y, y % 2 ? P.woodLight : P.wood)
    return
  }
  pc.rect(3, H - 6, 26, 4, P.stone)
  pc.hline(3, 28, H - 6, P.stoneLight)
  const top = Math.max(1, H - 6 - Math.min(20, H - 8))
  for (const x of [4, 15, 26]) pc.rect(x, top, 2, H - 6 - top, P.wood)
  pc.rect(4, top, 24, 2, P.woodDark)
  pc.line(6, H - 7, 14, top + 2, P.woodLight)
  pc.line(17, top + 2, 25, H - 7, P.woodLight)
}

/** Stage 2's scaffolding: two standards and a boarded lift every ten rows. */
function scaffold(pc, H, top) {
  pc.vline(1, top, H - 2, P.woodDark)
  pc.vline(30, top, H - 2, P.woodDark)
  for (let y = top + 3; y < H - 3; y += 10) pc.hline(0, 31, y, P.woodLight)
}

// ---------- parts ----------

/** A stone step from x0 to x1, rows y0 to y1: lit along its top, shaded along its foot and right end. */
function step(pc, x0, x1, y0, y1) {
  pc.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, P.stone)
  pc.hline(x0, x1, y0, P.stoneLight)
  pc.hline(x0, x1, y1, P.stoneDark)
  pc.vline(x1, y0, y1, P.stoneDark)
}

/** A tall window with a rounded head, 4 px wide. */
function archWindow(pc, x, y, lit, h = 9) {
  pc.rect(x, y, 4, h, P.woodDark)
  pc.rect(x + 1, y + 1, 2, h - 2, lit ? P.windowLit : P.window)
  pc.px(x + 1, y + 2, lit ? P.windowLitCore : P.windowShine)
  pc.clearPx(x, y)
  pc.clearPx(x + 3, y)
}

/** An arrow slit: a dark stripe in the stone, glowing when somebody is in after dark. */
function slit(pc, x, y, lit) {
  pc.rect(x, y, 2, 5, P.woodDark)
  pc.vline(x, y + 1, y + 3, lit ? P.windowLit : P.window)
}

/** A tub of flowers in the plot's colour, `x` its left edge. */
function tub(pc, x, base, accent) {
  pc.rect(x, base - 3, 4, 4, P.wood)
  pc.hline(x, x + 3, base - 3, P.woodLight)
  pc.hline(x, x + 3, base - 4, P.leaf)
  pc.px(x, base - 5, accent)
  pc.px(x + 2, base - 5, accent)
  pc.px(x + 1, base - 6, shade(accent, 0.25))
  pc.px(x + 3, base - 4, P.leafDark)
}

/** A cone of roof over a turret, centred on `cx`, its eave on row `yBot`. */
function cone(pc, cx, yBot, rows, color) {
  const dark = shade(color, -0.25)
  for (let i = 0; i < rows; i++) {
    const half = 0.5 + (i * 4) / (rows - 1)
    const a = Math.round(cx - half)
    const b = Math.round(cx + half - 1)
    pc.hline(a, b, yBot - rows + 1 + i, i % 3 === 2 ? dark : color)
    pc.px(b, yBot - rows + 1 + i, dark)
  }
}

/** A round turret from x0 to x1: coursed stone, lit on its left, a slit halfway up. */
function turret(pc, x0, x1, y0, y1, lit) {
  pc.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, P.stone)
  for (let y = y0 + 2; y < y1; y += 3) pc.hline(x0, x1, y, P.stoneDark)
  pc.vline(x0, y0, y1, P.stoneLight)
  pc.vline(x1, y0, y1, P.stoneDark)
  slit(pc, Math.round((x0 + x1) / 2) - 1, y0 + 6, lit)
}

/** A flame on its fire, tip up; `frame` bends it one way, then the other. */
const FLAMES = [
  [[0, 0], [-1, 0], [-1, 1], [-2, 1], [-2, 2], [-3, 2], [-3, 3], [-3, 3], [-2, 2]],
  [[-1, -1], [-1, 0], [-2, 0], [-2, 1], [-3, 2], [-3, 2], [-3, 3], [-2, 3], [-2, 2]],
]
function flame(pc, cx, bottom, frame) {
  const rows = FLAMES[frame % FLAMES.length]
  const top = bottom - rows.length + 1
  rows.forEach(([a, b], i) => {
    const y = top + i
    pc.hline(cx + a, cx + b, y, P.flame)
    if (i >= 2 && b - a >= 2) pc.hline(cx + a + 1, cx + b - 1, y, P.flameTip)
    if (i >= 5 && b - a >= 4) pc.hline(cx + a + 2, cx + b - 2, y, P.flameCore)
  })
  // A spark leaving it.
  pc.px(frame % 2 ? cx - 2 : cx + 2, top - 2 - (frame % 2), P.flameTip)
}

// ---------- the tiers ----------

const TIERS = [
  function campfire(pc, o) {
    const g = o.H - 4
    pc.ellipse(16, g, 14.5, 3.5, P.dirt)
    for (let i = 0; i < 10; i++) pc.px(3 + Math.floor(o.rand() * 26), g - 2 + Math.floor(o.rand() * 5), P.dirtDark)
    // A log to sit on either side.
    for (const x of o.stage >= 2 ? [1, 24] : []) {
      pc.rect(x, g - 4, 7, 3, P.wood)
      pc.hline(x, x + 6, g - 4, P.woodLight)
      pc.hline(x, x + 6, g - 2, P.woodDark)
      pc.px(x === 1 ? x : x + 6, g - 3, P.woodLight)
    }
    // The ring of stones round the ashes, back half first so the logs lie over it.
    const stones = []
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2
      stones.push([Math.round(15 + Math.cos(a) * 6.5), Math.round(g - 2 + Math.sin(a) * 2.5), Math.sin(a)])
    }
    const stone = ([x, y]) => {
      pc.rect(x, y, 2, 2, P.stone)
      pc.px(x, y, P.stoneLight)
      pc.px(x + 1, y + 1, P.stoneDark)
    }
    stones.filter((s) => s[2] <= 0).forEach(stone)
    // Set out, it is only its ring of stones: nothing to frame, nothing burnt yet.
    if (o.stage >= 2) {
      pc.ellipse(16, g - 1, 4.5, 1.6, P.ash)
      pc.line(12, g, 20, g - 4, P.woodDark)
      pc.line(12, g - 4, 20, g, P.wood)
      pc.line(13, g - 4, 19, g - 1, P.woodLight)
    }
    stones.filter((s) => s[2] > 0).forEach(stone)
    if (!o.roof) return
    if (o.busy) flame(pc, 16, g - 3, o.frame)
    else for (const [x, y] of [[15, g - 2], [17, g - 3], [14, g - 3], [18, g - 1]]) pc.px(x, y, P.ember)
  },

  function well(pc, o) {
    const base = o.H - 2
    tub(pc, 1, base, o.accent)
    tub(pc, 27, base, o.accent)
    // The shaft's ring of stone, and the water down it.
    pc.rect(7, base - 9, 18, 10, P.stone)
    for (const x of [10, 16, 21]) pc.vline(x, base - 9, base, P.stoneDark)
    pc.hline(7, 24, base - 5, P.stoneDark)
    pc.vline(24, base - 9, base, P.stoneDark)
    pc.ellipse(16, base - 9, 9.5, 3.5, P.stoneLight)
    pc.ellipse(16, base - 9, 7, 2.2, P.waterDeep)
    pc.ellipse(16, base - 9.5, 5, 1.2, P.water)
    // Its posts, the winch and a bucket on the rope.
    pc.rect(6, base - 27, 2, 18, P.wood)
    pc.rect(24, base - 27, 2, 18, P.wood)
    pc.vline(6, base - 27, base - 10, P.woodLight)
    pc.hline(6, 26, base - 23, P.woodDark)
    pc.rect(27, base - 24, 2, 4, P.woodDark)
    pc.vline(16, base - 22, base - 14, P.plasterShade)
    pc.rect(14, base - 14, 5, 3, P.wood)
    pc.hline(14, 18, base - 13, P.metalDark)
    if (!o.roof) return
    drawGableRoof(pc, 3, 28, base - 36, base - 27, o.roofColor, 3)
    pc.hline(4, 27, base - 26, o.accent)
  },

  function marketCross(pc, o) {
    const base = o.H - 2
    step(pc, 3, 28, base - 2, base)
    step(pc, 7, 24, base - 5, base - 3)
    step(pc, 11, 20, base - 8, base - 6)
    // The shaft.
    pc.rect(14, base - 30, 4, 22, P.stone)
    pc.vline(14, base - 30, base - 9, P.stoneLight)
    pc.vline(17, base - 30, base - 9, P.stoneDark)
    // Market day: a basket of fruit and a pot of flowers left on the steps.
    pc.rect(5, base - 5, 4, 3, P.wood)
    for (const [x, c] of [[5, P.fruit], [6, P.pollen], [7, P.fruit], [8, P.crop]]) pc.px(x, base - 6, c)
    tub(pc, 22, base - 3, o.accent)
    if (!o.roof) return
    // Its head: a crosspiece with the plot's banners, a lantern and a gilt finial.
    pc.rect(9, base - 33, 14, 3, P.stone)
    pc.hline(9, 22, base - 33, P.stoneLight)
    pc.hline(9, 22, base - 31, P.stoneDark)
    for (const x of [10, 19]) {
      pc.rect(x, base - 30, 3, 7, o.accent)
      pc.vline(x + 2, base - 30, base - 24, shade(o.accent, -0.2))
      pc.clearPx(x + 1, base - 24)
    }
    pc.hline(12, 19, base - 40, P.metalDark)
    pc.rect(13, base - 39, 6, 6, P.metalDark)
    pc.rect(14, base - 38, 4, 4, o.lit ? P.windowLit : P.window)
    if (o.lit) pc.rect(15, base - 37, 2, 2, P.windowLitCore)
    else pc.px(14, base - 38, P.windowShine)
    pc.rect(15, base - 43, 2, 3, P.gilt)
    pc.px(16, base - 42, P.giltDark)
    pc.px(15, base - 44, P.gilt)
  },

  function chapel(pc, o) {
    const base = o.H - 2
    const wallTop = base - 19
    drawWalls(pc, 5, 26, wallTop, base, o.material, o.rand)
    drawDoor(pc, 16, base, o.accent, 12)
    pc.clearPx(13, base - 11)
    pc.clearPx(18, base - 11)
    archWindow(pc, 8, wallTop + 4, o.lit)
    archWindow(pc, 20, wallTop + 4, o.lit)
    if (!o.roof) return
    drawGableRoof(pc, 2, 29, wallTop - 13, wallTop, o.roofColor, 3)
    pc.hline(5, 26, wallTop + 1, o.accent)
    // A round window in the gable.
    pc.ellipse(16, wallTop - 4.5, 2.6, 2.6, P.woodDark)
    pc.ellipse(16, wallTop - 4.5, 1.5, 1.5, o.lit ? P.windowLit : P.window)
    // The bell-cote on the ridge: an opening with a gilt bell in it, a little cap, a finial.
    const bt = wallTop - 13
    pc.rect(13, bt - 10, 6, 11, P.stone)
    pc.vline(13, bt - 10, bt, P.stoneLight)
    pc.vline(18, bt - 10, bt, P.stoneDark)
    pc.rect(14, bt - 8, 4, 5, P.interior)
    pc.px(14, bt - 8, P.stone)
    pc.px(17, bt - 8, P.stone)
    pc.rect(15, bt - 7, 2, 3, P.gilt)
    pc.px(16, bt - 6, P.giltDark)
    for (let i = 0; i < 4; i++) pc.hline(12 + i, 19 - i, bt - 11 - i, i % 2 ? shade(o.roofColor, -0.2) : o.roofColor)
    pc.vline(15, bt - 18, bt - 15, P.gilt)
    pc.hline(14, 16, bt - 17, P.gilt)
  },

  function townHall(pc, o) {
    const base = o.H - 2
    const wallTop = base - 27
    drawWalls(pc, 2, 29, wallTop, base, o.material, o.rand)
    pc.hline(2, 29, wallTop + 13, shade(o.accent, -0.2))
    // The ground floor: the door between two broad windows.
    drawWindow(pc, 5, base - 11, o.lit, 7, 7)
    drawWindow(pc, 20, base - 11, o.lit, 7, 7)
    drawDoor(pc, 16, base, o.accent, 11)
    // Upstairs: three windows, and the plot's banners between them.
    for (const x of [5, 13, 21]) drawWindow(pc, x, wallTop + 3, o.lit, 6, 7)
    for (const x of [11, 19]) {
      pc.rect(x, wallTop + 2, 2, 8, o.accent)
      pc.px(x + 1, wallTop + 2, shade(o.accent, 0.25))
    }
    if (!o.roof) return
    drawGableRoof(pc, 1, 30, wallTop - 8, wallTop, o.roofColor, 11)
    pc.hline(2, 29, wallTop + 1, o.accent)
    // The clock tower over the door, its spire and a gilt weathervane.
    const tb = wallTop - 6
    pc.rect(11, tb - 16, 10, 17, P.stone)
    pc.vline(11, tb - 16, tb, P.stoneLight)
    pc.vline(20, tb - 16, tb, P.stoneDark)
    pc.hline(10, 21, tb - 16, P.stoneDark)
    pc.hline(10, 21, tb - 15, P.stoneLight)
    pc.ellipse(16, tb - 8, 3.6, 3.6, P.giltDark)
    pc.ellipse(16, tb - 8, 2.6, 2.6, P.paper)
    pc.vline(15, tb - 10, tb - 8, P.woodDark)
    pc.hline(15, 17, tb - 8, P.woodDark)
    for (let i = 0; i < 8; i++) {
      const half = 0.5 + i * 0.7
      const y = tb - 24 + i
      pc.hline(Math.round(15.5 - half), Math.round(15.5 + half), y, i % 3 === 2 ? shade(o.roofColor, -0.25) : o.roofColor)
    }
    pc.vline(15, tb - 28, tb - 25, P.giltDark)
    pc.hline(13, 18, tb - 27, P.gilt)
    pc.px(18, tb - 26, P.gilt)
  },

  function keep(pc, o) {
    const base = o.H - 2
    const top = base - 52
    turret(pc, 1, 8, base - 38, base, o.lit)
    turret(pc, 23, 30, base - 38, base, o.lit)
    drawWalls(pc, 7, 24, top, base, 'stone', o.rand)
    // The gate: a round-headed door, iron-banded.
    pc.rect(12, base - 12, 8, 13, P.woodDark)
    pc.vline(14, base - 11, base, P.wood)
    pc.vline(17, base - 11, base, P.wood)
    pc.hline(12, 19, base - 8, P.metalDark)
    pc.hline(12, 19, base - 3, P.metalDark)
    pc.clearPx(12, base - 12)
    pc.clearPx(19, base - 12)
    pc.hline(11, 20, base - 13, P.stoneDark)
    for (const [x, y] of [[15, base - 26], [11, base - 38], [19, base - 38], [15, base - 46]]) slit(pc, x, y, o.lit)
    // The plot's colours hung on the walls.
    for (const x of [9, 21]) {
      pc.rect(x, base - 31, 2, 9, o.accent)
      pc.clearPx(x, base - 22)
    }
    if (!o.roof) return
    // Battlements.
    pc.rect(6, top - 2, 20, 3, P.stone)
    pc.hline(6, 25, top - 2, P.stoneLight)
    pc.hline(6, 25, top, P.stoneDark)
    for (let x = 6; x <= 24; x += 4) {
      pc.rect(x, top - 5, 2, 3, P.stone)
      pc.px(x, top - 5, P.stoneLight)
    }
    cone(pc, 4.5, base - 39, 9, o.roofColor)
    cone(pc, 26.5, base - 39, 9, o.roofColor)
    // The flag in the plot's colour, flying from the top.
    pc.vline(16, top - 16, top - 3, P.metalDark)
    pc.px(16, top - 17, P.gilt)
    const flyLen = o.frame % 2 ? [7, 9, 10, 9, 6] : [8, 9, 9, 8, 7]
    flyLen.forEach((n, i) => pc.hline(17, 16 + n, top - 16 + i, i === 0 ? shade(o.accent, 0.2) : o.accent))
    pc.clearPx(16 + flyLen[2], top - 14)
    pc.clearPx(15 + flyLen[2], top - 14)
  },
]

/**
 * @param {{ tier: number, stage: number, variant?: number, accent?: string, wall?: number, roofs?: number, lit?: boolean, busy?: boolean, frame?: number }} o
 */
export function drawLandmark(o) {
  const tier = tierOf(o.tier)
  const H = LANDMARK_HEIGHTS[tier]
  const pc = new PixelCanvas(LANDMARK_W, H)
  const variant = o.variant || 0
  const rand = mulberry32(variant * 6007 + tier * 131 + 5)
  // A campfire is laid, not built: after its pegs, its ring of stones, where anything else is framed.
  if (o.stage === 0 || (o.stage === 1 && tier > 0)) {
    groundwork(pc, H, o.stage, rand)
    return pc.outline(P.outline)
  }
  const family = ROOF_FAMILIES[(o.roofs || 0) % ROOF_FAMILIES.length]
  TIERS[tier](pc, {
    H, rand, variant, stage: o.stage, frame: o.frame || 0, roof: o.stage >= 3, lit: Boolean(o.lit), busy: Boolean(o.busy),
    accent: o.accent || P.roof[0], roofColor: P.roof[family[variant % family.length]], material: WALLS[(o.wall || 0) % WALLS.length],
  })
  // A campfire has nothing to climb.
  if (o.stage === 2 && tier > 0) scaffold(pc, H, Math.round(H * 0.4))
  return pc.outline(P.outline)
}
