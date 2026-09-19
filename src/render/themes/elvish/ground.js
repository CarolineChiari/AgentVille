// Elvish ground, ways and fences: a flowering glade, deep moss, leaf loam or pale river sand
// inside each plot, a paved way of fitted stones round it, stepping stones across it, and fences
// that are grown or carved rather than built.
//
// Contract (see ThemePack in ../index.js and the village's src/render/sprites/tiles.js):
// - `tone` is a plot's yard, an index into THEMES.elvish.dims.yard (glade, moss, loam, silversand).
// - Ground, trail and road tiles are 16×16 and fully opaque; each variant is its own picture.
// - A fence's `style` indexes THEMES.elvish.dims.fence; `mask` which sides carry on (1 N, 2 E,
//   4 S, 8 W). A straight run meets the next tile's edge to edge, so nothing a run draws may
//   differ in shape between its first column and its last (see the periods chosen below).
// - `patches(tone)` is [plain, sunny, lush]: the ground's plain colours, and what each becomes in
//   a dry patch and a damp one. Only pixels exactly a plain colour are repainted.
// - `elfCover` is pure: the same tile always has the same thing lying on it, or nothing.
import { PALETTE as P } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { mulberry32 } from '../../../sim/rng.js'
import { fbm, lattice } from '../../../sim/noise.js'

const T = 16
const GLADE = 0
const MOSS = 1
const LOAM = 2
const SAND = 3

const toneOf = (tone) => (tone || 0) % P.elfGround.length
/** A ground's colours: base, shade, light, deepest. All four are its plain colours. */
const groundOf = (tone) => P.elfGround[toneOf(tone)]

/** How many looks each thing lying about under the trees has; drawn as `deco.<kind>.<variant>`. */
export const COVER_VARIANTS = { ferns: 2, glowcaps: 2, petals: 2, roots: 2, shards: 1, acorns: 1 }
/** The lip drawn where the paved way meets anything else: the shadowed edge of its kerbstones. */
export const ROAD_EDGE = P.wayStoneDark
/** What the lantern grove is edged in: a kerb of the same pale stone the lanterns stand on. */
export const BED_EDGE = P.paleStoneDark

// ---------- the ground ----------

/** Seeds per kind of tile, so a way and a ground of the same variant don't share a scatter. */
const SEED = { ground: 21, trail: 22, road: 23 }

function scatter(pc, rand, n, draw) {
  for (let i = 0; i < n; i++) draw(Math.floor(rand() * T), Math.floor(rand() * T))
}

/** A blade of grass leaning one way or the other, two pixels of it. */
function blade(pc, x, y, c) {
  pc.px(x, y, c)
  pc.px(x + (((x + y) & 1) ? 1 : -1), y - 1, c)
}

/** A fallen leaf lying flat: three pixels across with a stalk, small enough to read at 1×. */
function leaf(pc, x, y, c, stalk) {
  pc.hline(x, x + 2, y, c)
  pc.px(x + 1, y - 1, c)
  pc.px(x + 3, y, stalk)
}

/** The ground itself, before anything is found in it. */
function texture(pc, rand, t) {
  const [base, dark, light, deep] = P.elfGround[t]
  pc.rect(0, 0, T, T, base)
  if (t === GLADE) {
    // Short sward: blades leaning both ways, tips catching the light.
    scatter(pc, rand, 18, (x, y) => blade(pc, x, y, dark))
    scatter(pc, rand, 10, (x, y) => blade(pc, x, y, light))
    scatter(pc, rand, 4, (x, y) => pc.px(x, y, deep))
  } else if (t === MOSS) {
    // Cushions of moss: soft round clumps, lit on top and deep in the hollows between them.
    for (let i = 0; i < 4; i++) {
      const x = Math.floor(rand() * 13)
      const y = 1 + Math.floor(rand() * 13)
      pc.hline(x + 1, x + 2, y - 1, light)
      pc.hline(x, x + 3, y, light)
      pc.hline(x, x + 3, y + 1, dark)
      pc.hline(x + 1, x + 2, y + 2, deep)
    }
    scatter(pc, rand, 10, (x, y) => pc.px(x, y, dark))
    scatter(pc, rand, 5, (x, y) => pc.px(x, y, deep))
  } else if (t === LOAM) {
    // Leaf litter, lying every which way, the earth showing through in places.
    scatter(pc, rand, 7, (x, y) => leaf(pc, x, y, rand() < 0.5 ? light : dark, deep))
    scatter(pc, rand, 8, (x, y) => pc.px(x, y, deep))
    scatter(pc, rand, 6, (x, y) => pc.hline(x, x + 1, y, dark))
  } else {
    // River sand, raked smooth by the water: long shallow ripples and a little grit.
    for (let i = 0; i < 4; i++) {
      const x = Math.floor(rand() * 11)
      const y = 1 + Math.floor(rand() * 14)
      pc.hline(x, x + 4, y - 1, light)
      pc.hline(x + 1, x + 5, y, dark)
    }
    scatter(pc, rand, 7, (x, y) => pc.px(x, y, dark))
    scatter(pc, rand, 3, (x, y) => pc.px(x, y, deep))
  }
}

