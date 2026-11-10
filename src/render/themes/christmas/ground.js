// Christmas ground, ways and fences: deep snow, cobbles under snow, a frosted lawn or a gingerbread
// floor inside each plot, a trodden-slush lane round it, a path across it, and fences of light-hung
// rails, a snowed-over low wall, candy canes and a holly garland.
//
// Contract (see ThemePack in ../index.js and the village's src/render/sprites/tiles.js):
// - `tone` is a plot's yard, an index into THEMES.christmas.dims.yard (snow, market, frost, ginger).
// - Ground, trail and road tiles are 16×16 and fully opaque; each variant is its own picture.
// - A fence's `style` indexes THEMES.christmas.dims.fence; `mask` which sides carry on (1 N,
//   2 E, 4 S, 8 W). A straight run meets the next tile's edge to edge, so nothing a run draws may
//   differ in shape between its first column and its last. Every pattern below therefore has a
//   period that divides 15 — 3 or 5 — which is the only way column 0 and column 15 agree.
// - `patches(tone)` is [plain, sunny, lush]: the ground's plain colours, and what each becomes
//   where it has dried out and where it grows lush. Only pixels exactly a plain colour change.
// - `xmasCover` is pure: the same tile always has the same thing lying on it, or nothing.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { mulberry32 } from '../../../sim/rng.js'
import { fbm, lattice } from '../../../sim/noise.js'

const T = 16
const SNOW = 0
const MARKET = 1
const FROST = 2

const toneOf = (tone) => (tone || 0) % P.xmasGround.length
/** A ground's colours: base, shade, light, deepest. All four are its plain colours. */
const groundOf = (tone) => P.xmasGround[toneOf(tone)]
/** What the season drops on everything: a red bauble's glint, gold tinsel, a sprig of fir, a mint. */
const FALL = [P.xmasHolly, P.xmasTinsel, P.xmasFirLight, P.xmasMint, P.xmasBulbBlue]

/** How many looks each thing lying about has; drawn as `deco.<kind>.<variant>`. */
export const COVER_VARIANTS = { snowheap: 2, strayornament: 2, pinecone: 2, bootprints: 2, ribbonscrap: 2, mintcrumbs: 1 }
/** The lip drawn where the lane meets anything else: its verge of trodden slush. */
export const ROAD_EDGE = P.xmasLaneEdge
/** What the present bed is edged in: the dark boards that hold its felt in. */
export const BED_EDGE = P.xmasLogDark

// ---------- the ground ----------

/** Seeds per kind of tile, so a path and a ground of the same variant don't share a scatter. */
const SEED = { ground: 81, trail: 82, road: 83 }

function scatter(rand, n, draw) {
  for (let i = 0; i < n; i++) draw(Math.floor(rand() * T), Math.floor(rand() * T))
}

/** A tuft of frosted grass: three blades. */
function tuft(pc, x, y, c, dark) {
  pc.px(x, y, dark)
  pc.px(x + 1, y - 1, c)
  pc.px(x + 1, y, dark)
  pc.px(x + 2, y, c)
}

/** One thing dropped on the ground: two pixels, in whichever colour of the season. */
function fallen(pc, x, y, i) {
  const c = FALL[i % FALL.length]
  pc.px(x, y, c)
  pc.px(x + 1, y + (i & 1), c)
}

