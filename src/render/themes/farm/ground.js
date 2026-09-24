// Farm ground, ways and fences: pasture, golden stubble, fresh-turned furrows or a trodden
// farmyard inside each plot, a rolled lane round it, a trodden path across it, and fences of post
// and rail, wire, wattle hurdles and white paddock boards.
//
// Contract (see ThemePack in ../index.js and the village's src/render/sprites/tiles.js):
// - `tone` is a plot's yard, an index into THEMES.farm.dims.yard (pasture, stubble, furrow,
//   farmyard).
// - Ground, trail and road tiles are 16×16 and fully opaque; each variant is its own picture.
// - A fence's `style` indexes THEMES.farm.dims.fence; `mask` which sides carry on (1 N, 2 E,
//   4 S, 8 W). A straight run meets the next tile's edge to edge, so nothing a run draws may
//   differ in shape between its first column and its last. Every pattern below therefore has a
//   period that divides 15 — 3 or 5 — which is the only way column 0 and column 15 agree.
// - `patches(tone)` is [plain, sunny, lush]: the ground's plain colours, and what each becomes
//   where it has dried out and where it grows lush. Only pixels exactly a plain colour change.
// - `farmCover` is pure: the same tile always has the same thing lying on it, or nothing.
import { PALETTE as P } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { mulberry32 } from '../../../sim/rng.js'
import { fbm, lattice } from '../../../sim/noise.js'

const T = 16
const PASTURE = 0
const STUBBLE = 1
const FURROW = 2

const toneOf = (tone) => (tone || 0) % P.farmGround.length
/** A ground's colours: base, shade, light, deepest. All four are its plain colours. */
const groundOf = (tone) => P.farmGround[toneOf(tone)]

/** How many looks each thing lying about has; drawn as `deco.<kind>.<variant>`. */
export const COVER_VARIANTS = { hens: 2, bales: 2, straw: 2, molehills: 2, thistles: 2, windfalls: 2, pails: 1, stones: 2 }
/** The lip drawn where the lane meets anything else: its verge of beaten earth. */
export const ROAD_EDGE = P.farmLaneEdge
/** What the kitchen garden is edged in: the boards that hold its beds up. */
export const BED_EDGE = P.barnTimberDark

// ---------- the ground ----------

/** Seeds per kind of tile, so a path and a ground of the same variant don't share a scatter. */
const SEED = { ground: 51, trail: 52, road: 53 }

function scatter(rand, n, draw) {
  for (let i = 0; i < n; i++) draw(Math.floor(rand() * T), Math.floor(rand() * T))
}

/** A tuft of grass: three blades, the middle one tallest. */
function tuft(pc, x, y, c, dark) {
  pc.px(x, y, dark)
  pc.px(x + 1, y - 1, c)
  pc.px(x + 1, y, dark)
  pc.px(x + 2, y, c)
}

/** A dandelion or a buttercup in the grass, which is what a pasture is dotted with. */
function flowerHead(pc, x, y, i) {
  pc.px(x, y, i % 3 ? P.farmPaint[2] : P.petalWhite)
}

