// Independence Day ground, ways and fences: a lawn trodden with confetti, a mown park lawn, lakeside
// shingle or sidewalk slabs inside each plot, a paved street round it, a trodden path across it,
// and fences of flag posts, hay bales, red-white-and-blue bunting and white pickets.
//
// Contract (see ThemePack in ../index.js and the village's src/render/sprites/tiles.js):
// - `tone` is a plot's yard, an index into THEMES['independence-day'].dims.yard (confetti, lawn, shingle,
//   sidewalk).
// - Ground, trail and road tiles are 16×16 and fully opaque; each variant is its own picture.
// - A fence's `style` indexes THEMES['independence-day'].dims.fence; `mask` which sides carry on (1 N,
//   2 E, 4 S, 8 W). A straight run meets the next tile's edge to edge, so nothing a run draws may
//   differ in shape between its first column and its last. Every pattern below therefore has a
//   period that divides 15 — 3 or 5 — which is the only way column 0 and column 15 agree.
// - `patches(tone)` is [plain, sunny, lush]: the ground's plain colours, and what each becomes
//   where it has dried out and where it grows lush. Only pixels exactly a plain colour change.
// - `paradeCover` is pure: the same tile always has the same thing lying on it, or nothing.
import { PALETTE as P } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { mulberry32 } from '../../../sim/rng.js'
import { fbm, lattice } from '../../../sim/noise.js'

const T = 16
const LEAVES = 0
const LAWN = 1
const EARTH = 2

const toneOf = (tone) => (tone || 0) % P.paradeGround.length
/** A ground's colours: base, shade, light, deepest. All four are its plain colours. */
const groundOf = (tone) => P.paradeGround[toneOf(tone)]
/** The colours of the confetti that falls on everything. */
const FALL = [P.flagRed, P.flagBlue, P.flagWhite, P.starGold, P.flagBlueLight]

/** How many looks each thing lying about has; drawn as `deco.<kind>.<variant>`. */
export const COVER_VARIANTS = { confetti: 2, sparkstubs: 2, pennants: 2, melon: 2, hayscatter: 2, streamer: 1 }
/** The lip drawn where the lane meets anything else: its kerb of worn concrete. */
export const ROAD_EDGE = P.paradeLaneEdge
/** What the finished-work bed is edged in: the boards that hold its mulch in. */
export const BED_EDGE = P.barnTimberDark

// ---------- the ground ----------

/** Seeds per kind of tile, so a path and a ground of the same variant don't share a scatter. */
const SEED = { ground: 71, trail: 72, road: 73 }

function scatter(rand, n, draw) {
  for (let i = 0; i < n; i++) draw(Math.floor(rand() * T), Math.floor(rand() * T))
}

/** A tuft of dry grass: three blades. */
function tuft(pc, x, y, c, dark) {
  pc.px(x, y, dark)
  pc.px(x + 1, y - 1, c)
  pc.px(x + 1, y, dark)
  pc.px(x + 2, y, c)
}

/** One bit of confetti: two pixels, in whichever colour. */
function fallen(pc, x, y, i) {
  const c = FALL[i % FALL.length]
  pc.px(x, y, c)
  pc.px(x + 1, y + (i & 1), c)
}