/** The ground itself, before anything is found in it. */
function texture(pc, rand, t) {
  const [base, dark, light, deep] = P.xmasGround[t]
  pc.rect(0, 0, T, T, base)
  if (t === SNOW) {
    // Deep snow: soft drifts in blue shade, sparkle on the tops, a wind-ripple or two.
    scatter(rand, 14, (x, y) => pc.px(x, y, dark))
    scatter(rand, 14, (x, y) => pc.px(x, y, light))
    scatter(rand, 3, (x, y) => pc.px(x, y, deep))
    for (const y of [4, 11]) {
      const x = Math.floor(rand() * 8)
      pc.hline(x, x + 5, y, light)
      pc.hline(x + 1, x + 6, y + 1, dark)
    }
  } else if (t === MARKET) {
    // Cobbles under a skin of snow: round stones in courses, the snow lying in the joints.
    for (let y = 0; y < T; y++) {
      const row = y >> 2
      for (let x = 0; x < T; x++) {
        const u = (x + row * 2) % 4
        if (y % 4 === 3 || u === 3) pc.px(x, y, dark)
        else if (y % 4 === 0 && u < 2) pc.px(x, y, light)
      }
    }
    scatter(rand, 8, (x, y) => pc.px(x, y, deep))
    scatter(rand, 2, (x, y) => fallen(pc, x, y, x + y))
  } else if (t === FROST) {
    // A frosted lawn: tufts poking through, rime on their tips, a dropped bauble or two.
    scatter(rand, 14, (x, y) => tuft(pc, x, y, light, dark))
    scatter(rand, 5, (x, y) => pc.px(x, y, deep))
    scatter(rand, 4, (x, y) => pc.px(x, y, P.xmasSnow))
    scatter(rand, 2, (x, y) => fallen(pc, x, y, x + y))
  } else {
    // A gingerbread floor: biscuit slabs, a line of white icing piped along every seam.
    for (let y = 0; y < T; y++) {
      const row = y >> 3
      for (let x = 0; x < T; x++) {
        const u = (x + row * 4) % 8
        if (y % 8 === 7 || u === 7) pc.px(x, y, P.xmasIcing)
        else if (y % 8 === 0 || u === 0) pc.px(x, y, light)
        else if (y % 8 === 6 || u === 6) pc.px(x, y, deep)
      }
    }
    scatter(rand, 9, (x, y) => pc.px(x, y, dark))
    scatter(rand, 2, (x, y) => pc.px(x, y, P.xmasIcing))
  }
}

/** What a rare tile has in it: variants 3, 4 and 5 of each ground. */
function find(pc, rand, t, variant) {
  const [base, dark, light] = P.xmasGround[t]
  const x = 4 + Math.floor(rand() * 6)
  const y = 4 + Math.floor(rand() * 6)
  const k = variant - 3
  if (k === 0) {
    // A snowdrift heaped against the wind, the brightest on top.
    pc.ellipse(x, y, 4.5, 2.5, dark)
    pc.ellipse(x - 0.5, y - 1, 3.5, 1.5, P.xmasSnow)
    pc.hline(x - 2, x, y - 2, P.xmasSnow)
  } else if (k === 1) {
    // Boot prints in a line, left and right.
    for (let i = 0; i < 3; i++) {
      pc.rect(x - 3 + i * 3, y + (i & 1) * 2, 2, 2, dark)
      pc.px(x - 3 + i * 3, y + (i & 1) * 2, P.xmasSnowDeep)
    }
  } else {
    // A dropped ornament and the tinsel it trails.
    pc.rect(x, y, 3, 3, P.xmasHolly)
    pc.px(x, y, P.xmasSnow)
    pc.px(x + 1, y - 1, P.xmasTinsel)
    for (let i = 0; i < 6; i++) pc.px(x + 3 + i, y + 2 + (i & 1), i % 2 ? P.xmasTinsel : light)
    pc.hline(x - 1, x + 3, y + 3, base)
  }
}

/**
 * A plot's ground. Variants 0–2 are plain and carry the ground; 3–5 are rare (see TILE_WEIGHTS in
 * the village's tiles) and each holds something the harvest has left there.
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
 * The present bed, where the village has its flower bed: a tree skirt of dark green felt in rows,
 * a gold-ringed spot for every present. The spots are on the village's grid, 8 px apart:
 * variant 0 is the bed's top row, variant 1 every row below it, which carries the grid on from the
 * row above (see the village's `bed` tile). Its felt is its own, not the plot's ground, so a
 * present reads against it whatever the plot is laid in.
 */