/** The ground itself, before anything is found in it. */
function texture(pc, rand, t) {
  const [base, dark, light, deep] = P.farmGround[t]
  pc.rect(0, 0, T, T, base)
  if (t === PASTURE) {
    // Grazed grass: tufts everywhere, darker where it's thick, and the odd buttercup.
    scatter(rand, 14, (x, y) => tuft(pc, x, y, light, dark))
    scatter(rand, 5, (x, y) => pc.px(x, y, deep))
    scatter(rand, 2, (x, y) => flowerHead(pc, x, y, x + y))
  } else if (t === STUBBLE) {
    // Stubble: the stalks cut short in drilled rows across, on a period of four so the rows run
    // on from tile to tile, each a light stalk top over its shadow.
    for (let y = 1; y < T; y += 4) {
      for (let x = 0; x < T; x++) {
        if ((x + (y >> 2)) % 2) continue
        pc.px(x, y, light)
        pc.px(x, y + 1, dark)
      }
      pc.hline(0, T - 1, y + 2, (y >> 2) % 2 ? base : dark)
    }
    scatter(rand, 6, (x, y) => pc.px(x, y, deep))
    scatter(rand, 4, (x, y) => pc.hline(x, x + 1, y, light))
  } else if (t === FURROW) {
    // Ploughed land: ridges and furrows across on a period of four, the ridge's crest lit and the
    // furrow deep, with clods turned up along the ridges.
    for (let y = 0; y < T; y++) {
      const s = y % 4
      if (s === 0) pc.hline(0, T - 1, y, light)
      else if (s === 2) pc.hline(0, T - 1, y, dark)
      else if (s === 3) pc.hline(0, T - 1, y, deep)
    }
    scatter(rand, 8, (x, y) => {
      const ry = y - (y % 4)
      pc.px(x, ry, deep)
      pc.px(x, ry + 1, light)
    })
  } else {
    // A farmyard: earth beaten hard by boots and hooves, straw trodden into it, and ruts.
    scatter(rand, 16, (x, y) => pc.px(x, y, dark))
    scatter(rand, 10, (x, y) => pc.px(x, y, light))
    scatter(rand, 5, (x, y) => pc.hline(x, x + 1, y, P.hayDark))
    scatter(rand, 3, (x, y) => pc.px(x, y, deep))
  }
}

/** What a rare tile has in it: variants 3, 4 and 5 of each ground. */
function find(pc, rand, t, variant) {
  const [base, dark, light, deep] = P.farmGround[t]
  const x = 4 + Math.floor(rand() * 6)
  const y = 4 + Math.floor(rand() * 6)
  const k = variant - 3
  if (t === PASTURE) {
    if (k === 0) {
      // A cowpat, drying at the edges.
      pc.ellipse(x, y, 3.5, 2, deep)
      pc.ellipse(x - 0.5, y - 0.5, 2.2, 1.2, dark)
      pc.px(x - 1, y - 1, base)
    } else if (k === 1) {
      // A ring of darker grass where a trough once stood.
      pc.ellipse(x, y, 5, 3, dark)
      pc.ellipse(x, y, 3.5, 1.8, base)
      tuft(pc, x - 1, y, light, dark)
    } else {
      // A clump of clover in flower.
      for (const [dx, dy] of [[0, 0], [2, 1], [-2, 1], [1, -2], [-1, 3]]) {
        pc.px(x + dx, y + dy, deep)
        pc.px(x + dx + 1, y + dy, dark)
      }
      pc.px(x, y - 1, P.blossom)
      pc.px(x + 2, y, P.petalWhite)
    }
  } else if (t === STUBBLE) {
    if (k === 0) {
      // Straw the baler missed, lying in a row.
      for (let i = 0; i < 10; i++) pc.px(3 + i, y + (i % 3 === 0 ? 1 : 0), i % 2 ? P.hayLight : P.hay)
      pc.hline(4, 11, y + 2, P.hayDark)
    } else if (k === 1) {
      // A poppy come up in the stubble.
      pc.vline(x, y, y + 3, P.vegLeafDark)
      pc.px(x, y - 1, P.henComb)
      pc.px(x + 1, y - 1, P.apple)
      pc.px(x - 1, y, P.henComb)
    } else {
      // Tyre tracks, two of them, across the tile.
      for (let i = 0; i < T; i++) {
        pc.px(i, y, deep)
        pc.px(i, y + 4, deep)
        if (i % 3 === 0) {
          pc.px(i, y + 1, dark)
          pc.px(i, y + 5, dark)
        }
      }
    }
  } else if (t === FURROW) {
    if (k === 0) {
      // A stone the plough turned up.
      pc.ellipse(x, y, 2.5, 1.8, P.fieldstone)
      pc.px(x - 1, y - 1, P.fieldstoneLight)
      pc.hline(x - 2, x + 2, y + 2, deep)
    } else if (k === 1) {
      // Seedlings coming up along a ridge.
      const ry = y - (y % 4)
      for (let i = 1; i < T; i += 3) {
        pc.px(i, ry, P.vegLeaf)
        pc.px(i + 1, ry - 1, P.vegLeafLight)
      }
    } else {
      // A rook's footprints, walking the furrow.
      for (let i = 0; i < 4; i++) {
        const tx = 2 + i * 3
        const ty = y + (i % 2)
        pc.px(tx, ty, deep)
        pc.px(tx - 1, ty - 1, deep)
        pc.px(tx + 1, ty - 1, deep)
      }
    }
  } else {
    if (k === 0) {
      // A puddle in a rut, with the sky in it.
      pc.ellipse(x, y, 4.5, 2, P.water)
      pc.ellipse(x - 1, y - 0.5, 2.5, 1, P.waterLight)
      pc.hline(x - 4, x + 4, y + 2, deep)
    } else if (k === 1) {
      // Hoofprints across the mud.
      for (let i = 0; i < 4; i++) {
        const hx = 2 + i * 3
        const hy = y + (i % 2) * 3
        pc.hline(hx, hx + 1, hy, deep)
        pc.px(hx, hy + 1, deep)
        pc.px(hx + 1, hy + 1, dark)
      }
    } else {
      // A drift of spilt straw.
      for (let i = 0; i < 7; i++) {
        const sx = 2 + ((i * 5) % 11)
        const sy = 3 + ((i * 7) % 10)
        pc.hline(sx, sx + 2, sy, i % 2 ? P.hay : P.hayLight)
        pc.px(sx + 1, sy + 1, P.hayDark)
      }
    }
  }
}

