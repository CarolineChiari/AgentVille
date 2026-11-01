// Eid ground, ways and fences: pale sand, a garden lawn, terracotta courtyard pavers or blue mosaic
// inside each plot, a beaten-sand lane round it, a path across it, and fences of lantern posts,
// a tiled low wall, a carved lattice and a garland of stars.
//
// Contract (see ThemePack in ../index.js and the village's src/render/sprites/tiles.js):
// - `tone` is a plot's yard, an index into THEMES.hanukkah.dims.yard (sand, garden, courtyard, mosaic).
// - Ground, trail and road tiles are 16×16 and fully opaque; each variant is its own picture.
// - A fence's `style` indexes THEMES.hanukkah.dims.fence; `mask` which sides carry on (1 N,
//   2 E, 4 S, 8 W). A straight run meets the next tile's edge to edge, so nothing a run draws may
//   differ in shape between its first column and its last. Every pattern below therefore has a
//   period that divides 15 — 3 or 5 — which is the only way column 0 and column 15 agree.
// - `patches(tone)` is [plain, sunny, lush]: the ground's plain colours, and what each becomes
//   where it has dried out and where it grows lush. Only pixels exactly a plain colour change.
// - `hanukkahCover` is pure: the same tile always has the same thing lying on it, or nothing.
import { PALETTE as P } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { mulberry32 } from '../../../sim/rng.js'
import { fbm, lattice } from '../../../sim/noise.js'

const T = 16
const SAND = 0
const GARDEN = 1
const COURTYARD = 2

const toneOf = (tone) => (tone || 0) % P.hkGround.length
/** A ground's colours: base, shade, light, deepest. All four are its plain colours. */
const groundOf = (tone) => P.hkGround[toneOf(tone)]
/** The colours of the petals the festival leaves on everything: rose, gold, white, teal. */
const FALL = [P.hkPaint[3], P.hkBrassLight, P.sugarDust, P.hkPaint[0], P.honey]

/** How many looks each thing lying about has; drawn as `deco.<kind>.<variant>`. */
export const COVER_VARIANTS = { confetti: 2, geltcoins: 2, sugarsnow: 2, burntcandle: 2, tilechips: 2, pinesprig: 1 }
/** The lip drawn where the lane meets anything else: its verge of beaten sand. */
export const ROAD_EDGE = P.hkLaneEdge
/** What the lantern bed is edged in: the dark boards that hold its soil in. */
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

/** One fallen petal: two pixels, in whichever colour of the festival. */
function fallen(pc, x, y, i) {
  const c = FALL[i % FALL.length]
  pc.px(x, y, c)
  pc.px(x + 1, y + (i & 1), c)
}

/** The ground itself, before anything is found in it. */
function texture(pc, rand, t) {
  const [base, dark, light, deep] = P.hkGround[t]
  pc.rect(0, 0, T, T, base)
  if (t === SAND) {
    // Swept sand: fine speckle, with a few wind ripples running across it.
    scatter(rand, 16, (x, y) => pc.px(x, y, dark))
    scatter(rand, 12, (x, y) => pc.px(x, y, light))
    scatter(rand, 3, (x, y) => pc.px(x, y, deep))
    for (const y of [3, 10]) {
      const x = Math.floor(rand() * 8)
      pc.hline(x, x + 5, y, light)
      pc.hline(x + 1, x + 6, y + 1, dark)
    }
  } else if (t === GARDEN) {
    // A garden lawn: tufts everywhere, a petal or two blown across it.
    scatter(rand, 14, (x, y) => tuft(pc, x, y, light, dark))
    scatter(rand, 5, (x, y) => pc.px(x, y, deep))
    scatter(rand, 3, (x, y) => fallen(pc, x, y, x + y))
  } else if (t === COURTYARD) {
    // Terracotta pavers in square courses: each tile lit along the top and left, grouted below.
    for (let y = 0; y < T; y++) {
      const row = y >> 3
      for (let x = 0; x < T; x++) {
        const u = (x + row * 4) % 8
        if (y % 8 === 7 || u === 7) pc.px(x, y, deep)
        else if (y % 8 === 0 || u === 0) pc.px(x, y, light)
      }
    }
    scatter(rand, 10, (x, y) => pc.px(x, y, dark))
    scatter(rand, 2, (x, y) => fallen(pc, x, y, x + y))
  } else {
    // Blue mosaic: small square tiles in a chequer of glaze, the grout deep between them.
    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        if (x % 4 === 3 || y % 4 === 3) pc.px(x, y, deep)
        else if (((x >> 2) + (y >> 2)) % 2) pc.px(x, y, dark)
        else if (x % 4 === 0 && y % 4 === 0) pc.px(x, y, light)
      }
    }
    scatter(rand, 2, (x, y) => fallen(pc, x, y, x + y))
  }
}

