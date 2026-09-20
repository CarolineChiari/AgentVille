// Halloween ground, lanes and fences: frosted grass, leaf mould, turf with fog lying on it or the
// old flags of a forecourt inside each plot, a lane of dark setts round it, a path swept through
// the leaves across it, and fences that have been leaned on for a century.
//
// Contract (see ThemePack in ../index.js and the village's src/render/sprites/tiles.js):
// - `tone` is a plot's yard, an index into THEMES.halloween.dims.yard (frost, mulch, mist, flagstone).
// - Ground, trail and road tiles are 16×16 and fully opaque; each variant is its own picture.
// - A fence's `style` indexes THEMES.halloween.dims.fence; `mask` which sides carry on (1 N, 2 E,
//   4 S, 8 W). A straight run meets the next tile's edge to edge, so nothing a run draws may
//   differ in shape between its first column and its last. Every pattern below therefore has a
//   period that divides 15, which is the only way column 0 and column 15 agree.
// - `patches(tone)` is [plain, sunny, lush]: the ground's plain colours, and what each becomes in
//   a dry patch and a damp one. Only pixels exactly a plain colour are repainted.
// - `hallowCover` is pure: the same tile always has the same thing lying on it, or nothing.
import { PALETTE as P } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { mulberry32 } from '../../../sim/rng.js'
import { fbm, lattice } from '../../../sim/noise.js'

const T = 16
const FROST = 0
const MULCH = 1
const MIST = 2
const FLAG = 3

const toneOf = (tone) => (tone || 0) % P.hallowGround.length
/** A ground's colours: base, shade, light, deepest. All four are its plain colours. */
const groundOf = (tone) => P.hallowGround[toneOf(tone)]
/** A fallen leaf's colour, by whatever number is to hand. */
const fallen = (i) => P.fallen[Math.abs(Math.floor(i)) % P.fallen.length]

/** How many looks each thing lying about has; drawn as `deco.<kind>.<variant>`. */
export const COVER_VARIANTS = { pumpkins: 2, hay: 2, deadleaves: 2, webs: 2, toadstools: 2, treats: 1 }
/** The lip drawn where the lane meets anything else: the shadowed edge of its setts. */
export const ROAD_EDGE = P.cobbleSeam
/** What the pumpkin patch is edged in: the boards holding its beds in. */
export const BED_EDGE = P.deadBarkDark

// ---------- the ground ----------

/** Seeds per kind of tile, so a lane and a ground of the same variant don't share a scatter. */
const SEED = { ground: 31, trail: 32, road: 33 }

function scatter(rand, n, draw) {
  for (let i = 0; i < n; i++) draw(Math.floor(rand() * T), Math.floor(rand() * T))
}

/** A blade of dying grass, two pixels of it, leaning one way or the other. */
function blade(pc, x, y, c) {
  pc.px(x, y, c)
  pc.px(x + (((x + y) & 1) ? 1 : -1), y - 1, c)
}

/** A fallen leaf lying flat: three across with a stalk, small enough to read at 1×. */
function leaf(pc, x, y, i) {
  const c = fallen(i)
  pc.hline(x, x + 2, y, c)
  pc.px(x + 1, y - 1, c)
  pc.px(x + 3, y, P.deadBarkDark)
}

/** The ground itself, before anything is found in it. */
function texture(pc, rand, t) {
  const [base, dark, light, deep] = P.hallowGround[t]
  pc.rect(0, 0, T, T, base)
  if (t === FROST) {
    // The last of the year's grass, its tips gone pale with frost.
    scatter(rand, 16, (x, y) => blade(pc, x, y, dark))
    scatter(rand, 12, (x, y) => blade(pc, x, y, light))
    scatter(rand, 5, (x, y) => pc.px(x, y, deep))
    scatter(rand, 3, (x, y) => pc.px(x, y, P.web))
  } else if (t === MULCH) {
    // Leaf mould: what has fallen, and the turned earth showing through it.
    scatter(rand, 9, (x, y) => leaf(pc, x, y, x + y))
    scatter(rand, 9, (x, y) => pc.px(x, y, deep))
    scatter(rand, 7, (x, y) => pc.hline(x, x + 1, y, dark))
    scatter(rand, 4, (x, y) => pc.px(x, y, light))
  } else if (t === MIST) {
    // Churchyard turf with the fog lying on it in long low bands.
    for (let i = 0; i < 4; i++) {
      const x = Math.floor(rand() * 10)
      const y = 1 + Math.floor(rand() * 14)
      pc.hline(x, x + 6, y, light)
      pc.hline(x + 1, x + 5, y - 1, P.webDim)
    }
    scatter(rand, 9, (x, y) => blade(pc, x, y, dark))
    scatter(rand, 5, (x, y) => pc.px(x, y, deep))
  } else {
    // Old flags, laid long ago and settling: 8 px squares with moss and grit in the joints.
    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        if (y % 8 === 7 || x % 8 === 7) pc.px(x, y, deep)
        else if (y % 8 === 0 || x % 8 === 0) pc.px(x, y, light)
      }
    }
    scatter(rand, 10, (x, y) => pc.px(x, y, dark))
    for (let i = 0; i < 6; i++) pc.px(Math.floor(rand() * T), (Math.floor(rand() * 2) * 8 + 7) % T, P.moss)
  }
}

