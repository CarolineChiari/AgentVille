// Día de los Muertos ground, ways and fences: pale cantera flags, earth strewn with marigold
// petals, terracotta tile or the grass of a panteón inside each plot, a beaten-earth lane round
// it, a path of petals across it, and fences of papel picado, a garland of cempasúchil, a low
// adobe wall with candles on it and a cemetery's wrought-iron railing.
//
// Contract (see ThemePack in ../index.js and the village's src/render/sprites/tiles.js):
// - `tone` is a plot's yard, an index into THEMES['dia-de-muertos'].dims.yard.
// - Ground, trail and road tiles are 16×16 and fully opaque; each variant is its own picture.
// - A fence's `style` indexes the theme's dims.fence; `mask` which sides carry on (1 N, 2 E, 4 S,
//   8 W). A straight run meets the next tile's edge to edge, so nothing a run draws may differ in
//   shape between its first column and its last. Every pattern below therefore has a period that
//   divides 15 — 3 or 5 — which is the only way column 0 and column 15 agree.
// - `patches(tone)` is [plain, sunny, lush]: the ground's plain colours, and what each becomes
//   where it has dried out and where it grows lush. Only pixels exactly a plain colour change.
// - `muertosCover` is pure: the same tile always has the same thing lying on it, or nothing.
import { PALETTE as P } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { mulberry32 } from '../../../sim/rng.js'
import { fbm, lattice } from '../../../sim/noise.js'

const T = 16
const PLAZA = 0
const PETALS = 1
const TERRACOTTA = 2

const toneOf = (tone) => (tone || 0) % P.muertosGround.length
/** A ground's colours: base, shade, light, deepest. All four are its plain colours. */
const groundOf = (tone) => P.muertosGround[toneOf(tone)]
/** The petals strewn on everything: cempasúchil orange and gold, and the magenta of cockscomb. */
const FALL = [P.marigold, P.marigoldLight, P.marigoldDeep, P.marigold, P.muertosPaint[0]]
/** The colours papel picado is cut from. */
const PICADO = [P.muertosPaint[0], P.muertosPaint[1], P.muertosPaint[2], P.muertosPaint[3], P.muertosPaint[4]]

/** How many looks each thing lying about has; drawn as `deco.<kind>.<variant>`. */
export const COVER_VARIANTS = { muertospetals: 2, picadoscrap: 2, waxdrip: 2, copal: 2, tendedgrave: 2, marigoldhead: 1 }
/** The lip drawn where the lane meets anything else: its verge of beaten earth. */
export const ROAD_EDGE = P.muertosLaneEdge
/** What the marigold bed is edged in: the dark boards that hold its soil in. */
export const BED_EDGE = P.barnTimberDark

// ---------- the ground ----------

/** Seeds per kind of tile, so a path and a ground of the same variant don't share a scatter. */
const SEED = { ground: 81, trail: 82, road: 83 }

function scatter(rand, n, draw) {
  for (let i = 0; i < n; i++) draw(Math.floor(rand() * T), Math.floor(rand() * T))
}

/** A tuft of grass: three blades. */
function tuft(pc, x, y, c, dark) {
  pc.px(x, y, dark)
  pc.px(x + 1, y - 1, c)
  pc.px(x + 1, y, dark)
  pc.px(x + 2, y, c)
}

/** One fallen petal: two pixels, in whichever colour of the festival. */
function fallen(pc, x, y, i) {
  const c = FALL[i % FALL.length]
  pc.px(x, y, c)
  pc.px(x + 1, y + (i & 1), c)
}

