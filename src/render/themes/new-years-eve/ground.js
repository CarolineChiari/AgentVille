// New Year's Eve ground, ways and fences: confetti-strewn pavement, a night lawn, a dance floor
// or fresh snow inside each plot, a slate-violet lane round it, a trodden path across it, and
// fences of bunting, party lights, velvet rope on gilt stanchions and balloons tied to posts.
//
// Contract (see ThemePack in ../index.js and the village's src/render/sprites/tiles.js):
// - `tone` is a plot's yard, an index into THEMES['new-years-eve'].dims.yard (confetti, nightlawn,
//   dancefloor, snow).
// - Ground, trail and road tiles are 16×16 and fully opaque; each variant is its own picture.
// - A fence's `style` indexes dims.fence; `mask` which sides carry on (1 N, 2 E, 4 S, 8 W). A
//   straight run meets the next tile's edge to edge, so nothing a run draws may differ in shape
//   between its first column and its last. Every pattern below therefore has a period of 5, which
//   divides 15, the only way column 0 and column 15 agree.
// - `patches(tone)` is [plain, sunny, lush]: the ground's plain colours, and what each becomes
//   where it has dried out and where it grows lush. Only pixels exactly a plain colour change.
// - `partyCover` is pure: the same tile always has the same thing lying on it, or nothing.
import { PALETTE as P } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { mulberry32 } from '../../../sim/rng.js'
import { fbm, lattice } from '../../../sim/noise.js'

const T = 16
const PAVEMENT = 0
const LAWN = 1
const DANCE = 2

const toneOf = (tone) => (tone || 0) % P.nyeGround.length
/** A ground's colours: base, shade, light, deepest. All four are its plain colours. */
const groundOf = (tone) => P.nyeGround[toneOf(tone)]
const BULBS = P.nyeBulb

/** How many looks each thing lying about has; drawn as `deco.<kind>.<variant>`. */
export const COVER_VARIANTS = { confettidrift: 2, streamercurl: 2, sparklerstick: 2, poppedballoon: 2, partyhatdrop: 1 }
/** The lip drawn where the lane meets anything else. */
export const ROAD_EDGE = P.nyeLaneEdge
/** What the celebration's field is edged in: a strip of dark violet. */
export const BED_EDGE = P.nyeBedDeep

// ---------- the ground ----------

/** Seeds per kind of tile, so a path and a ground of the same variant don't share a scatter. */
const SEED = { ground: 81, trail: 82, road: 83 }

function scatter(rand, n, draw) {
  for (let i = 0; i < n; i++) draw(Math.floor(rand() * T), Math.floor(rand() * T))
}

/** A tuft of night grass: three blades. */
function tuft(pc, x, y, c, dark) {
  pc.px(x, y, dark)
  pc.px(x + 1, y - 1, c)
  pc.px(x + 1, y, dark)
  pc.px(x + 2, y, c)
}

/** One scrap of confetti: a pixel or two in one of the party colours. */
function scrap(pc, x, y, i) {
  const c = BULBS[Math.abs(i) % BULBS.length]
  pc.px(x, y, c)
  if (i % 3 === 0) pc.px(x + 1, y + 1, c)
}

/** The ground itself, before anything is found in it. */
function texture(pc, rand, t) {
  const [base, dark, light, deep] = P.nyeGround[t]
  pc.rect(0, 0, T, T, base)
  if (t === PAVEMENT) {
    // Dark flagged pavement with a night's worth of confetti trodden into it.
    scatter(rand, 14, (x, y) => pc.px(x, y, dark))
    scatter(rand, 8, (x, y) => pc.px(x, y, light))
    scatter(rand, 4, (x, y) => pc.px(x, y, deep))
    let i = 0
    scatter(rand, 9, (x, y) => scrap(pc, x, y, i++))
  } else if (t === LAWN) {
    // A lawn after dark: tufts everywhere, a scrap of confetti blown across it.
    scatter(rand, 14, (x, y) => tuft(pc, x, y, light, dark))
    scatter(rand, 5, (x, y) => pc.px(x, y, deep))
    scatter(rand, 3, (x, y) => scrap(pc, x, y, x + y))
  } else if (t === DANCE) {
    // A dance floor: squares eight pixels across in two violets, each lit along its top and left
    // edge and dark along the bottom and right, with the odd bright fleck from the lights above.
    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        const odd = ((x >> 3) + (y >> 3)) & 1
        const u = x % 8
        const v = y % 8
        pc.px(x, y, v === 7 || u === 7 ? deep : v === 0 || u === 0 ? light : odd ? dark : base)
      }
    }
    scatter(rand, 3, (x, y) => pc.px(x, y, BULBS[(x + y) % BULBS.length]))
  } else {
    // Fresh snow: drifts in the shade, sparkle on top, a few footprints' hollows.
    scatter(rand, 12, (x, y) => pc.hline(x, x + 1, y, dark))
    scatter(rand, 12, (x, y) => pc.px(x, y, light))
    scatter(rand, 4, (x, y) => pc.px(x, y, deep))
    scatter(rand, 2, (x, y) => scrap(pc, x, y, x))
  }
}

