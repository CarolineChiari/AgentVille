// Holi ground, ways and fences: powder-dusted stone, petal-strewn earth, terracotta flags or the
// swept ash of the bonfire square inside each plot, a pale lane round it splashed with colour, a
// trodden path across it, and fences of splashed whitewash, marigold garlands, bamboo and logs.
//
// Contract (see ThemePack in ../index.js and the village's src/render/sprites/tiles.js):
// - `tone` is a plot's yard, an index into THEMES.holi.dims.yard (powder, petals, courtyard,
//   ashfloor).
// - Ground, trail and road tiles are 16×16 and fully opaque; each variant is its own picture.
// - A fence's `style` indexes THEMES.holi.dims.fence; `mask` which sides carry on (1 N, 2 E, 4 S,
//   8 W). A straight run meets the next tile's edge to edge, so nothing a run draws may differ in
//   shape between its first column and its last. Every pattern below therefore has a period that
//   divides 15 (3 or 5), the only way column 0 and column 15 agree.
// - `patches(tone)` is [plain, sunny, lush]: the ground's plain colours, and what each becomes
//   where it has dried out and where it grows lush. Only pixels exactly a plain colour change.
// - `holiCover` is pure: the same tile always has the same thing lying on it, or nothing.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { mulberry32 } from '../../../sim/rng.js'
import { fbm, lattice } from '../../../sim/noise.js'

const T = 16
const POWDER = 0
const PETALS = 1
const COURTYARD = 2

const toneOf = (tone) => (tone || 0) % P.holiGround.length
/** A ground's colours: base, shade, light, deepest. All four are its plain colours. */
const groundOf = (tone) => P.holiGround[toneOf(tone)]
/** The colours thrown about: pink, green, yellow, blue, orange, violet. */
const GULAL = P.holiGulal
/** The petals that fall on everything: marigold, rose, pink and a paler marigold. */
const PETAL = [P.marigold, P.roseRed, P.holiGulal[0], P.marigoldLight]

/** How many looks each thing lying about has; drawn as `deco.<kind>.<variant>`. */
export const COVER_VARIANTS = { splashmark: 3, petaldrift: 2, ashpatch: 2, lonepot: 2, powderheap: 2 }
/** The lip drawn where the lane meets anything else: its verge of dusty earth. */
export const ROAD_EDGE = P.holiLaneEdge
/** What the petal field is edged in: the clay of the pots. */
export const BED_EDGE = P.matkaDark

// ---------- the ground ----------

/** Seeds per kind of tile, so a path and a ground of the same variant don't share a scatter. */
const SEED = { ground: 81, trail: 82, road: 83 }

function scatter(rand, n, draw) {
  for (let i = 0; i < n; i++) draw(Math.floor(rand() * T), Math.floor(rand() * T))
}

/** One fallen petal: two pixels, in whichever colour of the fall. */
function petal(pc, x, y, i) {
  const c = PETAL[i % PETAL.length]
  pc.px(x, y, c)
  pc.px(x + 1, y + (i & 1), shade(c, -0.12))
}

/** A fleck of coloured powder: a single pixel, a little pale, as it settles. */
function fleck(pc, x, y, i) {
  pc.px(x, y, shade(GULAL[i % GULAL.length], 0.15))
}

/** The ground itself, before anything is found in it. */
function texture(pc, rand, t) {
  const [base, dark, light, deep] = P.holiGround[t]
  pc.rect(0, 0, T, T, base)
  if (t === POWDER) {
    // Pale stone, dusted: speckle, and flecks of every colour settled in it.
    scatter(rand, 16, (x, y) => pc.px(x, y, dark))
    scatter(rand, 10, (x, y) => pc.px(x, y, light))
    scatter(rand, 3, (x, y) => pc.px(x, y, deep))
    let i = 0
    scatter(rand, 10, (x, y) => fleck(pc, x, y, i++))
  } else if (t === PETALS) {
    // Raked earth under a scatter of marigold and rose petals.
    scatter(rand, 14, (x, y) => pc.px(x, y, dark))
    scatter(rand, 8, (x, y) => pc.px(x, y, light))
    scatter(rand, 3, (x, y) => pc.px(x, y, deep))
    let i = 0
    scatter(rand, 11, (x, y) => petal(pc, x, y, i++))
  } else if (t === COURTYARD) {
    // Terracotta flags laid in courses, the joints dark, with a fleck of colour in a few.
    for (let y = 0; y < T; y++) {
      const row = y >> 3
      for (let x = 0; x < T; x++) {
        const u = (x + row * 5) % 8
        if (y % 8 === 7 || u === 7) pc.px(x, y, deep)
        else if (y % 8 === 0 || u === 0) pc.px(x, y, light)
      }
    }
    scatter(rand, 10, (x, y) => pc.px(x, y, dark))
    let i = 0
    scatter(rand, 4, (x, y) => fleck(pc, x, y, i++))
  } else {
    // Swept ash: broom strokes curving across it, a cinder or two, no colour at all.
    for (let y = 0; y < T; y++) {
      const s = y % 4
      if (s === 0) pc.hline(0, T - 1, y, light)
      else if (s === 2) pc.hline(0, T - 1, y, dark)
    }
    scatter(rand, 8, (x, y) => pc.px(x, y, deep))
    scatter(rand, 3, (x, y) => pc.px(x, y, P.ember))
    scatter(rand, 5, (x, y) => pc.px(x, y, P.ash))
  }
}