/** What a rare tile has in it: variants 3, 4 and 5 of each ground. */
function find(pc, rand, t, variant) {
  const [base, dark, light, deep] = P.elfGround[t]
  const x = 4 + Math.floor(rand() * 6)
  const y = 4 + Math.floor(rand() * 6)
  const k = variant - 3
  if (t === GLADE) {
    if (k === 0) {
      // A ring of little white star-flowers, the kind that only opens in a glade.
      for (const [dx, dy] of [[0, 0], [3, 1], [1, 3], [4, 4], [-1, 2]]) {
        pc.px(x + dx, y + dy, P.petalWhite)
        pc.px(x + dx, y + dy + 1, deep)
      }
    } else if (k === 1) {
      // A tussock of longer grass nobody has cut.
      for (let i = 0; i < 7; i++) pc.vline(x + i - 3, y + 2 - (i % 3), y + 3, i % 2 ? light : dark)
    } else {
      // A grey feather dropped by something passing over.
      pc.line(x, y + 4, x + 4, y, P.mithrilDark)
      for (let i = 1; i <= 3; i++) pc.px(x + i - 1, y + 4 - i, P.mithril)
      pc.px(x + 5, y - 1, P.mithrilLight)
    }
  } else if (t === MOSS) {
    if (k === 0) {
      // A root running just under the moss, breaking the surface here and there.
      for (let i = 0; i < 12; i++) {
        const rx = 2 + i
        const ry = y + Math.round(Math.sin(i / 2.4) * 2)
        pc.px(rx, ry, i % 3 ? P.livewood : P.livewoodLight)
        pc.px(rx, ry + 1, P.livewoodDark)
      }
    } else if (k === 1) {
      // A glowing cap or two, pale blue even by day.
      for (const [dx, dy] of [[0, 0], [4, 2]]) {
        pc.hline(x + dx - 1, x + dx + 1, y + dy, P.glowCap)
        pc.px(x + dx, y + dy - 1, P.glowCap)
        pc.px(x + dx, y + dy + 1, P.glowCapStem)
      }
    } else {
      // A hollow that holds the rain.
      pc.ellipse(x + 1, y + 1, 3.5, 2, deep)
      pc.ellipse(x + 1, y + 1, 2.5, 1, dark)
      pc.hline(x, x + 1, y, light)
    }
  } else if (t === LOAM) {
    if (k === 0) {
      // A drift of leaves piled against nothing in particular.
      for (let i = 0; i < 6; i++) leaf(pc, x - 3 + ((i * 3) % 8), y + (i % 3), i % 2 ? light : dark, deep)
    } else if (k === 1) {
      // Acorns, cups and all.
      for (const [dx, dy] of [[0, 0], [3, 3]]) {
        pc.hline(x + dx, x + dx + 1, y + dy, P.acorn)
        pc.hline(x + dx, x + dx + 1, y + dy + 1, P.trunk)
      }
      pc.px(x + 1, y - 1, P.trunk)
    } else {
      // Bare earth where the leaves have been swept away.
      pc.ellipse(x + 1, y + 1, 4, 2.5, deep)
      pc.ellipse(x + 1, y + 1, 3, 1.5, dark)
      pc.px(x, y, base)
    }
  } else {
    if (k === 0) {
      // A splinter of crystal washed down with the sand.
      pc.line(x, y + 3, x + 3, y, P.shard)
      pc.line(x + 1, y + 3, x + 4, y, P.shardDark)
      pc.px(x + 3, y, P.glassLight)
    } else if (k === 1) {
      // Silver pebbles, sorted by the water into a line.
      for (const [dx, dy] of [[0, 0], [3, 1], [6, 0], [2, 3]]) {
        pc.hline(x + dx - 3, x + dx - 2, y + dy, P.mithril)
        pc.hline(x + dx - 3, x + dx - 2, y + dy + 1, P.mithrilDark)
      }
    } else {
      // Where the river last reached: a damp line with the sand darker beyond it.
      for (let i = 0; i < T; i++) {
        const ry = y - 2 + Math.round(Math.sin(i / 3.5) * 1.5)
        pc.px(i, ry, deep)
        pc.px(i, ry + 1, dark)
      }
    }
  }
}

