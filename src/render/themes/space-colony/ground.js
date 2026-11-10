// Space colony ground, ways and fences: red regolith, landing-pad plating, dark basalt or a dome
// garden inside each plot, a packed-dust lane round it, a path across it, and fences of perimeter
// beacons, a hazard-striped guard rail, wire mesh and a row of solar panels.
//
// Contract (see ThemePack in ../index.js and the village's src/render/sprites/tiles.js):
// - `tone` is a plot's yard, an index into THEMES['space-colony'].dims.yard (regolith, pad, ore, garden).
// - Ground, trail and road tiles are 16×16 and fully opaque; each variant is its own picture.
// - A fence's `style` indexes dims.fence; `mask` which sides carry on (1 N, 2 E, 4 S, 8 W). A
//   straight run meets the next tile's edge to edge, so nothing a run draws may differ in shape
//   between its first column and its last. Every pattern therefore has a period that divides 15,
//   3 or 5, which is the only way column 0 and column 15 agree.
// - `patches(tone)` is [plain, sunny, lush]: the ground's plain colours, and what each becomes
//   where it has dried out and where it grows lush. Only pixels exactly a plain colour change.
// - `spaceCover` is pure: the same tile always has the same thing lying on it, or nothing.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { mulberry32 } from '../../../sim/rng.js'
import { fbm, lattice } from '../../../sim/noise.js'

const T = 16
const REGOLITH = 0
const PAD = 1
const ORE = 2

const toneOf = (tone) => (tone || 0) % P.spaceGround.length
/** A ground's colours: base, shade, light, deepest. All four are its plain colours. */
const groundOf = (tone) => P.spaceGround[toneOf(tone)]

/** How many looks each thing lying about has; drawn as `deco.<kind>.<variant>`. */
export const COVER_VARIANTS = { moonrock: 2, cratermark: 2, oreshard: 2, supplycrate: 2, bootprints: 2, cablecoil: 1 }
/** The lip drawn where the lane meets anything else: its verge of packed dust. */
export const ROAD_EDGE = P.spaceLaneEdge
/** What the sample bay is edged in: the dark plating that holds its basalt in. */
export const BED_EDGE = P.spacePlateDark

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

/** A pebble: a pale top and a dark foot. */
function pebble(pc, x, y, light, dark) {
  pc.px(x, y, light)
  pc.px(x + 1, y, dark)
  pc.px(x + 1, y + 1, dark)
}

/** A fleck of ore, violet. */
function fleck(pc, x, y, i) {
  pc.px(x, y, i % 2 ? P.spaceOre : P.spaceOreLight)
  pc.px(x + 1, y + (i & 1), P.spaceOre)
}

/** The ground itself, before anything is found in it. */
function texture(pc, rand, t) {
  const [base, dark, light, deep] = P.spaceGround[t]
  pc.rect(0, 0, T, T, base)
  if (t === REGOLITH) {
    // Red dust: fine speckle, a few stones and a wind ripple or two.
    scatter(rand, 18, (x, y) => pc.px(x, y, dark))
    scatter(rand, 12, (x, y) => pc.px(x, y, light))
    scatter(rand, 3, (x, y) => pebble(pc, x, y, light, deep))
    for (const y of [3, 11]) {
      const x = Math.floor(rand() * 8)
      pc.hline(x, x + 5, y, light)
      pc.hline(x + 1, x + 6, y + 1, dark)
    }
  } else if (t === PAD) {
    // Landing-pad plating: 8 px panels, lit along the top and left, seamed deep below, rivets at the corners.
    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        if (y % 8 === 7 || x % 8 === 7) pc.px(x, y, deep)
        else if (y % 8 === 0 || x % 8 === 0) pc.px(x, y, light)
        else if ((x % 8 === 1 || x % 8 === 5) && (y % 8 === 1 || y % 8 === 5)) pc.px(x, y, dark)
      }
    }
    scatter(rand, 4, (x, y) => pc.px(x, y, dark))
  } else if (t === ORE) {
    // Dark basalt: grain, glints of ore and the odd paler chip.
    scatter(rand, 18, (x, y) => pc.px(x, y, dark))
    scatter(rand, 14, (x, y) => pc.px(x, y, light))
    scatter(rand, 4, (x, y) => pc.px(x, y, deep))
    scatter(rand, 2, (x, y) => fleck(pc, x, y, x + y))
  } else {
    // A dome garden: tufts everywhere, a darker clump or two.
    scatter(rand, 14, (x, y) => tuft(pc, x, y, light, dark))
    scatter(rand, 5, (x, y) => pc.px(x, y, deep))
  }
}

