// Site ground, roads and fences: gravel, dirt, sand or a poured slab inside each plot, asphalt
// round it, scaffold boards laid across it to walk on, and temporary fencing.
//
// Contract (see ThemePack in ../index.js and the village's src/render/sprites/tiles.js):
// - `tone` is a plot's yard, an index into THEMES.construction.dims.yard (gravel, dirt, sand, slab).
// - Ground, trail and road tiles are 16×16 and fully opaque; each variant is its own picture.
// - A fence's `style` indexes THEMES.construction.dims.fence; `mask` which sides carry on
//   (1 N, 2 E, 4 S, 8 W). A straight run meets the next tile's edge to edge.
// - `patches(tone)` is [plain, sunny, lush]: the ground's plain colours, and what each becomes in
//   a dry patch and a damp one. Only pixels exactly a plain colour are repainted.
// - `siteCover` is pure: the same tile always has the same thing lying on it, or nothing.
import { PALETTE as P } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { mulberry32 } from '../../../sim/rng.js'
import { fbm, lattice } from '../../../sim/noise.js'

const T = 16
const GRAVEL = 0
const DIRT = 1
const SAND = 2
const SLAB = 3

const toneOf = (tone) => (tone || 0) % P.siteGround.length
/** A ground's colours: base, shade, light, deepest. All four are its plain colours. */
const groundOf = (tone) => P.siteGround[toneOf(tone)]

/** How many looks each thing lying about on a site has; drawn as `deco.<kind>.<variant>`. */
export const COVER_VARIANTS = { rubble: 3, puddle: 2, planks: 2, bricks: 2, hose: 1, cone: 2, rebar: 1, pipes: 1, sack: 1 }
/** The lip drawn where a road meets anything else: a concrete kerb. */
export const ROAD_EDGE = P.kerb

// ---------- the ground ----------

/** Seeds per kind of tile, so a road and a ground of the same variant don't share a scatter. */
const SEED = { ground: 11, trail: 12, road: 13 }

function scatter(pc, rand, n, draw) {
  for (let i = 0; i < n; i++) draw(Math.floor(rand() * T), Math.floor(rand() * T))
}

/** A stone lying on the ground, lit from the top left, its shadow on the ground under it. */
function stone(pc, x, y, [light, mid, dark], shadow) {
  pc.hline(x + 1, x + 2, y, light)
  pc.hline(x, x + 3, y + 1, mid)
  pc.px(x, y + 1, light)
  pc.px(x + 3, y + 1, dark)
  pc.hline(x + 1, x + 3, y + 2, dark)
  pc.hline(x + 1, x + 4, y + 3, shadow)
}

/** Two boot prints a stride apart, as the village's footpaths have them: soles, no more. */
function prints(pc, x, y, c) {
  for (const [dx, dy] of [[0, 0], [3, 3]]) pc.rect(x + dx, y + dy, 2, 2, c)
}

/** A nut dropped off something: a hexagon of steel round its hole. */
function nut(pc, x, y, shadow) {
  pc.px(x + 1, y, P.metal)
  pc.px(x, y + 1, P.metal)
  pc.px(x + 1, y + 1, P.rubber)
  pc.px(x + 2, y + 1, P.metalDark)
  pc.px(x + 1, y + 2, P.metalDark)
  pc.px(x + 2, y + 2, shadow)
}

/** The ground itself, before anything is found in it. */
function texture(pc, rand, t) {
  const [base, dark, light, deep] = P.siteGround[t]
  pc.rect(0, 0, T, T, base)
  if (t === GRAVEL) {
    // Crushed stone: a dense scatter of chips, some catching the light with a shadow under them.
    scatter(pc, rand, 26, (x, y) => pc.px(x, y, dark))
    scatter(pc, rand, 14, (x, y) => {
      pc.px(x, y, light)
      pc.px(x, y + 1, deep)
    })
    scatter(pc, rand, 4, (x, y) => pc.px(x, y, deep))
  } else if (t === DIRT) {
    // Churned earth: dug-over patches, and clods thrown up by the machines.
    for (let i = 0; i < 2; i++) {
      const x = Math.floor(rand() * 12)
      const y = Math.floor(rand() * 13)
      pc.hline(x + 1, x + 3, y, dark)
      pc.hline(x, x + 4, y + 1, dark)
      pc.hline(x + 1, x + 2, y + 2, dark)
    }
    scatter(pc, rand, 6, (x, y) => {
      pc.hline(x, x + 1, y, light)
      pc.hline(x, x + 1, y + 1, deep)
    })
    scatter(pc, rand, 10, (x, y) => pc.px(x, y, dark))
  } else if (t === SAND) {
    // Building sand: fine, soft ripples where it was tipped and spread, a little grit.
    for (let i = 0; i < 3; i++) {
      const x = Math.floor(rand() * 12)
      const y = 1 + Math.floor(rand() * 13)
      pc.hline(x, x + 3, y, light)
      pc.hline(x + 1, x + 4, y + 1, dark)
    }
    scatter(pc, rand, 6, (x, y) => pc.px(x, y, dark))
    scatter(pc, rand, 2, (x, y) => pc.px(x, y, deep))
  } else {
    // Poured concrete, floated nearly smooth, sawn into bays along the tile's edges so bay meets
    // bay. The cut is its shade, not its deepest: in the deepest, the joints ruled the site like
    // a tiled floor.
    scatter(pc, rand, 8, (x, y) => pc.px(x, y, dark))
    scatter(pc, rand, 6, (x, y) => pc.px(x, y, light))
    pc.hline(0, T - 1, T - 1, dark)
    pc.vline(T - 1, 0, T - 1, dark)
  }
}