/**
 * A plot's ground. Variants 0–2 are plain and carry the ground; 3–5 are rare (see TILE_WEIGHTS in
 * the village's tiles) and each holds a find.
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
 * The lantern grove, where the village has its ploughed field: the plot's ground mown close, with
 * a flat pale stone set where each lantern will stand. The stones sit on the village's grid of
 * dimples, 8 px apart: variant 0 is the grove's top row, variant 1 every row below, which carries
 * the grid on from the row above (see the village's `bed` tile). Everything but the stones is
 * drawn in the ground's own colours, so the grove takes its plot's patches like the rest of it.
 */
export function drawBed(variant, tone) {
  const [base, dark, light] = groundOf(tone)
  const pc = new PixelCanvas(T, T)
  pc.rect(0, 0, T, T, base)
  // Mown close, in bands, as a sward that is kept is: a pale stripe every fourth row and a
  // shaded one between, both broken, so the bands of one tile run into the next. A diagonal
  // pattern here read as woven cloth rather than as grass.
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      if (y % 4 === 0 && (x + y) % 5) pc.px(x, y, light)
      else if (y % 4 === 2 && (x * 3 + y) % 7 === 0) pc.px(x, y, dark)
    }
  }
  for (const y0 of variant ? [-4, 4] : [4]) {
    for (const x0 of [0, 8]) {
      pc.hline(x0 + 2, x0 + 5, y0 + 5, P.paleStone)
      pc.hline(x0 + 3, x0 + 4, y0 + 4, P.paleStoneLight)
      pc.hline(x0 + 3, x0 + 4, y0 + 6, P.paleStoneDark)
    }
  }
  return pc
}

// ---------- ways inside a plot ----------

/** Where a way runs across its tile: 8 px wide, down the middle, so arms meet their neighbours'. */
const LO = 4
const HI = 11
/**
 * Stepping stones sit on the village's 8 px grid, so a run of them is evenly spaced across a tile
 * boundary as well as within one. Each is six pixels square with its corners taken off, and only
 * a stone that fits inside the arm it belongs to is laid, so none is cut off at a dead end.
 */
const STEP = [1, 9]
const STEP_W = 6
/**
 * One stone: a dark rim all round it, then its face lit from the top left. The rim is what makes
 * it a stone on pale river sand as well as on dark moss; without it the stones vanished into the
 * sand and read as blossom on the grass.
 */
const STONE = [
  ' rrrr ',
  'rllllr',
  'rlssmr',
  'rlssmr',
  'rssmmr',
  ' rrrr ',
]
const STONE_COLOR = { r: P.runestoneDark, l: P.stepStoneLight, s: P.stepStone, m: P.stepStoneDark }

function stepStone(pc, x, y) {
  STONE.forEach((row, j) => [...row].forEach((c, i) => c !== ' ' && pc.px(x + i, y + j, STONE_COLOR[c])))
}

/**
 * A way of stepping stones set into the plot's ground: 8 px wide down the middle of the tile,
 * with an arm out of each linked side reaching its edge, so it joins the next tile's. The ground
 * between the stones is trodden down to its deepest colour, which is one of its plain colours,
 * so a way takes the plot's patches along with the ground round it.
 */
