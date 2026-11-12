// Wild West ground, ways and fences: desert sand, a plank boardwalk, sagebrush scrub or mesa red
// rock inside each plot, a rutted wagon road round it, a dusty path across it, and fences of split
// rails, a low adobe wall, barbed wire on cedar posts and a hitching rail.
//
// Contract (see ThemePack in ../index.js and the village's src/render/sprites/tiles.js):
// - `tone` is a plot's yard, an index into THEMES['wild-west'].dims.yard (desert, boardwalk, scrub, redrock).
// - Ground, trail and road tiles are 16×16 and fully opaque; each variant is its own picture.
// - A fence's `style` indexes dims.fence; `mask` which sides carry on (1 N, 2 E, 4 S, 8 W). A
//   straight run meets the next tile's edge to edge, so nothing a run draws may differ in shape
//   between its first column and its last. Every pattern therefore has a period that divides 15,
//   3 or 5, which is the only way column 0 and column 15 agree.
// - `patches(tone)` is [plain, sunny, lush]: the ground's plain colours, and what each becomes
//   where it has dried out and where it grows lush. Only pixels exactly a plain colour change.
// - `westCover` is pure: the same tile always has the same thing lying on it, or nothing.
import { PALETTE as P } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { mulberry32 } from '../../../sim/rng.js'
import { fbm, lattice } from '../../../sim/noise.js'

const T = 16
const DESERT = 0
const BOARDWALK = 1
const SCRUB = 2

const toneOf = (tone) => (tone || 0) % P.wwGround.length
/** A ground's colours: base, shade, light, deepest. All four are its plain colours. */
const groundOf = (tone) => P.wwGround[toneOf(tone)]

/** How many looks each thing lying about has; drawn as `deco.<kind>.<variant>`. */
export const COVER_VARIANTS = { tumbleweed: 2, barrelcactus: 2, cowskull: 1, sagebrush: 2, hoofprints: 2, wagonwheel: 1, mesarock: 2, woodcrate: 2 }
/** The lip drawn where the wagon road meets anything else: its rutted edge. */
export const ROAD_EDGE = P.wwLaneEdge
/** What the corral is edged in: the dark timber of its bottom rail. */
export const BED_EDGE = P.wwTimberDark

// ---------- the ground ----------

/** Seeds per kind of tile, so a path and a ground of the same variant don't share a scatter. */
const SEED = { ground: 91, trail: 92, road: 93 }

function scatter(rand, n, draw) {
  for (let i = 0; i < n; i++) draw(Math.floor(rand() * T), Math.floor(rand() * T))
}

/** A sagebrush tuft: a low grey-green mound, three pixels wide. */
function sage(pc, x, y, light, dark) {
  pc.px(x, y, dark)
  pc.px(x + 1, y - 1, light)
  pc.px(x + 1, y, dark)
  pc.px(x + 2, y, light)
}

/** A pebble: a pale top and a dark foot. */
function pebble(pc, x, y, light, dark) {
  pc.px(x, y, light)
  pc.px(x + 1, y, dark)
  pc.px(x + 1, y + 1, dark)
}

/** The ground itself, before anything is found in it. */
function texture(pc, rand, t) {
  const [base, dark, light, deep] = P.wwGround[t]
  pc.rect(0, 0, T, T, base)
  if (t === DESERT) {
    // Sand: fine speckle, a few stones and wind ripples.
    scatter(rand, 16, (x, y) => pc.px(x, y, dark))
    scatter(rand, 14, (x, y) => pc.px(x, y, light))
    scatter(rand, 2, (x, y) => pebble(pc, x, y, light, deep))
    for (const y of [4, 12]) {
      const x = Math.floor(rand() * 8)
      pc.hline(x, x + 6, y, light)
      pc.hline(x + 1, x + 7, y + 1, dark)
    }
  } else if (t === BOARDWALK) {
    // Planks laid across, four rows each: lit along the top, a seam below, a nail at each end.
    for (let y = 0; y < T; y++) {
      const k = y % 4
      if (k === 0) pc.hline(0, T - 1, y, light)
      else if (k === 3) pc.hline(0, T - 1, y, deep)
    }
    for (let p = 0; p < 4; p++) {
      const joint = (p * 5 + 3) % 8
      // One butt joint per plank per tile, staggered, so the planks read as long boards.
      const x = joint * 2 - (joint > 7 ? 15 : 0) + (p % 2) * 3
      pc.vline(x, p * 4, p * 4 + 2, deep)
      pc.px(x + 1, p * 4 + 1, dark)
    }
    scatter(rand, 6, (x, y) => (y % 4 === 1 || y % 4 === 2 ? pc.px(x, y, dark) : null))
  } else if (t === SCRUB) {
    // Dry earth with sagebrush on it, a few bare stones.
    scatter(rand, 14, (x, y) => pc.px(x, y, dark))
    scatter(rand, 6, (x, y) => sage(pc, x, y, light, deep))
    scatter(rand, 2, (x, y) => pebble(pc, x, y, light, deep))
  } else {
    // Red rock: strata running across, cracks and chips.
    for (const y of [2, 7, 13]) {
      const x = Math.floor(rand() * 6)
      pc.hline(x, x + 9, y, light)
      pc.hline(x + 2, x + 11, y + 1, dark)
    }
    scatter(rand, 12, (x, y) => pc.px(x, y, dark))
    scatter(rand, 4, (x, y) => pc.px(x, y, deep))
    const cx = Math.floor(rand() * 12)
    pc.line(cx, 4, cx + 3, 10, deep)
  }
}