/** What a rare tile has in it: variants 3, 4 and 5 of each ground. */
function find(pc, rand, t, variant) {
  const [base, dark, light] = P.hkGround[t]
  const x = 4 + Math.floor(rand() * 6)
  const y = 4 + Math.floor(rand() * 6)
  const k = variant - 3
  if (k === 0) {
    // A drift of petals heaped against the wind, the brightest on top.
    pc.ellipse(x, y, 4.5, 2.5, dark)
    for (let i = 0; i < 9; i++) fallen(pc, x - 4 + ((i * 3) % 8), y - 2 + ((i * 5) % 4), i + t)
  } else if (k === 1) {
    // Date stones, dropped after the feast.
    for (const [dx, dy] of [[0, 0], [3, 1], [-2, 2]]) {
      pc.hline(x + dx, x + dx + 1, y + dy, P.dateBrown)
      pc.px(x + dx, y + dy - 1, P.crustDark)
    }
  } else {
    // Sugar from the sweets, a dusting across the ground.
    for (let i = 0; i < 7; i++) pc.px(x - 3 + ((i * 3) % 7), y + (i % 3), i % 2 ? P.sugarDust : light)
    pc.hline(x - 1, x + 2, y + 5, base)
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
 * The lantern bed, where the village has its flower bed: dark watered soil in rows, a brass socket
 * set for every spot a lantern stands on. The sockets are on the village's grid, 8 px apart:
 * variant 0 is the bed's top row, variant 1 every row below it, which carries the grid on from the
 * row above (see the village's `bed` tile). Its soil is its own, not the plot's ground, so a
 * lantern reads against it whatever the plot is laid in.
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
      // A brass ring set round the socket.
      pc.px(x0 + 2, y0 + 5, P.hkBrassDark)
      pc.px(x0 + 6, y0 + 5, P.hkBrass)
    }
  }
  if (!variant) {
    // The top row is where the bed starts: a string run along it on two pegs.
    pc.hline(0, T - 1, 1, P.hkBrassLight)
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
  const g = P.hkGround[t]
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
        pc.px(x, y, n === 0 ? P.hkLaneDark : n === 5 ? P.hkLaneLight : P.hkLane)
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
  if (variant === 1) pc.hline(6, 8, 9, P.sugarDust)
  else if (variant === 2) fallen(pc, 7, 7, 1)
  else if (variant === 3) {
    pc.px(6, 8, P.hkLaneEdge)
    pc.px(7, 9, P.hkLaneEdge)
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
  pc.rect(0, 0, T, T, P.hkLane)
  scatter(rand, 22, (x, y) => pc.px(x, y, P.hkLaneDark))
  scatter(rand, 16, (x, y) => pc.px(x, y, P.hkLaneLight))
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(rand() * 15)
    const y = Math.floor(rand() * 15)
    pc.px(x, y, P.fieldstoneLight)
    pc.px(x, y + 1, P.hkLaneEdge)
    pc.px(x + 1, y, P.fieldstone)
  }
  if (variant === 3) {
    pc.ellipse(8, 8, 5.5, 2.5, P.water)
    pc.ellipse(7, 7.5, 3.5, 1.2, P.waterLight)
    pc.hline(4, 12, 11, P.hkLaneEdge)
  } else if (variant === 4) {
    for (let i = 0; i < 6; i++) {
      const x = Math.floor(rand() * 12)
      const y = Math.floor(rand() * 14)
      pc.hline(x, x + 3, y, i % 2 ? P.sugarDust : P.hkLaneLight)
      pc.px(x + 1, y + 1, P.hkLaneDark)
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

/** A fanous hung by its cord from row y0 at column cx: brass ends and a candle in coloured glass. */
function hung(pc, cx, y0, glass = P.hkPaint[1]) {
  pc.px(cx, y0, P.hkBrassDark)
  pc.hline(cx - 1, cx + 1, y0 + 1, P.hkBrassLight)
  for (let y = y0 + 2; y <= y0 + 4; y++) {
    pc.px(cx - 1, y, P.hkBrass)
    pc.px(cx, y, y === y0 + 3 ? P.glowCandle : glass)
    pc.px(cx + 1, y, P.hkBrassDark)
  }
  pc.hline(cx - 1, cx + 1, y0 + 5, P.hkBrassDark)
}

/** The glazed band that runs along a low wall, on a period of five. */
const BAND = [P.glazeBlue, P.glazeBlue, P.glazeTeal, P.glazeTeal, P.glazeBlueDark]

/**
 * Each style draws a run across the tile (x from a to b, at the fence's height), a run down it
 * (y from a to b), and the post that stands at a corner or the end of a run.
 */
const FENCE_DRAW = {
  // Lantern posts: a post every fifth column with a fanous hung from a rail, the rail strung
  // between them.
  lanterns: {
    across(pc, a, b) {
      pc.hline(a, b, 4, P.barnTimberLight)
      pc.hline(a, b, 5, P.barnTimberDark)
      for (let x = a; x <= b; x++) {
        if (x % 5 === 0) {
          post(pc, x, 3, 15)
          hung(pc, x >= 10 ? 12 : x + 3, 6, [P.hkPaint[1], P.hkPaint[3], P.hkPaint[0]][(x / 5) % 3 | 0]) // never within two columns of the tile's edge
        }
      }
    },
    down(pc, a, b) {
      pc.vline(6, a, b, P.barnTimberLight)
      pc.vline(7, a, b, P.barnTimber)
      pc.vline(9, a, b, P.hkBrassLight)
      pc.vline(10, a, b, P.hkBrassDark)
      for (let y = a; y <= b; y++) if (y % 5 === 0) pc.hline(7, 9, y, P.hkBrass)
    },
    post(pc) {
      pc.rect(6, 3, 4, 13, P.barnTimber)
      pc.vline(6, 3, 15, P.barnTimberLight)
      pc.vline(9, 3, 15, P.barnTimberDark)
      hung(pc, 11, 3)
      hung(pc, 4, 5, P.hkPaint[3])
      return pc
    },
  },
  // A low whitewashed wall banded in glazed tile, on a period of five so it meets edge to edge.
  lowwall: {
    across(pc, a, b) {
      for (let x = a; x <= b; x++) {
        pc.px(x, 6, P.hkWhitewashLight)
        pc.px(x, 7, P.hkWhitewash)
        pc.px(x, 8, P.hkWhitewashDark)
        pc.px(x, 9, BAND[x % 5])
        pc.px(x, 10, BAND[x % 5])
        for (let y = 11; y <= 13; y++) pc.px(x, y, P.hkWhitewash)
        pc.px(x, 14, P.hkWhitewashDark)
      }
    },
    down(pc, a, b) {
      for (let y = a; y <= b; y++) {
        pc.px(5, y, P.hkWhitewashLight)
        pc.hline(6, 8, y, P.hkWhitewash)
        pc.hline(9, 10, y, P.hkWhitewashDark)
        if (y % 5 === 0) pc.hline(5, 10, y, P.glazeBlue)
      }
    },
    post(pc) {
      pc.rect(5, 4, 6, 11, P.hkWhitewash)
      pc.vline(5, 4, 14, P.hkWhitewashLight)
      pc.vline(10, 4, 14, P.hkWhitewashDark)
      pc.hline(5, 10, 9, P.glazeBlue)
      pc.hline(5, 10, 10, P.glazeTeal)
      pc.hline(4, 11, 3, P.hkWhitewashLight)
      pc.hline(6, 9, 2, P.glazeBlue)
      pc.px(7, 1, P.hkBrassLight)
      pc.px(8, 1, P.hkBrass)
      return pc
    },
  },
  // A carved lattice screen: a diamond mesh between two rails, on a period of five.
  lattice: {
    across(pc, a, b) {
      pc.hline(a, b, 5, P.barnTimberLight)
      pc.hline(a, b, 14, P.barnTimberDark)
      for (let x = a; x <= b; x++) {
        for (let y = 6; y <= 13; y++) {
          if ((x + y) % 5 === 0) pc.px(x, y, P.barnTimberLight)
          else if ((x - y + 20) % 5 === 0) pc.px(x, y, P.barnTimber)
        }
      }
    },
    down(pc, a, b) {
      pc.vline(5, a, b, P.barnTimberLight)
      pc.vline(10, a, b, P.barnTimberDark)
      for (let y = a; y <= b; y++) {
        if (y % 5 === 0) pc.hline(5, 10, y, P.barnTimber)
        pc.px(7, y, (y % 5 === 2) ? P.barnTimberLight : P.barnTimber)
      }
    },
    post(pc) {
      pc.rect(6, 3, 4, 13, P.barnTimber)
      pc.vline(6, 3, 15, P.barnTimberLight)
      pc.vline(9, 3, 15, P.barnTimberDark)
      pc.hline(5, 10, 3, P.barnTimberLight)
      pc.px(7, 2, P.hkBrassLight)
      pc.px(8, 2, P.hkBrass)
      return pc
    },
  },
  // A bunting: a string of stars and pennants sagging between slender posts, five columns apart.
  garland: {
    across(pc, a, b) {
      const SAG = [0, 1, 2, 1, 0]
      for (let x = a; x <= b; x++) {
        const y = 5 + SAG[x % 5]
        pc.px(x, y, P.hkBrassDark)
        if (x % 5 === 2) {
          // A little star of David hung from the string: a plus and a pair of points.
          pc.px(x, y + 1, P.hkBrassLight)
          pc.hline(x - 1, x + 1, y + 2, P.white)
          pc.px(x, y + 3, P.hkBrassLight)
        } else if (x % 5 === 0) {
          pc.vline(x, 4, 15, P.barnTimber)
          pc.px(x, 3, P.hkBrassLight)
        } else {
          pc.px(x, y + 1, [P.hkPaint[1], P.hkPaint[3], P.hkPaint[0]][(x >> 1) % 3])
        }
      }
    },
    down(pc, a, b) {
      pc.vline(7, a, b, P.barnTimber)
      pc.vline(8, a, b, P.barnTimberDark)
      for (let y = a; y <= b; y++) {
        if (y % 5 === 2) pc.px(9, y, P.hkPaint[1])
        else if (y % 5 === 4) pc.px(6, y, P.hkPaint[3])
      }
    },
    post(pc) {
      pc.vline(7, 3, 15, P.barnTimber)
      pc.vline(8, 3, 15, P.barnTimberDark)
      pc.px(7, 2, P.hkBrassLight)
      pc.px(8, 2, P.hkBrass)
      pc.px(10, 5, P.hkBrassLight)
      pc.px(9, 6, P.hkBrassLight)
      pc.px(10, 7, P.hkBrassLight)
      pc.px(5, 6, P.hkPaint[1])
      pc.px(4, 8, P.hkPaint[3])
      return pc
    },
  },
}
const STYLES = ['lanterns', 'lowwall', 'lattice', 'garland']

/**
 * A plot's fence, one tile of it. A run reaches the edge of the tile on a linked side and stops
 * in the middle otherwise, so it ends in a post at a gap and turns a proper corner.
 */
export function drawFence(style, mask) {
  const pc = new PixelCanvas(T, T)
  const f = FENCE_DRAW[STYLES[style]] || FENCE_DRAW.lattice
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
  if (kind === 'confetti') {
    // Petals blown into a heap, the bright ones on top.
    const n = variant ? 16 : 10
    for (let i = 0; i < n; i++) {
      const x = 2 + ((i * 5) % 11)
      const y = 4 + ((i * 7) % 9)
      fallen(pc, x, y, i)
    }
    return pc
  }
  if (kind === 'geltcoins') {
    const n = variant ? 5 : 3
    for (let i = 0; i < n; i++) {
      const x = 2 + ((i * 5) % 11)
      const y = 5 + ((i * 7) % 9)
      pc.hline(x, x + 1, y, P.dateBrown)
      pc.px(x, y - 1, P.crustDark)
    }
    return dropShadow(pc)
  }
  if (kind === 'sugarsnow') {
    const n = variant ? 8 : 5
    for (let i = 0; i < n; i++) {
      const x = 1 + ((i * 5) % 12)
      const y = 3 + ((i * 7) % 11)
      pc.hline(x, x + 1, y, P.sugarDust)
      pc.px(x + 2, y + 1, P.honey)
    }
    return pc
  }
  if (kind === 'burntcandle') {
    // A little paper lantern left standing where the children put it down.
    const c = variant ? P.hkPaint[0] : P.hkPaint[3]
    pc.rect(6, 7, 5, 5, c)
    pc.vline(6, 8, 11, P.hkPaint[4])
    pc.vline(10, 8, 11, P.hkPaint[5])
    pc.hline(6, 10, 6, P.hkBrassLight)
    pc.hline(6, 10, 12, P.hkBrassDark)
    pc.px(8, 5, P.hkBrassDark)
    return dropShadow(pc)
  }
  if (kind === 'tilechips') {
    const n = variant ? 8 : 5
    for (let i = 0; i < n; i++) {
      const x = 1 + ((i * 5) % 12)
      const y = 3 + ((i * 7) % 11)
      pc.hline(x, x + 1, y, i % 2 ? P.glazeBlue : P.glazeTeal)
      pc.px(x + 2, y + 1, P.glazeWhite)
    }
    return pc
  }
  // pinesprig: a frond dropped in passing, its leaflets down both sides of the rib.
  pc.line(4, 12, 11, 5, P.palmGreenDark)
  pc.line(5, 12, 12, 6, P.palmGreen)
  pc.line(5, 11, 11, 4, P.palmGreen)
  pc.px(3, 13, P.palmGreenDark)
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
/** What gathers in a drift, by ground: lanterns on the sand, petals on the lawn, tile chips in the courtyard. */
const WORK = ['burntcandle', 'confetti', 'tilechips', 'burntcandle']
/** And what lies loose everywhere between the drifts. */
const LOOSE = ['sugarsnow', 'confetti', 'sugarsnow', 'geltcoins']
/** The odd thing, anywhere, by ground. */
const ODDS = [
  ['pinesprig', 'geltcoins', 'tilechips', 'sugarsnow'],
  ['pinesprig', 'geltcoins', 'burntcandle', 'tilechips'],
  ['burntcandle', 'pinesprig', 'confetti', 'geltcoins'],
  ['confetti', 'pinesprig', 'geltcoins', 'sugarsnow'],
]
const ODD_SHARE = 0.03

/** What lies on the plot ground tile (tx, ty), if anything: `{ kind, variant }`, or null. */
export function hanukkahCover(tx, ty, tone) {
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
  return [P.hkGround[t], P.hkGroundSunny[t], P.hkGroundLush[t]]
}