/** The ground itself, before anything is found in it. */
function texture(pc, rand, t) {
  const [base, dark, light, deep] = P.muertosGround[t]
  pc.rect(0, 0, T, T, base)
  if (t === PLAZA) {
    // Cantera flags, big and squarish, staggered by row, each lit along its top and left.
    for (let y = 0; y < T; y++) {
      const row = y >> 3
      for (let x = 0; x < T; x++) {
        const u = (x + row * 5) % 10
        if (y % 8 === 7 || u === 9) pc.px(x, y, deep)
        else if (y % 8 === 0 || u === 0) pc.px(x, y, light)
      }
    }
    scatter(rand, 9, (x, y) => pc.px(x, y, dark))
    scatter(rand, 1, (x, y) => fallen(pc, x, y, x + y))
  } else if (t === PETALS) {
    // Beaten earth strewn thick with petals: the path laid for the dead to find their way home.
    scatter(rand, 14, (x, y) => pc.px(x, y, dark))
    scatter(rand, 8, (x, y) => pc.px(x, y, light))
    scatter(rand, 3, (x, y) => pc.px(x, y, deep))
    scatter(rand, 7, (x, y) => fallen(pc, x, y, x * 3 + y))
  } else if (t === TERRACOTTA) {
    // Terracotta tile in small squares on the diagonal, grouted deep between them.
    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        const u = (x + y) % 8
        const v = (x - y + 64) % 8
        if (u === 0 || v === 0) pc.px(x, y, deep)
        else if (u === 1 || v === 1) pc.px(x, y, light)
      }
    }
    scatter(rand, 8, (x, y) => pc.px(x, y, dark))
    scatter(rand, 2, (x, y) => fallen(pc, x, y, x + y))
  } else {
    // The grass of a panteón, kept short by the families who tend it.
    scatter(rand, 14, (x, y) => tuft(pc, x, y, light, dark))
    scatter(rand, 5, (x, y) => pc.px(x, y, deep))
    scatter(rand, 2, (x, y) => fallen(pc, x, y, x + y))
  }
}

/** What a rare tile has in it: variants 3, 4 and 5 of each ground. */
function find(pc, rand, t, variant) {
  const [base, dark, light] = P.muertosGround[t]
  const x = 4 + Math.floor(rand() * 6)
  const y = 4 + Math.floor(rand() * 6)
  const k = variant - 3
  if (k === 0) {
    // A drift of petals heaped against the wind, the brightest on top.
    pc.ellipse(x, y, 4.5, 2.5, dark)
    for (let i = 0; i < 9; i++) fallen(pc, x - 4 + ((i * 3) % 8), y - 2 + ((i * 5) % 4), i + t)
  } else if (k === 1) {
    // Wax dripped where a candle stood all night.
    pc.ellipse(x, y, 2.5, 1.5, P.candleWaxDark)
    pc.px(x - 1, y, P.candleWax)
    pc.px(x + 2, y + 2, P.candleWax)
  } else {
    // A scrap of papel picado blown off its string.
    pc.rect(x - 2, y, 4, 3, PICADO[(variant + t) % PICADO.length])
    pc.px(x - 1, y + 1, light)
    pc.hline(x - 2, x + 1, y + 3, base)
  }
}

/**
 * A plot's ground. Variants 0–2 are plain and carry the ground; 3–5 are rare (see TILE_WEIGHTS in
 * the village's tiles) and each holds something the night has left there.
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
 * The marigold bed, where the village has its flower bed: dark watered soil in rows, a ring of
 * petals round every spot an offering stands on. The spots are on the village's grid, 8 px apart:
 * variant 0 is the bed's top row, variant 1 every row below it, which carries the grid on from the
 * row above (see the village's `bed` tile). Its soil is its own, not the plot's ground, so a
 * candle reads against it whatever the plot is laid in.
 */