/** What a rare tile has in it: variants 3, 4 and 5 of each ground. */
function find(pc, rand, t, variant) {
  const [base, dark, light, deep] = P.wwGround[t]
  const x = 4 + Math.floor(rand() * 6)
  const y = 4 + Math.floor(rand() * 6)
  const k = variant - 3
  if (k === 0) {
    // A cow's skull bleached in the sun, horns out either side.
    pc.hline(x - 1, x + 1, y, P.wwBone)
    pc.hline(x - 1, x + 1, y + 1, P.wwBoneShade)
    pc.px(x, y + 2, P.wwBoneShade)
    pc.px(x - 2, y - 1, P.wwBone)
    pc.px(x + 2, y - 1, P.wwBone)
    pc.px(x - 1, y, deep)
    pc.px(x + 1, y, deep)
  } else if (k === 1) {
    // A hoof's prints, in pairs, walking by.
    for (let i = 0; i < 4; i++) {
      pc.px(x - 3 + i * 3, y + (i % 2) * 2, deep)
      pc.px(x - 2 + i * 3, y + (i % 2) * 2, dark)
    }
  } else {
    // Wheel ruts across the tile, a strip of the ground left between them.
    for (let i = 0; i < T; i++) {
      pc.px(i, y, deep)
      pc.px(i, y + 4, deep)
    }
    pc.hline(0, T - 1, y + 1, dark)
    pc.hline(0, T - 1, y + 2, base)
  }
}

/**
 * A plot's ground. Variants 0–2 are plain and carry the ground; 3–5 are rare (see TILE_WEIGHTS in
 * the village's tiles) and each holds something the frontier has left there.
 */
export function drawGround(variant, tone) {
  const t = toneOf(tone)
  const pc = new PixelCanvas(T, T)
  const rand = mulberry32(variant * 149 + t * 6151 + SEED.ground)
  texture(pc, rand, t)
  if (variant >= 3) find(pc, rand, t, variant)
  return pc
}

/**
 * The corral, where the village has its flower bed: trampled dark earth, a scuffed spot for every
 * cactus or horseshoe on the village's grid, 8 px apart: variant 0 is the bed's top row, variant 1
 * every row below it, which carries the grid on from the row above (see the village's `bed` tile).
 * Its earth is its own, not the plot's ground, so a keepsake reads against it whatever the plot is
 * laid in.
 */
export function drawBed(variant) {
  const pc = new PixelCanvas(T, T)
  pc.rect(0, 0, T, T, P.wwBed)
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const n = (x * 7 + y * 11) % 13
      if (n === 0) pc.px(x, y, P.wwBedLight)
      else if (n === 6) pc.px(x, y, P.wwBedDark)
    }
  }
  for (const y0 of variant ? [-4, 4] : [4]) {
    for (const x0 of [0, 8]) {
      pc.hline(x0 + 3, x0 + 5, y0 + 6, P.wwBedDeep)
      pc.px(x0 + 4, y0 + 5, P.wwBedDark)
      pc.px(x0 + 2, y0 + 6, P.wwBedLight)
    }
  }
  if (!variant) {
    // The top row is where the corral starts: its bottom rail laid along it.
    pc.hline(0, T - 1, 0, P.wwTimberLight)
    pc.hline(0, T - 1, 1, P.wwTimber)
    for (let x = 2; x < T; x += 5) pc.px(x, 1, P.wwTimberDark)
  }
  return pc
}

