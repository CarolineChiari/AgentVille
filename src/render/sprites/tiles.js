// Ground tiles (16×16), their decorations, and the tall scenery that is y-sorted with villagers.
import { PALETTE as P, shade } from './palette.js'
import { PixelCanvas } from './pixel.js'
import { mulberry32 } from '../../sim/rng.js'

const T = 16

function speckle(pc, rand, colors, n) {
  for (let i = 0; i < n; i++) pc.px(Math.floor(rand() * T), Math.floor(rand() * T), colors[Math.floor(rand() * colors.length)])
}

export const TILE_VARIANTS = { wild: 8, yard: 6, road: 6, plaza: 4, bed: 2, trail: 4, water: 2 }
/**
 * How often each variant comes up, by position hash. The plain ones carry the ground; a tile
 * with something in it (clover, a scuff, a daisy) only reads as a find if it is rare, and a
 * field of them reads as noise.
 */
const TILE_WEIGHTS = {
  wild: [6, 6, 6, 6, 2, 2, 1, 1],
  yard: [6, 6, 6, 2, 1, 1],
  road: [5, 5, 5, 2, 1, 1],
  plaza: [8, 2, 1, 1],
  trail: [5, 2, 2, 1],
}
const WEIGHT_TOTAL = Object.fromEntries(Object.entries(TILE_WEIGHTS).map(([k, w]) => [k, w.reduce((a, b) => a + b, 0)]))

/** Which variant a tile of `kind` gets from a hash of its position, honouring TILE_WEIGHTS. */
export function tileVariant(kind, hash) {
  const w = TILE_WEIGHTS[kind]
  if (!w) return hash % (TILE_VARIANTS[kind] || 1)
  let r = hash % WEIGHT_TOTAL[kind]
  for (let i = 0; i < w.length; i++) {
    if (r < w[i]) return i
    r -= w[i]
  }
  return 0
}

/** How many looks each decoration has; the renderer picks one by a hash of the tile. */
export const DECO_VARIANTS = {
  fenceh: 1, fencev: 1, post: 1, flowers: 6, pebbles: 3, fringe: 16,
  tallgrass: 3, clover: 2, mushrooms: 2, reeds: 2, lilypad: 2,
}
/**
 * How many looks each tall static has. Trees: 0 broadleaf, 1 pine, 2 fruit, 3 birch, 4 autumn,
 * 5 willow. A board's variant is how many notes it shows.
 */
export const STATIC_VARIANTS = { tree: 6, bush: 2, rock: 2, stump: 1, log: 1, sapling: 1, lamp: 1, arch: 1, board: 7 }

/** Seeds per kind. Not the name's length: 'plaza', 'trail' and 'water' would share one. */
const KIND_SEED = { wild: 1, yard: 2, road: 3, plaza: 4, bed: 5, trail: 6, water: 7 }

/** A little clump of blades, dark at the root with one light tip. */
function tuft(pc, x, y, dark, light) {
  pc.px(x, y, dark)
  pc.px(x, y - 1, dark)
  pc.px(x + 1, y, dark)
  pc.px(x + 1, y - 2, light)
}

/** Three-leaved clovers, a shade lighter than the grass they grow in. */
function clovers(pc, rand, n, color, stem) {
  for (let i = 0; i < n; i++) {
    const x = 3 + Math.floor(rand() * 10)
    const y = 3 + Math.floor(rand() * 10)
    pc.px(x, y - 1, color)
    pc.px(x - 1, y, color)
    pc.px(x + 1, y, color)
    pc.px(x, y, stem)
  }
}

/** One daisy, face up in the grass. */
function daisy(pc, x, y) {
  pc.px(x, y - 1, P.petalWhite)
  pc.px(x - 1, y, P.petalWhite)
  pc.px(x + 1, y, P.petalWhite)
  pc.px(x, y + 1, P.petalWhite)
  pc.px(x, y, P.pollen)
}

/** A stone pressed into the ground: lit from the top left. */
function stone(pc, x, y) {
  pc.hline(x, x + 1, y, P.stoneLight)
  pc.hline(x, x + 1, y + 1, P.stone)
  pc.px(x + 2, y + 1, P.stoneDark)
  pc.hline(x, x + 1, y + 2, P.stoneDark)
}

/** Where a footpath runs across its tile: 8 px wide, down the middle, so arms meet their neighbours'. */
const PATH_LO = 4
const PATH_HI = 11
/** Bits of a footpath's `links`: which sides it runs out of. */
export const LINK = { N: 1, E: 2, S: 4, W: 8 }