/** The ground itself, before anything is found in it. */
function texture(pc, rand, t) {
  const [base, dark, light, deep] = P.paradeGround[t]
  pc.rect(0, 0, T, T, base)
  if (t === LEAVES) {
    // A lawn trodden by the crowd, confetti lying on top of the grass.
    scatter(rand, 14, (x, y) => pc.px(x, y, dark))
    scatter(rand, 10, (x, y) => pc.px(x, y, light))
    scatter(rand, 4, (x, y) => pc.px(x, y, deep))
    let i = 0
    scatter(rand, 9, (x, y) => fallen(pc, x, y, i++))
  } else if (t === LAWN) {
    // A park lawn mown in broad stripes, a few clover tufts and a bit of confetti.
    for (let y = 0; y < T; y++) if (y % 8 < 4) pc.hline(0, T - 1, y, dark)
    scatter(rand, 9, (x, y) => tuft(pc, x, y, light, dark))
    scatter(rand, 5, (x, y) => pc.px(x, y, deep))
    scatter(rand, 3, (x, y) => fallen(pc, x, y, x + y))
  } else if (t === EARTH) {
    // Lakeside shingle, ridged across on a period of four, with pebbles left among it.
    for (let y = 0; y < T; y++) {
      const s = y % 4
      if (s === 0) pc.hline(0, T - 1, y, light)
      else if (s === 2) pc.hline(0, T - 1, y, dark)
      else if (s === 3) pc.hline(0, T - 1, y, deep)
    }
    scatter(rand, 6, (x, y) => {
      const ry = y - (y % 4)
      pc.px(x, ry, light)
      pc.px(x + 1, ry, base)
      pc.px(x, ry + 1, deep)
    })
    scatter(rand, 3, (x, y) => fallen(pc, x, y, x))
  } else {
    // Sidewalk: poured in slabs, the joints dark and a bit of confetti caught in them.
    for (let y = 0; y < T; y++) {
      const row = y >> 3
      for (let x = 0; x < T; x++) {
        const u = (x + row * 5) % 8
        if (y % 8 === 7 || u === 7) pc.px(x, y, deep)
        else if (y % 8 === 0 || u === 0) pc.px(x, y, light)
      }
    }
    scatter(rand, 12, (x, y) => pc.px(x, y, dark))
    scatter(rand, 3, (x, y) => fallen(pc, x, y, x + y))
  }
}

/** What a rare tile has in it: variants 3, 4 and 5 of each ground. */
function find(pc, rand, t, variant) {
  const [base, dark, light, deep] = P.paradeGround[t]
  const x = 4 + Math.floor(rand() * 6)
  const y = 4 + Math.floor(rand() * 6)
  const k = variant - 3
  if (k === 0) {
    // A drift of confetti heaped against the kerb, the brightest on top.
    pc.ellipse(x, y, 4.5, 2.5, dark)
    for (let i = 0; i < 9; i++) fallen(pc, x - 4 + ((i * 3) % 8), y - 2 + ((i * 5) % 4), i + t)
  } else if (k === 1) {
    // A few spent firecrackers: red paper tubes with a black fuse.
    for (const [dx, dy] of [[0, 0], [3, 1], [-2, 2]]) {
      pc.hline(x + dx, x + dx + 1, y + dy, P.flagRed)
      pc.px(x + dx, y + dy - 1, P.flagRedDark)
      pc.px(x + dx + 1, y + dy - 1, P.outline)
    }
  } else {
    // What the picnic left: a few kernels of popcorn and a scrap of red-striped paper.
    for (let i = 0; i < 6; i++) pc.px(x - 2 + ((i * 3) % 6), y + (i % 3), i % 2 ? P.flagWhite : P.starGold)
    pc.line(x - 3, y + 4, x + 3, y + 3, P.flagRed)
    pc.hline(x - 1, x + 2, y + 5, t === EARTH ? light : base)
  }
}

/**
 * A plot's ground. Variants 0–2 are plain and carry the ground; 3–5 are rare (see TILE_WEIGHTS in
 * the village's tiles) and each holds something the crowd has left there.
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
 * The flag bed, where the village has its flower bed: mulched soil under straw in rows, a
 * hollow dibbed for every spot a flag stands on. The hollows are on the village's grid, 8 px
 * apart: variant 0 is the patch's top row, variant 1 every row below it, which carries the grid on
 * from the row above (see the village's `bed` tile). Its soil is its own, not the plot's ground,
 * so a flag reads against it whatever the plot is laid in.
 */
export function drawBed(variant) {
  const pc = new PixelCanvas(T, T)
  pc.rect(0, 0, T, T, P.lawnSoil)
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const s = y % 4
      if (s === 1) pc.px(x, y, (x * 5 + y) % 7 ? P.lawnSoilLight : P.lawnSoil)
      else if (s === 3) pc.px(x, y, P.lawnSoilDark)
    }
  }
  for (const y0 of variant ? [-4, 4] : [4]) {
    for (const x0 of [0, 8]) {
      pc.hline(x0 + 3, x0 + 5, y0 + 6, P.lawnSoilDeep)
      pc.px(x0 + 4, y0 + 5, P.lawnSoilDeep)
      // Straw pulled round the hollow.
      pc.px(x0 + 2, y0 + 5, P.hayDark)
      pc.px(x0 + 6, y0 + 5, P.hay)
    }
  }
  if (!variant) {
    // The top row is where the patch starts: a line strung along it on two pegs.
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
 * A path trodden across the plot: packed earth 8 px wide down the middle of the tile, an arm out
 * of each linked side to its edge, and the ground's own edge ragged either side.
 */
export function drawTrail(variant, links, tone) {
  const t = toneOf(tone)
  const g = P.paradeGround[t]
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
        pc.px(x, y, n === 0 ? P.paradeLaneDark : n === 5 ? P.paradeLaneLight : P.paradeLane)
      }
    }
  }
  const dy0 = N ? 0 : LO
  const dy1 = S ? T - 1 : HI
  const ax0 = W ? 0 : LO
  const ax1 = E ? T - 1 : HI
  if (down) earth(LO, dy0, HI, dy1)
  if (across) earth(ax0, LO, ax1, HI)
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
  else if (variant === 2) fallen(pc, 7, 7, 1)
  else if (variant === 3) {
    pc.px(6, 8, P.paradeLaneEdge)
    pc.px(7, 9, P.paradeLaneEdge)
  }
  return pc
}