/** What a rare tile has in it: variants 3, 4 and 5 of each ground. */
function find(pc, rand, t, variant) {
  const x = 4 + Math.floor(rand() * 6)
  const y = 4 + Math.floor(rand() * 6)
  const k = variant - 3
  if (k === 0) {
    // A splash of colour thrown at the ground: a blot with drops flung off it.
    const c = GULAL[(t * 2 + 1) % GULAL.length]
    pc.ellipse(x, y, 3.5, 2.5, c)
    pc.ellipse(x - 1, y - 1, 1.5, 1, shade(c, 0.3))
    for (const [dx, dy] of [[-5, 1], [5, -1], [4, 3], [-3, -3]]) pc.px(x + dx, y + dy, c)
  } else if (k === 1) {
    // A handprint pressed into the dust: a palm and four fingers.
    const c = GULAL[(t + 3) % GULAL.length]
    pc.rect(x, y + 1, 3, 3, c)
    for (const dx of [0, 1, 2]) pc.vline(x + dx, y - 1, y, dx === 1 ? shade(c, 0.1) : c)
    pc.px(x - 1, y + 2, c)
    pc.px(x - 1, y + 1, shade(c, -0.2))
  } else {
    // A few petals heaped where they fell from a garland.
    for (let i = 0; i < 7; i++) petal(pc, x - 3 + ((i * 3) % 7), y - 1 + ((i * 5) % 4), i + t)
  }
}

/**
 * A plot's ground. Variants 0–2 are plain and carry the ground; 3–5 are rare (see TILE_WEIGHTS in
 * the village's tiles) and each holds something the festival has left there.
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
 * The petal field, where the village has its flower bed: dark soil under a scatter of petals, a
 * clay ring set in it for every spot a pot stands on. The rings are on the village's grid, 8 px
 * apart: variant 0 is the field's top row, variant 1 every row below it, which carries the grid on
 * from the row above (see the village's `bed` tile). Its soil is its own, not the plot's ground,
 * so a pot reads against it whatever the plot is laid in.
 */
export function drawBed(variant) {
  const pc = new PixelCanvas(T, T)
  pc.rect(0, 0, T, T, P.holiBed)
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const s = y % 4
      if (s === 1) pc.px(x, y, (x * 5 + y) % 7 ? P.holiBedLight : P.holiBed)
      else if (s === 3) pc.px(x, y, P.holiBedDark)
    }
  }
  for (const y0 of variant ? [-4, 4] : [4]) {
    for (const x0 of [0, 8]) {
      pc.hline(x0 + 3, x0 + 5, y0 + 6, P.holiBedDeep)
      pc.px(x0 + 4, y0 + 5, P.holiBedDeep)
      // Petals pulled round the ring.
      pc.px(x0 + 2, y0 + 5, P.marigold)
      pc.px(x0 + 6, y0 + 5, P.roseRed)
    }
  }
  if (!variant) {
    // The top row is where the field starts: a line of marigold heads strung along it.
    for (let x = 0; x < T; x += 2) pc.px(x, 1, x % 4 ? P.marigold : P.marigoldLight)
    pc.px(1, 0, P.matkaDark)
    pc.px(14, 0, P.matkaDark)
  }
  return pc
}

// ---------- the path across a plot ----------

/** Where the path runs across its tile: 8 px wide, down the middle, so arms meet their neighbours'. */
const LO = 4
const HI = 11