// ---------- the path across a plot ----------

/** Where the path runs across its tile: 8 px wide, down the middle, so arms meet their neighbours'. */
const LO = 4
const HI = 11

/**
 * A path trodden across the plot: packed dirt 8 px wide down the middle of the tile, an arm out
 * of each linked side to its edge, and the ground's own edge ragged either side.
 */
export function drawTrail(variant, links, tone) {
  const t = toneOf(tone)
  const g = P.wwGround[t]
  const pc = new PixelCanvas(T, T)
  const rand = mulberry32(variant * 149 + links * 19 + t * 6151 + SEED.trail)
  texture(pc, rand, t)
  const N = links & 1
  const E = links & 2
  const S = links & 4
  const W = links & 8
  const down = N || S
  const across = E || W || !down
  const dirt = (x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const n = (x * 7 + y * 13 + variant * 3) % 11
        pc.px(x, y, n === 0 ? P.wwLaneDark : n === 5 ? P.wwLaneLight : P.wwLane)
      }
    }
  }
  const dy0 = N ? 0 : LO
  const dy1 = S ? T - 1 : HI
  const ax0 = W ? 0 : LO
  const ax1 = E ? T - 1 : HI
  if (down) dirt(LO, dy0, HI, dy1)
  if (across) dirt(ax0, LO, ax1, HI)
  const ragged = (x, y) => {
    if ((x * 3 + y * 5) % 4 === 0) pc.px(x, y, g[1])
  }
  if (down) for (let y = dy0; y <= dy1; y++) {
    ragged(LO, y)
    ragged(HI, y)
  }
  if (across) for (let x = ax0; x <= ax1; x++) {
    ragged(x, LO)
    ragged(x, HI)
  }
  // Something on the path, by variant: a bootprint, a hoofprint, a scuff.
  if (variant === 1) {
    pc.hline(6, 7, 8, P.wwLaneEdge)
    pc.px(6, 9, P.wwLaneEdge)
  } else if (variant === 2) {
    pc.px(8, 6, P.wwLaneEdge)
    pc.px(9, 6, P.wwLaneEdge)
    pc.px(7, 9, P.wwLaneEdge)
    pc.px(8, 9, P.wwLaneEdge)
  } else if (variant === 3) {
    pc.px(6, 8, P.wwLaneEdge)
    pc.px(7, 9, P.wwLaneEdge)
  }
  return pc
}

// ---------- the road round a plot ----------

/**
 * The wagon road round a plot: packed brown dirt, grit and small stones on a scatter so the road
 * reads as one surface running on. Variants 0–2 are plain; 3 has ruts along it, 4 hoofprints
 * across it, 5 a dry puddle cracked into plates.
 */
export function drawRoad(variant) {
  const pc = new PixelCanvas(T, T)
  const rand = mulberry32(variant * 149 + SEED.road * 6151)
  pc.rect(0, 0, T, T, P.wwLane)
  scatter(rand, 22, (x, y) => pc.px(x, y, P.wwLaneDark))
  scatter(rand, 16, (x, y) => pc.px(x, y, P.wwLaneLight))
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(rand() * 15)
    const y = Math.floor(rand() * 15)
    pc.px(x, y, P.wwLaneLight)
    pc.px(x, y + 1, P.wwLaneEdge)
    pc.px(x + 1, y, P.wwLaneDark)
  }
  if (variant === 3) {
    for (let x = 0; x < T; x++) {
      pc.px(x, 4, P.wwLaneEdge)
      pc.px(x, 11, P.wwLaneEdge)
    }
  } else if (variant === 4) {
    for (let i = 0; i < 5; i++) {
      pc.px(2 + i * 3, 5 + (i % 2) * 4, P.wwLaneEdge)
      pc.px(3 + i * 3, 5 + (i % 2) * 4, P.wwLaneEdge)
    }
  } else if (variant === 5) {
    pc.ellipse(8, 8, 5.5, 3, P.wwLaneLight)
    pc.line(4, 8, 12, 8, P.wwLaneEdge)
    pc.line(8, 6, 7, 10, P.wwLaneEdge)
  }
  return pc
}

// ---------- fences ----------