export function drawBed(variant) {
  const pc = new PixelCanvas(T, T)
  pc.rect(0, 0, T, T, P.xmasBed)
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const s = y % 4
      if (s === 1) pc.px(x, y, (x * 5 + y) % 7 ? P.xmasBedLight : P.xmasBed)
      else if (s === 3) pc.px(x, y, P.xmasBedDark)
    }
  }
  for (const y0 of variant ? [-4, 4] : [4]) {
    for (const x0 of [0, 8]) {
      pc.hline(x0 + 3, x0 + 5, y0 + 6, P.xmasBedDeep)
      pc.px(x0 + 4, y0 + 5, P.xmasBedDeep)
      // A thread of gold tinsel set round the spot.
      pc.px(x0 + 2, y0 + 5, P.xmasTinsel)
      pc.px(x0 + 6, y0 + 5, P.xmasTinsel)
    }
  }
  if (!variant) {
    // The top row is where the bed starts: a string of lights run along it on two pegs.
    for (let x = 0; x < T; x++) pc.px(x, 1, [P.xmasHolly, P.xmasBulbYellow, P.xmasBulbBlue, P.xmasCandyGreen][(x >> 1) % 4])
    pc.px(1, 0, P.xmasLog)
    pc.px(14, 0, P.xmasLog)
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
  const g = P.xmasGround[t]
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
        pc.px(x, y, n === 0 ? P.xmasLaneDark : n === 5 ? P.xmasLaneLight : P.xmasLane)
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
  if (variant === 1) pc.hline(6, 8, 9, P.xmasSnow)
  else if (variant === 2) fallen(pc, 7, 7, 1)
  else if (variant === 3) {
    pc.px(6, 8, P.xmasLaneEdge)
    pc.px(7, 9, P.xmasLaneEdge)
  }
  return pc
}

// ---------- the lane round a plot ----------

/**
 * The lane round a plot: beaten sand, grit and small stones in a pale binding, the stones on a
 * scatter rather than a grid so the lane reads as one surface running on. Variants 0–2 are plain;
 * 3 has a puddle in it, 4 sugar spilled across it, 5 a drift of fallen petals.
 */
export function drawRoad(variant) {
  const pc = new PixelCanvas(T, T)
  const rand = mulberry32(variant * 149 + SEED.road * 6151)
  pc.rect(0, 0, T, T, P.xmasLane)
  scatter(rand, 22, (x, y) => pc.px(x, y, P.xmasLaneDark))
  scatter(rand, 16, (x, y) => pc.px(x, y, P.xmasLaneLight))
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(rand() * 15)
    const y = Math.floor(rand() * 15)
    pc.px(x, y, P.fieldstoneLight)
    pc.px(x, y + 1, P.xmasLaneEdge)
    pc.px(x + 1, y, P.fieldstone)
  }
  if (variant === 3) {
    pc.ellipse(8, 8, 5.5, 2.5, P.water)
    pc.ellipse(7, 7.5, 3.5, 1.2, P.waterLight)
    pc.hline(4, 12, 11, P.xmasLaneEdge)
  } else if (variant === 4) {
    for (let i = 0; i < 6; i++) {
      const x = Math.floor(rand() * 12)
      const y = Math.floor(rand() * 14)
      pc.hline(x, x + 3, y, i % 2 ? P.xmasSnow : P.xmasLaneLight)
      pc.px(x + 1, y + 1, P.xmasLaneDark)
    }
  } else if (variant === 5) {
    for (let i = 0; i < 8; i++) fallen(pc, Math.floor(rand() * 14), Math.floor(rand() * 14), i)
  }
  return pc
}

// ---------- fences ----------

/** A timber post down a column, from y0 to y1. */
function post(pc, x, y0, y1, face = P.xmasLog, dark = P.xmasLogDark, light = P.xmasLogLight) {
  pc.vline(x, y0, y1, face)
  pc.vline(x + 1, y0, y1, dark)
  pc.px(x, y0, light)
  pc.px(x + 1, y0, face)
}

/** A bulb hung from row y0 at column cx: a cap, then a drop of coloured glass. */
function bulb(pc, cx, y0, c) {
  pc.px(cx, y0, P.xmasLogDark)
  pc.rect(cx, y0 + 1, 2, 2, c)
  pc.px(cx, y0 + 1, P.xmasSnow)
}

/** Snow lying along the top of a run, from column a to b at row y: light above, shade below. */
function snowOn(pc, a, b, y) {
  for (let x = a; x <= b; x++) {
    pc.px(x, y, P.xmasSnow)
    pc.px(x, y + 1, x % 3 === 0 ? P.xmasSnowShade : P.xmasSnow)
  }
}

const BULBS = [P.xmasHolly, P.xmasBulbYellow, P.xmasBulbBlue, P.xmasCandyGreen, P.xmasCandyRed]