/**
 * A path trodden across the plot: lime-dusted earth 8 px wide down the middle of the tile, an arm
 * out of each linked side to its edge, and the ground's own edge ragged either side.
 */
export function drawTrail(variant, links, tone) {
  const t = toneOf(tone)
  const g = P.holiGround[t]
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
        pc.px(x, y, n === 0 ? P.holiLaneDark : n === 5 ? P.holiLaneLight : P.holiLane)
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
  if (variant === 1) pc.hline(6, 8, 9, P.marigold)
  else if (variant === 2) petal(pc, 7, 7, 1)
  else if (variant === 3) {
    pc.px(6, 8, P.holiLaneEdge)
    pc.px(7, 9, P.holiLaneEdge)
  }
  return pc
}

// ---------- the lane round a plot ----------

/**
 * The lane round a plot: pale lime-dusted earth with grit in it and colour thrown across it, on a
 * scatter rather than a grid so the lane reads as one surface running on. Variants 0–2 are plain
 * (each with its own few splashes); 3 has a puddle of coloured water in it, 4 a sweep of green
 * powder, 5 a scatter of petals.
 */
export function drawRoad(variant) {
  const pc = new PixelCanvas(T, T)
  const rand = mulberry32(variant * 149 + SEED.road * 6151)
  pc.rect(0, 0, T, T, P.holiLane)
  scatter(rand, 20, (x, y) => pc.px(x, y, P.holiLaneDark))
  scatter(rand, 16, (x, y) => pc.px(x, y, P.holiLaneLight))
  // The colour thrown on it, a different few each variant.
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(rand() * 14)
    const y = Math.floor(rand() * 14)
    const c = GULAL[(variant * 2 + i) % GULAL.length]
    pc.px(x, y, c)
    pc.px(x + 1, y, shade(c, 0.2))
    if (i % 2) pc.px(x, y + 1, shade(c, -0.15))
  }
  if (variant === 3) {
    pc.ellipse(8, 8, 5.5, 2.5, GULAL[0])
    pc.ellipse(7, 7.5, 3.5, 1.2, shade(GULAL[0], 0.35))
    pc.hline(4, 12, 11, P.holiLaneEdge)
  } else if (variant === 4) {
    for (let i = 0; i < 6; i++) {
      const x = Math.floor(rand() * 12)
      const y = Math.floor(rand() * 14)
      pc.hline(x, x + 3, y, i % 2 ? GULAL[1] : shade(GULAL[1], 0.2))
      pc.px(x + 1, y + 1, shade(GULAL[1], -0.2))
    }
  } else if (variant === 5) {
    for (let i = 0; i < 8; i++) petal(pc, Math.floor(rand() * 14), Math.floor(rand() * 14), i)
  }
  return pc
}

// ---------- fences ----------

/** A bamboo post down a column, from y0 to y1. */
function post(pc, x, y0, y1) {
  pc.vline(x, y0, y1, P.bambooLight)
  pc.vline(x + 1, y0, y1, P.bamboo)
  pc.px(x, y0, P.bambooLight)
  pc.px(x + 1, y0, P.bambooDark)
  for (let y = y0 + 3; y < y1; y += 5) {
    pc.px(x, y, P.bambooDark)
    pc.px(x + 1, y, P.bambooDark)
  }
}

/** A log end: five wide and five high, rings in it. Column u of the pattern at x, row v at y. */
const LOG_END = [
  '.ooo.',
  'ooLoo',
  'oLdLo',
  'ooLoo',
  '.ooo.',
]
const logPx = (pc, x, y, u, v) => {
  const ch = LOG_END[v][u]
  if (ch === '.') return
  pc.px(x, y, ch === 'o' ? P.barnTimber : ch === 'L' ? P.barnTimberLight : P.barnTimberDark)
}

/**
 * Each style draws a run across the tile (x from a to b, at the fence's height), a run down it
 * (y from a to b), and the post that stands at a corner or the end of a run.
 */