/**
 * A footpath worn through a lawn: bare earth in the middle of the tile with an arm out of each
 * linked side, its edges nibbled so it looks trodden rather than laid. Nothing is nibbled on the
 * tile's own border, where an arm has to meet the next tile's.
 */
function footpath(pc, rand, variant, links) {
  const lawn = P.yard
  pc.rect(0, 0, T, T, lawn[0])
  speckle(pc, rand, [lawn[1], lawn[2]], 10)
  const earth = new Uint8Array(T * T)
  const dig = (x0, y0, w, h) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) earth[y * T + x] = 1
  }
  const w = PATH_HI - PATH_LO + 1
  dig(PATH_LO, PATH_LO, w, w)
  if (links & LINK.N) dig(PATH_LO, 0, w, PATH_LO)
  if (links & LINK.S) dig(PATH_LO, PATH_HI + 1, w, T - PATH_HI - 1)
  if (links & LINK.W) dig(0, PATH_LO, PATH_LO, w)
  if (links & LINK.E) dig(PATH_HI + 1, PATH_LO, T - PATH_HI - 1, w)
  // Soften the edges, away from the tile border.
  const nibble = mulberry32(variant * 97 + links * 13 + 1)
  const at = (x, y) => x >= 0 && y >= 0 && x < T && y < T && earth[y * T + x]
  for (let y = 1; y < T - 1; y++) {
    for (let x = 1; x < T - 1; x++) {
      const edge = at(x - 1, y) + at(x + 1, y) + at(x, y - 1) + at(x, y + 1)
      if (earth[y * T + x] && edge < 4 && nibble() < 0.3) earth[y * T + x] = 2
      else if (!earth[y * T + x] && edge > 0 && nibble() < 0.2) earth[y * T + x] = 3
    }
  }
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const e = earth[y * T + x]
      if (e === 1 || e === 3) pc.px(x, y, P.trail)
    }
  }
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(rand() * T)
    const y = Math.floor(rand() * T)
    if (earth[y * T + x] === 1) pc.px(x, y, rand() < 0.5 ? P.trailLight : P.trailDark)
  }
  const mid = PATH_LO + 2
  if (variant === 1) stone(pc, mid + Math.floor(rand() * 3), mid + Math.floor(rand() * 3))
  if (variant === 2) {
    // Footprints.
    for (const [x, y] of [[mid, mid - 1], [mid + 3, mid + 2]]) {
      pc.vline(x, y, y + 1, P.trailDark)
      pc.vline(x + 1, y, y + 1, P.trailDark)
    }
  }
  if (variant === 3) tuft(pc, mid + 1, mid + 3, lawn[1], lawn[2])
}

