// Neon city ground, ways and fences: wet asphalt, poured concrete, paving or a rooftop deck inside
// each plot, a black road round it, a paved footpath across it, and fences of neon tube, chain
// link, concrete barrier and a hologram of posts and light.
//
// Contract (see ThemePack in ../index.js and the village's src/render/sprites/tiles.js):
// - `tone` is a plot's yard, an index into THEMES['neon-city'].dims.yard.
// - Ground, trail and road tiles are 16×16 and fully opaque; each variant is its own picture.
// - A fence's `style` indexes dims.fence; `mask` says which sides carry on (1 N, 2 E, 4 S, 8 W).
//   A straight run meets the next tile edge to edge, so every pattern along a run has a period
//   of 3 or 5, which divide 15: the only way column 0 and column 15 agree.
// - `patches(tone)` is [plain, sunny, lush]; only pixels exactly a plain colour change.
// - `neonCover` is pure: the same tile always has the same thing lying on it, or nothing.
import { PALETTE as P } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { mulberry32 } from '../../../sim/rng.js'
import { fbm, lattice } from '../../../sim/noise.js'

const T = 16

const toneOf = (tone) => (tone || 0) % P.neonGround.length
/** A ground's colours: base, shade, light, deepest. All four are its plain colours. */
const groundOf = (tone) => P.neonGround[toneOf(tone)]

/** How many looks each thing lying about has; drawn as `deco.<kind>.<variant>`. */
export const COVER_VARIANTS = { puddle: 2, grate: 1, cans: 2, cable: 2 }
/** The lip drawn where the road meets anything else: a dark gutter. */
export const ROAD_EDGE = P.neonRoadEdge
/** What the sign row is edged in: a steel kerb. */
export const BED_EDGE = P.neonSteelDark

// ---------- the ground ----------

const SEED = { ground: 71, trail: 72, road: 73 }

function scatter(rand, n, draw) {
  for (let i = 0; i < n; i++) draw(Math.floor(rand() * T), Math.floor(rand() * T))
}

/** The surface itself: the ground's base with speckle, and a seam or two by what it is. */
function texture(pc, rand, t) {
  const [base, dark, light, deep] = P.neonGround[t]
  pc.rect(0, 0, T, T, base)
  scatter(rand, 26, (x, y) => pc.px(x, y, dark))
  scatter(rand, 12, (x, y) => pc.px(x, y, light))
  scatter(rand, 4, (x, y) => pc.px(x, y, deep))
  if (t === 1) {
    // Poured concrete: a joint through it.
    pc.hline(0, T - 1, 7, deep)
  } else if (t === 2) {
    // Paving: a grid of slabs.
    pc.hline(0, T - 1, 7, deep)
    pc.vline(7, 0, T - 1, deep)
  } else if (t === 3) {
    // A rooftop deck: boards.
    for (const y of [3, 7, 11, 15]) pc.hline(0, T - 1, y, deep)
  }
}

/** Something found in the ground, by variant 3–5: a puddle holding a sign, a manhole, litter. */
function find(pc, rand, t, variant) {
  const [, dark, light, deep] = P.neonGround[t]
  if (variant === 3) {
    pc.ellipse(8, 9, 5, 3, P.neonPuddle)
    pc.hline(5, 9, 8, P.neonPuddleLight)
    pc.px(10, 10, t % 2 ? P.neonPink : P.neonCyan)
    pc.px(6, 10, t % 2 ? P.neonCyanDim : P.neonPinkDim)
  } else if (variant === 4) {
    pc.ellipse(8, 8, 4, 4, dark)
    pc.ellipse(8, 8, 3, 3, deep)
    pc.hline(5, 11, 8, dark)
    pc.vline(8, 5, 11, dark)
    pc.px(5, 5, light)
  } else {
    scatter(rand, 3, (x, y) => {
      pc.px(x, y, P.neonSteel)
      pc.px(x + 1, y, P.neonSteelDark)
    })
    pc.px(11, 5, P.neonPinkDim)
    pc.px(4, 12, P.neonCyanDim)
  }
}

/**
 * A plot's ground. Variants 0–2 are plain and carry the ground; 3–5 are rare (see TILE_WEIGHTS in
 * the village's tiles) and each holds something the city has left there.
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
 * The sign row, where the village has its flower bed: dark planter soil with a steel strip along
 * the top of the first row, and a mark every 8 px, on the village's grid, for each sign's post.
 * Variant 0 is the top row, variant 1 every row below it.
 */