const FENCE_DRAW = {
  // A whitewashed low wall with a coping, thrown with colour: a splash every fifth column, in
  // pink, green, yellow, blue in turn, on a period of five so the run meets edge to edge.
  colourwall: {
    across(pc, a, b) {
      for (let x = a; x <= b; x++) {
        const u = x % 5
        pc.px(x, 5, P.holiWhiteLight)
        pc.vline(x, 6, 12, P.holiWhite)
        pc.px(x, 13, P.holiWhiteDark)
        pc.px(x, 14, P.holiWhiteDark)
        if (u === 0) pc.vline(x, 6, 13, P.holiWhiteDark) // a pier
        const c = GULAL[Math.floor(x / 5) % 4]
        if (u === 1 || u === 2) {
          pc.px(x, 8, c)
          pc.px(x, 9, c)
          if (u === 2) pc.px(x, 10, shade(c, -0.18))
        }
        if (u === 3) pc.px(x, 7, shade(c, 0.2))
      }
    },
    down(pc, a, b) {
      for (let y = a; y <= b; y++) {
        pc.px(5, y, P.holiWhiteLight)
        pc.hline(6, 9, y, P.holiWhite)
        pc.px(10, y, P.holiWhiteDark)
        const v = y % 5
        if (v === 1 || v === 2) pc.hline(7, 8, y, GULAL[Math.floor(y / 5) % 4])
      }
    },
    post(pc) {
      pc.rect(5, 3, 6, 12, P.holiWhite)
      pc.hline(4, 11, 3, P.holiWhiteLight)
      pc.vline(10, 3, 14, P.holiWhiteDark)
      pc.hline(5, 10, 14, P.holiWhiteDark)
      pc.rect(6, 7, 3, 3, GULAL[0])
      pc.px(8, 11, GULAL[3])
      return pc
    },
  },
  // Marigold garlands: a bamboo post every fifth column and a garland sagging between them.
  garland: {
    across(pc, a, b) {
      const sag = [0, 2, 3, 2, 0]
      for (let x = a; x <= b; x++) {
        const u = x % 5
        const y = 6 + sag[u]
        pc.px(x, y, (x + (x >> 2)) % 3 === 0 ? P.marigoldLight : P.marigold)
        pc.px(x, y + 1, u === 2 ? P.roseRed : P.marigoldDark)
        if (u === 2) pc.px(x, y + 2, P.roseRedDark)
      }
      for (let x = a; x <= b; x++) if (x % 5 === 0) post(pc, x, 4, 15)
    },
    down(pc, a, b) {
      post(pc, 6, a, b)
      for (let y = a; y <= b; y++) {
        const v = y % 5
        pc.px(9 + (v === 2 ? 1 : 0), y, v % 2 ? P.marigold : P.marigoldLight)
        pc.px(10 + (v === 2 ? 1 : 0), y, v === 2 ? P.roseRed : P.marigoldDark)
      }
    },
    post(pc) {
      post(pc, 6, 3, 15)
      pc.rect(8, 5, 3, 3, P.marigold)
      pc.px(9, 5, P.marigoldLight)
      pc.px(10, 7, P.marigoldDark)
      pc.px(8, 8, P.roseRed)
      return pc
    },
  },
  // Bamboo: two poles run through uprights every fifth column, a strip of cloth tied at each.
  bamboo: {
    across(pc, a, b) {
      for (const y of [7, 11]) {
        pc.hline(a, b, y, P.bambooLight)
        pc.hline(a, b, y + 1, P.bamboo)
        for (let x = a; x <= b; x++) if (x % 5 === 2) pc.px(x, y + 1, P.bambooDark)
      }
      for (let x = a; x <= b; x++) {
        if (x % 5 !== 0) continue
        post(pc, x, 4, 15)
        const c = GULAL[Math.floor(x / 5) % GULAL.length]
        pc.px(x + 2, 7, c)
        pc.px(x + 2, 8, shade(c, -0.2))
        pc.px(x + 3, 8, c)
      }
    },
    down(pc, a, b) {
      post(pc, 6, a, b)
      for (let y = a; y <= b; y++) if (y % 5 === 0) pc.hline(5, 9, y, P.bambooDark)
    },
    post(pc) {
      post(pc, 6, 3, 15)
      pc.hline(5, 9, 7, P.bambooLight)
      pc.hline(5, 9, 8, P.bamboo)
      pc.px(8, 5, GULAL[2])
      pc.px(9, 6, GULAL[2])
      return pc
    },
  },
  // Logs stacked for the fire: two courses of log ends, the upper course stepped half a log along.
  logstack: {
    across(pc, a, b) {
      for (let x = a; x <= b; x++) {
        for (let v = 0; v < 5; v++) {
          logPx(pc, x, 4 + v, x % 5, v)
          logPx(pc, x, 9 + v, (x + 2) % 5, v)
        }
        pc.px(x, 14, P.barnTimberDark)
      }
    },
    down(pc, a, b) {
      for (let y = a; y <= b; y++) {
        for (let u = 0; u < 5; u++) logPx(pc, 5 + u, y, u, y % 5)
        pc.px(10, y, P.barnTimberDark)
      }
    },
    post(pc) {
      for (const [cx, cy] of [[5, 9], [10, 9], [7, 4]]) {
        for (let v = 0; v < 5; v++) for (let u = 0; u < 5; u++) logPx(pc, cx - 2 + u, cy - 2 + v + 3, u, v)
      }
      return pc
    },
  },
}
const STYLES = ['colourwall', 'garland', 'bamboo', 'logstack']