export function drawTile(kind, variant, opts = {}) {
  const rand = mulberry32(variant * 131 + (KIND_SEED[kind] || 0) * 7919)
  const pc = new PixelCanvas(T, T)
  if (kind === 'wild') {
    // Plain greens only (see src/render/ground.js): the meadow's tone is painted over these.
    const g = P.grass
    pc.rect(0, 0, T, T, g[0])
    speckle(pc, rand, [g[1], g[2]], 16)
    const tufts = variant < 4 ? 2 + (variant % 2) : 1
    for (let i = 0; i < tufts; i++) tuft(pc, 1 + Math.floor(rand() * 13), 3 + Math.floor(rand() * 11), g[3], g[2])
    if (variant === 4) clovers(pc, rand, 3, shade(g[2], 0.12), g[3])
    if (variant === 5) {
      // A tall tuft: five blades fanning out of one root.
      const x = 4 + Math.floor(rand() * 7)
      const y = 7 + Math.floor(rand() * 6)
      for (const [dx, h] of [[-2, 2], [-1, 3], [0, 4], [1, 3], [2, 2]]) pc.vline(x + dx, y - h + 1, y, g[3])
      for (const dx of [-2, 0, 2]) pc.px(x + dx, y - [2, 4, 2][dx / 2 + 1] + 1, g[2])
    }
    if (variant === 6) {
      // A scuffed bare spot with a stone in it.
      const x = 4 + Math.floor(rand() * 6)
      const y = 5 + Math.floor(rand() * 6)
      pc.hline(x, x + 3, y, P.dirt)
      pc.hline(x - 1, x + 4, y + 1, P.dirt)
      pc.hline(x, x + 2, y + 2, P.dirtDark)
      pc.px(x + 1, y + 1, P.dirtDark)
      stone(pc, x + 2, y - 1)
    }
    if (variant === 7) {
      daisy(pc, 4 + Math.floor(rand() * 8), 4 + Math.floor(rand() * 8))
      pc.px(10, 11, g[3])
    }
  } else if (kind === 'yard') {
    const y = P.yard
    pc.rect(0, 0, T, T, y[0])
    speckle(pc, rand, [y[1], y[2]], 12)
    if (variant === 3) clovers(pc, rand, 2, shade(y[2], 0.1), y[1])
    if (variant === 4) daisy(pc, 4 + Math.floor(rand() * 8), 4 + Math.floor(rand() * 8))
    if (variant === 5) for (let i = 0; i < 2; i++) tuft(pc, 2 + Math.floor(rand() * 11), 4 + Math.floor(rand() * 10), y[1], y[2])
  } else if (kind === 'road') {
    pc.rect(0, 0, T, T, P.path)
    speckle(pc, rand, [P.pathLight], 10)
    for (let i = 0; i < 3; i++) {
      const x = Math.floor(rand() * 14)
      const y = Math.floor(rand() * 15)
      pc.hline(x, x + 1, y, P.pathDark)
    }
    if (variant === 3) {
      stone(pc, 2 + Math.floor(rand() * 4), 2 + Math.floor(rand() * 4))
      stone(pc, 8 + Math.floor(rand() * 4), 8 + Math.floor(rand() * 4))
    }
    if (variant === 4) {
      // Loose gravel.
      for (let i = 0; i < 4; i++) {
        const x = 2 + Math.floor(rand() * 12)
        const y = 2 + Math.floor(rand() * 12)
        pc.px(x, y, P.pebble)
        pc.px(x, y + 1, shade(P.pebble, -0.3))
      }
    }
    if (variant === 5) tuft(pc, 5 + Math.floor(rand() * 6), 6 + Math.floor(rand() * 6), P.grass[3], P.grass[0])
  } else if (kind === 'trail') {
    footpath(pc, rand, variant, opts.links || 0)
  } else if (kind === 'water') {
    // Open water; its banks are drawn over it by the renderer (see `shoreline`).
    pc.rect(0, 0, T, T, P.water)
    for (let i = 0; i < 3 - variant; i++) {
      const x = 2 + Math.floor(rand() * 10)
      const y = 3 + Math.floor(rand() * 10)
      pc.hline(x, x + 2, y, P.waterLight)
      pc.hline(x + 1, x + 3, y + 1, P.waterDeep)
    }
  } else if (kind === 'bed') {
    // Ploughed soil. The empty dimples mark where flowers will go, 8 px apart, the way a
    // contribution graph shows empty days. Variant 0 is a field's top row, whose first row of
    // flowers sits 4 px under the plank edging; variant 1 is every row below, where the grid
    // carries on from the row above, so it has a second row of dimples near its top.
    pc.rect(0, 0, T, T, P.bed)
    speckle(pc, rand, [P.bedDark], 8)
    for (const y0 of variant ? [-4, 4] : [4]) {
      for (const x0 of [0, 8]) {
        pc.hline(x0 + 2, x0 + 5, y0 + 5, P.bedHole)
        pc.hline(x0 + 3, x0 + 4, y0 + 6, P.bedHole)
      }
    }
  } else if (kind === 'plaza') {
    // Running-bond paving: courses 3 px high, stones 4 px long, 1 px joints.
    pc.rect(0, 0, T, T, P.plaza)
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? 2 : 0
      pc.hline(0, T - 1, row * 4 + 3, P.plazaDark)
      for (let x = off; x < T; x += 4) pc.vline(x, row * 4, row * 4 + 2, P.plazaDark)
      for (let x = off + 1; x < T; x += 4) pc.px(x, row * 4, P.plazaLight)
    }
    speckle(pc, rand, [P.plazaLight, P.plazaDark], 3)
    // The top-left corner of the stone in course `row` that starts at column `col`.
    const at = (row, col) => [((row % 2 ? 2 : 0) + col * 4 + 1) % T, row * 4]
    if (variant === 1) {
      // A cracked stone.
      const [x, y] = at(1 + Math.floor(rand() * 2), Math.floor(rand() * 3))
      pc.px(x, y, P.plazaDark)
      pc.px(x + 1, y + 1, P.plazaDark)
      pc.px(x + 1, y + 2, P.plazaDark)
    }
    if (variant === 2) {
      // Moss in the joints.
      for (let i = 0; i < 5; i++) {
        const row = Math.floor(rand() * 4)
        const x = Math.floor(rand() * T)
        pc.px(x, row * 4 + 3, i % 2 ? P.leaf : P.leafDark)
      }
    }
    if (variant === 3) {
      // One stone newer than the rest, one older.
      const [x, y] = at(Math.floor(rand() * 4), Math.floor(rand() * 3))
      pc.rect(x, y, 3, 3, P.plazaLight)
      const [u, v] = at((y / 4 + 2) % 4, Math.floor(rand() * 3))
      pc.rect(u, v, 3, 3, shade(P.plaza, -0.08))
    }
  }
  return pc
}