/** What a rare tile has in it: variants 3, 4 and 5 of each ground. */
function find(pc, rand, t, variant) {
  const [, dark] = P.nyeGround[t]
  const x = 4 + Math.floor(rand() * 6)
  const y = 4 + Math.floor(rand() * 6)
  const k = variant - 3
  if (k === 0) {
    // A heap of confetti swept up against the kerb.
    pc.ellipse(x, y, 4.5, 2.5, dark)
    for (let i = 0; i < 12; i++) scrap(pc, x - 4 + ((i * 3) % 8), y - 2 + ((i * 5) % 4), i + t)
  } else if (k === 1) {
    // A spent sparkler, burnt black down its wire.
    pc.line(x - 3, y + 3, x + 3, y - 2, P.nyeWand)
    pc.line(x - 3, y + 4, x + 3, y - 1, P.nyeWandDark)
    pc.px(x + 4, y - 3, P.nyeSpark[2])
  } else {
    // A streamer, unrolled across the ground in a wave.
    for (let i = -5; i <= 5; i++) pc.px(x + i, y + Math.round(Math.sin(i * 0.8) * 2), BULBS[(i + 5) % 2 ? 0 : 2])
  }
}

/**
 * A plot's ground. Variants 0–2 are plain and carry the ground; 3–5 are rare (see TILE_WEIGHTS in
 * the village's tiles) and each holds something the party has left there.
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
 * The celebration's field, where the village has its flower bed: dark violet soil in rows, a
 * hollow for every spot a sparkler stands in. The hollows are on the village's grid, 8 px apart:
 * variant 0 is the field's top row, variant 1 every row below it, which carries the grid on from
 * the row above (see the village's `bed` tile). Its soil is its own, not the plot's ground, so a
 * sparkler's glow reads against it whatever the plot is laid in.
 */
export function drawBed(variant) {
  const pc = new PixelCanvas(T, T)
  pc.rect(0, 0, T, T, P.nyeBed)
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const s = y % 4
      if (s === 1) pc.px(x, y, (x * 5 + y) % 7 ? P.nyeBedLight : P.nyeBed)
      else if (s === 3) pc.px(x, y, P.nyeBedDark)
    }
  }
  for (const y0 of variant ? [-4, 4] : [4]) {
    for (const x0 of [0, 8]) {
      pc.hline(x0 + 3, x0 + 5, y0 + 6, P.nyeBedDeep)
      pc.px(x0 + 4, y0 + 5, P.nyeBedDeep)
      // A scrap of confetti by each hollow.
      pc.px(x0 + 2, y0 + 5, BULBS[(x0 + y0 + 8) % BULBS.length])
      pc.px(x0 + 6, y0 + 5, BULBS[(x0 + y0 + 11) % BULBS.length])
    }
  }
  if (!variant) {
    // The top row is where the field starts: a string of lights along it on two pegs.
    pc.hline(0, T - 1, 1, P.nyeWire)
    for (let x = 1; x < T; x += 3) pc.px(x, 2, BULBS[(x / 3 | 0) % BULBS.length])
    pc.px(1, 0, P.nyeWand)
    pc.px(14, 0, P.nyeWand)
  }
  return pc
}

// ---------- the path across a plot ----------

/** Where the path runs across its tile: 8 px wide, down the middle, so arms meet their neighbours'. */
const LO = 4
const HI = 11

/**
 * A path across the plot: slate-violet lane 8 px wide down the middle of the tile, an arm out of
 * each linked side to its edge, and the ground's own edge ragged either side.
 */