export function drawTrail(variant, links, tone) {
  const t = toneOf(tone)
  const g = P.elfGround[t]
  const pc = new PixelCanvas(T, T)
  const rand = mulberry32(variant * 149 + links * 19 + t * 6151 + SEED.trail)
  texture(pc, rand, t)
  const N = links & 1
  const E = links & 2
  const S = links & 4
  const W = links & 8
  const down = N || S
  const across = E || W || !down
  const worn = (x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) pc.px(x, y, (x * 5 + y * 3) % 7 ? g[3] : g[1])
  }
  const dy0 = N ? 0 : LO
  const dy1 = S ? T - 1 : HI
  const ax0 = W ? 0 : LO
  const ax1 = E ? T - 1 : HI
  if (down) worn(LO, dy0, HI, dy1)
  if (across) worn(ax0, LO, ax1, HI)
  let laid = 0
  if (down) {
    for (const y of STEP) if (y >= dy0 && y + STEP_W - 1 <= dy1) (stepStone(pc, 5, y), laid++)
  }
  if (across) {
    for (const x of STEP) if (x >= ax0 && x + STEP_W - 1 <= ax1) (stepStone(pc, x, 5), laid++)
  }
  // A short arm has room for no whole stone of the run's own grid: one goes in the middle instead.
  if (!laid) stepStone(pc, 5, 5)
  // Something beside the stones, by variant.
  if (variant === 1) pc.px(6, 12, P.wayMoss)
  else if (variant === 2) leaf(pc, LO, 13, g[2], g[1])
  else if (variant === 3) {
    // A stone cracked by a root under it.
    pc.vline(8, 6, 9, P.stepStoneDark)
    pc.px(9, 8, P.stepStoneDark)
  }
  return pc
}

// ---------- the paved way ----------

/**
 * The way round a plot: flagstones fitted close, worn pale on top, moss taken hold in the seams.
 * Stones are 8 px on a side with the courses staggered, so the joints line up tile to tile.
 * Variants 0–2 are plain; 3 has a leaf cut into a stone, 4 a patch of moss, 5 a cracked flag.
 */
export function drawRoad(variant) {
  const pc = new PixelCanvas(T, T)
  const rand = mulberry32(variant * 149 + SEED.road * 6151)
  pc.rect(0, 0, T, T, P.wayStone)
  // The courses: a seam along the bottom of each, and a cross joint staggered by half a stone.
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const course = y >> 3
      const joint = (x + course * 4) % 8 === 7
      if (y % 8 === 7 || joint) pc.px(x, y, P.waySeam)
      else if (y % 8 === 0 || (x + course * 4) % 8 === 0) pc.px(x, y, P.wayStoneLight)
    }
  }
  scatter(pc, rand, 10, (x, y) => pc.px(x, y, P.wayStoneDark))
  scatter(pc, rand, 6, (x, y) => pc.px(x, y, P.wayStoneLight))
  // Moss finds the seams first, so it is scattered along them rather than over the stones.
  for (let i = 0; i < 10; i++) {
    const x = Math.floor(rand() * T)
    const y = (Math.floor(rand() * 2) * 8 + 7) % T
    pc.px(x, y, P.wayMoss)
    if (rand() < 0.4) pc.px(x, y - 1, P.wayMoss)
  }
  if (variant === 3) {
    // A leaf cut into one of the stones by whoever laid the way.
    const x = 3 + Math.floor(rand() * 3)
    const y = 3 + Math.floor(rand() * 3)
    pc.line(x, y + 5, x + 5, y, P.wayStoneDark)
    for (let i = 1; i <= 4; i++) {
      pc.px(x + i - 1, y + 5 - i - 1, P.wayStoneDark)
      pc.px(x + i + 1, y + 5 - i, P.wayStoneDark)
    }
    pc.px(x + 5, y, P.wayStoneLight)
  } else if (variant === 4) {
    // A cushion of moss spreading out of a seam onto the stone.
    const x = 2 + Math.floor(rand() * 6)
    pc.ellipse(x + 2, 7.5, 3.5, 2, P.wayMoss)
    pc.hline(x, x + 3, 6, P.moss)
    pc.px(x + 1, 6, P.wayMoss)
  } else if (variant === 5) {
    // A flag split end to end, the crack dark where the frost got in.
    let x = 4 + Math.floor(rand() * 6)
    for (let y = 0; y < T; y++) {
      pc.px(x, y, P.waySeam)
      if (y % 3 === 1) pc.px(x + 1, y, P.wayStoneDark)
      if (rand() < 0.35) x = Math.max(1, Math.min(14, x + (rand() < 0.5 ? -1 : 1)))
    }
  }
  return pc
}

// ---------- fences ----------

/**
 * A briar's top edge, by column: a period of five, which starts and ends on the same value across
 * a 16 px tile (0 % 5 === 15 % 5), so a straight run meets the next tile's edge to edge.
 */
const BRIAR_TOP = [3, 4, 3, 5, 4]
/** How far the vine between two runestones dips, by column. Period five, for the same reason. */
const VINE_DIP = [0, 1, 1, 0, 0]