/**
 * A plot's ground. Variants 0–2 are plain and carry the ground; 3–5 are rare (see TILE_WEIGHTS in
 * the village's tiles) and each holds something the stock or the work has left there.
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
 * The kitchen garden, where the village has its flower bed: dug tilth in rows, a drill drawn
 * along each and a dibbed hole for every spot a crop stands on. The holes are on the village's
 * grid, 8 px apart: variant 0 is the garden's top row, variant 1 every row below it, which
 * carries the grid on from the row above (see the village's `bed` tile). Its soil is its own, not
 * the plot's ground, so a crop reads against it whatever the plot is laid in.
 */
export function drawBed(variant) {
  const pc = new PixelCanvas(T, T)
  pc.rect(0, 0, T, T, P.tilth)
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const s = y % 4
      if (s === 1) pc.px(x, y, (x * 5 + y) % 7 ? P.tilthLight : P.tilth)
      else if (s === 3) pc.px(x, y, P.tilthDark)
    }
  }
  for (const y0 of variant ? [-4, 4] : [4]) {
    for (const x0 of [0, 8]) {
      // The hole the crop goes in, dibbed into the drill, and the soil heaped beside it.
      pc.hline(x0 + 3, x0 + 5, y0 + 6, P.tilthDeep)
      pc.px(x0 + 4, y0 + 5, P.tilthDeep)
      pc.px(x0 + 2, y0 + 5, P.tilthLight)
      pc.px(x0 + 6, y0 + 5, P.tilthLight)
    }
  }
  if (!variant) {
    // The top row is where the garden starts: a line strung along it on two pegs.
    pc.hline(0, T - 1, 1, P.hayLight)
    pc.px(1, 0, P.barnTimber)
    pc.px(14, 0, P.barnTimber)
  }
  return pc
}

// ---------- the path across a plot ----------

/** Where the path runs across its tile: 8 px wide, down the middle, so arms meet their neighbours'. */
const LO = 4
const HI = 11

/**
 * A path trodden across the plot: beaten earth 8 px wide down the middle of the tile, an arm out
 * of each linked side to its edge, a strip of grass down the crown of it where the wheels don't
 * go, and the ground's own edge ragged either side.
 */