export function drawBed(variant) {
  const pc = new PixelCanvas(T, T)
  pc.rect(0, 0, T, T, P.neonSoil)
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      if ((x * 5 + y * 3) % 7 === 0) pc.px(x, y, P.neonSoilLight)
      else if ((x + y * 2) % 9 === 0) pc.px(x, y, P.neonSoilDark)
    }
  }
  for (const y0 of variant ? [-4, 4] : [4]) {
    for (const x0 of [0, 8]) {
      pc.hline(x0 + 3, x0 + 5, y0 + 6, P.neonSoilDark)
      pc.px(x0 + 4, y0 + 5, P.neonSoilDark)
      pc.px(x0 + 2, y0 + 5, P.neonSoilLight)
      pc.px(x0 + 6, y0 + 5, P.neonSoilLight)
    }
  }
  if (!variant) {
    // The top row is where the row starts: a conduit along it, with a lit stud at each end.
    pc.hline(0, T - 1, 1, P.neonSteelDark)
    pc.px(1, 1, P.neonCyan)
    pc.px(14, 1, P.neonCyan)
  }
  return pc
}

// ---------- the footpath across a plot ----------

/** Where the path runs across its tile: 8 px wide, down the middle, so arms meet their neighbours'. */
const LO = 4
const HI = 11

/** A paved path 8 px wide down the middle of the tile and an arm out of each linked side. */
export function drawTrail(variant, links, tone) {
  const t = toneOf(tone)
  const g = P.neonGround[t]
  const pc = new PixelCanvas(T, T)
  const rand = mulberry32(variant * 149 + links * 19 + t * 6151 + SEED.trail)
  texture(pc, rand, t)
  const N = links & 1
  const E = links & 2
  const S = links & 4
  const W = links & 8
  const down = N || S
  const across = E || W || !down
  const slab = (x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const n = (x * 7 + y * 13 + variant * 3) % 11
        pc.px(x, y, n === 0 ? P.neonSlabDark : n === 5 ? P.neonSlabLight : P.neonSlab)
      }
    }
  }
  const dy0 = N ? 0 : LO
  const dy1 = S ? T - 1 : HI
  const ax0 = W ? 0 : LO
  const ax1 = E ? T - 1 : HI
  if (down) slab(LO, dy0, HI, dy1)
  if (across) slab(ax0, LO, ax1, HI)
  // The joints between the slabs, and the ground's own edge ragged either side.
  if (down) for (let y = dy0; y <= dy1; y++) {
    if (y % 4 === 3) pc.hline(LO, HI, y, P.neonSlabDark)
    if ((y * 3) % 4 === 0) pc.px(LO, y, g[1])
    if ((y * 5) % 4 === 0) pc.px(HI, y, g[1])
  }
  if (across) for (let x = ax0; x <= ax1; x++) {
    if (x % 4 === 3) pc.vline(x, LO, HI, P.neonSlabDark)
    if ((x * 3) % 4 === 0) pc.px(x, LO, g[1])
    if ((x * 5) % 4 === 0) pc.px(x, HI, g[1])
  }
  // Something on the path, by variant: a wet patch holding a pink glow, a cigarette end, a drain.
  if (variant === 1) {
    pc.hline(6, 8, 9, P.neonPuddle)
    pc.px(7, 9, P.neonPink)
  } else if (variant === 2) {
    pc.px(7, 7, P.neonSteel)
    pc.px(10, 10, P.neonSteelDark)
  } else if (variant === 3) {
    pc.px(6, 8, P.neonCyanDim)
    pc.px(7, 9, P.neonCyanDim)
  }
  return pc
}

// ---------- the road round a plot ----------

/**
 * The road round a plot: black asphalt with a scatter of lighter grit, and a painted dash. The
 * dash is a little way in from the edge so it never meets another tile's at a join. Variants 0–2
 * are plain; 3 has a puddle in it, 4 a drain, 5 a smear of pink light.
 */
export function drawRoad(variant) {
  const pc = new PixelCanvas(T, T)
  const rand = mulberry32(variant * 149 + SEED.road * 6151)
  pc.rect(0, 0, T, T, P.neonRoad)
  scatter(rand, 24, (x, y) => pc.px(x, y, P.neonRoadDark))
  scatter(rand, 18, (x, y) => pc.px(x, y, P.neonRoadLight))
  if (variant === 3) {
    pc.ellipse(8, 8, 5, 3, P.neonPuddle)
    pc.hline(5, 8, 7, P.neonPuddleLight)
    pc.px(10, 9, P.neonCyan)
  } else if (variant === 4) {
    pc.rect(5, 6, 6, 4, P.neonRoadEdge)
    pc.hline(5, 10, 7, P.neonRoadDark)
    pc.hline(5, 10, 9, P.neonRoadDark)
  } else if (variant === 5) {
    pc.hline(2, 12, 11, P.neonPinkDim)
    pc.hline(4, 9, 12, P.neonPinkDim)
    pc.px(6, 11, P.neonPink)
  } else if (variant === 1) {
    pc.hline(5, 9, 14, P.neonLine)
  } else if (variant === 2) {
    pc.vline(2, 5, 9, P.neonLine)
  }
  return pc
}