/** What a rare tile has in it: variants 3, 4 and 5 of each ground. */
function find(pc, rand, t, variant) {
  const [base, dark, light, deep] = P.spaceGround[t]
  const x = 4 + Math.floor(rand() * 6)
  const y = 4 + Math.floor(rand() * 6)
  const k = variant - 3
  if (k === 0) {
    // A little crater: a dark bowl with a bright lip on its sunward side.
    pc.ellipse(x, y, 4.5, 2.5, deep)
    pc.ellipse(x + 0.5, y + 0.5, 3, 1.5, dark)
    pc.hline(x - 3, x + 2, y - 2, light)
  } else if (k === 1) {
    // Ore chips scattered where something was broken up.
    for (const [dx, dy] of [[0, 0], [3, 1], [-2, 2], [1, 3]]) fleck(pc, x + dx, y + dy, dx + dy + 4)
  } else {
    // Tracks: a pair of wheel lines running across, dotted.
    for (let i = 0; i < T; i += 2) {
      pc.px(i, y, deep)
      pc.px(i + 1, y + 3, deep)
    }
    pc.hline(0, T - 1, y + 1, base)
  }
}

/**
 * A plot's ground. Variants 0–2 are plain and carry the ground; 3–5 are rare (see TILE_WEIGHTS in
 * the village's tiles) and each holds something the work has left there.
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
 * The sample bay, where the village has its flower bed: dark basalt in rows, a plate set for every
 * spot a beacon or a sample stands on. The plates are on the village's grid, 8 px apart: variant 0
 * is the bed's top row, variant 1 every row below it, which carries the grid on from the row above
 * (see the village's `bed` tile). Its soil is its own, not the plot's ground, so a sample reads
 * against it whatever the plot is laid in.
 */
export function drawBed(variant) {
  const pc = new PixelCanvas(T, T)
  pc.rect(0, 0, T, T, P.spaceBed)
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const s = y % 4
      if (s === 1) pc.px(x, y, (x * 5 + y) % 7 ? P.spaceBedLight : P.spaceBed)
      else if (s === 3) pc.px(x, y, P.spaceBedDark)
    }
  }
  for (const y0 of variant ? [-4, 4] : [4]) {
    for (const x0 of [0, 8]) {
      pc.hline(x0 + 3, x0 + 5, y0 + 6, P.spaceBedDeep)
      pc.px(x0 + 4, y0 + 5, P.spaceBedDeep)
      // A plate ring set round the socket.
      pc.px(x0 + 2, y0 + 5, P.spacePlate)
      pc.px(x0 + 6, y0 + 5, P.spacePlateLight)
    }
  }
  if (!variant) {
    // The top row is where the bay starts: hazard tape run along it.
    for (let x = 0; x < T; x++) pc.px(x, 1, x % 4 < 2 ? P.spaceHazard : P.spacePlateDark)
  }
  return pc
}

// ---------- the path across a plot ----------

/** Where the path runs across its tile: 8 px wide, down the middle, so arms meet their neighbours'. */
const LO = 4
const HI = 11

/**
 * A path trodden across the plot: packed dust 8 px wide down the middle of the tile, an arm out
 * of each linked side to its edge, and the ground's own edge ragged either side.
 */