/** A timber post down a column, from y0 to y1. */
function post(pc, x, y0, y1) {
  pc.vline(x, y0, y1, P.wwTimberLight)
  pc.vline(x + 1, y0, y1, P.wwTimberDark)
}

/**
 * Each style draws a run across the tile (x from a to b, at the fence's height), a run down it
 * (y from a to b), and the post that stands at a corner or the end of a run.
 */
const FENCE_DRAW = {
  // Split rails: two rough rails between posts every fifth column.
  splitrail: {
    across(pc, a, b) {
      for (const y of [6, 10]) {
        pc.hline(a, b, y, P.wwTimberLight)
        pc.hline(a, b, y + 1, P.wwTimber)
      }
      for (let x = a; x <= b; x++) {
        if (x % 5 === 0) post(pc, x, 4, 15)
        if (x % 5 === 3) pc.px(x, 11, P.wwTimberDark)
      }
    },
    down(pc, a, b) {
      pc.vline(6, a, b, P.wwTimberLight)
      pc.vline(7, a, b, P.wwTimber)
      pc.vline(9, a, b, P.wwTimberLight)
      pc.vline(10, a, b, P.wwTimberDark)
    },
    post(pc) {
      pc.rect(6, 3, 4, 13, P.wwTimber)
      pc.vline(6, 3, 15, P.wwTimberLight)
      pc.vline(9, 3, 15, P.wwTimberDark)
      pc.hline(6, 9, 3, P.wwTimberLight)
    },
  },
  // A low adobe wall: whitewashed mud brick with a rounded cap, a brick showing every fifth column.
  adobe: {
    across(pc, a, b) {
      pc.rect(a, 8, b - a + 1, 8, P.wwWhitewash)
      pc.hline(a, b, 7, P.wwBone)
      pc.hline(a, b, 15, P.wwBoneShade)
      for (let x = a; x <= b; x++) {
        if (x % 5 === 1) {
          pc.hline(x, x + 1, 11, P.wwAdobe)
          pc.hline(x, x + 1, 12, P.wwAdobeDark)
        }
      }
    },
    down(pc, a, b) {
      pc.rect(5, a, 6, b - a + 1, P.wwWhitewash)
      pc.vline(5, a, b, P.wwBone)
      pc.vline(10, a, b, P.wwBoneShade)
      for (let y = a; y <= b; y++) if (y % 5 === 2) pc.hline(7, 8, y, P.wwAdobe)
    },
    post(pc) {
      pc.rect(4, 5, 8, 11, P.wwWhitewash)
      pc.hline(5, 10, 4, P.wwBone)
      pc.vline(4, 5, 15, P.wwBone)
      pc.vline(11, 5, 15, P.wwBoneShade)
      pc.hline(6, 9, 9, P.wwAdobe)
    },
  },
  // Barbed wire: three strands on cedar posts every fifth column, a barb on each every third.
  barbed: {
    across(pc, a, b) {
      for (const y of [6, 9, 12]) {
        pc.hline(a, b, y, P.wwIronLight)
        for (let x = a; x <= b; x++) if (x % 3 === 1) pc.px(x, y - 1, P.wwIron)
      }
      for (let x = a; x <= b; x++) if (x % 5 === 0) post(pc, x, 4, 15)
    },
    down(pc, a, b) {
      for (const x of [6, 9]) {
        pc.vline(x, a, b, P.wwIronLight)
        for (let y = a; y <= b; y++) if (y % 3 === 1) pc.px(x + 1, y, P.wwIron)
      }
    },
    post(pc) {
      post(pc, 7, 3, 15)
      pc.px(7, 3, P.wwBarnwoodLight)
      pc.px(8, 3, P.wwBarnwood)
    },
  },
  // A hitching rail: one heavy rail on stout posts every fifth column, an iron ring on each post.
  hitching: {
    across(pc, a, b) {
      pc.hline(a, b, 7, P.wwTimberLight)
      pc.hline(a, b, 8, P.wwTimber)
      pc.hline(a, b, 9, P.wwTimberDark)
      for (let x = a; x <= b; x++) {
        if (x % 5 === 0) {
          post(pc, x, 6, 15)
          pc.px(x, 10, P.wwIronLight)
          pc.px(x + 1, 11, P.wwIronLight)
        }
      }
    },
    down(pc, a, b) {
      pc.vline(7, a, b, P.wwTimberLight)
      pc.vline(8, a, b, P.wwTimber)
      pc.vline(9, a, b, P.wwTimberDark)
      for (let y = a; y <= b; y++) if (y % 5 === 0) pc.px(10, y, P.wwIronLight)
    },
    post(pc) {
      pc.rect(6, 5, 4, 11, P.wwTimber)
      pc.vline(6, 5, 15, P.wwTimberLight)
      pc.vline(9, 5, 15, P.wwTimberDark)
      pc.hline(6, 9, 5, P.wwTimberLight)
      pc.px(10, 9, P.wwIronLight)
    },
  },
}
const STYLES = ['splitrail', 'adobe', 'barbed', 'hitching']