export function drawTrail(variant, links, tone) {
  const t = toneOf(tone)
  const g = P.nyeGround[t]
  const pc = new PixelCanvas(T, T)
  const rand = mulberry32(variant * 149 + links * 19 + t * 6151 + SEED.trail)
  texture(pc, rand, t)
  const N = links & 1
  const E = links & 2
  const S = links & 4
  const W = links & 8
  const down = N || S
  const across = E || W || !down
  const lane = (x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const n = (x * 7 + y * 13 + variant * 3) % 11
        pc.px(x, y, n === 0 ? P.nyeLaneDark : n === 5 ? P.nyeLaneLight : P.nyeLane)
      }
    }
  }
  const dy0 = N ? 0 : LO
  const dy1 = S ? T - 1 : HI
  const ax0 = W ? 0 : LO
  const ax1 = E ? T - 1 : HI
  if (down) lane(LO, dy0, HI, dy1)
  if (across) lane(ax0, LO, ax1, HI)
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
  if (variant === 1) pc.hline(6, 8, 9, BULBS[1])
  else if (variant === 2) scrap(pc, 7, 7, 3)
  else if (variant === 3) {
    pc.px(6, 8, P.nyeLaneEdge)
    pc.px(7, 9, P.nyeLaneEdge)
  }
  return pc
}

// ---------- the lane round a plot ----------

/**
 * The lane round a plot: slate-violet asphalt with silver grit on a scatter rather than a grid, so
 * the lane reads as one surface running on. Variants 0–2 are plain; 3 has a puddle in it, 4 a
 * streamer blown across it, 5 a drift of confetti.
 */
export function drawRoad(variant) {
  const pc = new PixelCanvas(T, T)
  const rand = mulberry32(variant * 149 + SEED.road * 6151)
  pc.rect(0, 0, T, T, P.nyeLane)
  scatter(rand, 22, (x, y) => pc.px(x, y, P.nyeLaneDark))
  scatter(rand, 16, (x, y) => pc.px(x, y, P.nyeLaneLight))
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(rand() * 15)
    const y = Math.floor(rand() * 15)
    pc.px(x, y, P.nyePaint[7])
    pc.px(x, y + 1, P.nyeLaneEdge)
  }
  if (variant === 3) {
    pc.ellipse(8, 8, 5.5, 2.5, P.water)
    pc.ellipse(7, 7.5, 3.5, 1.2, P.waterLight)
    pc.hline(4, 12, 11, P.nyeLaneEdge)
    pc.px(10, 8, BULBS[0])
  } else if (variant === 4) {
    for (let i = 0; i < 4; i++) {
      const x = Math.floor(rand() * 8)
      const y = Math.floor(rand() * 14)
      for (let k = 0; k < 7; k++) pc.px(x + k, y + Math.round(Math.sin(k * 0.9) * 1.5), BULBS[i % BULBS.length])
    }
  } else if (variant === 5) {
    for (let i = 0; i < 12; i++) scrap(pc, Math.floor(rand() * 14), Math.floor(rand() * 14), i)
  }
  return pc
}

// ---------- fences ----------

/** A pole down a column, from y0 to y1, two pixels wide. */
function pole(pc, x, y0, y1, face = P.nyeWand, dark = P.nyeWandDark) {
  pc.vline(x, y0, y1, face)
  pc.vline(x + 1, y0, y1, dark)
}

/** A balloon centred on (cx, cy), with its string down to y. */
function balloon(pc, cx, cy, c, y = cy + 5) {
  pc.ellipse(cx + 0.5, cy + 0.5, 2.3, 3, c)
  pc.px(cx - 1, cy - 1, P.nyeSpark[0])
  pc.px(cx, cy + 3, P.nyeWandDark)
  pc.vline(cx, cy + 4, y, P.nyeFuse)
}

/**
 * Each style draws a run across the tile (x from a to b, at the fence's height), a run down it
 * (y from a to b), and the post that stands at a corner or the end of a run.
 */