export function drawTrail(variant, links, tone) {
  const t = toneOf(tone)
  const g = P.spaceGround[t]
  const pc = new PixelCanvas(T, T)
  const rand = mulberry32(variant * 149 + links * 19 + t * 6151 + SEED.trail)
  texture(pc, rand, t)
  const N = links & 1
  const E = links & 2
  const S = links & 4
  const W = links & 8
  const down = N || S
  const across = E || W || !down
  const dust = (x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const n = (x * 7 + y * 13 + variant * 3) % 11
        pc.px(x, y, n === 0 ? P.spaceLaneDark : n === 5 ? P.spaceLaneLight : P.spaceLane)
      }
    }
  }
  const dy0 = N ? 0 : LO
  const dy1 = S ? T - 1 : HI
  const ax0 = W ? 0 : LO
  const ax1 = E ? T - 1 : HI
  if (down) dust(LO, dy0, HI, dy1)
  if (across) dust(ax0, LO, ax1, HI)
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
  // Something on the path, by variant: a bootprint, a fleck of ore, a scuff.
  if (variant === 1) {
    pc.px(6, 8, P.spaceLaneEdge)
    pc.px(7, 8, P.spaceLaneEdge)
    pc.px(6, 9, P.spaceLaneEdge)
  } else if (variant === 2) fleck(pc, 7, 7, 1)
  else if (variant === 3) {
    pc.px(6, 8, P.spaceLaneEdge)
    pc.px(7, 9, P.spaceLaneEdge)
  }
  return pc
}

// ---------- the lane round a plot ----------

/**
 * The lane round a plot: packed pale dust, grit and small stones in a pale binding, the stones on
 * a scatter rather than a grid so the lane reads as one surface running on. Variants 0–2 are
 * plain; 3 has a crater in it, 4 wheel tracks across it, 5 a trail of bootprints.
 */
export function drawRoad(variant) {
  const pc = new PixelCanvas(T, T)
  const rand = mulberry32(variant * 149 + SEED.road * 6151)
  pc.rect(0, 0, T, T, P.spaceLane)
  scatter(rand, 22, (x, y) => pc.px(x, y, P.spaceLaneDark))
  scatter(rand, 16, (x, y) => pc.px(x, y, P.spaceLaneLight))
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(rand() * 15)
    const y = Math.floor(rand() * 15)
    pc.px(x, y, P.spaceLaneLight)
    pc.px(x, y + 1, P.spaceLaneEdge)
    pc.px(x + 1, y, P.spaceLaneDark)
  }
  if (variant === 3) {
    pc.ellipse(8, 8, 5.5, 2.5, P.spaceLaneEdge)
    pc.ellipse(8, 8.5, 4, 1.5, P.spaceLaneDark)
    pc.hline(4, 11, 6, P.spaceLaneLight)
  } else if (variant === 4) {
    for (let x = 0; x < T; x += 2) {
      pc.px(x, 5, P.spaceLaneEdge)
      pc.px(x + 1, 10, P.spaceLaneEdge)
    }
  } else if (variant === 5) {
    for (let i = 0; i < 5; i++) {
      pc.px(2 + i * 3, 4 + (i % 2) * 5, P.spaceLaneEdge)
      pc.px(3 + i * 3, 4 + (i % 2) * 5, P.spaceLaneEdge)
    }
  }
  return pc
}

// ---------- fences ----------

/** A beacon lamp at (cx, y): a 3-wide cap of colour c with a bright heart. */
function lamp(pc, cx, y, c = P.spacePaint[3]) {
  pc.hline(cx - 1, cx + 1, y, c)
  pc.px(cx, y - 1, P.spaceGlow)
  pc.px(cx - 1, y - 1, c)
  pc.px(cx + 1, y - 1, c)
}

/** A steel post down a column, from y0 to y1. */
function post(pc, x, y0, y1) {
  pc.vline(x, y0, y1, P.spacePlateLight)
  pc.vline(x + 1, y0, y1, P.spacePlateDark)
}

/** The hazard band along a rail, on a period of five. */
const HAZARD = [P.spaceHazard, P.spaceHazard, P.spaceHazard, P.spacePlateDark, P.spacePlateDark]