/**
 * A plot's fence, one tile of it. A run reaches the edge of the tile on a linked side and stops
 * in the middle otherwise, so it ends in a post at a gap and turns a proper corner.
 */
export function drawFence(style, mask) {
  const pc = new PixelCanvas(T, T)
  const f = FENCE_DRAW[STYLES[style]] || FENCE_DRAW.bamboo
  const across = mask & (2 | 8)
  const down = mask & (1 | 4)
  if (across) f.across(pc, mask & 8 ? 0 : 7, mask & 2 ? T - 1 : 8)
  if (down) f.down(pc, mask & 1 ? 0 : 7, mask & 4 ? T - 1 : 8)
  const straight = mask === (2 | 8) || mask === (1 | 4)
  if (!straight) f.post(pc)
  return pc
}

/**
 * What lies at a fence's foot where the broom doesn't reach: drifts of powder and fallen petals.
 * `mask` as the fence's (1 N, 2 E, 4 S, 8 W). The drifts are in the ground's own colours and the
 * petals are marigold and rose.
 */
export function drawVerge(mask, tone) {
  const pc = new PixelCanvas(T, T)
  const [, dark, light, deep] = groundOf(tone)
  const rand = mulberry32(mask * 883 + toneOf(tone) * 149 + 77)
  const drift = (x, y, i) => {
    const c = GULAL[i % GULAL.length]
    pc.hline(x - 1, x + 1, y, shade(c, 0.1))
    pc.px(x, y - 1, c)
    pc.px(x + 2, y, shade(c, -0.2))
    pc.px(x - 2, y, dark)
  }
  const across = mask & (2 | 8)
  const down = mask & (1 | 4)
  if (across) {
    const x0 = mask & 8 ? 0 : 4
    const x1 = mask & 2 ? T - 3 : 10
    drift(x0 + 2 + Math.floor(rand() * 2), 15, mask)
    for (let x = x0 + 3; x <= x1; x += 3) {
      const r = rand()
      if (r < 0.35) drift(x, 15, x)
      else if (r < 0.7) petal(pc, x, 14, x)
    }
    for (let x = x0; x <= x1; x++) if (rand() < 0.2) pc.px(x, 15, light)
  }
  if (down) {
    const left = !(mask & 8)
    const right = !(mask & 2)
    for (let y = mask & 1 ? 3 : 6; y <= (mask & 4 ? 14 : 10); y += 3) {
      if (left && rand() < 0.5) petal(pc, 2, y, y)
      if (right && rand() < 0.5) petal(pc, 12, y, y + 1)
    }
    if (right) drift(12, mask & 4 ? 14 : 10, mask)
    else if (left) drift(3, mask & 4 ? 14 : 10, mask)
  }
  if (!across && !down) {
    drift(4, 15, 0)
    petal(pc, 9, 14, 1)
    pc.px(6, 13, deep)
  }
  return pc
}

/**
 * The plot's ground spilling over the edge of the lane: dust and petals creeping out onto the
 * pale lane. Variant `side * 2 + k`, as the village's grass fringe: side 0 top, 1 right, 2
 * bottom, 3 left of the lane's tile, k one of two scatters, and 8 more leaves the mouth of a path
 * open.
 */