/**
 * A pond's bank, drawn over a water tile. `mask` says which sides are land (1 N, 2 E, 4 S, 8 W).
 * The north bank shades the water under it; the others show a line of shallows. An outside
 * corner is rounded off with grass, or a pond is a stack of squares.
 */
function shoreline(pc, mask) {
  const N = mask & 1
  const E = mask & 2
  const S = mask & 4
  const W = mask & 8
  if (S) pc.hline(0, T - 1, T - 2, P.waterLight)
  if (W) pc.vline(1, 0, T - 1, P.waterLight)
  if (E) pc.vline(T - 2, 0, T - 1, P.waterLight)
  if (N) {
    pc.hline(0, T - 1, 1, P.waterDeep)
    pc.hline(0, T - 1, 2, P.waterDeep)
  }
  if (N) pc.hline(0, T - 1, 0, P.shore)
  if (S) pc.hline(0, T - 1, T - 1, P.shore)
  if (W) pc.vline(0, 0, T - 1, P.shore)
  if (E) pc.vline(T - 1, 0, T - 1, P.shore)
  // A quarter circle of this radius, in px: grass outside it, the muddy edge along it.
  const R = 5
  const round = (fx, fy) => {
    for (let d = 0; d < R; d++) {
      for (let e = 0; e < R; e++) {
        const r2 = (R - d - 0.5) ** 2 + (R - e - 0.5) ** 2
        const x = fx ? T - 1 - d : d
        const y = fy ? T - 1 - e : e
        if (r2 > R * R) pc.px(x, y, P.grass[0])
        else if (r2 > (R - 1.2) ** 2) pc.px(x, y, P.shore)
      }
    }
  }
  if (N && W) round(false, false)
  if (N && E) round(true, false)
  if (S && W) round(false, true)
  if (S && E) round(true, true)
}

/**
 * Blades of grass hanging over the edge of a path. Variant `side * 2 + k`: side 0 top, 1 right,
 * 2 bottom, 3 left of the path tile; k picks one of two scatters; add 8 to leave a footpath's
 * mouth open. `ground` is the grass they belong to, so a lawn's edge is lawn-coloured.
 */
function fringe(pc, variant, ground) {
  // Variants 8–15 leave the middle open, where a footpath joins the road.
  const mouth = variant >= 8
  const side = (variant & 7) >> 1
  const rand = mulberry32(variant * 613 + 29)
  const g = ground === 'yard' ? P.yard : P.grass
  const set = (i, d, c) => {
    if (side === 0) pc.px(i, d, c)
    else if (side === 1) pc.px(T - 1 - d, i, c)
    else if (side === 2) pc.px(i, T - 1 - d, c)
    else pc.px(d, i, c)
  }
  for (let i = 0; i < T; i++) {
    const r = rand()
    if (r < 0.35 || (mouth && i >= PATH_LO && i <= PATH_HI)) continue
    const len = r < 0.8 ? 1 : 2
    set(i, 0, g[0])
    if (len === 2) set(i, 1, g[1])
  }
}