/** What a rare tile has in it: variants 3, 4 and 5 of each ground. */
function find(pc, rand, t, variant) {
  const [base, dark, light, deep] = P.hallowGround[t]
  const x = 4 + Math.floor(rand() * 6)
  const y = 4 + Math.floor(rand() * 6)
  const k = variant - 3
  if (t === FROST) {
    if (k === 0) {
      // A rime of frost where the sun never reaches.
      pc.ellipse(x, y, 4, 2.5, light)
      for (let i = 0; i < 7; i++) pc.px(x - 3 + i, y - 1 + ((i * 3) % 3), P.web)
    } else if (k === 1) {
      // A sweet dropped on the way home and never picked up.
      pc.hline(x, x + 2, y, P.candyRed)
      pc.px(x - 1, y, P.wrapper)
      pc.px(x + 3, y, P.wrapper)
      pc.px(x + 1, y + 1, deep)
    } else {
      // A little gourd nobody carved.
      pc.ellipse(x, y, 2.5, 2, P.gourd)
      pc.px(x - 1, y - 1, P.boneWhite)
      pc.px(x, y - 3, P.stalkDark)
      pc.hline(x - 2, x + 2, y + 3, deep)
    }
  } else if (t === MULCH) {
    if (k === 0) {
      // A drift of leaves raked up and left.
      for (let i = 0; i < 8; i++) leaf(pc, x - 4 + ((i * 3) % 9), y + (i % 4), i + x)
    } else if (k === 1) {
      // A pumpkin still on its bine, too small to bother with.
      pc.ellipse(x, y, 3, 2.5, P.pumpkin)
      pc.vline(x - 1, y - 2, y + 2, P.pumpkinDark)
      pc.px(x + 1, y - 1, P.pumpkinLight)
      pc.px(x, y - 3, P.stalkDark)
      for (let i = 0; i < 5; i++) pc.px(x + 3 + i, y + 2 - (i % 2), P.bine)
    } else {
      // Bare earth where a boot has been through the leaves.
      pc.ellipse(x, y, 3.5, 2, deep)
      pc.ellipse(x, y, 2.5, 1, dark)
      pc.px(x - 1, y - 1, base)
    }
  } else if (t === MIST) {
    if (k === 0) {
      // A stone fallen flat and sunk into the turf.
      pc.rect(x - 4, y, 8, 4, P.graveStone)
      pc.hline(x - 4, x + 3, y, P.graveStoneLight)
      pc.hline(x - 4, x + 3, y + 3, P.graveStoneDark)
      pc.hline(x - 2, x + 1, y + 2, P.moss)
    } else if (k === 1) {
      // Toadstools in the damp, come up overnight.
      for (const [dx, dy] of [[0, 0], [3, 2], [-2, 3]]) {
        pc.hline(x + dx - 1, x + dx + 1, y + dy, P.mushroom[0])
        pc.px(x + dx, y + dy + 1, P.boneWhite)
        pc.px(x + dx, y + dy + 2, deep)
      }
    } else {
      // Standing water, with the sky in it.
      pc.ellipse(x, y, 4.5, 2.5, deep)
      pc.ellipse(x, y, 3, 1.5, P.cobbleDark)
      pc.hline(x - 2, x, y - 1, P.webDim)
    }
  } else {
    if (k === 0) {
      // A flag split end to end, the crack dark where the frost got in.
      let cx = 4 + Math.floor(rand() * 7)
      for (let cy = 0; cy < T; cy++) {
        pc.px(cx, cy, deep)
        if (cy % 3 === 1) pc.px(cx + 1, cy, dark)
        if (rand() < 0.35) cx = Math.max(1, Math.min(14, cx + (rand() < 0.5 ? -1 : 1)))
      }
    } else if (k === 1) {
      // A hopscotch chalked on the flags and half worn off again.
      for (const [dx, dy] of [[0, -6], [0, -2], [-3, 2], [3, 2]]) {
        const bx = x + dx - 2
        const by = y + dy
        pc.hline(bx, bx + 4, by, P.wrapper)
        pc.hline(bx, bx + 4, by + 3, P.boneShade)
        pc.vline(bx, by, by + 3, P.boneShade)
        pc.vline(bx + 4, by, by + 3, P.wrapper)
      }
    } else {
      // Leaves blown into a corner and left to rot.
      for (let i = 0; i < 6; i++) leaf(pc, 1 + ((i * 4) % 11), 10 + (i % 4), i * 3)
      pc.hline(0, 4, 15, dark)
    }
  }
}