// ---------- the lane round a plot ----------

/**
 * The street round a plot: worn concrete, grit and small stones in a pale binding, the stones on a
 * scatter rather than a grid so the lane reads as one surface running on. Variants 0–2 are plain;
 * 3 has a puddle in it, 4 straw blown across it, 5 a drift of confetti.
 */
export function drawRoad(variant) {
  const pc = new PixelCanvas(T, T)
  const rand = mulberry32(variant * 149 + SEED.road * 6151)
  pc.rect(0, 0, T, T, P.paradeLane)
  scatter(rand, 22, (x, y) => pc.px(x, y, P.paradeLaneDark))
  scatter(rand, 16, (x, y) => pc.px(x, y, P.paradeLaneLight))
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(rand() * 15)
    const y = Math.floor(rand() * 15)
    pc.px(x, y, P.fieldstoneLight)
    pc.px(x, y + 1, P.paradeLaneEdge)
    pc.px(x + 1, y, P.fieldstone)
  }
  if (variant === 3) {
    pc.ellipse(8, 8, 5.5, 2.5, P.water)
    pc.ellipse(7, 7.5, 3.5, 1.2, P.waterLight)
    pc.hline(4, 12, 11, P.paradeLaneEdge)
  } else if (variant === 4) {
    for (let i = 0; i < 6; i++) {
      const x = Math.floor(rand() * 12)
      const y = Math.floor(rand() * 14)
      pc.hline(x, x + 3, y, i % 2 ? P.hay : P.hayLight)
      pc.px(x + 1, y + 1, P.hayDark)
    }
  } else if (variant === 5) {
    for (let i = 0; i < 8; i++) fallen(pc, Math.floor(rand() * 14), Math.floor(rand() * 14), i)
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

/** A small flag on a pole at column x, flying to the right: the top row is y0. */
function flag(pc, x, y0) {
  pc.vline(x, y0, y0 + 5, P.starGold)
  pc.hline(x + 1, x + 3, y0, P.flagRed)
  pc.hline(x + 1, x + 3, y0 + 1, P.flagWhite)
  pc.hline(x + 1, x + 3, y0 + 2, P.flagRed)
  pc.px(x + 1, y0 + 1, P.flagBlue)
}

/**
 * Each style draws a run across the tile (x from a to b, at the fence's height), a run down it
 * (y from a to b), and the post that stands at a corner or the end of a run.
 */
const FENCE_DRAW = {
  // Flag posts: a post every fifth column, a small flag flying from the ones in the middle of the
  // tile, and a rope strung between them.
  flagposts: {
    across(pc, a, b) {
      pc.hline(a, b, 9, P.flagWhite)
      pc.hline(a, b, 10, P.porchWhiteDark)
      for (let x = a; x <= b; x++) {
        if (x % 5 !== 0) continue
        post(pc, x, 5, 15, P.porchWhite, P.porchWhiteDark, P.porchWhiteLight)
        if (x === 5 || x === 10) flag(pc, x, 1) // never within two columns of the tile's edge
      }
    },
    down(pc, a, b) {
      pc.vline(6, a, b, P.porchWhiteLight)
      pc.vline(7, a, b, P.porchWhite)
      pc.vline(9, a, b, P.flagRed)
      pc.vline(10, a, b, P.flagRedDark)
      for (let y = a; y <= b; y++) if (y % 5 === 0) pc.hline(5, 10, y, P.flagBlue)
    },
    post(pc) {
      pc.rect(6, 3, 4, 13, P.porchWhite)
      pc.vline(6, 3, 15, P.porchWhiteLight)
      pc.vline(9, 3, 15, P.porchWhiteDark)
      flag(pc, 10, 0)
      pc.hline(3, 12, 9, P.flagWhite)
      return pc
    },
  },
  // Stacked hay: rows of small bales laid like bricks, on a period of five so they meet edge to edge.
  haystack: {
    across(pc, a, b) {
      for (let row = 0; row < 2; row++) {
        const y = 4 + row * 5
        for (let x = a; x <= b; x++) {
          const u = (x + row * 2) % 5
          pc.px(x, y, P.hayLight)
          pc.px(x, y + 1, P.hay)
          pc.px(x, y + 2, P.hay)
          pc.px(x, y + 3, u === 0 ? P.hayDark : P.hay)
          pc.px(x, y + 4, P.hayDark)
        }
      }
    },
    down(pc, a, b) {
      for (let y = a; y <= b; y++) {
        const u = y % 5
        pc.px(5, y, P.hayLight)
        pc.vline(6, y, y, P.hay)
        pc.px(7, y, P.hay)
        pc.px(8, y, P.hay)
        pc.px(9, y, u === 0 ? P.hayDark : P.hay)
        pc.px(10, y, P.hayDark)
      }
    },
    post(pc) {
      pc.rect(5, 4, 6, 11, P.hay)
      pc.hline(5, 10, 4, P.hayLight)
      pc.hline(5, 10, 14, P.hayDark)
      pc.vline(10, 4, 14, P.hayDark)
      pc.hline(5, 10, 9, P.hayDark)
      return pc
    },
  },
  // Bunting: two rails on stakes with red, white and blue pennants swagged along the top one.
  bunting: {
    across(pc, a, b) {
      for (const y of [7, 11]) {
        pc.hline(a, b, y, P.barnTimberLight)
        pc.hline(a, b, y + 1, P.barnTimber)
        pc.hline(a, b, y + 2, P.barnTimberDark)
      }
      for (let x = a; x <= b; x++) {
        if (x % 5 === 0) {
          pc.vline(x, 4, 15, P.barnTimberDark)
          pc.vline(x + 1, 5, 15, P.barnTimber)
          pc.px(x, 4, P.barnTimberLight)
        }
        // A pennant hanging from the rail every fifth column, in turn red, white and blue.
        const u = x % 5
        const k = Math.floor(x / 5) % 3
        const c = [P.flagRed, P.flagWhite, P.flagBlue][k]
        if (u === 2) { pc.hline(x - 1, x + 1, 6, c); pc.hline(x - 1, x + 1, 5, c); pc.px(x, 4, c) }
        if (u === 2) pc.px(x, 3, c)
      }
    },
    down(pc, a, b) {
      pc.vline(6, a, b, P.barnTimberLight)
      pc.vline(7, a, b, P.barnTimber)
      pc.vline(8, a, b, P.barnTimberDark)
      for (let y = a; y <= b; y++) if (y % 5 === 0) pc.hline(5, 9, y, [P.flagRed, P.flagWhite, P.flagBlue][(y / 5) % 3])
    },
    post(pc) {
      pc.rect(6, 3, 4, 13, P.barnTimber)
      pc.vline(6, 3, 15, P.barnTimberLight)
      pc.vline(9, 3, 15, P.barnTimberDark)
      pc.hline(6, 9, 3, P.barnTimberLight)
      pc.hline(10, 12, 5, P.flagRed)
      pc.hline(10, 12, 6, P.flagBlue)
      pc.px(11, 7, P.flagBlue)
      return pc
    },
  },
  // A white picket fence, with a red-white-and-blue ribbon swag along the top rail.
  picket: {
    across(pc, a, b) {
      pc.hline(a, b, 7, P.paradePaint[4])
      pc.hline(a, b, 8, P.porchWhiteDark)
      pc.hline(a, b, 12, P.paradePaint[4])
      pc.hline(a, b, 13, P.porchWhiteDark)
      for (let x = a; x <= b; x++) {
        const u = x % 5
        if (u === 4) continue
        pc.vline(x, u === 2 ? 4 : 5, 14, u === 0 ? P.porchWhiteDark : P.paradePaint[4])
        if (u === 2) pc.px(x, 4, P.porchWhiteLight)
      }
      // Ribbon along the top rail.
      for (let x = a; x <= b; x++) if (x % 5 === 1) pc.px(x, 6, [P.flagRed, P.flagBlue, P.starGold][(x / 5 | 0) % 3])
    },
    down(pc, a, b) {
      pc.vline(6, a, b, P.paradePaint[4])
      pc.vline(7, a, b, P.porchWhiteDark)
      pc.vline(9, a, b, P.paradePaint[4])
      pc.vline(10, a, b, P.porchWhiteDark)
      for (let y = a; y <= b; y++) if (y % 5 === 0) pc.hline(5, 11, y, P.porchWhiteDark)
    },
    post(pc) {
      pc.rect(6, 2, 4, 14, P.paradePaint[4])
      pc.vline(9, 2, 15, P.porchWhiteDark)
      pc.hline(5, 10, 2, P.paradePaint[4])
      pc.hline(6, 9, 1, P.porchWhiteDark)
      pc.px(7, 4, P.flagRed)
      pc.px(8, 5, P.starGold)
      return pc
    },
  },
}
const STYLES = ['flagposts', 'haystack', 'bunting', 'picket']

/**
 * A plot's fence, one tile of it. A run reaches the edge of the tile on a linked side and stops
 * in the middle otherwise, so it ends in a post at a gap and turns a proper corner.
 */
export function drawFence(style, mask) {
  const pc = new PixelCanvas(T, T)
  const f = FENCE_DRAW[STYLES[style]] || FENCE_DRAW.bunting
  const across = mask & (2 | 8)
  const down = mask & (1 | 4)
  if (across) f.across(pc, mask & 8 ? 0 : 7, mask & 2 ? T - 1 : 8)
  if (down) f.down(pc, mask & 1 ? 0 : 7, mask & 4 ? T - 1 : 8)
  const straight = mask === (2 | 8) || mask === (1 | 4)
  if (!straight) f.post(pc)
  return pc
}

/**
 * What lies at a fence's foot where the mower doesn't reach: dry grass, a clover vine, a bit of
 * confetti. `mask` as the fence's (1 N, 2 E, 4 S, 8 W). The grass is drawn in the ground's own
 * colours, so the patches tint it along with the ground round it.
 */
export function drawVerge(mask, tone) {
  const pc = new PixelCanvas(T, T)
  const [, dark, light, deep] = groundOf(tone)
  const rand = mulberry32(mask * 883 + toneOf(tone) * 149 + 57)
  const long = (x, y) => {
    pc.vline(x, y - 2, y, dark)
    pc.px(x + 1, y - 1, light)
    pc.px(x + 1, y, dark)
    pc.px(x - 1, y, deep)
  }
  const vine = (x, y) => {
    pc.hline(x, x + 2, y, P.bine)
    pc.px(x + 1, y - 1, P.vegLeafDark)
    pc.px(x + 2, y + 1, P.bine)
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
      else if (r < 0.6) vine(x, 14)
      else if (r < 0.8) fallen(pc, x, 13, x)
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
    if (right) vine(12, mask & 4 ? 14 : 10)
    else if (left) vine(2, mask & 4 ? 14 : 10)
  }
  if (!across && !down) {
    long(3, 15)
    vine(9, 14)
    fallen(pc, 6, 13, 2)
  }
  return pc
}

/**
 * The plot's ground spilling over the edge of the lane: leaf litter and earth creeping out onto
 * the packed lane. Variant `side * 2 + k`, as the village's grass fringe: side 0 top, 1 right, 2
 * bottom, 3 left of the lane's tile, k one of two scatters, and 8 more leaves the mouth of a path
 * open.
 */
export function drawFringe(variant, tone) {
  const pc = new PixelCanvas(T, T)
  const [base, dark, light] = groundOf(tone)
  const mouth = variant >= 8
  const side = (variant & 7) >> 1
  const rand = mulberry32(variant * 661 + toneOf(tone) * 79 + 67)
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

/** Flat things that lie about on a plot: `deco.<kind>.<variant>`, over the ground of `tone`. */
export function drawCover(kind, variant, tone) {
  const pc = new PixelCanvas(T, T)
  if (kind === 'confetti') {
    // Confetti scattered thick, the bright bits on top.
    const n = variant ? 16 : 10
    for (let i = 0; i < n; i++) {
      const x = 2 + ((i * 5) % 11)
      const y = 4 + ((i * 7) % 9)
      fallen(pc, x, y, i)
    }
    return pc
  }
  if (kind === 'sparkstubs') {
    // Burnt-out sparklers stuck in the ground, their wire black and a spark of gold at the tip.
    const n = variant ? 5 : 3
    for (let i = 0; i < n; i++) {
      const x = 2 + ((i * 5) % 11)
      const y = 6 + ((i * 7) % 8)
      pc.vline(x, y - 3, y, P.outline)
      pc.px(x, y - 4, P.starGold)
    }
    return dropShadow(pc)
  }
  if (kind === 'pennants') {
    // Bunting that has come down: little triangles of red, white and blue.
    const n = variant ? 6 : 4
    for (let i = 0; i < n; i++) {
      const x = 1 + ((i * 5) % 12)
      const y = 3 + ((i * 7) % 11)
      const c = [P.flagRed, P.flagWhite, P.flagBlue][i % 3]
      pc.hline(x, x + 2, y, c)
      pc.px(x + 1, y + 1, c)
    }
    return pc
  }
  if (kind === 'melon') {
    // A slice of watermelon left on the grass: rind below, red flesh, a few seeds.
    pc.ellipse(8.5, 10, 4.5, 3.4, P.melonRind)
    pc.ellipse(8.5, 9, 3.8, 2.4, P.melonFlesh)
    if (variant) pc.hline(5, 12, 12, P.melonRindLight)
    pc.px(7, 9, P.melonSeed)
    pc.px(10, 8, P.melonSeed)
    pc.px(9, 10, P.melonSeed)
    return dropShadow(pc)
  }
  if (kind === 'hayscatter') {
    const n = variant ? 8 : 5
    for (let i = 0; i < n; i++) {
      const x = 1 + ((i * 5) % 12)
      const y = 3 + ((i * 7) % 11)
      pc.hline(x, x + 2, y, i % 2 ? P.hay : P.hayLight)
      pc.px(x + 3, y + 1, P.hayDark)
    }
    return pc
  }
  // streamer: a curl of ribbon dropped in passing, red and white striped.
  pc.line(4, 12, 11, 5, P.flagRed)
  pc.line(5, 12, 12, 6, P.flagBlue)
  pc.line(5, 11, 11, 4, P.flagWhite)
  pc.px(3, 13, P.flagRedDark)
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
const WORK_FILL = [0.3, 0.2, 0.22, 0.2]
/** What gathers in a drift, by ground: confetti on the trodden lawn, melon on the park lawn, bunting down on the shingle. */
const WORK = ['confetti', 'melon', 'pennants', 'confetti']
/** And what lies loose everywhere between the drifts. */
const LOOSE = ['sparkstubs', 'hayscatter', 'hayscatter', 'sparkstubs']
/** The odd thing, anywhere, by ground. */
const ODDS = [
  ['streamer', 'melon', 'pennants', 'sparkstubs'],
  ['streamer', 'sparkstubs', 'confetti', 'pennants'],
  ['melon', 'streamer', 'confetti', 'sparkstubs'],
  ['confetti', 'streamer', 'melon', 'hayscatter'],
]
const ODD_SHARE = 0.03

/** What lies on the plot ground tile (tx, ty), if anything: `{ kind, variant }`, or null. */
export function paradeCover(tx, ty, tone) {
  const t = toneOf(tone)
  const h = lattice(tx, ty, 691)
  const v = lattice(tx, ty, 692)
  const x = tx * DRIFT_SCALE
  const y = ty * DRIFT_SCALE
  if (fbm(x, y, 637) > WORK_DRIFT) {
    const kind = WORK[t]
    if (h < WORK_FILL[t]) return { kind, variant: Math.floor(v * COVER_VARIANTS[kind]) }
  } else if (fbm(x, y, 631) > LOOSE_DRIFT) {
    const kind = LOOSE[t]
    if (h < LOOSE_FILL) return { kind, variant: v < 0.55 ? 0 : 1 }
  }
  if (h > 1 - ODD_SHARE) {
    const list = ODDS[t]
    const kind = list[Math.floor(v * list.length)]
    return { kind, variant: Math.floor(lattice(tx, ty, 693) * COVER_VARIANTS[kind]) }
  }
  return null
}

/** The ground's plain colours, each paired with its dry partner and its lush one. */
export function patches(tone) {
  const t = toneOf(tone)
  return [P.paradeGround[t], P.paradeGroundSunny[t], P.paradeGroundLush[t]]
}