/**
 * Each style draws a run across the tile (x from a to b, at the fence's height), a run down it
 * (y from a to b), and the post that stands at a corner or the end of a run.
 */
const FENCE_DRAW = {
  // Light-hung rails: a pine post every fifth column and a rail with snow on it, a string of
  // coloured bulbs sagging under it.
  lights: {
    across(pc, a, b) {
      pc.hline(a, b, 5, P.xmasLogLight)
      pc.hline(a, b, 6, P.xmasLogDark)
      snowOn(pc, a, b, 3)
      const SAG = [0, 1, 2, 1, 0]
      for (let x = a; x <= b; x++) {
        if (x % 5 === 0) post(pc, x, 4, 15)
        else {
          pc.px(x, 7 + SAG[x % 5], P.xmasFirDark)
          if (x % 5 === 2) bulb(pc, x, 8 + SAG[x % 5], BULBS[(x / 5 | 0) % BULBS.length])
        }
      }
    },
    down(pc, a, b) {
      pc.vline(6, a, b, P.xmasLogLight)
      pc.vline(7, a, b, P.xmasLog)
      pc.vline(9, a, b, P.xmasFirDark)
      for (let y = a; y <= b; y++) {
        if (y % 5 === 2) pc.px(10, y, BULBS[(y / 5 | 0) % BULBS.length])
        if (y % 5 === 0) pc.px(8, y, P.xmasSnow)
      }
    },
    post(pc) {
      pc.rect(6, 4, 4, 12, P.xmasLog)
      pc.vline(6, 4, 15, P.xmasLogLight)
      pc.vline(9, 4, 15, P.xmasLogDark)
      pc.hline(5, 10, 3, P.xmasSnow)
      pc.hline(6, 9, 2, P.xmasSnow)
      bulb(pc, 11, 5, P.xmasHolly)
      bulb(pc, 3, 6, P.xmasBulbYellow)
      return pc
    },
  },
  // A low wall of stones with a deep cap of snow on it, on a period of five so it meets edge to edge.
  snowwall: {
    across(pc, a, b) {
      for (let x = a; x <= b; x++) {
        pc.px(x, 5, P.xmasSnow)
        pc.px(x, 6, P.xmasSnow)
        pc.px(x, 7, x % 5 < 2 ? P.xmasSnow : P.xmasSnowShade)
        pc.px(x, 8, P.xmasSnowShade)
        for (let y = 9; y <= 13; y++) {
          const joint = (x + (y >> 2) * 2) % 5 === 4 || y === 11
          pc.px(x, y, joint ? P.xmasStoneDark : (y === 9 ? P.xmasStoneLight : P.xmasStone))
        }
        pc.px(x, 14, P.xmasStoneDark)
      }
    },
    down(pc, a, b) {
      for (let y = a; y <= b; y++) {
        pc.hline(5, 6, y, P.xmasSnow)
        pc.hline(7, 8, y, y % 5 < 2 ? P.xmasSnow : P.xmasSnowShade)
        pc.px(9, y, P.xmasSnowShade)
        pc.px(10, y, P.xmasStoneDark)
        if (y % 5 === 0) pc.hline(5, 10, y, P.xmasStoneDark)
      }
    },
    post(pc) {
      pc.rect(5, 5, 6, 10, P.xmasStone)
      pc.vline(5, 5, 14, P.xmasStoneLight)
      pc.vline(10, 5, 14, P.xmasStoneDark)
      pc.hline(5, 10, 10, P.xmasStoneDark)
      pc.hline(4, 11, 4, P.xmasSnow)
      pc.hline(5, 10, 3, P.xmasSnow)
      pc.hline(6, 9, 2, P.xmasSnow)
      pc.px(7, 1, P.xmasHolly)
      pc.px(8, 1, P.xmasFir)
      return pc
    },
  },
  // Candy canes: red-and-white striped posts, hooked at the top, with a white rail between them.
  candycane: {
    across(pc, a, b) {
      pc.hline(a, b, 8, P.xmasIcing)
      pc.hline(a, b, 9, P.xmasIcingDark)
      for (let x = a; x <= b; x++) {
        if (x % 5 === 0) {
          for (let y = 5; y <= 15; y++) pc.px(x, y, (y >> 1) % 2 ? P.xmasIcing : P.xmasCandyRed)
          pc.px(x + 1, 4, P.xmasCandyRed)
          pc.px(x + 2, 4, P.xmasIcing)
          pc.px(x + 2, 5, P.xmasCandyRed)
          pc.px(x, 4, P.xmasIcing)
        } else if (x % 5 === 3) pc.px(x, 7, P.xmasCandyGreen)
      }
    },
    down(pc, a, b) {
      pc.vline(7, a, b, P.xmasIcing)
      pc.vline(8, a, b, P.xmasIcingDark)
      for (let y = a; y <= b; y++) if (y % 5 === 2) pc.hline(6, 9, y, P.xmasCandyRed)
    },
    post(pc) {
      for (let y = 4; y <= 15; y++) {
        pc.px(7, y, (y >> 1) % 2 ? P.xmasIcing : P.xmasCandyRed)
        pc.px(8, y, (y >> 1) % 2 ? P.xmasIcingDark : P.xmasCandyRed)
      }
      pc.px(7, 3, P.xmasCandyRed)
      pc.px(8, 2, P.xmasIcing)
      pc.px(9, 2, P.xmasCandyRed)
      pc.px(10, 3, P.xmasIcing)
      pc.px(10, 4, P.xmasCandyRed)
      return pc
    },
  },
  // A garland: fir swags looped between slender posts five columns apart, berries and baubles in it.
  holly: {
    across(pc, a, b) {
      const SAG = [0, 1, 2, 1, 0]
      for (let x = a; x <= b; x++) {
        const y = 5 + SAG[x % 5]
        pc.px(x, y, P.xmasFir)
        pc.px(x, y + 1, x % 2 ? P.xmasFirDark : P.xmasFirLight)
        if (x % 5 === 2) {
          pc.px(x, y + 2, P.xmasHolly)
          pc.px(x, y + 3, P.xmasTinsel)
        } else if (x % 5 === 0) {
          pc.vline(x, 4, 15, P.xmasLog)
          pc.px(x, 3, P.xmasSnow)
        } else if (x % 5 === 4) pc.px(x, y + 2, P.xmasHolly)
      }
    },
    down(pc, a, b) {
      pc.vline(7, a, b, P.xmasLog)
      pc.vline(8, a, b, P.xmasLogDark)
      for (let y = a; y <= b; y++) {
        if (y % 5 === 2) pc.px(9, y, P.xmasFirLight)
        else if (y % 5 === 4) pc.px(6, y, P.xmasHolly)
      }
    },
    post(pc) {
      pc.vline(7, 3, 15, P.xmasLog)
      pc.vline(8, 3, 15, P.xmasLogDark)
      pc.px(7, 2, P.xmasSnow)
      pc.px(8, 2, P.xmasSnow)
      pc.hline(9, 11, 5, P.xmasFir)
      pc.hline(4, 6, 6, P.xmasFirDark)
      pc.px(10, 6, P.xmasHolly)
      pc.px(5, 7, P.xmasHolly)
      pc.px(10, 8, P.xmasTinsel)
      return pc
    },
  },
}
const STYLES = ['lights', 'snowwall', 'candycane', 'holly']