/**
 * A plot's ground. Variants 0–2 are plain and carry the ground; 3–5 are rare (see TILE_WEIGHTS in
 * the village's tiles) and each holds something the night has left lying there.
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
 * The pumpkin patch, where the village has its ploughed field: beds of turned earth in ridges,
 * with a bine running along them and a mound raised where each pumpkin will sit. The mounds are
 * on the village's grid of dimples, 8 px apart: variant 0 is the patch's top row, variant 1 every
 * row below it, which carries the grid on from the row above (see the village's `bed` tile).
 * Everything but the bine is drawn in the ground's own colours, so the patch takes its plot's
 * patches along with the rest of it.
 */
export function drawBed(variant, tone) {
  const [base, dark, light, deep] = groundOf(tone)
  const pc = new PixelCanvas(T, T)
  pc.rect(0, 0, T, T, base)
  // Ridge and furrow, drawn across: the earth heaped up in bands with the furrow dark between.
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const s = y % 4
      if (s === 0) pc.px(x, y, deep)
      else if (s === 1) pc.px(x, y, dark)
      else if (s === 3 && (x * 3 + y) % 5) pc.px(x, y, light)
    }
  }
  for (const y0 of variant ? [-4, 4] : [4]) {
    for (const x0 of [0, 8]) {
      // A mound of raked earth, and the bine crossing it, so a bare spot still reads as planted.
      pc.hline(x0 + 2, x0 + 5, y0 + 5, light)
      pc.hline(x0 + 3, x0 + 4, y0 + 4, base)
      pc.hline(x0 + 2, x0 + 5, y0 + 6, dark)
      pc.px(x0 + 1, y0 + 5, P.bine)
      pc.px(x0 + 6, y0 + 4, P.bine)
    }
  }
  return pc
}

// ---------- the path across a plot ----------

/** Where a path runs across its tile: 8 px wide, down the middle, so arms meet their neighbours'. */
const LO = 4
const HI = 11

/**
 * A path swept clear through the fallen leaves: bare trodden earth 8 px wide down the middle of
 * the tile, an arm out of each linked side to its edge, and the leaves heaped along both sides of
 * it. The earth is the ground's own deepest colour, which is one of its plain colours, so a path
 * takes the plot's patches along with the ground round it.
 */
export function drawTrail(variant, links, tone) {
  const t = toneOf(tone)
  const g = P.hallowGround[t]
  const pc = new PixelCanvas(T, T)
  const rand = mulberry32(variant * 149 + links * 19 + t * 6151 + SEED.trail)
  texture(pc, rand, t)
  const N = links & 1
  const E = links & 2
  const S = links & 4
  const W = links & 8
  const down = N || S
  const across = E || W || !down
  const swept = (x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) pc.px(x, y, (x * 5 + y * 3) % 7 ? g[3] : g[1])
  }
  // The heap of leaves the broom pushed aside, along one edge of an arm.
  const heap = (x0, y0, x1, y1) => {
    for (let i = 0; i <= Math.max(x1 - x0, y1 - y0); i += 2) {
      const x = x0 === x1 ? x0 : x0 + i
      const y = y0 === y1 ? y0 : y0 + i
      pc.px(x, y, fallen(x * 3 + y))
      if ((x + y) % 3 === 0) pc.px(x0 === x1 ? x + 1 : x, y0 === y1 ? y + 1 : y, P.deadBarkDark)
    }
  }
  const dy0 = N ? 0 : LO
  const dy1 = S ? T - 1 : HI
  const ax0 = W ? 0 : LO
  const ax1 = E ? T - 1 : HI
  if (down) {
    swept(LO, dy0, HI, dy1)
    heap(LO, dy0, LO, dy1)
    heap(HI, dy0, HI, dy1)
  }
  if (across) {
    swept(ax0, LO, ax1, HI)
    heap(ax0, LO, ax1, LO)
    heap(ax0, HI, ax1, HI)
  }
  // Something on the path, by variant.
  if (variant === 1) leaf(pc, 6, 9, 5)
  else if (variant === 2) {
    pc.px(8, 7, g[1])
    pc.px(9, 11, g[1])
  } else if (variant === 3) {
    // A bootprint pressed into the earth.
    pc.ellipse(7, 8, 1.5, 2, g[1])
    pc.hline(6, 8, 11, g[1])
  }
  return pc
}