export function drawDeco(kind, variant = 0, opts = {}) {
  const pc = new PixelCanvas(T, T)
  const rand = mulberry32(variant * 977 + 3)
  if (kind === 'fringe') {
    fringe(pc, variant, opts.ground)
    return pc
  }
  if (kind === 'shore') {
    shoreline(pc, variant)
    return pc
  }
  if (kind === 'lilypad') {
    // Round pads with a notch cut in, lying flat; variant 1 has a flower on one.
    for (const [x, y] of [[5, 5], [10, 10]]) {
      pc.ellipse(x, y, 3, 2, P.lilyDark)
      pc.ellipse(x - 0.5, y - 0.5, 2.5, 1.5, P.lily)
      pc.clearPx(x, y - 1)
      pc.clearPx(x + 1, y - 2)
    }
    if (variant === 1) {
      pc.px(10, 8, P.flower[0])
      pc.px(9, 9, P.flower[0])
      pc.px(11, 9, P.flower[0])
      pc.px(10, 9, P.petalWhite)
    }
    return pc
  }
  const post = (x, y0, y1) => {
    pc.rect(x, y0, 3, y1 - y0 + 1, P.fence)
    pc.vline(x + 2, y0 + 1, y1, P.fenceDark)
    pc.hline(x, x + 2, y0, shade(P.fence, 0.2))
  }
  if (kind === 'fenceh' || kind === 'post') {
    pc.hline(0, T - 1, 6, P.fence)
    pc.hline(0, T - 1, 7, P.fenceDark)
    pc.hline(0, T - 1, 10, P.fence)
    pc.hline(0, T - 1, 11, P.fenceDark)
    post(1, 3, 13)
    post(12, 3, 13)
  }
  if (kind === 'fencev' || kind === 'post') {
    pc.rect(7, 0, 2, T, P.fence)
    pc.vline(8, 0, T - 1, P.fenceDark)
    post(6, 1, 6)
    post(6, 9, 14)
  }
  if (kind === 'flowers') {
    const n = 3 + Math.floor(rand() * 3)
    const color = P.flower[variant % P.flower.length]
    for (let i = 0; i < n; i++) {
      const x = 2 + Math.floor(rand() * 12)
      const y = 3 + Math.floor(rand() * 10)
      pc.px(x, y + 2, P.leafDark)
      pc.px(x - 1, y + 1, P.leaf)
      pc.px(x, y - 1, color)
      pc.px(x - 1, y, color)
      pc.px(x + 1, y, color)
      pc.px(x, y + 1, color)
      pc.px(x, y, P.flower[1] === color ? P.white : P.flower[1])
    }
  }
  if (kind === 'pebbles') {
    if (variant === 2) {
      // One flat stone and a chip off it.
      const x = 4 + Math.floor(rand() * 5)
      const y = 5 + Math.floor(rand() * 6)
      pc.hline(x + 1, x + 4, y, P.stoneLight)
      pc.hline(x, x + 5, y + 1, P.pebble)
      pc.hline(x + 1, x + 4, y + 2, shade(P.pebble, -0.25))
      pc.px(x + 8, y + 2, P.pebble)
    } else {
      for (let i = 0; i < (variant ? 5 : 3); i++) {
        const x = 2 + Math.floor(rand() * 11)
        const y = 3 + Math.floor(rand() * 10)
        pc.hline(x, x + (variant ? 0 : 1), y, P.pebble)
        pc.hline(x, x + (variant ? 0 : 1), y + 1, shade(P.pebble, -0.25))
      }
    }
  }
  if (kind === 'tallgrass') {
    // Clumps of long blades in the plain greens, so the meadow tints them with the grass round
    // them. Variant 2 has gone to seed.
    const g = P.grass
    const tip = variant === 2 ? P.thatch : g[2]
    const n = 2 + (variant % 2)
    for (let i = 0; i < n; i++) {
      const x = 2 + Math.floor(rand() * 11)
      const y = 6 + Math.floor(rand() * 9)
      for (const [dx, h] of [[-2, 2], [-1, 4], [0, 6], [1, 3], [2, 5]]) {
        pc.vline(x + dx, y - h + 1, y, dx % 2 ? g[1] : g[3])
        pc.px(x + dx, y - h + 1, tip)
      }
      pc.px(x - 1, y - 6, g[3]) // the tallest blade bends over
    }
  }
  if (kind === 'clover') {
    for (let i = 0; i < 6; i++) {
      const x = 2 + Math.floor(rand() * 12)
      const y = 2 + Math.floor(rand() * 12)
      // A shade darker than the grass: clover in grass is told apart by its depth, not its hue.
      pc.px(x, y - 1, P.leaf)
      pc.px(x - 1, y, P.leaf)
      pc.px(x + 1, y, P.leaf)
      pc.px(x, y, P.leafDark)
      pc.px(x - 1, y - 1, P.leafLight)
    }
    if (variant === 1) {
      // In flower: two round pink-and-white heads.
      for (let i = 0; i < 2; i++) {
        const x = 3 + Math.floor(rand() * 10)
        const y = 3 + Math.floor(rand() * 9)
        pc.rect(x, y, 2, 2, P.petalWhite)
        pc.px(x + 1, y + 1, P.flower[0])
      }
    }
  }
  if (kind === 'mushrooms') {
    // A few toadstools: red with white spots, or plain brown.
    const cap = P.mushroom[variant % P.mushroom.length]
    const n = 2 + Math.floor(rand() * 2)
    for (let i = 0; i < n; i++) {
      const big = i === 0
      const x = 3 + Math.floor(rand() * 10)
      const y = 6 + Math.floor(rand() * 8)
      pc.vline(x, y - (big ? 1 : 0), y, P.white)
      pc.px(x + 1, y, P.plasterShade)
      if (big) {
        pc.hline(x - 2, x + 2, y - 2, cap)
        pc.hline(x - 1, x + 1, y - 3, cap)
        pc.px(x + 2, y - 2, shade(cap, -0.3))
      } else {
        pc.hline(x - 1, x + 1, y - 1, cap)
        pc.px(x, y - 2, cap)
      }
      if (variant === 0) pc.px(x - (big ? 1 : 0), y - (big ? 3 : 2), P.white)
    }
  }
  if (kind === 'reeds') {
    // Stalks by the water, some topped with a cattail.
    for (let i = 0; i < 5; i++) {
      const x = 1 + Math.floor(rand() * 14)
      const h = 5 + Math.floor(rand() * 7)
      const base = 12 + Math.floor(rand() * 4)
      pc.vline(x, base - h, base, i % 2 ? P.reed : shade(P.reed, -0.2))
      if (rand() < 0.6 - variant * 0.3) pc.vline(x, base - h - 1, base - h + 1, P.reedHead)
      else pc.px(x + (i % 2 ? 1 : -1), base - h, P.reed)
    }
    // Leaves fanning from the base.
    pc.line(4, 15, 1, 11, P.reed)
    pc.line(11, 15, 14, 10, shade(P.reed, -0.2))
  }
  return pc
}