export function drawBed(variant) {
  const pc = new PixelCanvas(T, T)
  pc.rect(0, 0, T, T, P.patchSoilNight)
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const s = y % 4
      if (s === 1) pc.px(x, y, (x * 5 + y) % 7 ? P.patchSoilNightLight : P.patchSoilNight)
      else if (s === 3) pc.px(x, y, P.patchSoilNightDark)
    }
  }
  for (const y0 of variant ? [-4, 4] : [4]) {
    for (const x0 of [0, 8]) {
      pc.hline(x0 + 3, x0 + 5, y0 + 6, P.patchSoilNightDeep)
      pc.px(x0 + 4, y0 + 5, P.patchSoilNightDeep)
      pc.px(x0 + 2, y0 + 5, P.marigoldDeep)
      pc.px(x0 + 6, y0 + 5, P.marigold)
    }
  }
  if (!variant) {
    // The top row is where the bed starts: a cord of papel picado run along it on two pegs.
    pc.hline(0, T - 1, 1, P.muertosIron)
    for (let x = 0; x < T; x++) if (x % 4 !== 3) pc.px(x, 2, PICADO[(x >> 2) % PICADO.length])
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
 * A path across the plot: packed earth 8 px wide down the middle of the tile, petals strewn along
 * it, an arm out of each linked side to its edge, and the ground's own edge ragged either side.
 */
export function drawTrail(variant, links, tone) {
  const t = toneOf(tone)
  const g = P.muertosGround[t]
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
        pc.px(x, y, n === 0 ? P.muertosLaneDark : n === 5 ? P.muertosLaneLight : n === 8 ? P.marigold : P.muertosLane)
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
  if (variant === 1) fallen(pc, 6, 8, 2)
  else if (variant === 2) fallen(pc, 7, 7, 1)
  else if (variant === 3) {
    pc.px(6, 8, P.candleWaxDark)
    pc.px(7, 8, P.candleWax)
  }
  return pc
}

// ---------- the lane round a plot ----------

/**
 * The lane round a plot: beaten earth, grit and small stones, on a scatter rather than a grid so
 * the lane reads as one surface running on. Variants 0–2 are plain; 3 has a puddle in it, 4 a
 * trail of petals across it, 5 wax where a procession's candles dripped.
 */
export function drawRoad(variant) {
  const pc = new PixelCanvas(T, T)
  const rand = mulberry32(variant * 149 + SEED.road * 6151)
  pc.rect(0, 0, T, T, P.muertosLane)
  scatter(rand, 22, (x, y) => pc.px(x, y, P.muertosLaneDark))
  scatter(rand, 16, (x, y) => pc.px(x, y, P.muertosLaneLight))
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(rand() * 15)
    const y = Math.floor(rand() * 15)
    pc.px(x, y, P.canteraLight)
    pc.px(x, y + 1, P.muertosLaneEdge)
    pc.px(x + 1, y, P.cantera)
  }
  if (variant === 3) {
    pc.ellipse(8, 8, 5.5, 2.5, P.water)
    pc.ellipse(7, 7.5, 3.5, 1.2, P.waterLight)
    pc.hline(4, 12, 11, P.muertosLaneEdge)
  } else if (variant === 4) {
    for (let i = 0; i < 9; i++) fallen(pc, 1 + i + Math.floor(rand() * 3), 6 + Math.floor(rand() * 4), i)
  } else if (variant === 5) {
    for (let i = 0; i < 4; i++) {
      const x = 2 + Math.floor(rand() * 11)
      const y = 2 + Math.floor(rand() * 11)
      pc.hline(x, x + 1, y, P.candleWax)
      pc.px(x + 1, y + 1, P.candleWaxDark)
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

/** A bloom of cempasúchil at (x, y), on a garland. */
function bloom(pc, x, y) {
  pc.px(x, y, P.marigold)
  pc.px(x - 1, y + 1, P.marigoldDeep)
  pc.px(x, y + 1, P.marigoldLight)
  pc.px(x + 1, y + 1, P.marigold)
  pc.px(x, y + 2, P.marigoldDeep)
}

/**
 * Each style draws a run across the tile (x from a to b, at the fence's height), a run down it
 * (y from a to b), and the post that stands at a corner or the end of a run.
 */
const FENCE_DRAW = {
  // Papel picado: a cord between posts five columns apart, a cut-paper flag on every column but
  // the post's, each with its hole cut in it.
  picado: {
    across(pc, a, b) {
      for (let x = a; x <= b; x++) {
        if (x % 5 === 0) {
          post(pc, x, 3, 15)
          continue
        }
        pc.px(x, 4, P.muertosIron)
        const c = PICADO[Math.floor(x / 5) % PICADO.length]
        for (let y = 5; y <= 8; y++) pc.px(x, y, c)
        if (x % 5 === 2) pc.px(x, 6, P.white)
        else if (x % 5 === 4) pc.px(x, 9, c)
      }
    },
    down(pc, a, b) {
      pc.vline(7, a, b, P.barnTimber)
      pc.vline(8, a, b, P.barnTimberDark)
      for (let y = a; y <= b; y++) if (y % 5 === 2) pc.hline(9, 10, y, PICADO[Math.floor(y / 5) % PICADO.length])
    },
    post(pc) {
      pc.rect(6, 3, 4, 13, P.barnTimber)
      pc.vline(6, 3, 15, P.barnTimberLight)
      pc.vline(9, 3, 15, P.barnTimberDark)
      pc.hline(5, 10, 2, P.barnTimberLight)
      pc.rect(11, 4, 2, 4, P.muertosPaint[0])
      pc.rect(3, 4, 2, 4, P.muertosPaint[2])
      return pc
    },
  },
  // A garland of cempasúchil sagging between slender posts, five columns apart.
  marigolds: {
    across(pc, a, b) {
      const SAG = [0, 1, 2, 1, 0]
      for (let x = a; x <= b; x++) {
        const y = 5 + SAG[x % 5]
        if (x % 5 === 0) {
          pc.vline(x, 4, 15, P.barnTimber)
          pc.px(x, 3, P.marigoldLight)
          continue
        }
        pc.px(x, y, P.palmGreenDark)
        if (x % 5 === 2) bloom(pc, x, y + 1)
        else pc.px(x, y + 1, x % 5 === 4 ? P.marigoldDeep : P.marigold)
      }
    },
    down(pc, a, b) {
      pc.vline(7, a, b, P.barnTimber)
      pc.vline(8, a, b, P.barnTimberDark)
      for (let y = a; y <= b; y++) {
        if (y % 5 === 2) pc.px(9, y, P.marigold)
        else if (y % 5 === 4) pc.px(6, y, P.marigoldDeep)
      }
    },
    post(pc) {
      pc.vline(7, 3, 15, P.barnTimber)
      pc.vline(8, 3, 15, P.barnTimberDark)
      pc.px(7, 2, P.marigoldLight)
      pc.px(8, 2, P.marigold)
      bloom(pc, 10, 5)
      bloom(pc, 5, 6)
      return pc
    },
  },
  // A low adobe wall with candles along its coping, on a period of five so it meets edge to edge.
  adobe: {
    across(pc, a, b) {
      for (let x = a; x <= b; x++) {
        pc.px(x, 7, P.muertosAdobeLight)
        for (let y = 8; y <= 13; y++) pc.px(x, y, (y === 10 && x % 5 === 2) ? P.muertosAdobeDark : P.muertosAdobe)
        pc.px(x, 14, P.muertosAdobeDark)
        if (x % 5 === 2) {
          pc.vline(x, 5, 6, P.candleWax)
          pc.px(x, 4, P.flameTip)
        }
      }
    },
    down(pc, a, b) {
      for (let y = a; y <= b; y++) {
        pc.px(5, y, P.muertosAdobeLight)
        pc.hline(6, 9, y, P.muertosAdobe)
        pc.px(10, y, P.muertosAdobeDark)
        if (y % 5 === 0) pc.hline(6, 9, y, P.muertosAdobeDark)
      }
    },
    post(pc) {
      pc.rect(5, 5, 6, 10, P.muertosAdobe)
      pc.vline(5, 5, 14, P.muertosAdobeLight)
      pc.vline(10, 5, 14, P.muertosAdobeDark)
      pc.hline(4, 11, 4, P.muertosAdobeLight)
      pc.vline(7, 2, 3, P.candleWax)
      pc.vline(8, 2, 3, P.candleWaxDark)
      pc.px(7, 1, P.flameTip)
      return pc
    },
  },
  // A panteón's wrought-iron railing: bars between two rails, a spear point on every third.
  railing: {
    across(pc, a, b) {
      pc.hline(a, b, 6, P.muertosIronLight)
      pc.hline(a, b, 13, P.muertosIron)
      for (let x = a; x <= b; x++) {
        if (x % 3 !== 0) continue
        pc.vline(x, 5, 15, P.muertosIron)
        pc.px(x, 4, P.muertosIronLight)
      }
    },
    down(pc, a, b) {
      pc.vline(6, a, b, P.muertosIronLight)
      pc.vline(9, a, b, P.muertosIron)
      for (let y = a; y <= b; y++) if (y % 3 === 0) pc.hline(6, 9, y, P.muertosIron)
    },
    post(pc) {
      pc.rect(6, 3, 4, 13, P.headstone)
      pc.vline(6, 3, 15, P.headstoneLight)
      pc.vline(9, 3, 15, P.headstoneDark)
      pc.hline(5, 10, 2, P.headstoneLight)
      pc.px(7, 1, P.flameTip)
      pc.px(8, 1, P.candleWax)
      return pc
    },
  },
}
const STYLES = ['picado', 'marigolds', 'adobe', 'railing']

/**
 * A plot's fence, one tile of it. A run reaches the edge of the tile on a linked side and stops
 * in the middle otherwise, so it ends in a post at a gap and turns a proper corner.
 */
export function drawFence(style, mask) {
  const pc = new PixelCanvas(T, T)
  const f = FENCE_DRAW[STYLES[style]] || FENCE_DRAW.adobe
  const across = mask & (2 | 8)
  const down = mask & (1 | 4)
  if (across) f.across(pc, mask & 8 ? 0 : 7, mask & 2 ? T - 1 : 8)
  if (down) f.down(pc, mask & 1 ? 0 : 7, mask & 4 ? T - 1 : 8)
  const straight = mask === (2 | 8) || mask === (1 | 4)
  if (!straight) f.post(pc)
  return pc
}

/**
 * What lies at a fence's foot where the broom doesn't reach: long grass, a creeper, a fallen
 * petal or two. `mask` as the fence's (1 N, 2 E, 4 S, 8 W). The grass is drawn in the ground's own
 * colours, so the patches tint it along with the ground round it.
 */
export function drawVerge(mask, tone) {
  const pc = new PixelCanvas(T, T)
  const [, dark, light, deep] = groundOf(tone)
  const rand = mulberry32(mask * 883 + toneOf(tone) * 149 + 59)
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
 * The plot's ground spilling over the edge of the lane. Variant `side * 2 + k`, as the village's
 * grass fringe: side 0 top, 1 right, 2 bottom, 3 left of the lane's tile, k one of two scatters,
 * and 8 more leaves the mouth of a path open.
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
  if (kind === 'muertospetals') {
    // Petals scattered in a trail, the way they are laid from the road to the door.
    const n = variant ? 16 : 10
    for (let i = 0; i < n; i++) fallen(pc, 1 + ((i * 5) % 13), 4 + ((i * 7) % 9), i)
    return pc
  }
  if (kind === 'picadoscrap') {
    // Scraps of papel picado blown down off their strings.
    const n = variant ? 3 : 2
    for (let i = 0; i < n; i++) {
      const x = 2 + ((i * 5) % 10)
      const y = 3 + ((i * 7) % 9)
      const c = PICADO[(i + variant * 2) % PICADO.length]
      pc.rect(x, y, 3, 3, c)
      pc.px(x + 1, y + 1, P.white)
    }
    return pc
  }
  if (kind === 'waxdrip') {
    // A candle burned down to its stub, wax pooled round it.
    pc.ellipse(8, 11, 3.5, 1.5, P.candleWaxDark)
    pc.vline(8, variant ? 7 : 9, 10, P.candleWax)
    pc.px(8, variant ? 6 : 8, P.cinder)
    if (variant) pc.px(10, 12, P.candleWax)
    return dropShadow(pc)
  }
  if (kind === 'copal') {
    // A clay censer where copal was burned, a curl of its smoke still over it.
    pc.hline(6, 10, 11, P.diyaClay)
    pc.hline(7, 9, 12, P.diyaClayDark)
    pc.hline(6, 10, 10, P.diyaClayLight)
    pc.px(8, 9, P.ash)
    pc.px(variant ? 9 : 7, 7, P.sugarSkullShade)
    pc.px(8, 5, P.sugarSkullShade)
    return dropShadow(pc)
  }
  if (kind === 'tendedgrave') {
    // A headstone tended for the night: marigolds laid at its foot and a candle beside it.
    pc.rect(5, 4, 6, 8, P.headstone)
    pc.hline(6, 9, 3, P.headstone)
    pc.vline(5, 4, 11, P.headstoneLight)
    pc.vline(10, 4, 11, P.headstoneDark)
    pc.hline(7, 8, 6, P.headstoneDark)
    for (const x of [4, 6, 8, 10]) pc.px(x, 12, x % 4 ? P.marigold : P.marigoldDeep)
    pc.px(5, 13, P.marigoldLight)
    pc.px(9, 13, P.marigold)
    pc.vline(variant ? 12 : 2, 10, 12, P.candleWax)
    pc.px(variant ? 12 : 2, 9, P.flameTip)
    return dropShadow(pc)
  }
  // marigoldhead: a single bloom fallen from a garland, its stem still on it.
  pc.rect(6, 7, 3, 3, P.marigold)
  pc.px(7, 8, P.marigoldLight)
  pc.px(6, 7, P.marigoldDeep)
  pc.line(9, 10, 11, 12, P.palmGreenDark)
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
const WORK_FILL = [0.25, 0.3, 0.22, 0.28]
/** What gathers in a drift, by ground: candle stubs on the flags, petals in the earth, graves in the panteón. */
const WORK = ['waxdrip', 'muertospetals', 'picadoscrap', 'tendedgrave']
/** And what lies loose everywhere between the drifts. */
const LOOSE = ['muertospetals', 'muertospetals', 'muertospetals', 'waxdrip']
/** The odd thing, anywhere, by ground. */
const ODDS = [
  ['marigoldhead', 'copal', 'picadoscrap', 'muertospetals'],
  ['marigoldhead', 'copal', 'waxdrip', 'picadoscrap'],
  ['waxdrip', 'marigoldhead', 'copal', 'muertospetals'],
  ['copal', 'marigoldhead', 'muertospetals', 'waxdrip'],
]
const ODD_SHARE = 0.03

/** What lies on the plot ground tile (tx, ty), if anything: `{ kind, variant }`, or null. */
export function muertosCover(tx, ty, tone) {
  const t = toneOf(tone)
  const h = lattice(tx, ty, 711)
  const v = lattice(tx, ty, 712)
  const x = tx * DRIFT_SCALE
  const y = ty * DRIFT_SCALE
  if (fbm(x, y, 717) > WORK_DRIFT) {
    const kind = WORK[t]
    if (h < WORK_FILL[t]) return { kind, variant: Math.floor(v * COVER_VARIANTS[kind]) }
  } else if (fbm(x, y, 713) > LOOSE_DRIFT) {
    const kind = LOOSE[t]
    if (h < LOOSE_FILL) return { kind, variant: v < 0.55 ? 0 : 1 }
  }
  if (h > 1 - ODD_SHARE) {
    const list = ODDS[t]
    const kind = list[Math.floor(v * list.length)]
    return { kind, variant: Math.floor(lattice(tx, ty, 714) * COVER_VARIANTS[kind]) }
  }
  return null
}

/** The ground's plain colours, each paired with its dry partner and its lush one. */
export function patches(tone) {
  const t = toneOf(tone)
  return [P.muertosGround[t], P.muertosGroundSunny[t], P.muertosGroundLush[t]]
}