// ---------- the lane ----------

/**
 * The lane round a plot: old setts, dark and damp, laid in courses, with leaves blown into the
 * seams. Stones are 4 px wide and 3 deep with the courses staggered, so the joints line up tile
 * to tile. Variants 0–2 are plain; 3 has a drift of leaves, 4 a weed through a seam, 5 a puddle.
 */
export function drawRoad(variant) {
  const pc = new PixelCanvas(T, T)
  const rand = mulberry32(variant * 149 + SEED.road * 6151)
  pc.rect(0, 0, T, T, P.cobble)
  for (let y = 0; y < T; y++) {
    const course = Math.floor(y / 4)
    for (let x = 0; x < T; x++) {
      const joint = (x + course * 2) % 4 === 3
      if (y % 4 === 3 || joint) pc.px(x, y, P.cobbleSeam)
      else if (y % 4 === 0 || (x + course * 2) % 4 === 0) pc.px(x, y, P.cobbleLight)
    }
  }
  scatter(rand, 12, (x, y) => pc.px(x, y, P.cobbleDark))
  scatter(rand, 6, (x, y) => pc.px(x, y, P.cobbleLight))
  // Leaves find the seams first, so they are scattered along them rather than over the stones.
  for (let i = 0; i < 7; i++) {
    const x = Math.floor(rand() * T)
    const y = Math.floor(rand() * 4) * 4 + 3
    pc.px(x, y, fallen(x + y))
    if (rand() < 0.4) pc.px(x, y - 1, fallen(x))
  }
  if (variant === 3) {
    for (let i = 0; i < 5; i++) leaf(pc, 2 + ((i * 3) % 10), 4 + (i % 3) * 4, i * 5)
  } else if (variant === 4) {
    // A weed that found its way up through a joint, dying back now.
    const x = 4 + Math.floor(rand() * 7)
    pc.vline(x, 6, 11, P.stalkDark)
    for (const [dx, dy] of [[-2, 7], [2, 8], [-1, 5]]) pc.px(x + dx, dy, P.stalk)
    pc.hline(x - 1, x + 1, 11, P.cobbleSeam)
  } else if (variant === 5) {
    // Standing water with the moon in it.
    pc.ellipse(8, 8, 5.5, 3, P.cobbleSeam)
    pc.ellipse(8, 8, 4, 2, P.cobbleDark)
    pc.hline(5, 7, 7, P.webDim)
    pc.px(10, 9, P.webDim)
  }
  return pc
}

// ---------- fences ----------

/**
 * A crooked pale's top row, by column. Two columns to a pale with a gap between, on a period of
 * five: five divides fifteen, so column 0 and column 15 are the same column of the same pale and
 * a straight run meets the next tile edge to edge.
 */
const PALE = [4, 5, 6, 7, -1]
/** How far the string of lights dips between its hangers, by column. Period five, likewise. */
const SWAG = [2, 1, 0, 1, 2]

/** A rail of weathered board across x0..x1 on row y. */
function rail(pc, x0, x1, y) {
  pc.hline(x0, x1, y, P.deadBarkLight)
  pc.hline(x0, x1, y + 1, P.deadBark)
}

/** A bar of wrought iron with a spear point on it, from y0 down to y1. */
function ironBar(pc, x, y0, y1) {
  pc.vline(x, y0 + 2, y1, P.ironBar)
  pc.px(x, y0 + 1, P.ironBarLight)
  pc.px(x, y0, P.ironBar)
}

/** One dried corn stalk down a column, from y0 to y1, with a husk hanging off it. */
function cornColumn(pc, x, y0, y1, k) {
  for (let y = y0; y <= y1; y++) pc.px(x, y, (x + y) % 3 === 0 ? P.husk : P.huskDark)
  pc.px(x, y0, P.straw)
  pc.px(x, y0 + 2, P.huskDark)
  if (k % 3 === 1) pc.px(x + 1, y0 + 4, P.husk)
  if (k % 3 === 2) pc.px(x - 1, y0 + 5, P.huskDark)
}