// ---------- tall scenery ----------

/** A round-crowned tree's canopy, in `dark` and `mid` with `light` dabs. */
function crown(pc, rand, cx, cy, rx, ry, dark, mid, light) {
  pc.ellipse(cx, cy, rx, ry, dark)
  pc.ellipse(cx - 0.5, cy - 1, rx - 1, ry - 1.5, mid)
  for (let i = 0; i < 5; i++) pc.ellipse(cx - rx * 0.6 + rand() * rx, cy - ry * 0.6 + rand() * ry * 0.8, 2.5, 2, light)
  for (let i = 0; i < 10; i++) pc.px(cx - rx + 2 + Math.floor(rand() * (rx * 2 - 4)), cy - ry + 2 + Math.floor(rand() * (ry * 2 - 4)), dark)
}

function trunk(pc, x, top, color = P.trunk) {
  pc.rect(x, top, 4, 33 - top, color)
  pc.vline(x + 3, top, 32, shade(color, -0.3))
  pc.px(x - 1, 32, color)
  pc.px(x + 4, 32, color)
}

function tree(variant) {
  const pc = new PixelCanvas(24, 34)
  const rand = mulberry32(variant * 53 + 11)
  if (variant === 1) {
    pc.rect(10, 26, 4, 7, P.trunk)
    pc.vline(13, 26, 32, shade(P.trunk, -0.3))
    for (const [top, half, h] of [[1, 5, 9], [7, 8, 10], [14, 11, 13]]) {
      for (let y = 0; y < h; y++) {
        const w = Math.round(1 + (half * y) / h)
        pc.hline(12 - w, 11 + w, top + y, y > h - 3 ? P.pineDark : P.pine)
        pc.px(12 - w, top + y, P.pineDark)
      }
    }
    for (let i = 0; i < 6; i++) pc.px(6 + Math.floor(rand() * 12), 6 + Math.floor(rand() * 18), shade(P.pine, 0.2))
    return pc.outline(P.outline)
  }
  if (variant === 3) {
    // Birch: a slim white trunk with dark marks under a narrow, light crown.
    pc.rect(11, 14, 3, 19, P.birch)
    pc.vline(13, 14, 32, shade(P.birch, -0.15))
    for (let y = 18; y < 32; y += 3) pc.hline(11, 11 + Math.floor(rand() * 2), y + Math.floor(rand() * 2), P.birchMark)
    pc.px(10, 32, P.birch)
    pc.px(14, 32, P.birch)
    crown(pc, rand, 12, 11, 8, 10.5, P.birchLeafDark, P.birchLeaf, shade(P.birchLeaf, 0.2))
    return pc.outline(P.outline)
  }
  if (variant === 5) {
    // Willow: a low dome with long strands hanging down round the trunk.
    trunk(pc, 10, 14)
    pc.ellipse(12, 10, 11.5, 8, P.willowDark)
    pc.ellipse(11.5, 9, 10.5, 6.5, P.willow)
    for (let x = 1; x <= 22; x += 2) {
      const bottom = 17 + Math.floor(rand() * 9)
      pc.vline(x, 10, bottom, x % 4 === 1 ? P.willowDark : P.willow)
      pc.px(x, bottom, P.willowLight)
    }
    for (let i = 0; i < 4; i++) pc.ellipse(6 + rand() * 12, 4 + rand() * 4, 2.2, 1.4, P.willowLight)
    return pc.outline(P.outline)
  }
  trunk(pc, 10, 20)
  if (variant === 4) {
    // Autumn: the broadleaf turned, with a few leaves already down.
    const [leaf, dark, light] = P.autumn
    crown(pc, rand, 12, 12, 11.5, 10.5, dark, leaf, light)
    for (const [x, y] of [[3, 32], [6, 33], [18, 33], [20, 31]]) pc.px(x, y, rand() < 0.5 ? leaf : dark)
    return pc.outline(P.outline)
  }
  crown(pc, rand, 12, 12, 11.5, 10.5, P.leafDark, P.leaf, P.leafLight)
  if (variant === 2) {
    for (let i = 0; i < 7; i++) {
      const x = 4 + Math.floor(rand() * 16)
      const y = 6 + Math.floor(rand() * 12)
      pc.px(x, y, P.fruit)
      pc.px(x + 1, y, shade(P.fruit, -0.2))
    }
  }
  return pc.outline(P.outline)
}