const FENCE_DRAW = {
  // Bunting: a pole every fifth column with a string between, and a pennant in each fifth.
  bunting: {
    across(pc, a, b) {
      for (let x = a; x <= b; x++) {
        const u = x % 5
        if (u === 0) {
          pole(pc, x, 4, 15)
          pc.px(x, 4, P.gilt)
          continue
        }
        pc.px(x, 5, P.nyeWire)
        const c = P.nyePaint[[0, 1, 2, 5, 3][(x / 5 | 0) % 5]]
        // A pennant hangs from the string: three wide at the top, one at the point.
        const drop = u === 2 ? 3 : u === 1 || u === 3 ? 2 : 0
        if (u < 4) {
          pc.px(x, 6, c)
          if (drop >= 2) pc.px(x, 7, c)
          if (drop >= 3) pc.px(x, 8, c)
        }
      }
    },
    down(pc, a, b) {
      pole(pc, 7, a, b)
      for (let y = a; y <= b; y++) if (y % 5 === 2) {
        pc.px(9, y, P.nyePaint[(y / 5 | 0) % 4 ? 0 : 1])
        pc.px(10, y, P.nyePaint[(y / 5 | 0) % 4 ? 0 : 1])
      }
    },
    post(pc) {
      pole(pc, 7, 3, 15)
      pc.px(7, 3, P.gilt)
      pc.hline(8, 11, 4, P.nyePaint[0])
      pc.hline(8, 10, 5, P.nyePaint[1])
      pc.hline(8, 9, 6, P.nyePaint[2])
      return pc
    },
  },
  // String lights: a pole every fifth column, the wire sagging between and a bulb hung in each sag.
  lights: {
    across(pc, a, b) {
      for (let x = a; x <= b; x++) {
        const u = x % 5
        if (u === 0) {
          pole(pc, x, 4, 15)
          pc.px(x, 5, BULBS[(x / 5 | 0) % BULBS.length])
          continue
        }
        pc.px(x, u === 2 ? 8 : u === 1 || u === 3 ? 7 : 6, P.nyeWire)
        if (u === 2) {
          pc.px(x, 9, BULBS[(x / 5 | 0) % BULBS.length])
          pc.px(x, 10, BULBS[((x / 5 | 0) + 2) % BULBS.length])
        }
      }
    },
    down(pc, a, b) {
      pole(pc, 7, a, b)
      for (let y = a; y <= b; y++) if (y % 5 === 2) pc.px(9, y, BULBS[(y / 5 | 0) % BULBS.length])
    },
    post(pc) {
      pole(pc, 7, 3, 15)
      pc.px(7, 3, BULBS[1])
      pc.px(8, 3, BULBS[0])
      pc.px(6, 4, BULBS[2])
      pc.px(9, 4, BULBS[3])
      return pc
    },
  },
  // Velvet rope on gilt stanchions: a post every fifth column topped with a ball, the rope in a
  // magenta swag between.
  velvetrope: {
    across(pc, a, b) {
      for (let x = a; x <= b; x++) {
        const u = x % 5
        if (u === 0) {
          pc.rect(x, 5, 2, 10, P.gilt)
          pc.vline(x + 1, 5, 14, P.giltDark)
          pc.hline(x - 1, x + 2, 15, P.giltDark)
          pc.rect(x, 3, 2, 2, P.gilt)
          pc.px(x, 3, P.nyeSpark[0])
          continue
        }
        const sag = u === 2 || u === 3 ? 3 : 2
        pc.px(x, 5 + sag, P.nyePaint[0])
        pc.px(x, 6 + sag, shade2(P.nyePaint[0]))
      }
    },
    down(pc, a, b) {
      pc.vline(6, a, b, P.nyePaint[0])
      pc.vline(7, a, b, shade2(P.nyePaint[0]))
      for (let y = a; y <= b; y++) if (y % 5 === 0) pc.hline(5, 8, y, P.gilt)
    },
    post(pc) {
      pc.rect(6, 5, 2, 10, P.gilt)
      pc.vline(7, 5, 14, P.giltDark)
      pc.hline(5, 8, 15, P.giltDark)
      pc.rect(6, 3, 2, 2, P.gilt)
      pc.px(6, 3, P.nyeSpark[0])
      return pc
    },
  },
  // Balloons: a thin pole every fifth column with a balloon tied to its top.
  balloons: {
    across(pc, a, b) {
      pc.hline(a, b, 11, P.nyeFuse)
      for (let x = a; x <= b; x++) {
        if (x % 5 !== 0) continue
        pc.vline(x, 8, 15, P.nyeWand)
        balloon(pc, x + 1, 4, P.nyePaint[[0, 2, 1, 5, 3][(x / 5 | 0) % 5]], 8)
      }
    },
    down(pc, a, b) {
      pc.vline(7, a, b, P.nyeWand)
      for (let y = a; y <= b; y++) if (y % 5 === 0) pc.px(8, y, BULBS[(y / 5 | 0) % BULBS.length])
    },
    post(pc) {
      pc.vline(7, 8, 15, P.nyeWand)
      balloon(pc, 5, 4, P.nyePaint[0], 8)
      balloon(pc, 9, 3, P.nyePaint[2], 8)
      return pc
    },
  },
}
const STYLES = ['bunting', 'lights', 'velvetrope', 'balloons']
/** The shaded side of a colour already in the palette: velvet in shadow. */
const shade2 = (c) => (c === P.nyePaint[0] ? P.nyePaint[3] : c)

/**
 * A plot's fence, one tile of it. A run reaches the edge of the tile on a linked side and stops
 * in the middle otherwise, so it ends in a post at a gap and turns a proper corner.
 */