/**
 * Each style draws a run across the tile (x from a to b, at the fence's height), a run down it
 * (y from a to b), and the post that stands at a corner or the end of a run.
 */
const FENCE_DRAW = {
  // A picket fence nobody has straightened in years: pales two columns wide leaning against each
  // other, a gap where one has gone, and two rails behind them.
  crooked: {
    across(pc, a, b) {
      rail(pc, a, b, 7)
      rail(pc, a, b, 11)
      for (let x = a; x <= b; x++) {
        const s = x % 5
        if (PALE[s] < 0) continue
        const lean = s === 1 || s === 3 ? 1 : 0
        pc.vline(x, PALE[s] + lean, 14, s % 2 ? P.deadBarkDark : P.deadBark)
        pc.px(x, PALE[s] + lean, P.deadBarkLight)
      }
    },
    down(pc, a, b) {
      pc.vline(6, a, b, P.deadBarkLight)
      pc.vline(7, a, b, P.deadBark)
      pc.vline(8, a, b, P.deadBarkDark)
      for (let y = a; y <= b; y++) if (y % 5 === 2) pc.hline(5, 9, y, P.deadBark)
    },
    post(pc) {
      pc.vline(7, 2, 15, P.deadBark)
      pc.vline(8, 3, 15, P.deadBarkDark)
      pc.px(7, 2, P.deadBarkLight)
      pc.hline(6, 9, 7, P.deadBarkLight)
      pc.hline(6, 9, 11, P.deadBark)
    },
  },
  // Wrought-iron railings: a bar every three columns (three divides fifteen) under two rails,
  // each bar drawn to a spear point.
  ironwork: {
    across(pc, a, b) {
      pc.hline(a, b, 6, P.ironBarLight)
      pc.hline(a, b, 7, P.ironBar)
      pc.hline(a, b, 12, P.ironBar)
      pc.hline(a, b, 13, P.ironBar)
      for (let x = a; x <= b; x++) if (x % 3 === 0) ironBar(pc, x, 3, 14)
    },
    down(pc, a, b) {
      pc.vline(6, a, b, P.ironBarLight)
      pc.vline(7, a, b, P.ironBar)
      pc.vline(9, a, b, P.ironBar)
      for (let y = a; y <= b; y++) if (y % 3 === 0) pc.hline(5, 10, y, P.ironBar)
    },
    post(pc) {
      pc.vline(7, 1, 15, P.ironBar)
      pc.vline(8, 1, 15, P.ironBarLight)
      pc.hline(6, 9, 3, P.ironBar)
      // A finial: a small barbed head on top of the standard.
      pc.px(7, 0, P.ironBarLight)
      pc.px(6, 2, P.ironBar)
      pc.px(9, 2, P.ironBar)
    },
  },
  // Corn stalks cut and stood up in a row, bound together at waist height.
  cornstalk: {
    across(pc, a, b) {
      // Every other column and no more: stalks stood up with the night showing between them. A
      // stalk in every column read as a wall of straw rather than as a fence of corn.
      for (let x = a; x <= b; x++) {
        const s = x % 5
        if (s === 1 || s === 3) continue
        cornColumn(pc, x, s === 0 ? 2 : s === 2 ? 4 : 6, 14, x)
      }
      pc.hline(a, b, 9, P.strawDark)
      pc.hline(a, b, 10, P.huskDark)
      for (let x = a; x <= b; x++) if (x % 5 === 0) pc.px(x, 9, P.strawLight)
    },
    down(pc, a, b) {
      for (let y = a; y <= b; y++) {
        const w = y % 5 === 0 ? 2 : 1
        for (let x = 7 - w; x <= 8 + w; x++) pc.px(x, y, (x + y) % 3 === 0 ? P.huskDark : P.husk)
        pc.px(8 + w, y, P.huskDark)
        if (y % 5 === 2) pc.hline(6, 9, y, P.straw)
      }
    },
    post(pc) {
      // A stook: the stalks gathered in and tied near the top, spreading out at the foot.
      for (let x = 4; x <= 11; x++) {
        const top = 3 + Math.abs(x - 7)
        for (let y = top; y <= 15; y++) pc.px(x, y, (x + y) % 3 === 0 ? P.husk : P.huskDark)
        pc.px(x, top, P.straw)
      }
      pc.hline(5, 10, 6, P.strawDark)
      pc.hline(5, 10, 7, P.huskDark)
      pc.px(6, 6, P.strawLight)
    },
  },
  // A low rail with a string of paper lanterns swagged along it: the cheerful end of the street.
  lights: {
    across(pc, a, b) {
      rail(pc, a, b, 10)
      rail(pc, a, b, 13)
      for (let x = a; x <= b; x++) {
        const s = x % 5
        pc.px(x, 3 + SWAG[s], P.ironBarLight)
        if (s !== 0) continue
        // A paper lantern hung from the bottom of each swag, orange or purple turn and turn
        // about. Five rows of it: at two it was a pair of dots and the fence read as bare wire.
        // It hangs where x % 5 is 0, so a lantern is cut in half across a tile join and its two
        // halves are the same shape: anywhere else a run met the next tile unevenly.
        const warm = (x >> 2) % 2 === 0
        const skin = warm ? P.pumpkin : P.hallowRoof[1]
        const shade = warm ? P.pumpkinDark : P.felt
        pc.hline(x - 1, x + 1, 6, skin)
        pc.hline(x - 2, x + 2, 7, skin)
        pc.hline(x - 2, x + 2, 8, shade)
        pc.px(x - 2, 7, shade)
        pc.px(x + 2, 7, shade)
        pc.px(x, 7, P.jackGlow)
        pc.px(x, 9, shade)
      }
    },
    down(pc, a, b) {
      pc.vline(6, a, b, P.deadBarkLight)
      pc.vline(7, a, b, P.deadBark)
      pc.vline(9, a, b, P.ironBar)
      for (let y = a; y <= b; y++) {
        if (y % 5 === 2) {
          pc.hline(9, 11, y, P.pumpkin)
          pc.px(10, y + 1, P.pumpkinDark)
        }
      }
    },
    post(pc) {
      pc.vline(7, 3, 15, P.deadBark)
      pc.vline(8, 4, 15, P.deadBarkDark)
      pc.px(7, 3, P.deadBarkLight)
      pc.hline(6, 9, 10, P.deadBarkLight)
      pc.hline(6, 9, 13, P.deadBark)
      // The string tied off at the post, with a lantern on the end of it.
      pc.hline(8, 10, 4, P.ironBarLight)
      pc.hline(9, 11, 6, P.pumpkin)
      pc.hline(8, 12, 7, P.pumpkin)
      pc.hline(9, 11, 8, P.pumpkinDark)
      pc.px(10, 7, P.jackGlow)
    },
  },
}
const STYLES = ['crooked', 'ironwork', 'cornstalk', 'lights']