export function drawTrail(variant, links, tone) {
  const t = toneOf(tone)
  const g = P.farmGround[t]
  const pc = new PixelCanvas(T, T)
  const rand = mulberry32(variant * 149 + links * 19 + t * 6151 + SEED.trail)
  texture(pc, rand, t)
  const N = links & 1
  const E = links & 2
  const S = links & 4
  const W = links & 8
  const down = N || S
  const across = E || W || !down
  const earth = (x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const n = (x * 7 + y * 13 + variant * 3) % 11
        pc.px(x, y, n === 0 ? P.farmLaneDark : n === 5 ? P.farmLaneLight : P.farmLane)
      }
    }
  }
  const dy0 = N ? 0 : LO
  const dy1 = S ? T - 1 : HI
  const ax0 = W ? 0 : LO
  const ax1 = E ? T - 1 : HI
  if (down) earth(LO, dy0, HI, dy1)
  if (across) earth(ax0, LO, ax1, HI)
  // Ragged edges: the ground's own colour nibbling in along both sides.
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
  // Something on the path, by variant.
  if (variant === 1) pc.hline(6, 8, 9, P.hay)
  else if (variant === 2) {
    pc.px(7, 7, P.fieldstone)
    pc.px(10, 10, P.fieldstoneDark)
  } else if (variant === 3) {
    pc.px(6, 8, P.farmLaneEdge)
    pc.px(7, 9, P.farmLaneEdge)
  }
  return pc
}

// ---------- the lane round a plot ----------

/**
 * The lane round a plot: rolled hoggin, grit and small stones in a pale binding, the stones on a
 * scatter rather than a grid so the lane reads as one surface running on. Variants 0–2 are plain;
 * 3 has a puddle in it, 4 straw blown across it, 5 a drift of fallen leaves.
 */
export function drawRoad(variant) {
  const pc = new PixelCanvas(T, T)
  const rand = mulberry32(variant * 149 + SEED.road * 6151)
  pc.rect(0, 0, T, T, P.farmLane)
  scatter(rand, 22, (x, y) => pc.px(x, y, P.farmLaneDark))
  scatter(rand, 16, (x, y) => pc.px(x, y, P.farmLaneLight))
  // Small stones, lit on top and shadowed under.
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(rand() * 15)
    const y = Math.floor(rand() * 15)
    pc.px(x, y, P.fieldstoneLight)
    pc.px(x, y + 1, P.farmLaneEdge)
    pc.px(x + 1, y, P.fieldstone)
  }
  if (variant === 3) {
    pc.ellipse(8, 8, 5.5, 2.5, P.water)
    pc.ellipse(7, 7.5, 3.5, 1.2, P.waterLight)
    pc.hline(4, 12, 11, P.farmLaneEdge)
  } else if (variant === 4) {
    for (let i = 0; i < 6; i++) {
      const x = Math.floor(rand() * 12)
      const y = Math.floor(rand() * 14)
      pc.hline(x, x + 3, y, i % 2 ? P.hay : P.hayLight)
      pc.px(x + 1, y + 1, P.hayDark)
    }
  } else if (variant === 5) {
    for (let i = 0; i < 6; i++) {
      const x = Math.floor(rand() * 14)
      const y = Math.floor(rand() * 14)
      const c = P.autumn[i % P.autumn.length]
      pc.hline(x, x + 1, y, c)
      pc.px(x, y + 1, P.autumn[1])
    }
  }
  return pc
}

// ---------- fences ----------

/** A timber post down a column, from y0 to y1. */
function post(pc, x, y0, y1, face = P.barnTimber, dark = P.barnTimberDark, light = P.barnTimberLight) {
  pc.vline(x, y0, y1, face)
  pc.vline(x + 1, y0, y1, dark)
  pc.px(x, y0, light)
  pc.px(x + 1, y0, face)
}

/**
 * Each style draws a run across the tile (x from a to b, at the fence's height), a run down it
 * (y from a to b), and the post that stands at a corner or the end of a run.
 */