export function drawFringe(variant, tone) {
  const pc = new PixelCanvas(T, T)
  const [base, dark, light] = groundOf(tone)
  const mouth = variant >= 8
  const side = (variant & 7) >> 1
  const rand = mulberry32(variant * 661 + toneOf(tone) * 79 + 87)
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
  if (kind === 'splashmark') {
    // Colour thrown at the ground: a blot, by variant pink, blue or yellow, and drops off it.
    const c = GULAL[[0, 3, 2][variant % 3]]
    pc.ellipse(8, 8, 4.5, 3, c)
    pc.ellipse(6.5, 7, 2, 1.2, shade(c, 0.3))
    for (const [x, y] of [[2, 6], [13, 9], [11, 13], [4, 12], [12, 3]]) pc.px(x, y, c)
    return pc
  }
  if (kind === 'petaldrift') {
    // Petals blown into a heap, the bright ones on top.
    const n = variant ? 16 : 10
    for (let i = 0; i < n; i++) petal(pc, 2 + ((i * 5) % 11), 4 + ((i * 7) % 9), i)
    return pc
  }
  if (kind === 'ashpatch') {
    // Ash and a cinder or two where something burned.
    const n = variant ? 9 : 5
    for (let i = 0; i < n; i++) {
      const x = 1 + ((i * 5) % 12)
      const y = 3 + ((i * 7) % 10)
      pc.hline(x, x + 2, y, i % 2 ? P.ash : shade(P.ash, 0.2))
      if (i % 3 === 0) pc.px(x + 1, y + 1, P.ember)
    }
    return pc
  }
  if (kind === 'lonepot') {
    // A pot of gulal left where it was set down, its heap of powder on top.
    const c = GULAL[variant ? 3 : 0]
    pc.ellipse(8.5, 11, 3.5, 3, P.matka)
    pc.rect(6, 7, 5, 2, P.matkaDark)
    pc.hline(6, 10, 7, P.matkaLight)
    pc.px(6, 10, P.matkaLight)
    pc.hline(6, 10, 13, P.matkaDark)
    pc.ellipse(8.5, 6.5, 2.8, 1.6, c)
    pc.px(7, 5, shade(c, 0.35))
    return dropShadow(pc)
  }
  // powderheap: a small cone of powder on the ground, dust drifting off it.
  const c = GULAL[variant ? 2 : 1]
  for (let i = 0; i < 5; i++) pc.hline(8 - i, 8 + i, 6 + i, i ? c : shade(c, 0.3))
  pc.hline(3, 13, 11, shade(c, -0.2))
  pc.px(11, 9, shade(c, 0.25))
  pc.px(12, 7, shade(c, 0.25))
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
const WORK_FILL = [0.3, 0.3, 0.2, 0.22]
/** What gathers in a drift, by ground: splashes on the powder, petals on the earth, pots on the flags. */
const WORK = ['splashmark', 'petaldrift', 'lonepot', 'ashpatch']
/** And what lies loose everywhere between the drifts. */
const LOOSE = ['powderheap', 'petaldrift', 'splashmark', 'ashpatch']
/** The odd thing, anywhere, by ground. */
const ODDS = [
  ['lonepot', 'petaldrift', 'powderheap', 'splashmark'],
  ['lonepot', 'powderheap', 'splashmark', 'petaldrift'],
  ['splashmark', 'petaldrift', 'powderheap', 'lonepot'],
  ['lonepot', 'petaldrift', 'splashmark', 'powderheap'],
]
const ODD_SHARE = 0.03

/** What lies on the plot ground tile (tx, ty), if anything: `{ kind, variant }`, or null. */
export function holiCover(tx, ty, tone) {
  const t = toneOf(tone)
  const h = lattice(tx, ty, 791)
  const v = lattice(tx, ty, 792)
  const x = tx * DRIFT_SCALE
  const y = ty * DRIFT_SCALE
  if (fbm(x, y, 737) > WORK_DRIFT) {
    const kind = WORK[t]
    if (h < WORK_FILL[t]) return { kind, variant: Math.floor(v * COVER_VARIANTS[kind]) }
  } else if (fbm(x, y, 731) > LOOSE_DRIFT) {
    const kind = LOOSE[t]
    if (h < LOOSE_FILL) return { kind, variant: v < 0.55 ? 0 : 1 }
  }
  if (h > 1 - ODD_SHARE) {
    const list = ODDS[t]
    const kind = list[Math.floor(v * list.length)]
    return { kind, variant: Math.floor(lattice(tx, ty, 793) * COVER_VARIANTS[kind]) }
  }
  return null
}

/** The ground's plain colours, each paired with its dry partner and its lush one. */
export function patches(tone) {
  const t = toneOf(tone)
  return [P.holiGround[t], P.holiGroundSunny[t], P.holiGroundLush[t]]
}