/**
 * A plot's fence, one tile of it. A run reaches the edge of the tile on a linked side and stops
 * in the middle otherwise, so it ends in a post at a gap and turns a proper corner.
 */
export function drawFence(style, mask) {
  const pc = new PixelCanvas(T, T)
  const f = FENCE_DRAW[STYLES[style]] || FENCE_DRAW.snowwall
  const across = mask & (2 | 8)
  const down = mask & (1 | 4)
  if (across) f.across(pc, mask & 8 ? 0 : 7, mask & 2 ? T - 1 : 8)
  if (down) f.down(pc, mask & 1 ? 0 : 7, mask & 4 ? T - 1 : 8)
  const straight = mask === (2 | 8) || mask === (1 | 4)
  if (!straight) f.post(pc)
  return pc
}

/**
 * What lies at a fence's foot where the mower doesn't reach: dry grass, a creeper, a fallen
 * petal or two. `mask` as the fence's (1 N, 2 E, 4 S, 8 W). The grass is drawn in the ground's own
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
    pc.hline(x, x + 2, y, P.xmasFir)
    pc.px(x + 1, y - 1, P.xmasFirDark)
    pc.px(x + 2, y + 1, P.xmasFir)
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
 * The plot's ground spilling over the edge of the lane: sand and lawn creeping out onto
 * the beaten lane. Variant `side * 2 + k`, as the village's grass fringe: side 0 top, 1 right, 2
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
  if (kind === 'snowheap') {
    // A heap of shovelled snow, bluer in its shade.
    const w = variant ? 6.5 : 5
    pc.ellipse(8, 10, w, 3.2, P.xmasSnowShade)
    pc.ellipse(7.5, 9, w - 1.5, 2.3, P.xmasSnow)
    pc.px(6, 8, P.white)
    return pc
  }
  if (kind === 'strayornament') {
    // A bauble that rolled off the tree, a gold cap and a glint.
    const c = variant ? P.xmasBulbBlue : P.xmasHolly
    pc.rect(6, 8, 4, 4, c)
    pc.px(6, 8, P.xmasSnow)
    pc.px(9, 11, shade(c, -0.3))
    pc.hline(7, 8, 7, P.xmasTinsel)
    return dropShadow(pc)
  }
  if (kind === 'pinecone') {
    const n = variant ? 3 : 1
    for (let i = 0; i < n; i++) {
      const x = 3 + i * 4
      const y = 8 + ((i * 3) % 4)
      pc.rect(x, y, 3, 4, P.xmasLog)
      pc.px(x, y, P.xmasLogLight)
      pc.px(x + 2, y + 2, P.xmasLogDark)
      pc.px(x + 1, y + 1, P.xmasLogDark)
      pc.px(x + 1, y - 1, P.xmasFirDark)
    }
    return dropShadow(pc)
  }
  if (kind === 'bootprints') {
    // Boot prints crossing the tile, one after the other.
    const n = variant ? 5 : 3
    for (let i = 0; i < n; i++) {
      const x = 1 + i * 3
      const y = 5 + ((i & 1) * 4)
      pc.rect(x, y, 2, 3, P.xmasSnowDeep)
      pc.px(x, y + 3, P.xmasSnowDeep)
    }
    return pc
  }
  if (kind === 'ribbonscrap') {
    // A curl of ribbon left from the wrapping.
    const c = variant ? P.xmasCandyGreen : P.xmasHolly
    pc.hline(3, 7, 8, c)
    pc.px(8, 9, c)
    pc.hline(8, 11, 10, c)
    pc.px(11, 9, shade(c, -0.3))
    pc.px(5, 7, shade(c, 0.3))
    return pc
  }
  // mintcrumbs: broken peppermint, red and white.
  for (let i = 0; i < 6; i++) {
    const x = 1 + ((i * 5) % 12)
    const y = 3 + ((i * 7) % 11)
    pc.hline(x, x + 1, y, i % 2 ? P.xmasCandyRed : P.xmasIcing)
    pc.px(x + 2, y + 1, P.xmasMint)
  }
  return pc
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
/** What gathers in a drift, by ground: shovelled heaps in the snow, boot prints in the market, scraps of ribbon on the lawn. */
const WORK = ['snowheap', 'bootprints', 'pinecone', 'ribbonscrap']
/** And what lies loose everywhere between the drifts. */
const LOOSE = ['bootprints', 'strayornament', 'snowheap', 'mintcrumbs']
/** The odd thing, anywhere, by ground. */
const ODDS = [
  ['strayornament', 'pinecone', 'ribbonscrap', 'mintcrumbs'],
  ['ribbonscrap', 'strayornament', 'pinecone', 'snowheap'],
  ['strayornament', 'bootprints', 'mintcrumbs', 'ribbonscrap'],
  ['mintcrumbs', 'strayornament', 'snowheap', 'pinecone'],
]
const ODD_SHARE = 0.03

/** What lies on the plot ground tile (tx, ty), if anything: `{ kind, variant }`, or null. */
export function xmasCover(tx, ty, tone) {
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
  return [P.xmasGround[t], P.xmasGroundSunny[t], P.xmasGroundLush[t]]
}