const FENCE_DRAW = {
  // Post and rail: sawn posts every fifth column with two stout rails nailed across them.
  postrail: {
    across(pc, a, b) {
      for (const y of [6, 10]) {
        pc.hline(a, b, y, P.barnTimberLight)
        pc.hline(a, b, y + 1, P.barnTimber)
        pc.hline(a, b, y + 2, P.barnTimberDark)
      }
      for (let x = a; x <= b; x++) if (x % 5 === 0) post(pc, x, 4, 15)
    },
    down(pc, a, b) {
      pc.vline(6, a, b, P.barnTimberLight)
      pc.vline(7, a, b, P.barnTimber)
      pc.vline(8, a, b, P.barnTimberDark)
      for (let y = a; y <= b; y++) if (y % 5 === 0) pc.hline(5, 9, y, P.barnTimberDark)
    },
    post(pc) {
      pc.rect(6, 3, 4, 13, P.barnTimber)
      pc.vline(6, 3, 15, P.barnTimberLight)
      pc.vline(9, 3, 15, P.barnTimberDark)
      pc.hline(6, 9, 3, P.barnTimberLight)
      return pc
    },
  },
  // Stock wire: thin posts every fifth column and three strands of wire, the top one barbed.
  wire: {
    across(pc, a, b) {
      for (let x = a; x <= b; x++) {
        if (x % 5 === 0) post(pc, x, 5, 15)
        pc.px(x, 6, (x % 3 === 1) ? P.fenceWireDark : P.fenceWire)
        pc.px(x, 9, P.fenceWire)
        pc.px(x, 12, P.fenceWire)
        // A barb every third column on the top strand.
        if (x % 3 === 1) {
          pc.px(x, 5, P.fenceWireDark)
          pc.px(x, 7, P.fenceWireDark)
        }
      }
    },
    down(pc, a, b) {
      pc.vline(7, a, b, P.fenceWire)
      pc.vline(9, a, b, P.fenceWire)
      for (let y = a; y <= b; y++) {
        if (y % 5 === 0) pc.hline(6, 10, y, P.barnTimber)
        if (y % 3 === 1) pc.px(8, y, P.fenceWireDark)
      }
    },
    post(pc) {
      post(pc, 7, 3, 15)
      pc.hline(6, 9, 3, P.barnTimberLight)
      // The strainer's brace, leaning in.
      pc.line(10, 14, 12, 8, P.barnTimberDark)
      return pc
    },
  },
  // Wattle hurdles: hazel woven between stakes, over and under on a period of three.
  wattle: {
    across(pc, a, b) {
      for (let y = 5; y <= 14; y++) {
        for (let x = a; x <= b; x++) {
          const over = ((x + (y >> 1)) % 3 + 3) % 3
          pc.px(x, y, over === 0 ? P.barnTimberDark : (y & 1) ? P.barnTimber : P.barnTimberLight)
        }
      }
      for (let x = a; x <= b; x++) {
        if (x % 5 === 0) {
          pc.vline(x, 3, 15, P.barnTimberDark)
          pc.px(x, 3, P.barnTimberLight)
          pc.px(x, 4, P.barnTimber)
        }
      }
      pc.hline(a, b, 5, P.barnTimberLight)
    },
    down(pc, a, b) {
      for (let y = a; y <= b; y++) {
        for (let x = 5; x <= 10; x++) {
          const over = ((y + (x >> 1)) % 3 + 3) % 3
          pc.px(x, y, over === 0 ? P.barnTimberDark : (x & 1) ? P.barnTimber : P.barnTimberLight)
        }
      }
    },
    post(pc) {
      pc.rect(5, 3, 6, 13, P.barnTimber)
      for (let y = 4; y <= 15; y += 2) pc.hline(5, 10, y, P.barnTimberLight)
      pc.vline(10, 3, 15, P.barnTimberDark)
      pc.vline(7, 1, 15, P.barnTimberDark)
      pc.px(7, 1, P.barnTimberLight)
      return pc
    },
  },
  // Paddock boards: three wide boards painted white, as a stud's are, on square posts.
  paddock: {
    across(pc, a, b) {
      for (const y of [4, 8, 12]) {
        pc.hline(a, b, y, P.whitewash)
        pc.hline(a, b, y + 1, P.whitewashShade)
      }
      for (let x = a; x <= b; x++) {
        if (x % 5) continue
        pc.vline(x, 3, 15, P.whitewash)
        pc.vline(x + 1, 3, 15, P.whitewashShade)
        pc.px(x, 15, P.farmGround[0][3])
      }
    },
    down(pc, a, b) {
      pc.vline(6, a, b, P.whitewash)
      pc.vline(7, a, b, P.whitewashShade)
      pc.vline(9, a, b, P.whitewash)
      pc.vline(10, a, b, P.whitewashShade)
      for (let y = a; y <= b; y++) if (y % 5 === 0) pc.hline(5, 11, y, P.whitewashShade)
    },
    post(pc) {
      pc.rect(6, 2, 4, 14, P.whitewash)
      pc.vline(9, 2, 15, P.whitewashShade)
      pc.hline(5, 10, 2, P.whitewash)
      pc.hline(6, 9, 1, P.whitewashShade)
      for (const y of [4, 8, 12]) pc.hline(6, 9, y + 1, P.whitewashShade)
      return pc
    },
  },
}
const STYLES = ['postrail', 'wire', 'wattle', 'paddock']