/** One stem of briar down a column, with its leaves, thorns and now and then a flower. */
function briarColumn(pc, x, y0, y1, k) {
  for (let y = y0; y <= y1; y++) {
    const lit = (x + y) % 3 === 0
    pc.px(x, y, y === y1 ? P.leafDark : lit ? P.leafLight : P.leaf)
  }
  if (k % 5 === 1) pc.px(x, y0 + 1, P.briarThorn)
  if (k % 5 === 3) pc.px(x, y0 + 2, P.briarBloom)
}

/** A stake of the woven hurdle, driven in and standing proud of the weave. */
function withyStake(pc, x, y0, y1) {
  pc.vline(x, y0, y1, P.withyDark)
  pc.px(x, y0, P.withy)
}

/** A low runestone, x0..x1 wide, its face carved. */
function runeStone(pc, x0, x1, y0, y1) {
  pc.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, P.runestone)
  pc.hline(x0, x1, y0, P.runestoneLight)
  pc.vline(x1, y0, y1, P.runestoneDark)
  pc.hline(x0, x1, y1, P.runestoneDark)
  pc.vline(Math.round((x0 + x1) / 2), y0 + 2, y1 - 1, P.rune)
  pc.px(x0 + 1, y0 + 3, P.rune)
}

/**
 * Each style draws a run across the tile (x from a to b, at the fence's height), a run down it
 * (y from a to b), and the post that stands at a corner or the end of a run. Every pattern here
 * has a period that agrees at x (or y) 0 and 15, so a straight run tiles.
 */
const FENCE_DRAW = {
  // A woven withy hurdle: rods threaded in and out of stakes driven every four pixels.
  woven: {
    across(pc, a, b) {
      for (let x = a; x <= b; x++) {
        for (let y = 5; y <= 12; y++) {
          // Over and under: which rod shows depends on the stake bay, which repeats every 4.
          const over = ((x >> 2) + y) % 2 === 0
          pc.px(x, y, y === 12 ? P.withyDark : over ? P.withy : P.withyLight)
        }
        pc.px(x, 4, x % 2 ? P.withyLight : P.withy) // the twisted top edge
      }
      for (let x = a - (a % 4) + 2; x <= b; x += 4) if (x >= a) withyStake(pc, x, 3, 13)
    },
    down(pc, a, b) {
      pc.vline(6, a, b, P.withyLight)
      pc.vline(7, a, b, P.withy)
      pc.vline(8, a, b, P.withyDark)
      for (let y = a - (a % 4) + 2; y <= b; y += 4) if (y >= a) pc.hline(6, 8, y, P.withyDark)
    },
    post(pc) {
      withyStake(pc, 7, 2, 14)
      withyStake(pc, 8, 3, 14)
      pc.px(7, 2, P.withyLight)
    },
  },
  // A briar in flower: thorny stems grown thick, kept to a hedge's height.
  briar: {
    across(pc, a, b) {
      for (let x = a; x <= b; x++) briarColumn(pc, x, BRIAR_TOP[x % 5], 13, x)
    },
    down(pc, a, b) {
      for (let y = a; y <= b; y++) {
        const w = BRIAR_TOP[y % 5] - 2 // 1..3: the mass breathes in and out down the run
        for (let x = 7 - w; x <= 8 + w; x++) pc.px(x, y, (x + y) % 3 === 0 ? P.leafLight : P.leaf)
        pc.px(8 + w, y, P.leafDark)
        if (y % 5 === 3) pc.px(7, y, P.briarBloom)
      }
    },
    post(pc) {
      for (let y = 2; y <= 14; y++) {
        const w = y < 4 ? 1 : 3
        for (let x = 7 - w; x <= 8 + w; x++) pc.px(x, y, (x + y) % 3 === 0 ? P.leafLight : P.leaf)
        pc.px(8 + w, y, P.leafDark)
      }
      pc.px(7, 5, P.briarBloom)
      pc.px(9, 9, P.briarThorn)
    },
  },
  // A mithril railing: two rails, a baluster and its shadow every four pixels, and a leaf twisted
  // into every second one. The pairs sit at x % 4 of 1 and 2, which leaves both of a tile's end
  // columns bare rail, so a straight run meets the next tile edge to edge.
  filigree: {
    across(pc, a, b) {
      pc.hline(a, b, 4, P.mithrilLight)
      pc.hline(a, b, 5, P.mithril)
      pc.hline(a, b, 11, P.mithril)
      pc.hline(a, b, 12, P.mithrilDark)
      for (let x = a; x <= b; x++) {
        if (x % 4 === 1) pc.vline(x, 6, 10, P.mithril)
        if (x % 4 === 2) pc.vline(x, 6, 10, P.mithrilDark)
        if (x % 8 === 5) {
          pc.px(x, 7, P.mithrilLight)
          pc.hline(x - 1, x + 1, 8, P.mithril)
          pc.px(x, 9, P.mithrilDark)
        }
      }
    },
    down(pc, a, b) {
      pc.vline(6, a, b, P.mithrilLight)
      pc.vline(7, a, b, P.mithril)
      pc.vline(8, a, b, P.mithrilDark)
      for (let y = a; y <= b; y++) if (y % 4 === 1) pc.hline(5, 9, y, P.mithril)
    },
    post(pc) {
      pc.vline(7, 2, 13, P.mithril)
      pc.vline(8, 2, 13, P.mithrilDark)
      pc.hline(6, 9, 4, P.mithril)
      // A finial: a single leaf on top of the standard.
      pc.px(7, 1, P.mithrilLight)
      pc.hline(6, 9, 2, P.mithrilLight)
    },
  },
  // Low runestones linked by a vine. The stones sit where x % 8 is 2..6, so both of a tile's end
  // columns carry the vine alone and a straight run joins up.
  standing: {
    across(pc, a, b) {
      for (let x = a; x <= b; x++) {
        const s = x % 8
        if (s >= 2 && s <= 6) continue
        pc.px(x, 7 + VINE_DIP[x % 5], P.vine)
        pc.px(x, 8 + VINE_DIP[x % 5], P.vineLight)
      }
      for (let x0 = a - (a % 8) + 2; x0 <= b; x0 += 8) {
        if (x0 < a || x0 + 4 > b) continue
        runeStone(pc, x0, x0 + 4, 5, 13)
      }
    },
    down(pc, a, b) {
      for (let y = a; y <= b; y++) {
        const s = y % 8
        if (s >= 2 && s <= 6) continue
        pc.px(7 + VINE_DIP[y % 5], y, P.vine)
        pc.px(8 + VINE_DIP[y % 5], y, P.vineLight)
      }
      for (let y0 = a - (a % 8) + 2; y0 <= b; y0 += 8) {
        if (y0 < a || y0 + 4 > b) continue
        runeStone(pc, 5, 10, y0, y0 + 4)
      }
    },
    post(pc) {
      runeStone(pc, 5, 10, 3, 14)
      pc.px(7, 1, P.runeGlow)
      pc.hline(6, 9, 2, P.runestoneLight)
    },
  },
}
const STYLES = ['woven', 'briar', 'filigree', 'standing']