/**
 * A plot's fence, one tile of it. A run reaches the edge of the tile on a linked side and stops
 * in the middle otherwise, so it ends in a post at a gap and turns a proper corner.
 */
export function drawFence(style, mask) {
  const pc = new PixelCanvas(T, T)
  const f = FENCE_DRAW[STYLES[style]] || FENCE_DRAW.splitrail
  const across = mask & (2 | 8)
  const down = mask & (1 | 4)
  if (across) f.across(pc, mask & 8 ? 0 : 7, mask & 2 ? T - 1 : 8)
  if (down) f.down(pc, mask & 1 ? 0 : 7, mask & 4 ? T - 1 : 8)
  const straight = mask === (2 | 8) || mask === (1 | 4)
  if (!straight) f.post(pc)
  return pc
}

/**
 * What lies at a fence's foot where nobody sweeps: drifted sand, a stone, a dry tuft. `mask` as
 * the fence's (1 N, 2 E, 4 S, 8 W). The sand is drawn in the ground's own colours, so the patches
 * tint it along with the ground round it.
 */
export function drawVerge(mask, tone) {
  const pc = new PixelCanvas(T, T)
  const [, dark, light, deep] = groundOf(tone)
  const rand = mulberry32(mask * 883 + toneOf(tone) * 149 + 61)
  const heap = (x, y) => {
    pc.hline(x - 1, x + 1, y, dark)
    pc.px(x, y - 1, light)
    pc.px(x - 1, y, deep)
  }
  const tuft = (x, y) => {
    pc.px(x, y, P.wwBarnwood)
    pc.px(x + 1, y - 1, P.wwBarnwoodLight)
    pc.px(x + 2, y, P.wwBarnwood)
  }
  const across = mask & (2 | 8)
  const down = mask & (1 | 4)
  if (across) {
    const x0 = mask & 8 ? 0 : 4
    const x1 = mask & 2 ? T - 3 : 10
    heap(x0 + 1 + Math.floor(rand() * 2), 15)
    for (let x = x0 + 3; x <= x1; x += 3) {
      const r = rand()
      if (r < 0.4) heap(x, 15)
      else if (r < 0.6) tuft(x, 15)
      else if (r < 0.8) pebble(pc, x, 13, light, deep)
    }
    for (let x = x0; x <= x1; x++) if (rand() < 0.2) pc.px(x, 15, light)
  }
  if (down) {
    const left = !(mask & 8)
    const right = !(mask & 2)
    for (let y = mask & 1 ? 3 : 6; y <= (mask & 4 ? 14 : 10); y += 3) {
      if (left && rand() < 0.5) heap(2, y)
      if (right && rand() < 0.5) heap(12, y)
    }
    if (right) tuft(12, mask & 4 ? 14 : 10)
    else if (left) tuft(1, mask & 4 ? 14 : 10)
  }
  if (!across && !down) {
    heap(3, 15)
    tuft(9, 14)
    pebble(pc, 6, 13, light, deep)
  }
  return pc
}

/**
 * The plot's ground spilling over the edge of the road: sand and grit creeping out onto the packed
 * dirt. Variant `side * 2 + k`, as the village's grass fringe: side 0 top, 1 right, 2 bottom, 3
 * left of the road's tile, k one of two scatters, and 8 more leaves the mouth of a path open.
 */