/**
 * A plot's fence, one tile of it. A run reaches the edge of the tile on a linked side and stops
 * in the middle otherwise, so it ends in a post at a gap and turns a proper corner.
 */
export function drawFence(style, mask) {
  const pc = new PixelCanvas(T, T)
  const f = FENCE_DRAW[STYLES[style]] || FENCE_DRAW.postrail
  const across = mask & (2 | 8)
  const down = mask & (1 | 4)
  if (across) f.across(pc, mask & 8 ? 0 : 7, mask & 2 ? T - 1 : 8)
  if (down) f.down(pc, mask & 1 ? 0 : 7, mask & 4 ? T - 1 : 8)
  const straight = mask === (2 | 8) || mask === (1 | 4)
  if (!straight) f.post(pc)
  return pc
}

/**
 * What grows at a fence's foot where the mower doesn't reach: long grass, nettles, a dandelion
 * and a stone or two. `mask` as the fence's (1 N, 2 E, 4 S, 8 W). The grass is drawn in the
 * ground's own colours, so the patches tint it along with the ground round it.
 */
export function drawVerge(mask, tone) {
  const pc = new PixelCanvas(T, T)
  const [, dark, light, deep] = groundOf(tone)
  const rand = mulberry32(mask * 883 + toneOf(tone) * 149 + 37)
  const long = (x, y) => {
    pc.vline(x, y - 2, y, P.vegLeafDark)
    pc.px(x + 1, y - 1, P.vegLeaf)
    pc.px(x + 1, y, P.vegLeafDark)
    pc.px(x - 1, y, deep)
  }
  const nettle = (x, y) => {
    pc.vline(x, y - 3, y, P.vegLeafDark)
    pc.px(x - 1, y - 2, P.vegLeaf)
    pc.px(x + 1, y - 1, P.vegLeaf)
  }
  const stone = (x, y) => {
    pc.hline(x, x + 1, y, P.fieldstone)
    pc.px(x, y - 1, P.fieldstoneLight)
    pc.hline(x, x + 1, y + 1, dark)
  }
  const across = mask & (2 | 8)
  const down = mask & (1 | 4)
  if (across) {
    const x0 = mask & 8 ? 0 : 4
    const x1 = mask & 2 ? T - 3 : 10
    long(x0 + 1 + Math.floor(rand() * 2), 15)
    for (let x = x0 + 3; x <= x1; x += 3) {
      const r = rand()
      if (r < 0.4) long(x, 15)
      else if (r < 0.55) nettle(x, 15)
      else if (r < 0.7) stone(x, 14)
      else if (r < 0.8) flowerHead(pc, x, 13, x)
    }
    for (let x = x0; x <= x1; x++) if (rand() < 0.2) pc.px(x, 15, light)
  }
  if (down) {
    const left = !(mask & 8)
    const right = !(mask & 2)
    for (let y = mask & 1 ? 3 : 6; y <= (mask & 4 ? 14 : 10); y += 3) {
      if (left && rand() < 0.5) long(2, y)
      if (right && rand() < 0.5) long(12, y)
    }
    if (right) nettle(13, mask & 4 ? 14 : 10)
    else if (left) nettle(2, mask & 4 ? 14 : 10)
  }
  if (!across && !down) {
    long(3, 15)
    nettle(10, 15)
    stone(7, 14)
  }
  return pc
}