/**
 * A plot's fence, one tile of it. A run reaches the edge of the tile on a linked side and stops
 * in the middle otherwise, so it ends in a post at a gap and turns a proper corner.
 */
export function drawFence(style, mask) {
  const pc = new PixelCanvas(T, T)
  const f = FENCE_DRAW[STYLES[style]] || FENCE_DRAW.crooked
  const across = mask & (2 | 8)
  const down = mask & (1 | 4)
  if (across) f.across(pc, mask & 8 ? 0 : 7, mask & 2 ? T - 1 : 8)
  if (down) f.down(pc, mask & 1 ? 0 : 7, mask & 4 ? T - 1 : 8)
  const straight = mask === (2 | 8) || mask === (1 | 4)
  if (!straight) f.post(pc)
  return pc
}

/**
 * What gathers at a fence's foot: leaves banked against it, a straggle of dead grass and the odd
 * gourd. `mask` as the fence's (1 N, 2 E, 4 S, 8 W). Drawn in the ground's own colours where it
 * can be, so the patches tint it along with the ground round it.
 */
export function drawVerge(mask, tone) {
  const pc = new PixelCanvas(T, T)
  const [, dark, light, deep] = groundOf(tone)
  const rand = mulberry32(mask * 883 + toneOf(tone) * 149 + 17)
  const clump = (x, y) => {
    pc.px(x, y, light)
    pc.px(x + 1, y, dark)
    pc.hline(x, x + 1, y + 1, deep)
  }
  const bank = (x, y) => {
    pc.hline(x, x + 2, y, fallen(x + y))
    pc.px(x + 1, y - 1, fallen(x * 3))
    pc.px(x, y + 1, P.deadBarkDark)
  }
  const across = mask & (2 | 8)
  const down = mask & (1 | 4)
  if (across) {
    const x0 = mask & 8 ? 0 : 4
    const x1 = mask & 2 ? T - 3 : 10
    bank(x0 + Math.floor(rand() * 2), 14)
    for (let x = x0 + 3; x <= x1; x += 3) {
      const r = rand()
      if (r < 0.45) bank(x, 14)
      else if (r < 0.7) clump(x, 14)
    }
    for (let x = x0; x <= x1; x++) if (rand() < 0.2) pc.px(x, 15, dark)
  }
  if (down) {
    // Beside the run, but not on the side a run across leaves by: there they would be banked up
    // the face of the fence rather than at its foot.
    const left = !(mask & 8)
    const right = !(mask & 2)
    for (let y = mask & 1 ? 2 : 5; y <= (mask & 4 ? 13 : 10); y += 3) {
      if (left && rand() < 0.5) bank(1, y)
      if (right && rand() < 0.5) bank(11, y)
    }
    if (right) clump(12, mask & 4 ? 13 : 9)
    else if (left) clump(2, mask & 4 ? 13 : 9)
  }
  if (!across && !down) {
    bank(3, 14)
    bank(10, 14)
    clump(7, 13)
  }
  return pc
}