/**
 * Each style draws a run across the tile (x from a to b, at the fence's height), a run down it
 * (y from a to b), and the post that stands at a corner or the end of a run.
 */
const FENCE_DRAW = {
  // Perimeter beacons: a steel post every fifth column with a lamp on it, a cable strung between.
  beacons: {
    across(pc, a, b) {
      pc.hline(a, b, 7, P.spacePlateLight)
      pc.hline(a, b, 8, P.spacePlateDark)
      for (let x = a; x <= b; x++) {
        if (x % 5 === 0) {
          post(pc, x, 5, 15)
          // The lamp sits on the post's own two columns, so a run's first column and its last agree.
          const c = [P.spacePaint[3], P.spaceHazard][(x / 5) % 2 | 0]
          pc.hline(x, x + 1, 3, c)
          pc.hline(x, x + 1, 4, shade(c, -0.25))
          pc.px(x, 2, P.spaceGlow)
        }
      }
    },
    down(pc, a, b) {
      pc.vline(7, a, b, P.spacePlateLight)
      pc.vline(8, a, b, P.spacePlateDark)
      for (let y = a; y <= b; y++) if (y % 5 === 0) pc.px(9, y, P.spacePaint[3])
    },
    post(pc) {
      pc.rect(6, 5, 4, 11, P.spacePlate)
      pc.vline(6, 5, 15, P.spacePlateLight)
      pc.vline(9, 5, 15, P.spacePlateDark)
      lamp(pc, 8, 4)
      pc.px(7, 3, P.spaceGlow)
    },
  },
  // A guard rail: two bars of hazard stripes between steel posts, on a period of five.
  rail: {
    across(pc, a, b) {
      for (let x = a; x <= b; x++) {
        pc.px(x, 6, HAZARD[x % 5])
        pc.px(x, 7, P.spacePlateDark)
        pc.px(x, 10, HAZARD[(x + 2) % 5])
        pc.px(x, 11, P.spacePlateDark)
        if (x % 5 === 0) post(pc, x, 5, 15)
      }
    },
    down(pc, a, b) {
      for (let y = a; y <= b; y++) {
        pc.px(6, y, HAZARD[y % 5])
        pc.px(7, y, P.spacePlateLight)
        pc.px(8, y, P.spacePlateDark)
        pc.px(9, y, HAZARD[(y + 2) % 5])
      }
    },
    post(pc) {
      post(pc, 6, 4, 15)
      post(pc, 8, 4, 15)
      pc.hline(6, 9, 4, P.spaceHazard)
      pc.hline(6, 9, 8, P.spaceHazard)
    },
  },
  // Wire mesh: a diamond lattice between two rails, on a period of five.
  mesh: {
    across(pc, a, b) {
      pc.hline(a, b, 5, P.spacePlateLight)
      pc.hline(a, b, 14, P.spacePlateDark)
      for (let x = a; x <= b; x++) {
        for (let y = 6; y <= 13; y++) {
          if ((x + y) % 5 === 0) pc.px(x, y, P.spacePlateLight)
          else if ((x - y + 20) % 5 === 0) pc.px(x, y, P.spacePlate)
        }
        if (x % 5 === 0) post(pc, x, 4, 15)
      }
    },
    down(pc, a, b) {
      pc.vline(5, a, b, P.spacePlateLight)
      pc.vline(10, a, b, P.spacePlateDark)
      for (let y = a; y <= b; y++) {
        if (y % 5 === 0) pc.hline(5, 10, y, P.spacePlate)
        pc.px(7, y, y % 5 === 2 ? P.spacePlateLight : P.spacePlate)
      }
    },
    post(pc) {
      pc.rect(6, 3, 4, 13, P.spacePlate)
      pc.vline(6, 3, 15, P.spacePlateLight)
      pc.vline(9, 3, 15, P.spacePlateDark)
      pc.hline(5, 10, 3, P.spacePlateLight)
      pc.px(7, 2, P.spacePlateLight)
    },
  },
  // Solar panels stood in a row: cells in a frame, a leg under every fifth column.
  panels: {
    across(pc, a, b) {
      for (let x = a; x <= b; x++) {
        pc.px(x, 4, P.spaceHullLight)
        for (let y = 5; y <= 10; y++) pc.px(x, y, x % 5 === 0 || y % 3 === 2 ? P.spaceSolarGrid : P.spaceSolar)
        pc.px(x, 5, P.spaceSolarLight)
        pc.px(x, 11, P.spaceHullDark)
        if (x % 5 === 2) pc.vline(x, 12, 15, P.spacePlate)
      }
    },
    down(pc, a, b) {
      for (let y = a; y <= b; y++) {
        pc.px(6, y, P.spaceHullLight)
        pc.hline(7, 8, y, y % 3 === 0 ? P.spaceSolarGrid : P.spaceSolar)
        pc.px(9, y, P.spaceHullDark)
      }
    },
    post(pc) {
      pc.rect(5, 4, 6, 7, P.spaceSolar)
      pc.hline(5, 10, 4, P.spaceHullLight)
      pc.hline(5, 10, 10, P.spaceHullDark)
      pc.vline(7, 5, 9, P.spaceSolarGrid)
      pc.hline(5, 10, 7, P.spaceSolarGrid)
      pc.vline(7, 11, 15, P.spacePlate)
      pc.vline(8, 11, 15, P.spacePlateDark)
    },
  },
}
const STYLES = ['beacons', 'rail', 'mesh', 'panels']