// ---------- fences ----------

/**
 * Each fence style is a cell function: `cell(i, d)` is the colour at `i` along the run (0–15, with
 * a period of 3 or 5) and `d` across it (0–15), or null for air. `post(pc)` stands the post a run
 * ends or turns in.
 */
const STYLES = [
  // Neon tube: two glowing rails on thin dark posts every five pixels.
  {
    cell: (i, d) => {
      if (d === 6 || d === 9) return P.neonPink
      if (d === 5 || d === 10) return i % 5 === 2 ? P.neonPinkDim : null
      if (i % 5 === 0 && d >= 5 && d <= 11) return P.neonSteelDark
      return null
    },
    post: (pc) => {
      pc.rect(6, 5, 4, 7, P.neonSteelDark)
      pc.px(7, 6, P.neonPink)
      pc.px(8, 9, P.neonPink)
    },
  },
  // Chain link: a diamond mesh between a top rail and posts every five.
  {
    cell: (i, d) => {
      if (d === 4) return P.neonSteel
      if (i % 5 === 0 && d >= 4 && d <= 11) return P.neonSteelDark
      if (d > 4 && d <= 10 && (i + d) % 3 === 0) return P.neonSteel
      return null
    },
    post: (pc) => {
      pc.rect(6, 3, 4, 9, P.neonSteelDark)
      pc.hline(6, 9, 3, P.neonSteel)
    },
  },
  // Concrete barrier: a low block with hazard stripes along its top.
  {
    cell: (i, d) => {
      if (d < 6 || d > 11) return null
      if (d === 6) return P.neonConcrete
      if (d === 7 || d === 8) return i % 5 < 2 ? P.neonAmber : P.neonConcreteDark
      if (d === 11) return P.neonRoadEdge
      return P.neonConcrete
    },
    post: (pc) => {
      pc.rect(6, 5, 4, 7, P.neonConcreteDark)
      pc.hline(6, 9, 5, P.neonConcrete)
      pc.hline(6, 9, 7, P.neonAmber)
    },
  },
  // Hologram: posts every five with a lit head, and a dotted pane of cyan light between them.
  {
    cell: (i, d) => {
      if (i % 5 === 0 && d >= 4 && d <= 11) return d === 4 ? P.neonCyan : P.neonSteelDark
      if (d >= 5 && d <= 9 && (i + d) % 3 === 0) return P.neonCyanDim
      if (d === 5 && i % 5 !== 0) return P.neonCyan
      return null
    },
    post: (pc) => {
      pc.rect(7, 4, 2, 8, P.neonSteelDark)
      pc.px(7, 3, P.neonCyan)
      pc.px(8, 3, P.neonCyan)
    },
  },
]

/**
 * A plot's fence, one tile of it. A run reaches the edge of the tile on a linked side and stops
 * in the middle otherwise, so it ends in a post at a gap and turns a proper corner.
 */
export function drawFence(style, mask) {
  const pc = new PixelCanvas(T, T)
  const f = STYLES[style] || STYLES[0]
  const across = mask & (2 | 8)
  const down = mask & (1 | 4)
  if (across) {
    for (let i = mask & 8 ? 0 : 7; i <= (mask & 2 ? T - 1 : 8); i++) for (let d = 0; d < T; d++) pc.px(i, d, f.cell(i, d))
  }
  if (down) {
    for (let i = mask & 1 ? 0 : 7; i <= (mask & 4 ? T - 1 : 8); i++) for (let d = 0; d < T; d++) pc.px(d, i, f.cell(i, d))
  }
  const straight = mask === (2 | 8) || mask === (1 | 4)
  if (!straight) f.post(pc)
  return pc
}

/**
 * What lies at a fence's foot: weeds through the cracks, a cable, a dropped can and a glint of
 * wet. `mask` as the fence's. Drawn in the ground's own colours so the patches tint it with it.
 */