/** A round shrub; variant 1 is heavy with berries. */
function bush(variant) {
  const pc = new PixelCanvas(20, 15)
  const rand = mulberry32(variant * 71 + 5)
  pc.ellipse(10, 9, 8.5, 5.5, P.leafDark)
  pc.ellipse(6, 7.5, 4, 3.5, P.leafDark)
  pc.ellipse(14, 7.5, 4, 3.5, P.leafDark)
  pc.ellipse(9.5, 8.5, 7.5, 4.5, P.leaf)
  pc.ellipse(6, 7, 3, 2.5, P.leaf)
  pc.ellipse(13.5, 7, 3, 2.5, P.leaf)
  for (let i = 0; i < 4; i++) pc.ellipse(4 + rand() * 12, 5 + rand() * 4, 1.6, 1.2, P.leafLight)
  pc.hline(3, 16, 13, P.leafDark)
  if (variant === 1) {
    for (let i = 0; i < 7; i++) {
      const x = 3 + Math.floor(rand() * 14)
      const y = 5 + Math.floor(rand() * 7)
      pc.px(x, y, i % 3 ? P.berry : P.fruit)
    }
  }
  return pc.outline(P.outline)
}

/** A boulder lit from the top left; variant 1 is furred with moss. */
function rock(variant) {
  const pc = new PixelCanvas(16, 12)
  pc.ellipse(8, 7, 7, 4.5, P.stoneDark)
  pc.ellipse(7.5, 6.3, 6, 3.8, P.stone)
  pc.ellipse(6, 5, 3, 1.8, P.stoneLight)
  pc.line(10, 4, 11, 8, P.stoneDark)
  pc.hline(2, 13, 11, P.stoneDark)
  if (variant === 1) {
    pc.ellipse(7.5, 3.6, 4.5, 1.6, P.moss)
    for (const [x, y] of [[4, 5], [11, 4], [9, 5]]) pc.px(x, y, P.moss)
    pc.px(6, 3, P.leafLight)
  }
  return pc.outline(P.outline)
}

function stump() {
  const pc = new PixelCanvas(14, 12)
  pc.rect(3, 5, 8, 6, P.trunk)
  pc.vline(10, 5, 10, shade(P.trunk, -0.3))
  pc.vline(5, 7, 10, shade(P.trunk, -0.2))
  pc.hline(1, 3, 11, P.trunk)
  pc.hline(10, 12, 11, shade(P.trunk, -0.3))
  pc.ellipse(7, 5, 4.5, 2, P.woodLight)
  pc.ellipse(7, 5, 2.5, 1, P.wood)
  pc.px(7, 5, P.woodLight)
  return pc.outline(P.outline)
}

function log() {
  const pc = new PixelCanvas(24, 11)
  pc.rect(4, 3, 18, 6, P.trunk)
  pc.hline(4, 21, 3, shade(P.trunk, 0.15))
  pc.hline(4, 21, 8, shade(P.trunk, -0.3))
  for (const x of [8, 13, 18]) pc.hline(x, x + 2, 5 + (x % 2), shade(P.trunk, -0.2))
  pc.ellipse(4, 5.5, 2.5, 3, P.woodLight)
  pc.px(4, 5, P.wood)
  pc.px(4, 6, P.wood)
  pc.hline(12, 15, 2, P.moss)
  pc.px(20, 2, P.mushroom[1])
  pc.hline(2, 21, 10, shade(P.trunk, -0.3))
  return pc.outline(P.outline)
}