/**
 * A plot's fence, one tile of it. A run reaches the edge of the tile on a linked side and stops
 * in the middle otherwise, so it ends in a post at a gap and turns a proper corner.
 */
export function drawFence(style, mask) {
  const pc = new PixelCanvas(T, T)
  const f = FENCE_DRAW[STYLES[style]] || FENCE_DRAW.mesh
  const across = mask & (2 | 8)
  const down = mask & (1 | 4)
  if (across) f.across(pc, mask & 8 ? 0 : 7, mask & 2 ? T - 1 : 8)
  if (down) f.down(pc, mask & 1 ? 0 : 7, mask & 4 ? T - 1 : 8)
  const straight = mask === (2 | 8) || mask === (1 | 4)
  if (!straight) f.post(pc)
  return pc
}

/**
 * What lies at a fence's foot where nobody sweeps: drifted dust, a pebble or two, a loose cable.
 * `mask` as the fence's (1 N, 2 E, 4 S, 8 W). The dust is drawn in the ground's own colours, so
 * the patches tint it along with the ground round it.
 */
export function drawVerge(mask, tone) {
  const pc = new PixelCanvas(T, T)
  const [, dark, light, deep] = groundOf(tone)
  const rand = mulberry32(mask * 883 + toneOf(tone) * 149 + 59)
  const heap = (x, y) => {
    pc.hline(x - 1, x + 1, y, dark)
    pc.px(x, y - 1, light)
    pc.px(x - 1, y, deep)
  }
  const cable = (x, y) => {
    pc.hline(x, x + 2, y, P.spacePlateDark)
    pc.px(x + 2, y + 1, P.spacePlate)
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
      else if (r < 0.6) cable(x, 14)
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
    if (right) cable(12, mask & 4 ? 14 : 10)
    else if (left) cable(2, mask & 4 ? 14 : 10)
  }
  if (!across && !down) {
    heap(3, 15)
    cable(9, 14)
    pebble(pc, 6, 13, light, deep)
  }
  return pc
}

/**
 * The plot's ground spilling over the edge of the lane: dust and turf creeping out onto
 * the packed lane. Variant `side * 2 + k`, as the village's grass fringe: side 0 top, 1 right, 2
 * bottom, 3 left of the lane's tile, k one of two scatters, and 8 more leaves the mouth of a path
 * open.
 */