/** What a rare tile has in it: variants 3, 4 and 5 of each ground. */
function find(pc, rand, t, variant) {
  const [, dark, light, deep] = P.siteGround[t]
  const x = 4 + Math.floor(rand() * 6)
  const y = 4 + Math.floor(rand() * 6)
  const k = variant - 3
  if (t === GRAVEL) {
    // A cobble too big for the crusher: darker than the chips round it, or it disappears in them.
    if (k === 0) stone(pc, x, y, [P.pebble, P.stoneDark, P.asphaltDark], deep)
    else if (k === 1) nut(pc, x, y, deep)
    else {
      // Where a machine stood and dripped: an oil stain soaked into the stone.
      pc.hline(x + 1, x + 4, y, deep)
      pc.hline(x, x + 5, y + 1, deep)
      pc.hline(x + 1, x + 3, y + 2, deep)
      pc.hline(x + 2, x + 3, y + 1, P.asphaltDark)
    }
  } else if (t === DIRT) {
    if (k === 0) {
      // A soft spot trodden to mud, still wet in the middle.
      pc.hline(x + 1, x + 4, y, dark)
      pc.hline(x, x + 5, y + 1, dark)
      pc.hline(x, x + 5, y + 2, dark)
      pc.hline(x + 1, x + 4, y + 3, dark)
      pc.hline(x + 1, x + 4, y + 1, deep)
      pc.hline(x + 2, x + 4, y + 2, deep)
      pc.px(x + 2, y + 1, light)
    } else if (k === 1) stone(pc, x, y, [P.stoneLight, P.stone, P.stoneDark], deep)
    else {
      // A tyre's track pressed into the mud: the rut's two edges, the tread's lugs across it,
      // fading out at both ends.
      const x0 = 3 + Math.floor(rand() * 7)
      for (let yy = 2; yy <= 13; yy++) {
        const end = yy < 4 || yy > 11
        pc.px(x0, yy, end ? dark : deep)
        pc.px(x0 + 4, yy, end ? dark : deep)
        if (yy % 2 === 0 && !end) pc.hline(x0 + 1, x0 + 3, yy, dark)
      }
    }
  } else if (t === SAND) {
    if (k === 0) prints(pc, x - 1, y - 2, dark)
    else if (k === 1) {
      stone(pc, x, y, [P.stoneLight, P.pebble, P.stoneDark], dark)
      pc.px(x + 6, y + 3, P.pebble)
      pc.px(x + 6, y + 4, dark)
    } else {
      // A damp patch where a bucket was tipped out.
      pc.hline(x + 1, x + 4, y, dark)
      pc.hline(x, x + 5, y + 1, dark)
      pc.hline(x, x + 5, y + 2, dark)
      pc.hline(x + 1, x + 4, y + 3, dark)
      pc.hline(x + 2, x + 3, y + 1, deep)
      pc.px(x + 1, y + 2, light)
    }
  } else {
    if (k === 0) {
      // A hairline crack wandering across the bay.
      let cx = x
      for (let yy = 2; yy <= 12; yy++) {
        pc.px(cx, yy, deep)
        if (rand() < 0.45) cx += rand() < 0.5 ? -1 : 1
      }
    } else if (k === 1) {
      // Where a machine stood and leaked.
      pc.hline(x + 1, x + 4, y, dark)
      pc.hline(x, x + 5, y + 1, dark)
      pc.hline(x + 1, x + 4, y + 2, dark)
      pc.hline(x + 2, x + 3, y + 1, P.grime)
    } else {
      // A setting-out mark: a sprayed cross where a column is to stand.
      pc.hline(x, x + 2, y + 1, P.safetyOrange)
      pc.vline(x + 1, y, y + 2, P.safetyOrange)
      pc.px(x + 3, y + 1, P.safetyOrangeDark)
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
  const rand = mulberry32(variant * 131 + t * 7919 + SEED.ground)
  texture(pc, rand, t)
  if (variant >= 3) find(pc, rand, t, variant)
  return pc
}

// ---------- walkways ----------

/** Where a walkway runs across its tile: 8 px wide, down the middle, so arms meet their neighbours'. */
const LO = 4
const HI = 11
/** Where each board of a walkway's two is butt-jointed to the next, by variant: staggered. */
const JOINTS = [[3, 11], [7, 14], [1, 9], [12, 5]]

/**
 * Two scaffold boards side by side down the walkway, rows y0..y1. A board is 4 px: lit on its
 * left edge, dark on its right where it meets the next. Where one board butts up to the next, a
 * seam, and the steel band that stops a board's end splitting. `top` puts an end on the boards.
 */
function boardsDown(pc, y0, y1, joints, top) {
  for (let b = 0; b < 2; b++) {
    const x = LO + b * 4
    for (let y = y0; y <= y1; y++) {
      pc.px(x, y, P.plankLight)
      pc.hline(x + 1, x + 2, y, P.plank)
      pc.px(x + 3, y, P.plankDark)
    }
    const j = joints[b]
    if (j > y0 && j < y1) {
      pc.hline(x, x + 3, j, P.plankDark)
      pc.hline(x + 1, x + 2, j - 1, P.metal)
    }
    if (top) pc.hline(x + 1, x + 2, y0, P.metal)
  }
}

/** The same, across: boards lit along their top edge, seamed along their bottom. */
function boardsAcross(pc, x0, x1, joints, left, right) {
  for (let b = 0; b < 2; b++) {
    const y = LO + b * 4
    for (let x = x0; x <= x1; x++) {
      pc.px(x, y, P.plankLight)
      pc.vline(x, y + 1, y + 2, P.plank)
      pc.px(x, y + 3, P.plankDark)
    }
    const j = joints[b]
    if (j > x0 && j < x1) {
      pc.vline(j, y, y + 3, P.plankDark)
      pc.vline(j - 1, y + 1, y + 2, P.metal)
    }
    if (left) pc.vline(x0, y + 1, y + 2, P.metal)
    if (right) pc.vline(x1, y + 1, y + 2, P.metal)
  }
}

/**
 * A walkway of scaffold boards laid on the site's ground: 8 px wide down the middle of the tile,
 * with an arm out of each linked side reaching its edge, so it joins the next tile's. Laid, not
 * worn: straight edges, the boards' thickness showing along the near side, and a shadow on the
 * ground beside them. Where it turns or branches, the boards across lie on top of the boards down.
 */
export function drawTrail(variant, links, tone) {
  const t = toneOf(tone)
  const g = P.siteGround[t]
  const pc = new PixelCanvas(T, T)
  const rand = mulberry32(variant * 131 + links * 17 + t * 7919 + SEED.trail)
  texture(pc, rand, t)
  const N = links & 1
  const E = links & 2
  const S = links & 4
  const W = links & 8
  const down = N || S
  const across = E || W || !down
  const joints = JOINTS[variant % JOINTS.length]
  if (down) {
    const y0 = N ? 0 : LO
    const y1 = S ? T - 1 : HI
    pc.vline(HI + 1, y0 + 1, y1, g[3])
    boardsDown(pc, y0, y1, joints, !N)
    // The boards' ends, seen from the south, where they stop short of the tile's edge.
    if (!S) pc.hline(LO, HI, HI + 1, P.woodDark)
  }
  if (across) {
    const x0 = W ? 0 : LO
    const x1 = E ? T - 1 : HI
    pc.hline(x0 + 1, x1 + 1, HI + 2, g[3])
    boardsAcross(pc, x0, x1, joints, !W, !E)
    pc.hline(x0, x1, HI + 1, P.woodDark)
  }
  // Something on the boards.
  const mx = LO + 2 + Math.floor(rand() * 3)
  const my = LO + 1 + Math.floor(rand() * 3)
  if (variant === 1) {
    // A knot in the grain.
    pc.px(mx, my, P.plankDark)
    pc.px(mx + 1, my, P.woodDark)
  } else if (variant === 2) {
    // Muddy boots have been this way.
    pc.hline(mx - 1, mx, my, g[1])
    pc.hline(mx - 1, mx, my + 1, g[1])
    pc.hline(mx - 1, mx, my + 3, g[1])
  } else if (variant === 3) {
    // A board split along its grain.
    if (down && !across) pc.vline(LO + 1, my - 1, my + 3, P.plankDark)
    else pc.hline(mx - 2, mx + 2, LO + 1, P.plankDark)
  }
  return pc
}

// ---------- roads ----------

/**
 * Asphalt, the stones in the mix showing through. Variants 0–2 are plain; 3 has a crack sealed
 * with tar, 4 a patch where it was dug up and made good, 5 a manhole cover and a faded mark
 * painted by it.
 */
export function drawRoad(variant) {
  const pc = new PixelCanvas(T, T)
  const rand = mulberry32(variant * 131 + SEED.road * 7919)
  pc.rect(0, 0, T, T, P.asphalt)
  scatter(pc, rand, 16, (x, y) => pc.px(x, y, P.asphaltLight))
  scatter(pc, rand, 10, (x, y) => pc.px(x, y, P.asphaltDark))
  for (let i = 0; i < 2; i++) {
    // Scuffs where tyres turn.
    const x = Math.floor(rand() * 13)
    const y = Math.floor(rand() * 15)
    pc.hline(x, x + 2, y, P.asphaltDark)
  }
  if (variant === 3) {
    // A crack sealed with tar, stopping short of the tile's edges: no crack in the next tile
    // carries it on, and one cut off at the edge read as a seam in the road.
    let x = 4 + Math.floor(rand() * 8)
    for (let y = 3; y < 13; y++) {
      pc.px(x, y, y > 3 && y < 12 ? P.tarSeal : P.asphaltDark)
      if (y % 4 === 1) pc.px(x + 1, y, P.tarSeal) // the sealant runs wider than the crack
      if (rand() < 0.4) x = Math.max(2, Math.min(13, x + (rand() < 0.5 ? -1 : 1)))
    }
  } else if (variant === 4) {
    // Newer, blacker asphalt where a trench was filled, its seams sealed; the aggregate has not
    // worn through it yet. A tar outline all round read as a hatch, so only two sides show.
    const x = 3 + Math.floor(rand() * 3)
    const y = 3 + Math.floor(rand() * 3)
    pc.rect(x, y, 9, 7, P.asphaltDark)
    pc.px(x + 2, y + 2, P.asphalt)
    pc.px(x + 6, y + 4, P.asphalt)
    pc.px(x + 4, y + 5, P.asphaltLight)
    pc.hline(x, x + 8, y - 1, P.tarSeal)
    pc.vline(x + 9, y, y + 6, P.tarSeal)
  } else if (variant === 5) {
    // A cast-iron cover in its frame, cross-hatched for grip.
    pc.ellipse(7, 7, 4.5, 4.5, P.tarSeal)
    pc.ellipse(7, 7, 3.5, 3.5, P.metalDark)
    for (let y = 4; y <= 10; y++) for (let x = 4; x <= 10; x++) {
      if ((x + y) % 3 === 0 && (x + 0.5 - 7) ** 2 + (y + 0.5 - 7) ** 2 < 9) pc.px(x, y, P.asphaltLight)
    }
    pc.px(5, 4, P.metal)
    // The utilities' mark beside it, sprayed long ago and nearly worn off.
    pc.hline(12, 14, 13, P.roadPaint)
    pc.px(13, 12, P.roadPaint)
    pc.px(13, 14, P.roadPaint)
  }
  return pc
}

// ---------- fences ----------

/** A Heras fence's foot: a concrete block the panels' uprights stand in, x0..x1 of it in this tile. */
function heraFoot(pc, x0, x1) {
  pc.hline(x0, x1, 12, P.concreteLight)
  pc.hline(x0, x1, 13, P.concrete)
  pc.hline(x0, x1, 14, P.concreteDark)
}

/** A water-filled barrier's colours, by segment: red, then white. */
const BARRIER = [
  [P.barrierRedLight, P.barrierRed, P.barrierRedDark],
  [P.white, P.reflective, P.metal],
]
const HAZARD = [P.hardHat[0], P.rubber] // safety yellow and black

/** A timber stake the safety netting is tied to. */
function stake(pc, y0, y1) {
  pc.vline(7, y0, y1, P.wood)
  pc.vline(8, y0, y1, P.woodDark)
  pc.px(7, y0, P.woodLight)
}

/**
 * Each style draws a run across the tile (x from a to b, at the fence's height), a run down it
 * (y from a to b), and the post that stands at a corner or the end of a run.
 */
const FENCE_DRAW = {
  // Heras panels: a galvanised tube frame with wire mesh in it, see-through, clipped to the next
  // panel where they meet at the tile's edge and both standing in one concrete foot.
  mesh: {
    across(pc, a, b) {
      for (let x = a; x <= b; x++) {
        pc.px(x, 2, P.heras)
        // Wires every 2 rows and every 4 columns, clear of the edges so both ends match.
        for (const y of [4, 6, 8]) pc.px(x, y, P.herasDark)
        if (x % 4 === 2) pc.vline(x, 3, 10, P.herasDark)
        pc.px(x, 10, P.heras)
        pc.px(x, 11, P.herasDark)
      }
      for (const x of [0, T - 1]) {
        if (x < a || x > b) continue
        pc.vline(x, 2, 11, P.heras)
        for (const y of [3, 8]) pc.px(x, y, P.metalDark) // the coupler clip
      }
      if (a === 0) heraFoot(pc, 0, 2)
      if (b === T - 1) heraFoot(pc, T - 3, T - 1)
    },
    down(pc, a, b) {
      pc.vline(7, a, b, P.heras)
      pc.vline(8, a, b, P.herasDark)
      // The foot under the join, half in this tile and half in the next.
      if (a === 0) {
        pc.hline(5, 10, 0, P.concrete)
        pc.hline(5, 10, 1, P.concreteDark)
        pc.px(7, 0, P.metalDark)
      }
      if (b === T - 1) {
        pc.hline(5, 10, T - 2, P.concreteLight)
        pc.hline(5, 10, T - 1, P.concrete)
      }
    },
    post(pc) {
      pc.vline(7, 2, 11, P.heras)
      pc.vline(8, 2, 11, P.herasDark)
      heraFoot(pc, 5, 10)
    },
  },
  // Painted plywood hoarding: a capping along the top, sheets butted every 8 px (which divides
  // 16, so runs meet seamlessly), and a hazard stripe along its foot.
  hoarding: {
    across(pc, a, b) {
      pc.rect(a, 2, b - a + 1, 10, P.hoarding)
      pc.hline(a, b, 2, P.white)
      pc.hline(a, b, 3, P.plasterShade)
      pc.hline(a, b, 4, P.hoardingDark)
      for (let x = a; x <= b; x++) {
        if (x % 8 === 7) pc.vline(x, 5, 11, P.hoardingDark)
        if (x % 8 === 0) pc.vline(x, 5, 11, P.hoardingLight)
        for (const y of [12, 13]) pc.px(x, y, HAZARD[Math.floor(((x + y) % 4) / 2)])
      }
    },
    down(pc, a, b) {
      pc.vline(6, a, b, P.hoardingDark)
      pc.vline(7, a, b, P.white)
      pc.vline(8, a, b, P.plasterShade)
      pc.vline(9, a, b, P.hoarding)
    },
    post(pc) {
      pc.rect(5, 1, 6, 11, P.hoarding)
      pc.vline(10, 3, 11, P.hoardingDark)
      pc.hline(5, 10, 1, P.white)
      pc.hline(5, 10, 2, P.plasterShade)
      for (let x = 5; x <= 10; x++) for (const y of [12, 13]) pc.px(x, y, HAZARD[Math.floor(((x + y) % 4) / 2)])
    },
  },
  // Water-filled plastic barriers, red and white by turns, each 8 px long and interlocking.
  barrier: {
    across(pc, a, b) {
      for (let x = a; x <= b; x++) {
        const [lit, body, shade] = BARRIER[(x >> 3) & 1]
        const s = x % 8
        if (s > 0 && s < 7) pc.px(x, 5, lit)
        pc.vline(x, 6, 12, body)
        pc.px(x, 6, lit)
        pc.px(x, 9, shade)
        pc.px(x, 13, shade)
        if (s === 3 || s === 4) pc.px(x, 5, shade) // the filler cap
        if (s === 0 || s === 7) pc.vline(x, 7, 8, shade) // where it hooks into the next
      }
    },
    down(pc, a, b) {
      for (let y = a; y <= b; y++) {
        const [lit, body, shade] = BARRIER[(y >> 3) & 1]
        pc.px(6, y, lit)
        pc.hline(7, 8, y, body)
        pc.px(9, y, shade)
        if (y % 8 === 0) pc.hline(6, 9, y, shade)
      }
    },
    post(pc) {
      const [lit, body, shade] = BARRIER[0]
      pc.rect(4, 6, 8, 7, body)
      pc.hline(5, 10, 5, lit)
      pc.hline(4, 11, 6, lit)
      pc.hline(4, 11, 9, shade)
      pc.hline(4, 11, 13, shade)
      pc.vline(11, 7, 12, shade)
      // A road lamp clamped on top, amber.
      pc.hline(7, 8, 4, P.rubber)
      pc.rect(7, 2, 2, 2, P.hiVis[1])
      pc.px(7, 2, P.windowLitCore)
    },
  },
  // Orange safety netting tied to timber stakes. The net's holes repeat every 3 px, which divides
  // 15, so its first and last columns match and runs join up.
  netting: {
    across(pc, a, b) {
      if (a <= 7 && b >= 8) stake(pc, 3, 14)
      for (let x = a; x <= b; x++) {
        pc.px(x, 5, P.safetyOrange)
        for (let y = 6; y <= 11; y++) {
          if (y % 2 === 0) pc.px(x, y, P.safetyOrange)
          else if ((x + (y >> 1)) % 3 === 0) pc.px(x, y, P.safetyOrangeDark)
        }
        pc.px(x, 12, P.safetyOrangeDark)
      }
    },
    down(pc, a, b) {
      pc.vline(7, a, b, P.safetyOrange)
      pc.vline(8, a, b, P.safetyOrangeDark)
      if (a <= 7 && b >= 8) {
        pc.rect(6, 7, 3, 2, P.wood)
        pc.px(6, 7, P.woodLight)
      }
    },
    post(pc) {
      stake(pc, 2, 14)
    },
  },
}
const STYLES = ['mesh', 'hoarding', 'barrier', 'netting']

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
 * What gathers at a fence's foot on a site: clods of the ground kicked up against it, a stone,
 * and now and then a sandbag weighing it down. `mask` as the fence's (1 N, 2 E, 4 S, 8 W).
 * Drawn in the ground's own colours, so the patches tint it with the ground round it.
 */
export function drawVerge(mask, tone) {
  const pc = new PixelCanvas(T, T)
  const [, dark, light, deep] = groundOf(tone)
  const rand = mulberry32(mask * 977 + toneOf(tone) * 131 + 7)
  const clod = (x, y) => {
    pc.px(x, y, light)
    pc.px(x + 1, y, dark)
    pc.hline(x, x + 1, y + 1, deep)
  }
  const across = mask & (2 | 8)
  const down = mask & (1 | 4)
  if (across) {
    const x0 = mask & 8 ? 0 : 4
    const x1 = mask & 2 ? T - 2 : 10
    clod(x0 + Math.floor(rand() * 3), 14)
    for (let x = x0 + 4; x <= x1; x += 3) {
      const r = rand()
      if (r < 0.4) clod(x, 14)
      else if (r < 0.55) {
        // A stone.
        pc.hline(x, x + 1, 14, P.pebble)
        pc.px(x, 14, P.stoneLight)
        pc.hline(x, x + 1, 15, P.stoneDark)
      }
    }
    for (let x = x0; x <= x1; x++) if (rand() < 0.15) pc.px(x, 15, dark)
    if (rand() < 0.3) {
      // A sandbag.
      const x = x0 + 2 + Math.floor(rand() * Math.max(1, x1 - x0 - 6))
      pc.hline(x + 1, x + 3, 12, P.sack)
      pc.hline(x, x + 4, 13, P.sack)
      pc.px(x + 4, 13, P.sackDark)
      pc.hline(x, x + 4, 14, P.sackDark)
      pc.px(x + 2, 12, P.sackDark)
    }
  }
  if (down) {
    // Beside the run, but not on the side a run across leaves by: there they'd be spattered up
    // the face of a hoarding or a barrier rather than lying at its foot.
    const left = !(mask & 8)
    const right = !(mask & 2)
    for (let y = mask & 1 ? 1 : 5; y <= (mask & 4 ? 14 : 10); y += 3) {
      if (left && rand() < 0.4) clod(1 + Math.floor(rand() * 2), y)
      if (right && rand() < 0.4) clod(12 + Math.floor(rand() * 2), y)
    }
    if (right) clod(12, mask & 4 ? 13 : 9)
    else if (left) clod(2, mask & 4 ? 13 : 9)
  }
  if (!across && !down) {
    clod(4, 14)
    clod(10, 14)
    pc.px(7, 15, dark)
  }
  return pc
}

/**
 * The site's ground spilling onto the road along one side of it: loose stones and a lip of dirt.
 * Variant `side * 2 + k`, as the village's grass fringe: side 0 top, 1 right, 2 bottom, 3 left of
 * the road tile, k one of two scatters, and 8 more leaves a walkway's mouth open.
 */
export function drawFringe(variant, tone) {
  const pc = new PixelCanvas(T, T)
  const [base, dark, light] = groundOf(tone)
  const mouth = variant >= 8
  const side = (variant & 7) >> 1
  const rand = mulberry32(variant * 613 + toneOf(tone) * 71 + 29)
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
    if (r < 0.4 || open(i)) continue
    set(i, 0, r < 0.75 ? base : dark)
    if (r > 0.88) set(i, 1, base)
    n++
  }
  // A stone or two thrown further out.
  for (let s = 0; s < 2; s++) {
    const i = Math.floor(rand() * T)
    if (open(i) || rand() < 0.4) continue
    set(i, 2 + Math.floor(rand() * 2), light)
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

/**
 * A chunk of broken concrete, w×h, lit on top and dark down its near sides: in concrete's own
 * colours alone it vanished on a concrete slab.
 */
function chunk(pc, x, y, w, h) {
  pc.rect(x, y, w, h, P.concrete)
  pc.hline(x, x + w - 1, y, P.concreteLight)
  pc.vline(x + w - 1, y + 1, y + h - 1, P.concreteDark)
  pc.hline(x, x + w - 1, y + h - 1, P.stoneDark)
}

/** A brick lying flat, 4×2. */
function brick(pc, x, y) {
  pc.hline(x, x + 3, y, P.brick)
  pc.hline(x, x + 3, y + 1, P.brickDark)
  pc.px(x, y, P.mortar)
}

/** A loose plank, x0..x1 along row y: lit edge, face, and its end grain. */
function plank(pc, x0, x1, y) {
  pc.hline(x0, x1, y, P.plankLight)
  pc.hline(x0, x1, y + 1, P.plank)
  pc.hline(x0, x1, y + 2, P.plankDark)
  pc.vline(x1, y, y + 2, P.woodDark)
}

/**
 * Flat things that lie about on a site and get walked over: `deco.<kind>.<variant>`, over the
 * ground of `tone`.
 */
export function drawCover(kind, variant, tone) {
  const pc = new PixelCanvas(T, T)
  const [, dark, , deep] = groundOf(tone)
  if (kind === 'puddle') {
    // Muddy at the rim, the sky in the middle, a ripple.
    const big = variant === 1
    const rx = big ? 5.5 : 3.5
    const ry = big ? 3 : 2
    pc.ellipse(8, 9, rx + 1, ry + 1, dark)
    pc.ellipse(8, 9, rx, ry, P.puddle)
    pc.hline(6, 8, 8, P.puddleLight)
    if (big) pc.hline(9, 11, 10, P.puddleLight)
    pc.hline(8 - Math.floor(rx), 8 + Math.floor(rx) - 1, 9 + ry, deep)
    return pc
  }
  if (kind === 'rubble') {
    if (variant === 2) {
      // A heap of it.
      chunk(pc, 3, 8, 4, 3)
      chunk(pc, 6, 6, 5, 4)
      chunk(pc, 10, 9, 3, 2)
      brick(pc, 4, 11)
      pc.px(12, 6, P.concreteDark)
      pc.px(2, 12, P.concreteLight)
    } else {
      chunk(pc, 3, 5, 4, 3)
      chunk(pc, 9, 9, 3, 2)
      chunk(pc, 5, 11, 2, 2)
      if (variant === 1) brick(pc, 10, 4)
      else {
        // The reinforcing bar it broke away from, still sticking out.
        pc.px(7, 4, P.rust)
        pc.px(8, 3, P.rust)
        pc.px(12, 5, P.concreteLight)
      }
    }
    return dropShadow(pc)
  }
  if (kind === 'planks') {
    if (variant === 0) {
      plank(pc, 2, 12, 5)
      plank(pc, 4, 14, 9)
    } else {
      plank(pc, 1, 13, 7)
      plank(pc, 8, 12, 11)
      pc.px(4, 8, P.metalDark) // a nail left in it
    }
    return dropShadow(pc)
  }
  if (kind === 'bricks') {
    if (variant === 0) {
      brick(pc, 3, 5)
      brick(pc, 9, 7)
      brick(pc, 5, 10)
    } else {
      // A few stacked, a course of three on a course of three.
      for (const y of [10, 8]) for (const x of [3, 7]) brick(pc, x, y)
      brick(pc, 5, 6)
      pc.vline(11, 6, 11, P.brickDark)
      brick(pc, 11, 11)
    }
    return dropShadow(pc)
  }
  if (kind === 'hose') {
    // A hose in two loose coils, the ground showing between them, its end trailing off.
    const coil = [
      '   oooooo   ',
      ' oo      oo ',
      'o   oooo   o',
      'o  o    d  o',
      'd  d    d  d',
      'd   dddd   d',
      ' dd      dd ',
      '   dddddd   ',
    ]
    coil.forEach((row, dy) => [...row].forEach((c, dx) => c !== ' ' && pc.px(2 + dx, 4 + dy, c === 'o' ? P.hose : P.hoseDark)))
    pc.hline(12, 14, 10, P.hose)
    pc.px(15, 10, P.metal)
    return dropShadow(pc)
  }
  if (kind === 'cone') {
    // A traffic cone knocked over onto its side, its base square and its tip pointing off.
    pc.rect(2, 7, 2, 6, P.rubber)
    for (let x = 4; x <= 12; x++) {
      const half = Math.max(0, Math.round((12 - x) / 3.2))
      pc.vline(x, 10 - half, 10 + half - 1 + (half ? 0 : 1), P.safetyOrange)
      pc.px(x, 10 - half, x < 12 ? P.hiVis[1] : P.safetyOrangeDark)
    }
    for (const x of [7, 8]) {
      const half = Math.round((12 - x) / 3.2)
      pc.vline(x, 10 - half, 9 + half, P.reflective)
    }
    pc.hline(4, 11, 11, P.safetyOrangeDark)
    dropShadow(pc)
    return variant === 1 ? pc.flipX() : pc
  }
  if (kind === 'rebar') {
    // Offcuts of reinforcing bar, rusty, their ribs catching the light.
    for (const [x0, x1, y] of [[2, 13, 5], [4, 12, 8], [1, 9, 11]]) {
      pc.hline(x0, x1, y, P.rebar)
      for (let x = x0 + 1; x <= x1; x += 2) pc.px(x, y, P.rust)
      pc.px(x1, y, P.rustDark)
    }
    return dropShadow(pc)
  }
  if (kind === 'pipes') {
    // Two lengths of drainage pipe, one open end towards us.
    for (const [x0, x1, y] of [[2, 10, 5], [5, 13, 10]]) {
      pc.hline(x0, x1, y, P.pipe)
      pc.hline(x0, x1, y + 1, P.pipe)
      pc.hline(x0, x1, y + 2, P.pipeDark)
      pc.hline(x0 + 1, x1 - 2, y, P.pipeLight)
      pc.vline(x1 + 1, y, y + 2, P.pipeDark)
      pc.px(x1 + 1, y + 1, P.rubber)
    }
    return dropShadow(pc)
  }
  // A cement sack, torn at one corner, grey powder spilling out.
  pc.rect(3, 6, 8, 5, P.sack)
  pc.hline(4, 9, 6, P.white)
  pc.vline(10, 7, 9, P.sackDark)
  pc.hline(4, 9, 10, P.sackDark)
  pc.clearPx(3, 6)
  pc.clearPx(10, 6)
  pc.clearPx(3, 10)
  pc.clearPx(10, 10)
  pc.hline(5, 8, 8, P.hoarding) // the maker's print
  pc.px(10, 8, P.concreteLight)
  pc.hline(11, 13, 9, P.concreteLight)
  pc.hline(11, 14, 10, P.concrete)
  return dropShadow(pc)
}

/**
 * Where things lie about: slow noise, a step every few tiles, so they gather in drifts rather
 * than peppering the ground, and only some tiles in a drift, so a drift thins out raggedly.
 * Octaves of value noise bunch round 0.5, so a drift is where it rises into its top sixth or so.
 */
const DRIFT_SCALE = 1 / 4.5
const RUBBLE_DRIFT = 0.67
const RUBBLE_FILL = 0.2
const PUDDLE_DRIFT = 0.7
/** How many tiles of a wet drift hold a puddle, by ground: gravel drains, sand soaks it up, dirt and a slab hold water. */
const PUDDLE_FILL = [0.1, 0.3, 0, 0.2]
/** The odd thing, anywhere, by ground. */
const ODDS = [
  ['planks', 'cone', 'rebar', 'pipes', 'bricks', 'hose'],
  ['planks', 'bricks', 'cone', 'hose', 'sack', 'rebar'],
  ['planks', 'sack', 'cone', 'bricks', 'hose'],
  ['pipes', 'rebar', 'hose', 'cone', 'sack', 'planks'],
]
const ODD_SHARE = 0.02

/** What lies on the plot ground tile (tx, ty), if anything: `{ kind, variant }`, or null. */
export function siteCover(tx, ty, tone) {
  const t = toneOf(tone)
  const h = lattice(tx, ty, 191)
  const v = lattice(tx, ty, 192)
  const x = tx * DRIFT_SCALE
  const y = ty * DRIFT_SCALE
  if (PUDDLE_FILL[t] && fbm(x, y, 137) > PUDDLE_DRIFT) {
    if (h < PUDDLE_FILL[t]) return { kind: 'puddle', variant: v < 0.6 ? 0 : 1 }
  } else if (fbm(x, y, 131) > RUBBLE_DRIFT) {
    // Sand is where the bricks are stacked; everywhere else, rubble.
    const kind = t === SAND ? 'bricks' : 'rubble'
    if (h < RUBBLE_FILL) return { kind, variant: Math.floor(v * COVER_VARIANTS[kind]) }
  }
  if (h > 1 - ODD_SHARE) {
    const list = ODDS[t]
    const kind = list[Math.floor(v * list.length)]
    return { kind, variant: Math.floor(lattice(tx, ty, 193) * COVER_VARIANTS[kind]) }
  }
  return null
}

/** The ground's plain colours, each paired with its dry and its damp partner. */
export function patches(tone) {
  const t = toneOf(tone)
  return [P.siteGround[t], P.siteGroundSunny[t], P.siteGroundLush[t]]
}