export function drawFringe(variant, tone) {
  const pc = new PixelCanvas(T, T)
  const [base, dark, light] = groundOf(tone)
  const mouth = variant >= 8
  const side = (variant & 7) >> 1
  const rand = mulberry32(variant * 661 + toneOf(tone) * 79 + 71)
  const set = (i, d, c) => {
    if (side === 0) pc.px(i, d, c)
    else if (side === 1) pc.px(T - 1 - d, i, c)
    else if (side === 2) pc.px(i, T - 1 - d, c)
    else pc.px(d, i, c)
  }
  const open = (i) => mouth && i >= 4 && i <= 11
  let n = 0
  for (let i = 0; i < T; i++) {
    const r = rand()
    if (r < 0.3 || open(i)) continue
    set(i, 0, r < 0.7 ? base : dark)
    if (r > 0.8) set(i, 1, r > 0.9 ? light : base)
    n++
  }
  for (let s = 0; s < 3; s++) {
    const i = Math.floor(rand() * T)
    if (open(i) || rand() < 0.3) continue
    set(i, 2 + Math.floor(rand() * 2), dark)
    n++
  }
  if (!n) set(0, 0, base)
  return pc
}

// ---------- what lies about ----------

/** A shadow on the ground under whatever has been drawn, where it meets the ground. */
function dropShadow(pc) {
  const under = []
  for (let y = 1; y < T; y++) for (let x = 0; x < T; x++) if (!pc.opaque(x, y) && pc.opaque(x, y - 1)) under.push(x, y)
  for (let i = 0; i < under.length; i += 2) pc.px(under[i], under[i + 1], P.shadow)
  return pc
}

/** Things that lie about on a plot: `deco.<kind>.<variant>`, over the ground of `tone`. */
export function drawCover(kind, variant, tone) {
  const pc = new PixelCanvas(T, T)
  if (kind === 'tumbleweed') {
    // A ball of dry twigs, loosely tangled.
    const r = variant ? 4.5 : 3.5
    const cx = 8
    const cy = 15 - r
    pc.ellipse(cx, cy, r, r, P.wwBarnwoodDark)
    for (let i = 0; i < 10; i++) {
      const a = i * 2.4
      pc.line(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), Math.round(cx - Math.cos(a + 1) * r * 0.6), Math.round(cy - Math.sin(a + 1) * r * 0.6), i % 2 ? P.wwBarnwoodLight : P.wwBarnwood)
    }
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) if ((x + y * 3) % 4 === 0 && pc.opaque(x, y) && Math.hypot(x - cx, y - cy) < r - 1.5) pc.clearPx(x, y)
    return dropShadow(pc)
  }
  if (kind === 'barrelcactus') {
    // A squat barrel cactus, ribbed, with a crown of flowers.
    const n = variant ? 2 : 1
    for (let i = 0; i < n; i++) {
      const x = 5 + i * 6
      const y = 11 - i
      pc.ellipse(x, y, 2.6, 3, P.wwCactus)
      pc.vline(x, y - 2, y + 2, P.wwCactusDark)
      pc.px(x - 1, y - 1, P.wwCactusLight)
      pc.px(x, y - 3, P.wwBloom)
    }
    return dropShadow(pc)
  }
  if (kind === 'cowskull') {
    // A cow's skull, horns spread.
    pc.rect(6, 7, 4, 3, P.wwBone)
    pc.rect(7, 10, 2, 2, P.wwBoneShade)
    pc.hline(3, 5, 6, P.wwBone)
    pc.hline(10, 12, 6, P.wwBone)
    pc.px(3, 5, P.wwBoneShade)
    pc.px(12, 5, P.wwBoneShade)
    pc.px(7, 8, P.wwBedDeep)
    pc.px(8, 8, P.wwBedDeep)
    return dropShadow(pc)
  }
  if (kind === 'sagebrush') {
    // A clump of sage, grey-green, round on top.
    const n = variant ? 2 : 1
    for (let i = 0; i < n; i++) {
      const x = 5 + i * 5
      const y = 11 - i * 3
      pc.ellipse(x, y, 3, 2, P.wwCactusDark)
      pc.ellipse(x - 0.5, y - 0.5, 2, 1.2, P.wwBarnwoodLight)
      pc.px(x + 1, y - 1, P.wwCactusLight)
    }
    return dropShadow(pc)
  }
  if (kind === 'hoofprints') {
    // A horse's track, walking across.
    const n = variant ? 6 : 4
    for (let i = 0; i < n; i++) {
      const x = 1 + i * 2 + (i % 2)
      const y = 5 + i * 2 - (i % 2) * 2
      pc.px(x, y, P.wwLaneEdge)
      pc.px(x + 1, y, P.wwLaneEdge)
      pc.px(x, y + 1, P.wwLaneDark)
    }
    return pc
  }
  if (kind === 'wagonwheel') {
    // A broken wheel lying flat, spokes and its iron tyre.
    pc.ellipse(8, 9, 5.5, 3, P.wwIronLight)
    pc.ellipse(8, 9, 4.5, 2.2, P.wwTimber)
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      pc.line(8, 9, Math.round(8 + Math.cos(a) * 4), Math.round(9 + Math.sin(a) * 2), P.wwTimberLight)
    }
    pc.px(8, 9, P.wwTimberDark)
    return dropShadow(pc)
  }
  if (kind === 'mesarock') {
    // A red boulder or two, lit from the top left.
    const n = variant ? 2 : 1
    const [, dark, light, deep] = P.wwGround[3]
    for (let i = 0; i < n; i++) {
      const x = 4 + i * 5
      const y = 8 + i * 2
      pc.ellipse(x + 2, y, 3.2, 2.4, dark)
      pc.ellipse(x + 1.5, y - 0.6, 2, 1.2, light)
      pc.hline(x, x + 4, y + 2, deep)
    }
    return dropShadow(pc)
  }
  // woodcrate: a crate dropped off a wagon, or two stacked.
  pc.rect(4, 7, 8, 6, P.wwTimber)
  pc.hline(4, 11, 7, P.wwTimberLight)
  pc.line(4, 12, 11, 7, P.wwTimberDark)
  pc.vline(11, 8, 12, P.wwTimberDark)
  if (variant) {
    pc.rect(6, 3, 6, 4, P.wwTimberLight)
    pc.hline(6, 11, 6, P.wwTimberDark)
  }
  return dropShadow(pc)
}