/**
 * The plot's ground spilling over the edge of the lane: grass and earth creeping out onto the
 * grit. Variant `side * 2 + k`, as the village's grass fringe: side 0 top, 1 right, 2 bottom, 3
 * left of the lane's tile, k one of two scatters, and 8 more leaves the mouth of a path open.
 */
export function drawFringe(variant, tone) {
  const pc = new PixelCanvas(T, T)
  const [base, dark, light] = groundOf(tone)
  const mouth = variant >= 8
  const side = (variant & 7) >> 1
  const rand = mulberry32(variant * 661 + toneOf(tone) * 79 + 47)
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

/** A hen on the ground, pecking or looking about. */
function hen(pc, x, y, dir, brown, pecking) {
  const body = brown ? P.henBrown : P.hen
  const dark = brown ? P.cowBlack : P.fleeceShade
  pc.hline(x - 1, x + 1, y - 2, body)
  pc.hline(x - 1, x + 1, y - 1, dark)
  pc.px(x - dir * 2, y - 3, dark)
  pc.px(x - dir * 2, y - 2, body)
  if (pecking) {
    pc.px(x + dir * 2, y - 1, body)
    pc.px(x + dir * 2, y - 2, P.henComb)
    pc.px(x + dir * 3, y, P.henBeak)
  } else {
    pc.px(x + dir * 2, y - 3, body)
    pc.px(x + dir * 2, y - 4, P.henComb)
    pc.px(x + dir * 3, y - 3, P.henBeak)
  }
  pc.px(x, y, P.henBeak)
}

/** Flat things that lie about on a plot: `deco.<kind>.<variant>`, over the ground of `tone`. */
export function drawCover(kind, variant, tone) {
  const pc = new PixelCanvas(T, T)
  const [, dark, light, deep] = groundOf(tone)
  if (kind === 'hens') {
    hen(pc, 6, 13, 1, variant === 1, false)
    hen(pc, 11, 9, -1, variant === 0, true)
    pc.px(3, 14, P.hayLight)
    return dropShadow(pc)
  }
  if (kind === 'bales') {
    const bale = (x, y, w) => {
      pc.rect(x, y - 3, w, 4, P.hay)
      pc.hline(x, x + w - 1, y - 3, P.hayLight)
      pc.hline(x, x + w - 1, y, P.hayDark)
      for (const dx of [2, w - 3]) pc.vline(x + dx, y - 2, y - 1, P.hayDark)
    }
    bale(3, 13, 8)
    if (variant) bale(7, 8, 7)
    pc.px(12, 14, P.hayLight)
    return dropShadow(pc)
  }
  if (kind === 'straw') {
    const n = variant ? 8 : 5
    for (let i = 0; i < n; i++) {
      const x = 1 + ((i * 5) % 12)
      const y = 3 + ((i * 7) % 11)
      pc.hline(x, x + 2, y, i % 2 ? P.hay : P.hayLight)
      pc.px(x + 3, y + 1, P.hayDark)
    }
    return pc
  }
  if (kind === 'molehills') {
    const hill = (x, y, r) => {
      pc.ellipse(x, y, r, r * 0.7, P.farmGround[2][1])
      pc.ellipse(x - 0.5, y - 0.5, r * 0.6, r * 0.4, P.farmGround[2][2])
      pc.hline(x - Math.round(r), x + Math.round(r), y + Math.round(r * 0.7), deep)
    }
    hill(6, 11, 3)
    if (variant) hill(12, 6, 2)
    return pc
  }
  if (kind === 'thistles') {
    const thistle = (x, y) => {
      pc.vline(x, y - 4, y, P.vegLeafDark)
      pc.px(x - 1, y - 2, P.vegLeaf)
      pc.px(x + 1, y - 1, P.vegLeaf)
      pc.hline(x - 1, x + 1, y - 5, P.vegLeafDark)
      pc.px(x, y - 6, P.blossomDark)
      pc.px(x - 1, y - 6, P.blossom)
    }
    thistle(5, 14)
    if (variant) thistle(11, 10)
    pc.px(8, 15, dark)
    return dropShadow(pc)
  }
  if (kind === 'windfalls') {
    const n = variant ? 5 : 3
    for (let i = 0; i < n; i++) {
      const x = 2 + ((i * 5) % 11)
      const y = 5 + ((i * 7) % 9)
      const c = i % 3 === 2 ? P.appleGreen : P.apple
      pc.hline(x, x + 1, y, c)
      pc.hline(x, x + 1, y + 1, i % 3 === 2 ? P.vegLeafDark : P.henComb)
      pc.px(x, y - 1, P.barnTimberDark)
    }
    return dropShadow(pc)
  }
  if (kind === 'stones') {
    const n = variant ? 5 : 3
    for (let i = 0; i < n; i++) {
      const x = 2 + ((i * 6) % 11)
      const y = 5 + ((i * 5) % 9)
      pc.hline(x, x + 2, y, P.fieldstone)
      pc.px(x, y - 1, P.fieldstoneLight)
      pc.px(x + 1, y - 1, P.fieldstoneLight)
      pc.hline(x, x + 2, y + 1, P.fieldstoneDark)
    }
    pc.px(12, 13, light)
    return dropShadow(pc)
  }
  // A tin pail, set down and forgotten, with the milk gone from it.
  pc.rect(5, 8, 6, 6, P.tin)
  pc.vline(5, 8, 13, P.tinLight)
  pc.vline(10, 8, 13, P.tinDark)
  pc.hline(4, 11, 8, P.tinLight)
  pc.hline(5, 10, 11, P.tinDark)
  pc.line(4, 8, 7, 4, P.farmIron)
  pc.line(8, 4, 11, 8, P.farmIron)
  return dropShadow(pc)
}

/**
 * Where things lie: slow noise, a step every few tiles, so they gather in drifts rather than
 * peppering the ground, and only some tiles in a drift, so a drift thins out raggedly. Octaves of
 * value noise bunch round 0.5, so a drift is where it rises into its top third or so.
 */
const DRIFT_SCALE = 1 / 4.5
const LOOSE_DRIFT = 0.62
const LOOSE_FILL = 0.3
const WORK_DRIFT = 0.68
/** How much of a working drift holds anything, by ground: the yard most, the furrows least. */
const WORK_FILL = [0.18, 0.22, 0.14, 0.32]
/** What gathers in a drift, by ground: the flock on the grass, bales on the stubble. */
const WORK = ['hens', 'bales', 'stones', 'hens']
/** And what lies loose everywhere between the drifts. */
const LOOSE = ['molehills', 'straw', 'thistles', 'straw']
/** The odd thing, anywhere, by ground. */
const ODDS = [
  ['windfalls', 'thistles', 'pails', 'stones'],
  ['hens', 'stones', 'straw', 'pails'],
  ['molehills', 'windfalls', 'straw', 'pails'],
  ['bales', 'pails', 'windfalls', 'stones'],
]
const ODD_SHARE = 0.03

/** What lies on the plot ground tile (tx, ty), if anything: `{ kind, variant }`, or null. */
export function farmCover(tx, ty, tone) {
  const t = toneOf(tone)
  const h = lattice(tx, ty, 591)
  const v = lattice(tx, ty, 592)
  const x = tx * DRIFT_SCALE
  const y = ty * DRIFT_SCALE
  if (fbm(x, y, 537) > WORK_DRIFT) {
    const kind = WORK[t]
    if (h < WORK_FILL[t]) return { kind, variant: Math.floor(v * COVER_VARIANTS[kind]) }
  } else if (fbm(x, y, 531) > LOOSE_DRIFT) {
    const kind = LOOSE[t]
    if (h < LOOSE_FILL) return { kind, variant: v < 0.55 ? 0 : 1 }
  }
  if (h > 1 - ODD_SHARE) {
    const list = ODDS[t]
    const kind = list[Math.floor(v * list.length)]
    return { kind, variant: Math.floor(lattice(tx, ty, 593) * COVER_VARIANTS[kind]) }
  }
  return null
}

/** The ground's plain colours, each paired with its dry partner and its lush one. */
export function patches(tone) {
  const t = toneOf(tone)
  return [P.farmGround[t], P.farmGroundSunny[t], P.farmGroundLush[t]]
}