function sapling() {
  const pc = new PixelCanvas(12, 18)
  pc.vline(6, 8, 16, P.trunk)
  pc.px(5, 16, P.trunk)
  pc.px(7, 16, P.trunk)
  pc.px(7, 11, P.leaf)
  pc.px(8, 10, P.leaf)
  pc.ellipse(6, 5.5, 4.5, 4.5, P.leafDark)
  pc.ellipse(5.5, 5, 3.5, 3.5, P.leaf)
  pc.px(4, 3, P.leafLight)
  pc.px(5, 4, P.leafLight)
  return pc.outline(P.outline)
}

/** Tall scenery. Anchor: bottom centre on the tile's bottom edge. */
export function drawStatic(sprite, variant = 0, opts = {}) {
  if (sprite === 'tree') return tree(variant)
  if (sprite === 'bush') return bush(variant)
  if (sprite === 'rock') return rock(variant)
  if (sprite === 'stump') return stump()
  if (sprite === 'log') return log()
  if (sprite === 'sapling') return sapling()
  if (sprite === 'lamp') {
    const pc = new PixelCanvas(8, 24)
    pc.vline(3, 8, 22, P.metalDark)
    pc.vline(4, 8, 22, P.metal)
    pc.rect(2, 21, 4, 3, P.metalDark)
    pc.rect(1, 2, 6, 6, P.metalDark)
    pc.rect(2, 3, 4, 4, opts.lit ? P.windowLit : P.windowShine)
    pc.hline(0, 7, 1, P.metalDark)
    return pc.outline(P.outline)
  }
  if (sprite === 'arch') {
    const pc = new PixelCanvas(64, 44)
    for (const x0 of [0, 56]) {
      pc.rect(x0, 12, 8, 32, P.stone)
      for (let y = 12; y < 44; y += 4) {
        pc.hline(x0, x0 + 7, y, P.stoneDark)
        pc.vline(x0 + (y % 8 ? 3 : 5), y, y + 3, P.stoneDark)
      }
      pc.vline(x0 + 7, 12, 43, P.stoneDark)
      pc.rect(x0 - 1 + (x0 ? 0 : 1), 10, 8, 2, P.stoneLight)
      for (let y = 16; y < 40; y += 5) {
        pc.px(x0 + (y % 2 ? 1 : 6), y, P.leaf)
        pc.px(x0 + (y % 2 ? 2 : 5), y + 1, P.leafDark)
      }
      pc.px(x0 + 2, 22, P.flower[0])
      pc.px(x0 + 5, 33, P.flower[3])
    }
    pc.rect(0, 4, 64, 6, P.wood)
    pc.hline(0, 63, 4, P.woodLight)
    pc.hline(0, 63, 9, P.woodDark)
    pc.rect(18, 11, 28, 9, P.plaster)
    pc.hline(18, 45, 11, P.woodDark)
    pc.hline(18, 45, 19, P.woodDark)
    pc.vline(18, 11, 19, P.woodDark)
    pc.vline(45, 11, 19, P.woodDark)
    pc.vline(22, 9, 11, P.woodDark)
    pc.vline(41, 9, 11, P.woodDark)
    // "AgentVille" as a row of little letter-strokes: legible as a sign, not as text.
    for (let x = 21; x <= 42; x += 2) pc.vline(x, 14, (x * 7) % 3 ? 16 : 17, P.woodDark)
    return pc.outline(P.outline)
  }
  if (sprite === 'board') {
    // A notice board with `variant` notes pinned to it (0–6), filled left to right, top row first.
    // One pixel of margin all round leaves room for the outline.
    const pc = new PixelCanvas(16, 22)
    pc.rect(3, 14, 2, 7, P.woodDark)
    pc.rect(11, 14, 2, 7, P.woodDark)
    pc.vline(3, 14, 20, P.wood)
    pc.vline(11, 14, 20, P.wood)
    pc.rect(1, 1, 14, 2, P.woodDark)
    pc.hline(1, 14, 1, P.woodLight)
    pc.rect(1, 3, 14, 11, P.woodDark)
    pc.rect(2, 4, 12, 9, P.wood)
    const shown = Math.max(0, Math.min(6, variant))
    for (let i = 0; i < shown; i++) {
      const x = 3 + (i % 3) * 4
      const y = 5 + Math.floor(i / 3) * 4
      pc.rect(x, y, 3, 3, i % 2 ? shade(P.paper, -0.06) : P.paper)
      pc.hline(x, x + 2, y + 2, P.plasterShade)
      pc.px(x + 1, y, P.pin)
    }
    return pc.outline(P.outline)
  }
  return new PixelCanvas(1, 1)
}