/**
 * Where things lie: slow noise, a step every few tiles, so they gather in drifts rather than
 * peppering the ground, and only some tiles in a drift, so a drift thins out raggedly.
 */
const DRIFT_SCALE = 1 / 4.5
const LOOSE_DRIFT = 0.62
const LOOSE_FILL = 0.3
const WORK_DRIFT = 0.68
/** How much of a working drift holds anything, by ground. */
const WORK_FILL = [0.3, 0.2, 0.3, 0.25]
/** What gathers in a drift, by ground: tumbleweed on the sand, crates on the boardwalk, cactus in the scrub, boulders on the rock. */
const WORK = ['tumbleweed', 'woodcrate', 'barrelcactus', 'mesarock']
/** And what lies loose everywhere between the drifts. */
const LOOSE = ['hoofprints', 'tumbleweed', 'sagebrush', 'hoofprints']
/** The odd thing, anywhere, by ground. */
const ODDS = [
  ['cowskull', 'barrelcactus', 'wagonwheel', 'sagebrush'],
  ['wagonwheel', 'hoofprints', 'tumbleweed', 'cowskull'],
  ['cowskull', 'tumbleweed', 'wagonwheel', 'hoofprints'],
  ['cowskull', 'barrelcactus', 'tumbleweed', 'wagonwheel'],
]
const ODD_SHARE = 0.03

/** What lies on the plot ground tile (tx, ty), if anything: `{ kind, variant }`, or null. */
export function westCover(tx, ty, tone) {
  const t = toneOf(tone)
  const h = lattice(tx, ty, 891)
  const v = lattice(tx, ty, 892)
  const x = tx * DRIFT_SCALE
  const y = ty * DRIFT_SCALE
  if (fbm(x, y, 837) > WORK_DRIFT) {
    const kind = WORK[t]
    if (h < WORK_FILL[t]) return { kind, variant: Math.floor(v * COVER_VARIANTS[kind]) }
  } else if (fbm(x, y, 831) > LOOSE_DRIFT) {
    const kind = LOOSE[t]
    if (h < LOOSE_FILL) return { kind, variant: Math.floor(v * COVER_VARIANTS[kind]) }
  }
  if (h > 1 - ODD_SHARE) {
    const list = ODDS[t]
    const kind = list[Math.floor(v * list.length)]
    return { kind, variant: Math.floor(lattice(tx, ty, 893) * COVER_VARIANTS[kind]) }
  }
  return null
}

/** The ground's plain colours, each paired with its dry partner and its lush one. */
export function patches(tone) {
  const t = toneOf(tone)
  return [P.wwGround[t], P.wwGroundSunny[t], P.wwGroundLush[t]]
}