/**
 * A plot's fence, one tile of it. A run reaches the edge of the tile on a linked side and stops
 * in the middle otherwise, so it ends in a post at a gap and turns a proper corner.
 */
export function drawFence(style, mask) {
  const pc = new PixelCanvas(T, T)
  const f = FENCE_DRAW[STYLES[style]] || FENCE_DRAW.woven
  const across = mask & (2 | 8)
  const down = mask & (1 | 4)
  if (across) f.across(pc, mask & 8 ? 0 : 7, mask & 2 ? T - 1 : 8)
  if (down) f.down(pc, mask & 1 ? 0 : 7, mask & 4 ? T - 1 : 8)
  const straight = mask === (2 | 8) || mask === (1 | 4)
  if (!straight) f.post(pc)
  return pc
}

/**
 * What gathers at a fence's foot: moss, a fern or two and fallen leaves. `mask` as the fence's
 * (1 N, 2 E, 4 S, 8 W). Drawn in the ground's own colours where it can be, so the patches tint it
 * along with the ground round it.
 */
export function drawVerge(mask, tone) {
  const pc = new PixelCanvas(T, T)
  const [, dark, light, deep] = groundOf(tone)
  const rand = mulberry32(mask * 883 + toneOf(tone) * 149 + 11)
  const clump = (x, y) => {
    pc.px(x, y, light)
    pc.px(x + 1, y, dark)
    pc.hline(x, x + 1, y + 1, deep)
  }
  const frond = (x, y) => {
    pc.vline(x, y, y + 2, P.fernDark)
    pc.px(x - 1, y + 1, P.fern)
    pc.px(x + 1, y, P.fern)
    pc.px(x + 1, y + 2, P.fern)
  }
  const across = mask & (2 | 8)
  const down = mask & (1 | 4)
  if (across) {
    const x0 = mask & 8 ? 0 : 4
    const x1 = mask & 2 ? T - 2 : 10
    clump(x0 + Math.floor(rand() * 3), 14)
    for (let x = x0 + 3; x <= x1; x += 3) {
      const r = rand()
      if (r < 0.4) clump(x, 14)
      else if (r < 0.6) frond(x, 12)
    }
    for (let x = x0; x <= x1; x++) if (rand() < 0.2) pc.px(x, 15, dark)
    if (rand() < 0.35) leaf(pc, x0 + 1 + Math.floor(rand() * Math.max(1, x1 - x0 - 4)), 13, light, deep)
  }
  if (down) {
    // Beside the run, but not on the side a run across leaves by: there they would be growing up
    // the face of the fence rather than at its foot.
    const left = !(mask & 8)
    const right = !(mask & 2)
    for (let y = mask & 1 ? 1 : 5; y <= (mask & 4 ? 14 : 10); y += 3) {
      if (left && rand() < 0.45) clump(1 + Math.floor(rand() * 2), y)
      if (right && rand() < 0.45) clump(12 + Math.floor(rand() * 2), y)
    }
    if (right) clump(12, mask & 4 ? 13 : 9)
    else if (left) clump(2, mask & 4 ? 13 : 9)
  }
  if (!across && !down) {
    clump(4, 14)
    clump(10, 14)
    frond(7, 12)
  }
  return pc
}