/**
 * The plot's ground spilling over the edge of the lane: leaves blown out onto the setts and grass
 * taking the joints. Variant `side * 2 + k`, as the village's grass fringe: side 0 top, 1 right,
 * 2 bottom, 3 left of the lane's tile, k one of two scatters, and 8 more leaves a path's mouth open.
 */
export function drawFringe(variant, tone) {
  const pc = new PixelCanvas(T, T)
  const [base, dark] = groundOf(tone)
  const mouth = variant >= 8
  const side = (variant & 7) >> 1
  const rand = mulberry32(variant * 661 + toneOf(tone) * 79 + 37)
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
    if (r < 0.35 || open(i)) continue
    set(i, 0, r < 0.7 ? base : dark)
    if (r > 0.85) set(i, 1, base)
    n++
  }
  // Leaves blown a good way further out than the grass reaches.
  for (let s = 0; s < 4; s++) {
    const i = Math.floor(rand() * T)
    if (open(i) || rand() < 0.3) continue
    set(i, 2 + Math.floor(rand() * 3), fallen(i + s))
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

/** A pumpkin sitting on the ground, `r` across, its ribs down it. */
function pumpkin(pc, cx, cy, rx, ry) {
  pc.ellipse(cx, cy, rx, ry, P.pumpkin)
  pc.ellipse(cx - rx * 0.35, cy - ry * 0.35, rx * 0.4, ry * 0.4, P.pumpkinLight)
  for (const dx of [-1, 1]) pc.vline(cx + Math.round(dx * rx * 0.45), cy - ry + 1, cy + ry - 1, P.pumpkinRib)
  pc.px(cx, cy - ry - 1, P.stalkDark)
  pc.px(cx + 1, cy - ry - 1, P.stalk)
}

/** Flat things that lie about on a plot: `deco.<kind>.<variant>`, over the ground of `tone`. */
export function drawCover(kind, variant, tone) {
  const pc = new PixelCanvas(T, T)
  const [, dark, , deep] = groundOf(tone)
  if (kind === 'pumpkins') {
    pumpkin(pc, 6, 11, 3.5, 2.8)
    if (variant) {
      pumpkin(pc, 12, 8, 2.5, 2)
      pc.px(2, 13, P.bine)
    }
    for (let i = 0; i < 6; i++) pc.px(1 + i * 2, 14 - (i % 2), P.bine)
    return dropShadow(pc)
  }
  if (kind === 'hay') {
    // A bale or two, the twine still round them.
    const bale = (x, y, w, h) => {
      pc.rect(x, y, w, h, P.straw)
      pc.hline(x, x + w - 1, y, P.strawLight)
      pc.hline(x, x + w - 1, y + h - 1, P.strawDark)
      for (let i = 2; i < w; i += 3) pc.vline(x + i, y, y + h - 1, P.strawDark)
      pc.vline(x + 1, y, y + h - 1, P.huskDark)
    }
    bale(2, 9, 9, 5)
    if (variant) bale(9, 5, 6, 4)
    return dropShadow(pc)
  }
  if (kind === 'deadleaves') {
    const n = variant ? 11 : 6
    for (let i = 0; i < n; i++) leaf(pc, 1 + ((i * 5) % 12), 3 + ((i * 7) % 11), i * 3)
    return pc
  }
  if (kind === 'webs') {
    // A web slung between the stems: six anchor threads out from the middle, and the spiral strung
    // between them ring by ring. A ring of scattered pixels read as a snowflake rather than a web,
    // so each ring is drawn as straight runs from one anchor thread to the next.
    const cx = variant ? 6 : 9
    const cy = variant ? 9 : 7
    const arms = [[-6, -4], [0, -6], [6, -4], [6, 4], [0, 6], [-6, 4]]
    for (const [dx, dy] of arms) pc.line(cx, cy, cx + dx, cy + dy, P.webDim)
    for (const t of [0.45, 0.8]) {
      const at = ([dx, dy]) => [Math.round(cx + dx * t), Math.round(cy + dy * t)]
      arms.forEach((arm, i) => {
        const [x0, y0] = at(arm)
        const [x1, y1] = at(arms[(i + 1) % arms.length])
        pc.line(x0, y0, x1, y1, P.web)
      })
    }
    pc.px(cx, cy, P.web)
    return pc
  }
  if (kind === 'toadstools') {
    const spots = variant ? [[4, 10], [8, 8], [11, 11], [6, 13]] : [[6, 11], [10, 9]]
    for (const [x, y] of spots) {
      pc.hline(x - 1, x + 1, y, P.mushroom[0])
      pc.px(x, y - 1, P.mushroom[0])
      pc.px(x - 1, y, P.boneWhite)
      pc.px(x, y + 1, P.boneWhite)
      pc.px(x, y + 2, deep)
    }
    return pc
  }
  // Sweets spilled out of somebody's bag and not all picked up again.
  for (const [x, y, c] of [[3, 12, P.candyRed], [7, 9, P.candyGreen], [11, 13, P.hallowRoof[7]], [9, 6, P.candyRed], [13, 9, P.wrapper]]) {
    pc.hline(x, x + 1, y, c)
    pc.px(x - 1, y, P.wrapper)
    pc.px(x + 2, y, P.wrapper)
    pc.px(x, y + 1, dark)
  }
  return pc
}

/**
 * Where things lie: slow noise, a step every few tiles, so they gather in drifts rather than
 * peppering the ground, and only some tiles in a drift, so a drift thins out raggedly. Octaves of
 * value noise bunch round 0.5, so a drift is where it rises into its top third or so.
 */
const DRIFT_SCALE = 1 / 4.5
const LEAF_DRIFT = 0.62
const LEAF_FILL = 0.3
const CROP_DRIFT = 0.7
/** How much of a growing drift holds anything, by ground: the leaf mould most, the flags none. */
const CROP_FILL = [0.18, 0.4, 0.25, 0]
/** What comes up in a drift, by ground: pumpkins in the mould, toadstools in the damp. */
const CROP = ['toadstools', 'pumpkins', 'toadstools', 'pumpkins']
/** The odd thing, anywhere, by ground. */
const ODDS = [
  ['webs', 'treats', 'deadleaves', 'pumpkins'],
  ['hay', 'pumpkins', 'webs', 'deadleaves'],
  ['webs', 'toadstools', 'deadleaves', 'webs'],
  ['deadleaves', 'webs', 'treats', 'pumpkins'],
]
const ODD_SHARE = 0.03

/** What lies on the plot ground tile (tx, ty), if anything: `{ kind, variant }`, or null. */
export function hallowCover(tx, ty, tone) {
  const t = toneOf(tone)
  const h = lattice(tx, ty, 391)
  const v = lattice(tx, ty, 392)
  const x = tx * DRIFT_SCALE
  const y = ty * DRIFT_SCALE
  if (CROP_FILL[t] && fbm(x, y, 337) > CROP_DRIFT) {
    const kind = CROP[t]
    if (h < CROP_FILL[t]) return { kind, variant: Math.floor(v * COVER_VARIANTS[kind]) }
  } else if (fbm(x, y, 331) > LEAF_DRIFT) {
    if (h < LEAF_FILL) return { kind: 'deadleaves', variant: v < 0.55 ? 0 : 1 }
  }
  if (h > 1 - ODD_SHARE) {
    const list = ODDS[t]
    const kind = list[Math.floor(v * list.length)]
    return { kind, variant: Math.floor(lattice(tx, ty, 393) * COVER_VARIANTS[kind]) }
  }
  return null
}

/** The ground's plain colours, each paired with its dry and its damp partner. */
export function patches(tone) {
  const t = toneOf(tone)
  return [P.hallowGround[t], P.hallowGroundSunny[t], P.hallowGroundLush[t]]
}