export function drawFringe(variant, tone) {
  const pc = new PixelCanvas(T, T)
  const [base, dark, light] = groundOf(tone)
  const mouth = variant >= 8
  const side = (variant & 7) >> 1
  const rand = mulberry32(variant * 661 + toneOf(tone) * 79 + 69)
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
  if (kind === 'moonrock') {
    // A boulder or two, lit from the top left.
    const n = variant ? 2 : 1
    for (let i = 0; i < n; i++) {
      const x = 4 + i * 5
      const y = 8 + i * 2
      pc.ellipse(x + 2, y, 3.2, 2.4, P.spacePlate)
      pc.ellipse(x + 1.5, y - 0.6, 2, 1.2, P.spacePlateLight)
      pc.hline(x, x + 4, y + 2, P.spacePlateDark)
    }
    return dropShadow(pc)
  }
  if (kind === 'cratermark') {
    // A small crater: a dark bowl with a lit rim.
    const r = variant ? 5.5 : 4
    pc.ellipse(8, 9, r, r * 0.55, P.spaceLaneEdge)
    pc.ellipse(8, 9.5, r - 1.3, r * 0.55 - 1, P.spaceBedDark)
    pc.hline(8 - r + 2, 8 + 1, 9 - Math.round(r * 0.55), P.spaceLaneLight)
    return pc
  }
  if (kind === 'oreshard') {
    // Ore, violet and bright, broken from the rock.
    const n = variant ? 4 : 2
    for (let i = 0; i < n; i++) {
      const x = 2 + ((i * 5) % 11)
      const y = 5 + ((i * 7) % 8)
      pc.px(x, y, P.spaceOreLight)
      pc.hline(x - 1, x + 1, y + 1, P.spaceOre)
      pc.px(x, y + 2, P.spaceBedDark)
    }
    return dropShadow(pc)
  }
  if (kind === 'supplycrate') {
    // A sealed supply crate, a hazard stripe across its lid.
    const c = variant ? P.spacePaint[0] : P.spacePaint[1]
    pc.rect(4, 6, 8, 6, c)
    pc.hline(4, 11, 6, P.spaceHullLight)
    pc.vline(11, 7, 11, P.spacePlateDark)
    for (let x = 5; x <= 10; x++) pc.px(x, 8, x % 2 ? P.spaceHazard : P.spacePlateDark)
    pc.hline(4, 11, 12, P.spacePlateDark)
    return dropShadow(pc)
  }
  if (kind === 'bootprints') {
    // A line of bootprints walking across.
    const n = variant ? 6 : 4
    for (let i = 0; i < n; i++) {
      const x = 1 + i * 2 + (i % 2)
      const y = 5 + i * 2 - (i % 2) * 2
      pc.hline(x, x + 1, y, P.spaceLaneEdge)
      pc.px(x, y + 1, P.spaceLaneEdge)
    }
    return pc
  }
  // cablecoil: a coil of cable dropped, one end trailing.
  pc.ellipse(7, 8, 3.5, 2.5, P.spacePlateDark)
  pc.ellipse(7, 8, 1.8, 1.2, P.spacePlate)
  pc.hline(10, 14, 10, P.spacePlateDark)
  pc.px(14, 11, P.spaceHazard)
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
const WORK_FILL = [0.3, 0.2, 0.28, 0.2]
/** What gathers in a drift, by ground: boulders on the regolith, crates on the pad, ore in the mine, prints in the garden. */
const WORK = ['moonrock', 'supplycrate', 'oreshard', 'bootprints']
/** And what lies loose everywhere between the drifts. */
const LOOSE = ['cratermark', 'cablecoil', 'moonrock', 'cratermark']
/** The odd thing, anywhere, by ground. */
const ODDS = [
  ['supplycrate', 'oreshard', 'cablecoil', 'bootprints'],
  ['moonrock', 'cratermark', 'bootprints', 'oreshard'],
  ['supplycrate', 'cablecoil', 'cratermark', 'bootprints'],
  ['moonrock', 'cablecoil', 'supplycrate', 'oreshard'],
]
const ODD_SHARE = 0.03

/** What lies on the plot ground tile (tx, ty), if anything: `{ kind, variant }`, or null. */
export function spaceCover(tx, ty, tone) {
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
  return [P.spaceGround[t], P.spaceGroundSunny[t], P.spaceGroundLush[t]]
}
