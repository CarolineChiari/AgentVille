// Labor Day ground, ways and fences: a picnic green, a mown meadow, the packed gravel of a builders'
// yard or parade-route cobbles inside each plot, a cobbled street round it, a trodden path across it,
// and fences of banner poles, sawhorses, bunting rails and stacked crates.
//
// Contract (see ThemePack in ../index.js and the village's src/render/sprites/tiles.js):
// - `tone` is a plot's yard, an index into THEMES['labor-day'].dims.yard (picnic, meadow, gravel,
//   cobbles).
// - Ground, trail and road tiles are 16×16 and fully opaque; each variant is its own picture.
// - A fence's `style` indexes THEMES['labor-day'].dims.fence; `mask` which sides carry on (1 N,
//   2 E, 4 S, 8 W). A straight run meets the next tile's edge to edge, so nothing a run draws may
//   differ in shape between its first column and its last. Every pattern below therefore has a
//   period that divides 15 — 3 or 5 — which is the only way column 0 and column 15 agree.
// - `patches(tone)` is [plain, sunny, lush]: the ground's plain colours, and what each becomes
//   where it has dried out and where it grows lush. Only pixels exactly a plain colour change.
// - `laborCover` is pure: the same tile always has the same thing lying on it, or nothing.
import { PALETTE as P } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { mulberry32 } from '../../../sim/rng.js'
import { fbm, lattice } from '../../../sim/noise.js'

const T = 16
const PICNIC = 0
const MEADOW = 1
const GRAVEL = 2

const toneOf = (tone) => (tone || 0) % P.laborGround.length
/** A ground's colours: base, shade, light, deepest. All four are its plain colours. */
const groundOf = (tone) => P.laborGround[toneOf(tone)]
/** What gets dropped on everything: wood chips, a crumb of bread, clover blossom, a scrap of gingham. */
const FALL = [P.laborChipsLight, P.laborBanner[3], P.laborBanner[4], P.laborGingham]

/** How many looks each thing lying about has; drawn as `deco.<kind>.<variant>`. */
export const COVER_VARIANTS = { gingham: 2, sawdust: 2, offcuts: 2, crumbs: 2, ribbon: 1, pail: 2 }
/** The lip drawn where the lane meets anything else: the kerb of its cobbles. */
export const ROAD_EDGE = P.laborLaneEdge
/** What the tool bench is edged in: the boards that hold its chips in. */
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

/** One bit of what the day leaves about: two pixels, in whichever colour. */
function fallen(pc, x, y, i) {
  const c = FALL[i % FALL.length]
  pc.px(x, y, c)
  pc.px(x + 1, y + (i & 1), c)
}

/** The ground itself, before anything is found in it. */
function texture(pc, rand, t) {
  const [base, dark, light, deep] = P.laborGround[t]
  pc.rect(0, 0, T, T, base)
  if (t === PICNIC) {
    // A green well trodden by picnickers: clover and a few blossoms among the blades.
    scatter(rand, 14, (x, y) => pc.px(x, y, dark))
    scatter(rand, 10, (x, y) => pc.px(x, y, light))
    scatter(rand, 4, (x, y) => pc.px(x, y, deep))
    scatter(rand, 3, (x, y) => pc.px(x, y, P.laborBanner[4]))
    scatter(rand, 2, (x, y) => pc.px(x, y, P.laborBanner[3]))
  } else if (t === MEADOW) {
    // A meadow mown in broad stripes, with the odd tuft left.
    for (let y = 0; y < T; y++) if (y % 8 < 4) pc.hline(0, T - 1, y, dark)
    scatter(rand, 9, (x, y) => tuft(pc, x, y, light, dark))
    scatter(rand, 5, (x, y) => pc.px(x, y, deep))
    scatter(rand, 2, (x, y) => fallen(pc, x, y, x + y))
  } else if (t === GRAVEL) {
    // The packed gravel of a builders' yard: a grit of pebbles, a sheen of sawdust.
    scatter(rand, 26, (x, y) => pc.px(x, y, dark))
    scatter(rand, 18, (x, y) => pc.px(x, y, light))
    scatter(rand, 8, (x, y) => {
      pc.px(x, y, deep)
      pc.px(x + 1, y, dark)
    })
    scatter(rand, 4, (x, y) => pc.px(x, y, P.laborChipsLight))
  } else {
    // Parade-route cobbles: rounded stones in staggered courses, the joints dark between them.
    for (let y = 0; y < T; y++) {
      const row = y >> 2
      for (let x = 0; x < T; x++) {
        const u = (x + row * 3) % 5
        if (y % 4 === 3 || u === 4) pc.px(x, y, deep)
        else if (y % 4 === 0 || u === 0) pc.px(x, y, light)
      }
    }
    scatter(rand, 10, (x, y) => pc.px(x, y, dark))
    scatter(rand, 2, (x, y) => fallen(pc, x, y, x + y))
  }
}