export function drawFence(style, mask) {
  const pc = new PixelCanvas(T, T)
  const f = FENCE_DRAW[STYLES[style]] || FENCE_DRAW.lights
  const across = mask & (2 | 8)
  const down = mask & (1 | 4)
  if (across) f.across(pc, mask & 8 ? 0 : 7, mask & 2 ? T - 1 : 8)
  if (down) f.down(pc, mask & 1 ? 0 : 7, mask & 4 ? T - 1 : 8)
  const straight = mask === (2 | 8) || mask === (1 | 4)
  if (!straight) f.post(pc)
  return pc
}

/**
 * What lies at a fence's foot where nobody sweeps: tufts of grass, a scrap or two of confetti.
 * `mask` as the fence's (1 N, 2 E, 4 S, 8 W). The grass is drawn in the ground's own colours, so
 * the patches tint it along with the ground round it.
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
  const across = mask & (2 | 8)
  const down = mask & (1 | 4)
  if (across) {
    const x0 = mask & 8 ? 0 : 4
    const x1 = mask & 2 ? T - 3 : 10
    long(x0 + 1 + Math.floor(rand() * 2), 15)
    for (let x = x0 + 3; x <= x1; x += 3) {
      const r = rand()
      if (r < 0.45) long(x, 15)
      else if (r < 0.8) scrap(pc, x, 14, x)
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
    if (right) scrap(pc, 12, mask & 4 ? 14 : 10, 1)
    else if (left) scrap(pc, 2, mask & 4 ? 14 : 10, 2)
  }
  if (!across && !down) {
    long(3, 15)
    scrap(pc, 9, 14, 4)
    scrap(pc, 6, 13, 2)
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
  if (kind === 'confettidrift') {
    const n = variant ? 18 : 10
    for (let i = 0; i < n; i++) scrap(pc, 2 + ((i * 5) % 11), 4 + ((i * 7) % 9), i)
    return pc
  }
  if (kind === 'streamercurl') {
    // A streamer fallen in loose waves, one colour or two.
    const rows = variant ? [5, 10] : [8]
    rows.forEach((y, r) => {
      for (let i = 1; i < 15; i++) pc.px(i, y + Math.round(Math.sin(i * 0.7 + r) * 2), BULBS[(r * 2 + (i > 7 ? 1 : 0)) % BULBS.length])
    })
    return pc
  }
  if (kind === 'sparklerstick') {
    // Burnt-out sparklers left where they were waved, a pale wire with a black end.
    const n = variant ? 3 : 1
    for (let i = 0; i < n; i++) {
      const y = 4 + i * 4
      pc.line(2 + i, y + 4, 12 + i, y - 1, P.nyeWand)
      pc.px(2 + i, y + 4, P.nyeWandDark)
      pc.px(3 + i, y + 4, P.nyeWandDark)
    }
    return dropShadow(pc)
  }
  if (kind === 'poppedballoon') {
    // A burst balloon: a limp scrap of rubber, its knot and a trailing string.
    const c = BULBS[variant ? 0 : 2]
    pc.hline(5, 10, 9, c)
    pc.hline(6, 9, 10, c)
    pc.px(7, 8, c)
    pc.px(11, 11, c)
    pc.px(12, 12, P.nyeFuse)
    pc.line(10, 10, 13, 12, P.nyeFuse)
    return dropShadow(pc)
  }
  // partyhatdrop: a paper cone knocked off in the dancing.
  pc.line(4, 11, 11, 8, P.nyePaint[1])
  pc.line(4, 12, 11, 9, P.nyePaint[0])
  pc.line(4, 10, 11, 7, P.nyePaint[0])
  pc.px(12, 8, P.nyeSpark[0])
  pc.px(3, 11, P.nyeSpark[0])
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
/** What gathers in a drift, by ground: confetti on the pavement, streamers on the floor. */
const WORK = ['confettidrift', 'streamercurl', 'streamercurl', 'confettidrift']
/** And what lies loose everywhere between the drifts. */
const LOOSE = ['sparklerstick', 'poppedballoon', 'sparklerstick', 'poppedballoon']
/** The odd thing, anywhere, by ground. */
const ODDS = [
  ['partyhatdrop', 'poppedballoon', 'streamercurl', 'sparklerstick'],
  ['partyhatdrop', 'sparklerstick', 'confettidrift', 'poppedballoon'],
  ['poppedballoon', 'partyhatdrop', 'confettidrift', 'sparklerstick'],
  ['confettidrift', 'partyhatdrop', 'sparklerstick', 'streamercurl'],
]
const ODD_SHARE = 0.03

/** What lies on the plot ground tile (tx, ty), if anything: `{ kind, variant }`, or null. */
export function partyCover(tx, ty, tone) {
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
  return [P.nyeGround[t], P.nyeGroundSunny[t], P.nyeGroundLush[t]]
}