export function drawVerge(mask, tone) {
  const pc = new PixelCanvas(T, T)
  const [, dark, light, deep] = groundOf(tone)
  const rand = mulberry32(mask * 883 + toneOf(tone) * 149 + 61)
  const weed = (x, y) => {
    pc.vline(x, y - 2, y, P.vegLeafDark)
    pc.px(x + 1, y - 1, P.vegLeaf)
    pc.px(x - 1, y, deep)
  }
  const wet = (x, y) => {
    pc.hline(x, x + 2, y, P.neonPuddle)
    pc.px(x + 1, y, P.neonPuddleLight)
  }
  const can = (x, y) => {
    pc.hline(x, x + 1, y, P.neonSteel)
    pc.px(x, y - 1, P.neonSteelDark)
    pc.hline(x, x + 1, y + 1, dark)
  }
  const across = mask & (2 | 8)
  const down = mask & (1 | 4)
  if (across) {
    const x0 = mask & 8 ? 0 : 4
    const x1 = mask & 2 ? T - 3 : 10
    weed(x0 + 1 + Math.floor(rand() * 2), 15)
    for (let x = x0 + 3; x <= x1; x += 3) {
      const r = rand()
      if (r < 0.35) weed(x, 15)
      else if (r < 0.55) wet(x, 15)
      else if (r < 0.7) can(x, 14)
    }
    for (let x = x0; x <= x1; x++) if (rand() < 0.2) pc.px(x, 15, light)
  }
  if (down) {
    const left = !(mask & 8)
    const right = !(mask & 2)
    for (let y = mask & 1 ? 3 : 6; y <= (mask & 4 ? 14 : 10); y += 3) {
      if (left && rand() < 0.5) weed(2, y)
      if (right && rand() < 0.5) weed(12, y)
    }
    if (right) wet(12, mask & 4 ? 14 : 10)
    else if (left) wet(1, mask & 4 ? 14 : 10)
  }
  if (!across && !down) {
    weed(3, 15)
    wet(8, 14)
    can(11, 14)
  }
  return pc
}

/**
 * The plot's ground spilling over the edge of the road. Variant `side * 2 + k`: side 0 top, 1
 * right, 2 bottom, 3 left of the road's tile, k one of two scatters, and 8 more leaves the mouth
 * of a footpath open.
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
  const [, dark] = groundOf(tone)
  if (kind === 'puddle') {
    pc.ellipse(8, 9, variant ? 5 : 4, variant ? 3 : 2.5, P.neonPuddle)
    pc.hline(5, 8, 8, P.neonPuddleLight)
    pc.px(variant ? 10 : 9, 10, variant ? P.neonCyan : P.neonPink)
    return pc
  }
  if (kind === 'grate') {
    pc.rect(4, 5, 8, 7, P.neonSteelDark)
    for (let x = 5; x <= 10; x += 2) pc.vline(x, 6, 10, P.neonRoadEdge)
    pc.hline(4, 11, 5, P.neonSteel)
    // Steam rising from it.
    pc.px(7, 3, P.neonSteel)
    pc.px(8, 2, P.neonConcrete)
    return dropShadow(pc)
  }
  if (kind === 'cans') {
    const can = (x, y, c) => {
      pc.rect(x, y - 2, 2, 3, c)
      pc.px(x, y - 2, P.neonConcrete)
    }
    can(4, 12, P.neonSteel)
    can(9, 10, variant ? P.neonPinkDim : P.neonCyanDim)
    if (variant) pc.hline(11, 13, 13, dark)
    return dropShadow(pc)
  }
  // cable: a dark cord looped across the ground with a spark of colour at one end.
  const y = variant ? 9 : 7
  for (let x = 1; x < 14; x++) pc.px(x, y + Math.round(Math.sin(x * 0.7) * 1.5), P.neonSteelDark)
  pc.px(13, y, variant ? P.neonViolet : P.neonLime)
  return pc
}

// What a plot's ground has lying on it: a drift of small litter, and now and then a thing of its own.
const KINDS = [['puddle', 'cans'], ['grate', 'cable'], ['cans', 'puddle'], ['cable', 'cans']]
const FILL = 0.12
const DRIFT = 0.3
const ODD_SHARE = 0.03

/** What lies on the plot ground tile (tx, ty), if anything: `{ kind, variant }`, or null. */
export function neonCover(tx, ty, tone) {
  const t = toneOf(tone)
  const h = lattice(tx, ty, 611)
  const v = lattice(tx, ty, 612)
  if (fbm(tx * DRIFT, ty * DRIFT, 613) > 0.55 && h < FILL) {
    const kind = KINDS[t][0]
    return { kind, variant: Math.floor(v * COVER_VARIANTS[kind]) }
  }
  if (h > 1 - ODD_SHARE) {
    const kind = KINDS[t][1]
    return { kind, variant: Math.floor(lattice(tx, ty, 614) * COVER_VARIANTS[kind]) }
  }
  return null
}

/** The ground's plain colours, each paired with its dry partner and its lush one. */
export function patches(tone) {
  const t = toneOf(tone)
  return [P.neonGround[t], P.neonGroundSunny[t], P.neonGroundLush[t]]
}