/** What a rare tile has in it: variants 3, 4 and 5 of each ground. */
function find(pc, rand, t, variant) {
  const [, dark] = P.laborGround[t]
  const x = 4 + Math.floor(rand() * 6)
  const y = 4 + Math.floor(rand() * 6)
  const k = variant - 3
  if (k === 0) {
    // A drift of wood shavings swept against the kerb, the pale curls on top.
    pc.ellipse(x, y, 4.5, 2.5, dark)
    for (let i = 0; i < 9; i++) {
      const c = i % 2 ? P.laborChipsLight : P.laborChips
      pc.hline(x - 4 + ((i * 3) % 8), y - 2 + ((i * 5) % 4), x - 3 + ((i * 3) % 8), c)
    }
  } else if (k === 1) {
    // A few dropped nails and a bolt: dark shafts with a bright head.
    for (const [dx, dy] of [[0, 0], [3, 1], [-2, 2]]) {
      pc.hline(x + dx, x + dx + 2, y + dy, P.laborSteelDark)
      pc.px(x + dx + 3, y + dy, P.laborSteel)
    }
    pc.px(x - 3, y - 2, P.laborBrass)
  } else {
    // What lunch left: a folded napkin with a red stripe and a few crumbs of bread.
    pc.rect(x - 3, y, 5, 4, P.laborBanner[4])
    pc.hline(x - 3, x + 1, y + 1, P.laborGingham)
    for (let i = 0; i < 5; i++) pc.px(x + 3 + (i % 3), y - 1 + ((i * 2) % 5), P.crustLight)
  }
}

/**
 * A plot's ground. Variants 0–2 are plain and carry the ground; 3–5 are rare (see TILE_WEIGHTS in
 * the village's tiles) and each holds something the day has left there.
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
 * The tool bench, where the village has its flower bed: wood chips swept into rows, a
 * peg hole bored for every spot a tool stands on. The hollows are on the village's grid, 8 px
 * apart: variant 0 is the patch's top row, variant 1 every row below it, which carries the grid on
 * from the row above (see the village's `bed` tile). Its soil is its own, not the plot's ground,
 * so a tool reads against it whatever the plot is laid in.
 */
export function drawBed(variant) {
  const pc = new PixelCanvas(T, T)
  pc.rect(0, 0, T, T, P.laborChips)
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const s = y % 4
      if (s === 1) pc.px(x, y, (x * 5 + y) % 7 ? P.laborChipsLight : P.laborChips)
      else if (s === 3) pc.px(x, y, P.laborChipsDark)
    }
  }
  for (const y0 of variant ? [-4, 4] : [4]) {
    for (const x0 of [0, 8]) {
      pc.hline(x0 + 3, x0 + 5, y0 + 6, P.laborChipsDeep)
      pc.px(x0 + 4, y0 + 5, P.laborChipsDeep)
      // Shavings curled round the hole.
      pc.px(x0 + 2, y0 + 5, P.laborChipsLight)
      pc.px(x0 + 6, y0 + 5, P.laborChipsDark)
    }
  }
  if (!variant) {
    // The top row is where the bench starts: a chalk line snapped along it between two pegs.
    pc.hline(0, T - 1, 1, P.laborBannerDark)
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
  const g = P.laborGround[t]
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
        pc.px(x, y, n === 0 ? P.laborLaneDark : n === 5 ? P.laborLaneLight : P.laborLane)
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
  if (variant === 1) pc.hline(6, 8, 9, P.laborChipsLight)
  else if (variant === 2) fallen(pc, 7, 7, 1)
  else if (variant === 3) {
    pc.px(6, 8, P.laborLaneEdge)
    pc.px(7, 9, P.laborLaneEdge)
  }
  return pc
}

// ---------- the lane round a plot ----------

/**
 * The street round a plot: warm cobble, grit and small stones in a pale binding, the stones on a
 * scatter rather than a grid so the lane reads as one surface running on. Variants 0–2 are plain;
 * 3 has a puddle in it, 4 sawdust blown across it, 5 a scatter of dropped ribbon and crumbs.
 */