/**
 * The plot's ground spilling over the edge of the paved way: moss and grass taking the joints,
 * and a leaf or two blown further out. Variant `side * 2 + k`, as the village's grass fringe:
 * side 0 top, 1 right, 2 bottom, 3 left of the way's tile, k one of two scatters, and 8 more
 * leaves a footpath's mouth open.
 */
export function drawFringe(variant, tone) {
  const pc = new PixelCanvas(T, T)
  const [base, dark, light] = groundOf(tone)
  const mouth = variant >= 8
  const side = (variant & 7) >> 1
  const rand = mulberry32(variant * 661 + toneOf(tone) * 79 + 31)
  const set = (i, d, c) => {
    if (side === 0) pc.px(i, d, c)
    else if (side === 1) pc.px(T - 1 - d, i, c)
    else if (side === 2) pc.px(i, T - 1 - d, c)
    else pc.px(d, i, c)
  }
  const open = (i) => mouth && i >= LO && i <= HI
  let n = 0
  for (let i = 0; i < T; i++) {
    const r = rand()
    if (r < 0.35 || open(i)) continue
    set(i, 0, r < 0.7 ? base : dark)
    if (r > 0.85) set(i, 1, base)
    n++
  }
  // Moss creeping a little further out along the joints.
  for (let s = 0; s < 3; s++) {
    const i = Math.floor(rand() * T)
    if (open(i) || rand() < 0.35) continue
    set(i, 2 + Math.floor(rand() * 2), rand() < 0.5 ? P.wayMoss : light)
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

/** One fern frond, arching from (x, y) up and over by `len`, leaning `dir`. */
function frond(pc, x, y, len, dir) {
  for (let i = 0; i < len; i++) {
    const fx = x + Math.round(dir * i * 0.6)
    const fy = y - i
    pc.px(fx, fy, i > len - 3 ? P.fern : P.fernDark)
    if (i % 2 === 0 && i < len - 1) {
      pc.px(fx - 1, fy, P.fern)
      pc.px(fx + 1, fy, P.fern)
    }
  }
}

/**
 * Flat things that lie about under the trees: `deco.<kind>.<variant>`, over the ground of `tone`.
 */
export function drawCover(kind, variant, tone) {
  const pc = new PixelCanvas(T, T)
  const [, dark, , deep] = groundOf(tone)
  if (kind === 'ferns') {
    frond(pc, 5, 13, variant ? 8 : 6, -1)
    frond(pc, 9, 14, variant ? 6 : 8, 1)
    if (variant) frond(pc, 12, 12, 5, 1)
    return pc
  }
  if (kind === 'glowcaps') {
    // Toadstools with pale blue caps, a ring of them on the bigger variant.
    const spots = variant ? [[4, 9], [8, 7], [11, 10], [6, 12]] : [[6, 10], [10, 8]]
    for (const [x, y] of spots) {
      pc.hline(x - 1, x + 1, y, P.glowCap)
      pc.px(x, y - 1, P.glassLight)
      pc.px(x, y + 1, P.glowCapStem)
      pc.px(x, y + 2, deep)
    }
    return pc
  }
  if (kind === 'petals') {
    // Fallen blossom, lying where it settled.
    const n = variant ? 9 : 5
    for (let i = 0; i < n; i++) {
      const x = 2 + ((i * 5) % 12)
      const y = 3 + ((i * 7) % 11)
      pc.hline(x, x + 1, y, i % 3 ? P.petalFall : P.blossomLight)
      pc.px(x, y + 1, P.petalFallDark)
    }
    return pc
  }
  if (kind === 'roots') {
    // A root out of the ground and back into it, moss along its top.
    const y0 = variant ? 6 : 9
    for (let i = 0; i < 14; i++) {
      const ry = y0 + Math.round(Math.sin(i / 2.6) * 2)
      pc.px(1 + i, ry, P.livewoodLight)
      pc.px(1 + i, ry + 1, P.livewood)
      pc.px(1 + i, ry + 2, P.livewoodDark)
      if (i % 4 === 1) pc.px(1 + i, ry, P.barkMoss)
    }
    return dropShadow(pc)
  }
  if (kind === 'shards') {
    // Splinters of crystal, of the kind the halls are glazed with.
    for (const [x, y, len] of [[3, 11, 5], [8, 9, 6], [12, 12, 3]]) {
      pc.line(x, y, x + len, y - len, P.shard)
      pc.line(x + 1, y, x + len + 1, y - len, P.shardDark)
      pc.px(x + len, y - len, P.glassLight)
    }
    return dropShadow(pc)
  }
  // Acorns and beech mast, dropped and left.
  for (const [x, y] of [[4, 8], [9, 6], [7, 12], [12, 10]]) {
    pc.hline(x, x + 1, y, P.acorn)
    pc.hline(x, x + 1, y + 1, P.acorn)
    pc.hline(x - 1, x + 2, y - 1, P.trunk)
    pc.px(x, y + 1, dark)
  }
  pc.px(2, 13, P.acorn)
  return dropShadow(pc)
}

/**
 * Where things lie: slow noise, a step every few tiles, so they gather in drifts rather than
 * peppering the ground, and only some tiles in a drift, so a drift thins out raggedly. Octaves
 * of value noise bunch round 0.5, so a drift is where it rises into its top sixth or so.
 */
const DRIFT_SCALE = 1 / 4.5
const GREEN_DRIFT = 0.67
const GREEN_FILL = 0.22
const GLOW_DRIFT = 0.7
/** How much of a glowing drift holds caps, by ground: moss most, bare sand hardly at all. */
const GLOW_FILL = [0.15, 0.35, 0.2, 0.05]
/** What grows in a green drift, by ground: ferns under the trees, crystal on the river sand. */
const GREEN = ['ferns', 'ferns', 'ferns', 'shards']
/** The odd thing, anywhere, by ground. */
const ODDS = [
  ['petals', 'ferns', 'acorns', 'shards'],
  ['roots', 'glowcaps', 'ferns', 'acorns'],
  ['acorns', 'roots', 'petals', 'ferns'],
  ['shards', 'petals', 'roots', 'ferns'],
]
const ODD_SHARE = 0.025

/** What lies on the plot ground tile (tx, ty), if anything: `{ kind, variant }`, or null. */
export function elfCover(tx, ty, tone) {
  const t = toneOf(tone)
  const h = lattice(tx, ty, 291)
  const v = lattice(tx, ty, 292)
  const x = tx * DRIFT_SCALE
  const y = ty * DRIFT_SCALE
  if (GLOW_FILL[t] && fbm(x, y, 237) > GLOW_DRIFT) {
    if (h < GLOW_FILL[t]) return { kind: 'glowcaps', variant: v < 0.6 ? 0 : 1 }
  } else if (fbm(x, y, 231) > GREEN_DRIFT) {
    const kind = GREEN[t]
    if (h < GREEN_FILL) return { kind, variant: Math.floor(v * COVER_VARIANTS[kind]) }
  }
  if (h > 1 - ODD_SHARE) {
    const list = ODDS[t]
    const kind = list[Math.floor(v * list.length)]
    return { kind, variant: Math.floor(lattice(tx, ty, 293) * COVER_VARIANTS[kind]) }
  }
  return null
}

/** The ground's plain colours, each paired with its dry and its damp partner. */
export function patches(tone) {
  const t = toneOf(tone)
  return [P.elfGround[t], P.elfGroundSunny[t], P.elfGroundLush[t]]
}