export function drawRoad(variant) {
  const pc = new PixelCanvas(T, T)
  const rand = mulberry32(variant * 149 + SEED.road * 6151)
  pc.rect(0, 0, T, T, P.laborLane)
  scatter(rand, 22, (x, y) => pc.px(x, y, P.laborLaneDark))
  scatter(rand, 16, (x, y) => pc.px(x, y, P.laborLaneLight))
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(rand() * 15)
    const y = Math.floor(rand() * 15)
    pc.px(x, y, P.fieldstoneLight)
    pc.px(x, y + 1, P.laborLaneEdge)
    pc.px(x + 1, y, P.fieldstone)
  }
  if (variant === 3) {
    pc.ellipse(8, 8, 5.5, 2.5, P.water)
    pc.ellipse(7, 7.5, 3.5, 1.2, P.waterLight)
    pc.hline(4, 12, 11, P.laborLaneEdge)
  } else if (variant === 4) {
    for (let i = 0; i < 6; i++) {
      const x = Math.floor(rand() * 12)
      const y = Math.floor(rand() * 14)
      pc.hline(x, x + 3, y, i % 2 ? P.laborChips : P.laborChipsLight)
      pc.px(x + 1, y + 1, P.laborChipsDark)
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

/** The plain colours a banner, a pennant or a crate's paint goes through, by index. */
const CLOTH = P.laborBanner.slice(0, 4)
const clothOf = (i) => CLOTH[Math.abs(i) % CLOTH.length]

/**
 * Each style draws a run across the tile (x from a to b, at the fence's height), a run down it
 * (y from a to b), and the post that stands at a corner or the end of a run.
 */
const FENCE_DRAW = {
  // Banner poles: a pole every fifth column, a crossbar between them and a plain cloth banner
  // hanging from it, swallow-tailed, one stripe of cream across. No emblem on it: the colour is all.
  bannerposts: {
    across(pc, a, b) {
      pc.hline(a, b, 3, P.barnTimberLight)
      pc.hline(a, b, 4, P.barnTimberDark)
      for (let x = a; x <= b; x++) {
        const u = x % 5
        const c = clothOf(Math.floor(x / 5))
        if (u === 0) post(pc, x, 2, 15)
        else if (u >= 2) {
          // Cloth from the bar down; the middle of its lower edge cut away.
          const bottom = u === 3 ? 10 : 12
          pc.vline(x, 5, bottom, c)
          pc.px(x, 5, P.laborBannerLight)
          pc.px(x, 8, P.laborBanner[4])
          pc.px(x, bottom, P.laborBannerDark)
        }
      }
    },
    down(pc, a, b) {
      pc.vline(6, a, b, P.barnTimberLight)
      pc.vline(7, a, b, P.barnTimber)
      pc.vline(9, a, b, P.laborBanner[1])
      pc.vline(10, a, b, P.laborRedDark)
      for (let y = a; y <= b; y++) if (y % 5 === 0) pc.hline(5, 10, y, P.laborBanner[0])
    },
    post(pc) {
      pc.rect(6, 3, 4, 13, P.barnTimber)
      pc.vline(6, 3, 15, P.barnTimberLight)
      pc.vline(9, 3, 15, P.barnTimberDark)
      pc.hline(6, 9, 3, P.barnTimberLight)
      pc.rect(10, 3, 3, 6, P.laborBanner[0])
      pc.hline(10, 12, 5, P.laborBanner[4])
      pc.px(11, 9, P.laborBannerDark)
      return pc
    },
  },
  // Sawhorses: a plank on trestle legs, striped mustard and charcoal on the slant (period five).
  sawhorses: {
    across(pc, a, b) {
      for (let x = a; x <= b; x++) {
        const u = x % 5
        for (let y = 6; y <= 9; y++) pc.px(x, y, (x + y) % 5 < 2 ? P.laborBanner[3] : P.laborPaint[5])
        pc.px(x, 5, P.barnTimberLight)
        pc.px(x, 10, P.barnTimberDark)
        if (u === 0) pc.vline(x, 11, 15, P.barnTimber)
        else if (u === 1) pc.vline(x, 11, 15, P.barnTimberDark)
        if (u === 0 || u === 1) pc.px(x, 11, P.farmIron)
      }
    },
    down(pc, a, b) {
      for (let y = a; y <= b; y++) {
        for (let x = 6; x <= 9; x++) pc.px(x, y, (x + y) % 5 < 2 ? P.laborBanner[3] : P.laborPaint[5])
        pc.px(5, y, P.barnTimberLight)
        pc.px(10, y, P.barnTimberDark)
        if (y % 5 === 0) pc.hline(4, 11, y, P.barnTimberDark)
      }
    },
    post(pc) {
      pc.rect(5, 4, 6, 12, P.barnTimber)
      pc.vline(5, 4, 15, P.barnTimberLight)
      pc.vline(10, 4, 15, P.barnTimberDark)
      pc.rect(6, 5, 4, 3, P.laborBanner[3])
      pc.hline(6, 9, 6, P.laborPaint[5])
      pc.hline(5, 10, 4, P.barnTimberLight)
      return pc
    },
  },
  // Bunting: two rails on stakes with plain pennants swagged along the top one, navy, red, green and gold in turn.
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
        // A pennant hanging from the rail every fifth column.
        if (x % 5 === 2) {
          const c = clothOf(Math.floor(x / 5))
          pc.hline(x - 1, x + 1, 6, c)
          pc.hline(x - 1, x + 1, 5, c)
          pc.px(x, 4, c)
          pc.px(x, 3, c)
        }
      }
    },
    down(pc, a, b) {
      pc.vline(6, a, b, P.barnTimberLight)
      pc.vline(7, a, b, P.barnTimber)
      pc.vline(8, a, b, P.barnTimberDark)
      for (let y = a; y <= b; y++) if (y % 5 === 0) pc.hline(5, 9, y, clothOf(y / 5))
    },
    post(pc) {
      pc.rect(6, 3, 4, 13, P.barnTimber)
      pc.vline(6, 3, 15, P.barnTimberLight)
      pc.vline(9, 3, 15, P.barnTimberDark)
      pc.hline(6, 9, 3, P.barnTimberLight)
      pc.hline(10, 12, 5, P.laborBanner[1])
      pc.hline(10, 12, 6, P.laborBanner[0])
      pc.px(11, 7, P.laborBanner[0])
      return pc
    },
  },
  // Stacked crates: two courses of slatted boxes laid like bricks, each crate five wide, so they meet edge to edge.
  crates: {
    across(pc, a, b) {
      for (let row = 0; row < 2; row++) {
        const y = 4 + row * 5
        for (let x = a; x <= b; x++) {
          const u = (x + row * 2) % 5
          pc.px(x, y, P.barnTimberLight)
          pc.px(x, y + 1, u === 0 ? P.barnTimberDark : P.barnTimber)
          pc.px(x, y + 2, u === 0 ? P.barnTimberDark : P.barnTimberLight)
          pc.px(x, y + 3, u === 0 ? P.barnTimberDark : P.barnTimber)
          pc.px(x, y + 4, P.barnTimberDark)
          // The paint-stamped batch mark on every crate's middle slat.
          if (u === 2) pc.px(x, y + 2, clothOf(Math.floor((x + row * 2) / 5) + row))
        }
      }
    },
    down(pc, a, b) {
      for (let y = a; y <= b; y++) {
        const u = y % 5
        pc.px(5, y, P.barnTimberLight)
        pc.px(6, y, u === 0 ? P.barnTimberDark : P.barnTimber)
        pc.px(7, y, u === 0 ? P.barnTimberDark : P.barnTimberLight)
        pc.px(8, y, u === 0 ? P.barnTimberDark : P.barnTimber)
        pc.px(9, y, P.barnTimberDark)
        if (u === 2) pc.px(7, y, clothOf(Math.floor(y / 5)))
      }
    },
    post(pc) {
      pc.rect(5, 4, 6, 11, P.barnTimber)
      pc.hline(5, 10, 4, P.barnTimberLight)
      pc.hline(5, 10, 14, P.barnTimberDark)
      pc.vline(10, 4, 14, P.barnTimberDark)
      pc.hline(5, 10, 9, P.barnTimberDark)
      pc.px(7, 7, P.laborBanner[3])
      return pc
    },
  },
}
const STYLES = ['bannerposts', 'sawhorses', 'bunting', 'crates']

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
 * What lies at a fence's foot where the mower doesn't reach: dry grass, a clover vine, a crumb of
 * bread. `mask` as the fence's (1 N, 2 E, 4 S, 8 W). The grass is drawn in the ground's own
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
  if (kind === 'gingham') {
    // A picnic blanket left on the grass: red gingham squares with a fold and a tassel.
    const w = variant ? 11 : 9
    const x0 = 3
    const y0 = 5
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < w; x++) {
        const a = (x >> 1) % 2
        const b = (y >> 1) % 2
        pc.px(x0 + x, y0 + y, a && b ? P.laborGinghamDark : a || b ? P.laborGingham : P.laborBanner[4])
      }
    }
    pc.hline(x0, x0 + w - 1, y0 + 6, P.laborGinghamDark)
    if (variant) pc.hline(x0 + 2, x0 + w - 3, y0 + 3, P.laborBanner[4])
    return dropShadow(pc)
  }
  if (kind === 'sawdust') {
    // A heap of sawdust and curled shavings under a bench that is no longer there.
    pc.ellipse(8.5, 10, variant ? 5 : 4, 2.6, P.laborChipsDark)
    pc.ellipse(8, 9, variant ? 4 : 3, 1.8, P.laborChips)
    pc.hline(6, 9, 8, P.laborChipsLight)
    if (variant) pc.px(12, 7, P.laborChipsLight)
    pc.px(4, 11, P.laborChipsLight)
    return pc
  }
  if (kind === 'offcuts') {
    // Offcuts of lumber: a couple of short planks left lying where they fell.
    pc.rect(3, 9, 8, 2, P.barnTimberLight)
    pc.hline(3, 10, 11, P.barnTimberDark)
    pc.rect(6, 5, 2, 7, P.barnTimber)
    pc.vline(7, 5, 11, P.barnTimberDark)
    if (variant) {
      pc.rect(9, 12, 5, 2, P.barnTimber)
      pc.hline(9, 13, 13, P.barnTimberDark)
    }
    pc.px(4, 9, P.laborChipsLight)
    return dropShadow(pc)
  }
  if (kind === 'crumbs') {
    // What a picnic leaves: crumbs of bread and a pale heel of crust.
    const n = variant ? 8 : 5
    for (let i = 0; i < n; i++) {
      const x = 1 + ((i * 5) % 12)
      const y = 3 + ((i * 7) % 11)
      pc.px(x, y, i % 2 ? P.crustLight : P.crust)
      pc.px(x + 1, y, P.crustLight)
    }
    if (variant) pc.hline(5, 8, 9, P.crustDark)
    return pc
  }
  if (kind === 'pail') {
    // A tin lunch pail on its side, its lid and handle open, a sandwich half out of it.
    pc.rect(3, 8, 9, 5, P.laborSteel)
    pc.hline(3, 11, 8, P.laborBanner[4])
    pc.hline(3, 11, 12, P.laborSteelDark)
    pc.vline(11, 8, 12, P.laborSteelDark)
    pc.rect(12, 9, 2, 3, variant ? P.crust : P.laborSteelDark)
    pc.hline(5, 9, 6, P.farmIron)
    pc.px(5, 7, P.farmIron)
    pc.px(9, 7, P.farmIron)
    return dropShadow(pc)
  }
  // ribbon: a curl of plain cloth dropped in passing, navy and cream.
  pc.line(4, 12, 11, 5, P.laborBanner[0])
  pc.line(5, 12, 12, 6, P.laborBanner[4])
  pc.line(5, 11, 11, 4, P.laborBanner[1])
  pc.px(3, 13, P.laborBannerDark)
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
/** What gathers in a drift, by ground: blankets on the picnic green, crumbs on the meadow, offcuts in the yard, dropped ribbon on the cobbles. */
const WORK = ['gingham', 'crumbs', 'offcuts', 'ribbon']
/** And what lies loose everywhere between the drifts. */
const LOOSE = ['crumbs', 'crumbs', 'sawdust', 'sawdust']
/** The odd thing, anywhere, by ground. */
const ODDS = [
  ['pail', 'ribbon', 'crumbs', 'gingham'],
  ['pail', 'gingham', 'sawdust', 'ribbon'],
  ['pail', 'ribbon', 'crumbs', 'offcuts'],
  ['pail', 'sawdust', 'gingham', 'offcuts'],
]
const ODD_SHARE = 0.03

/** What lies on the plot ground tile (tx, ty), if anything: `{ kind, variant }`, or null. */
export function laborCover(tx, ty, tone) {
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
  return [P.laborGround[t], P.laborGroundSunny[t], P.laborGroundLush[t]]
}
