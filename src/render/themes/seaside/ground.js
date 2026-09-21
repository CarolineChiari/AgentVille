// Seaside ground, ways and fences: dry sand, shingle, boardwalk decking or the wet flags of a
// quay inside each plot, a way of sea-rounded cobbles round it, a plank walk across it, and fences
// of rope, drying net, groyne baulks and painted railing.
//
// Contract (see ThemePack in ../index.js and the village's src/render/sprites/tiles.js):
// - `tone` is a plot's yard, an index into THEMES.seaside.dims.yard (sand, shingle, boardwalk,
//   harbourstone).
// - Ground, trail and road tiles are 16×16 and fully opaque; each variant is its own picture.
// - A fence's `style` indexes THEMES.seaside.dims.fence; `mask` which sides carry on (1 N, 2 E,
//   4 S, 8 W). A straight run meets the next tile's edge to edge, so nothing a run draws may
//   differ in shape between its first column and its last. Every pattern below therefore has a
//   period that divides 15 — 3 or 5 — which is the only way column 0 and column 15 agree.
// - `patches(tone)` is [plain, sunny, lush]: the ground's plain colours, and what each becomes
//   where it has dried out and where the tide still reaches. Only pixels exactly a plain colour
//   are repainted.
// - `seaCover` is pure: the same tile always has the same thing lying on it, or nothing.
import { PALETTE as P } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { mulberry32 } from '../../../sim/rng.js'
import { fbm, lattice } from '../../../sim/noise.js'

const T = 16
const SAND = 0
const SHINGLE = 1
const DECK = 2
const QUAY = 3

const toneOf = (tone) => (tone || 0) % P.seaGround.length
/** A ground's colours: base, shade, light, deepest. All four are its plain colours. */
const groundOf = (tone) => P.seaGround[toneOf(tone)]
/** A buoy or float's colour, by whatever number is to hand. */
const buoyOf = (i) => P.buoy[Math.abs(Math.floor(i)) % P.buoy.length]

/** How many looks each thing lying about has; drawn as `deco.<kind>.<variant>`. */
export const COVER_VARIANTS = { pots: 2, nets: 2, shells: 2, weed: 2, driftwood: 2, floats: 1 }
/** The lip drawn where the way meets anything else: the wet seam between its cobbles. */
export const ROAD_EDGE = P.quaySeam
/** What the strand is edged in: the driftwood boards holding the sand back. */
export const BED_EDGE = P.driftwoodDark

// ---------- the ground ----------

/** Seeds per kind of tile, so a way and a ground of the same variant don't share a scatter. */
const SEED = { ground: 41, trail: 42, road: 43 }

function scatter(rand, n, draw) {
  for (let i = 0; i < n; i++) draw(Math.floor(rand() * T), Math.floor(rand() * T))
}

/** A broken shell lying flat, two or three pixels of it. */
function grit(pc, x, y, i) {
  pc.px(x, y, i % 3 ? P.shellGrit : P.shellWhite)
  if (i % 2) pc.px(x + 1, y, P.shellShade)
}

/** A shell on the ground, small enough to read at 1×: a pale fan with its hinge in shadow. */
function shell(pc, x, y, i) {
  const face = i % 3 === 0 ? P.shellPink : P.shellWhite
  pc.hline(x, x + 2, y, face)
  pc.px(x + 1, y - 1, face)
  pc.hline(x, x + 2, y + 1, P.shellShade)
}

/** A frond of weed: wrack dried brown up the strand, green where the tide still reaches it. */
function frond(pc, x, y, wet) {
  const c = wet ? P.seaweed : P.wrack
  const dark = wet ? P.seaweedDark : P.wrackDark
  pc.hline(x, x + 2, y, c)
  pc.px(x + 3, y + 1, dark)
  pc.px(x - 1, y + 1, dark)
}

/** The ground itself, before anything is found in it. */
function texture(pc, rand, t) {
  const [base, dark, light, deep] = P.seaGround[t]
  pc.rect(0, 0, T, T, base)
  if (t === SAND) {
    // Ripples the last tide left, drawn across in long shallow bands, and broken shell in them.
    for (let i = 0; i < 5; i++) {
      const x = Math.floor(rand() * 9)
      const y = 1 + Math.floor(rand() * 14)
      pc.hline(x, x + 6, y, light)
      pc.hline(x + 1, x + 5, y + 1, dark)
    }
    scatter(rand, 10, (x, y) => grit(pc, x, y, x + y))
    scatter(rand, 6, (x, y) => pc.px(x, y, deep))
  } else if (t === SHINGLE) {
    // Pebbles, every one its own stone: a scatter of pixels read as noise rather than as shingle.
    for (let i = 0; i < 26; i++) {
      const x = Math.floor(rand() * T)
      const y = Math.floor(rand() * T)
      const r = rand()
      const c = r < 0.4 ? light : r < 0.75 ? dark : deep
      pc.hline(x, x + 1, y, c)
      if (r < 0.55) pc.px(x, y + 1, deep)
      else pc.px(x + 1, y + 1, dark)
    }
    scatter(rand, 5, (x, y) => grit(pc, x, y, x))
  } else if (t === DECK) {
    // Decking: boards running across on a period of four, so a run of them lines up tile to tile,
    // with the gap between boards dark and the sand that has blown into it paler.
    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        const s = y % 4
        if (s === 3) pc.px(x, y, deep)
        else if (s === 0) pc.px(x, y, light)
        else if ((x * 5 + y * 3) % 11 === 0) pc.px(x, y, dark)
      }
    }
    // Nails, two to a board, and the grain running along it.
    for (let y = 1; y < T; y += 4) for (const x of [2, 11]) pc.px(x + ((y >> 2) & 1) * 3, y, P.seaIron)
    scatter(rand, 6, (x, y) => pc.hline(x, x + 2, y - (y % 4 === 3 ? 1 : 0), dark))
  } else {
    // Quay flags, laid long ago and always a little wet: 8 px squares with weed in the joints.
    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        if (y % 8 === 7 || x % 8 === 7) pc.px(x, y, deep)
        else if (y % 8 === 0 || x % 8 === 0) pc.px(x, y, light)
      }
    }
    scatter(rand, 9, (x, y) => pc.px(x, y, dark))
    for (let i = 0; i < 5; i++) pc.px(Math.floor(rand() * T), (Math.floor(rand() * 2) * 8 + 7) % T, P.seaweed)
  }
}

/** What a rare tile has in it: variants 3, 4 and 5 of each ground. */
function find(pc, rand, t, variant) {
  const [base, dark, light, deep] = P.seaGround[t]
  const x = 4 + Math.floor(rand() * 6)
  const y = 4 + Math.floor(rand() * 6)
  const k = variant - 3
  if (t === SAND) {
    if (k === 0) {
      // A pool left behind in a hollow, with the sky in it and weed round the rim.
      pc.ellipse(x, y, 4.5, 2.5, P.tidePool)
      pc.ellipse(x, y - 0.5, 3, 1.3, P.tidePoolLight)
      pc.hline(x - 4, x + 4, y + 3, deep)
      frond(pc, x - 2, y + 4, true)
    } else if (k === 1) {
      // Gull tracks, three toes at a time, walking away.
      for (let i = 0; i < 4; i++) {
        const tx = x - 4 + i * 3
        const ty = y + (i % 2) * 3
        pc.px(tx, ty, deep)
        pc.px(tx - 1, ty - 1, deep)
        pc.px(tx + 1, ty - 1, deep)
        pc.px(tx, ty + 1, dark)
      }
    } else {
      // A line of finds along the strand: shells and a knot of dried weed.
      for (let i = 0; i < 4; i++) shell(pc, 2 + ((i * 4) % 12), 6 + (i % 3) * 3, i)
      frond(pc, 9, 12, false)
    }
  } else if (t === SHINGLE) {
    if (k === 0) {
      // A drift of wrack heaped along the high-water mark.
      for (let i = 0; i < 6; i++) frond(pc, 1 + ((i * 3) % 12), 5 + (i % 4) * 2, false)
    } else if (k === 1) {
      // A boulder among the shingle, lichen up its sunny side.
      pc.ellipse(x, y + 1, 4.5, 3.5, dark)
      pc.ellipse(x - 1, y, 3, 2, light)
      pc.hline(x - 4, x + 4, y + 4, deep)
      pc.px(x - 2, y - 2, P.shoreLichen)
      pc.px(x + 1, y - 2, P.shoreLichen)
    } else {
      // A plank of driftwood, bleached and split, worked up the beach by the tides.
      pc.hline(2, 13, y, P.driftwoodLight)
      pc.hline(2, 13, y + 1, P.driftwood)
      pc.hline(2, 13, y + 2, P.driftwoodDark)
      for (let i = 4; i < 13; i += 4) pc.px(i, y + 1, P.driftwoodDark)
      pc.hline(2, 13, y + 3, deep)
    }
  } else if (t === DECK) {
    if (k === 0) {
      // A coil of rope dropped on the boards.
      for (const r of [4, 3, 2]) pc.ellipse(x, y, r, r * 0.6, r % 2 ? P.rope : P.ropeDark)
      pc.ellipse(x, y, 1, 0.6, deep)
      pc.px(x + 4, y + 2, P.ropeLight)
    } else if (k === 1) {
      // A hatch in the decking, with a brass ring let into it.
      pc.rect(x - 4, y - 3, 9, 8, dark)
      pc.hline(x - 4, x + 4, y - 3, light)
      pc.rect(x - 3, y - 2, 7, 6, base)
      for (let i = y - 2; i <= y + 3; i += 2) pc.hline(x - 3, x + 3, i, deep)
      pc.hline(x - 1, x + 1, y, P.brass)
      pc.px(x, y, P.brassDark)
    } else {
      // A board that has been replaced: new timber, paler, and the nails still bright.
      const y0 = (y >> 2) * 4
      pc.rect(0, y0, T, 3, P.driftwoodLight)
      pc.hline(0, T - 1, y0 + 2, P.driftwood)
      for (let i = 2; i < T; i += 5) pc.px(i, y0 + 1, P.seaIronLight)
    }
  } else {
    if (k === 0) {
      // A mooring ring, set into the flags where a boat ties up.
      pc.ellipse(x, y, 3, 2.5, P.seaIron)
      pc.ellipse(x, y, 1.5, 1.2, deep)
      pc.px(x - 1, y - 2, P.seaIronLight)
      pc.hline(x - 1, x + 1, y + 3, P.seaIronLight)
      pc.px(x + 3, y + 3, P.seaweed)
    } else if (k === 1) {
      // Standing seawater in the dip of a flag.
      pc.ellipse(x, y, 5, 2.5, P.tidePool)
      pc.ellipse(x, y, 3.5, 1.5, P.tidePoolLight)
      pc.hline(x - 3, x - 1, y + 2, deep)
    } else {
      // A flag cracked end to end, the weed growing up through it.
      let cx = 4 + Math.floor(rand() * 7)
      for (let cy = 0; cy < T; cy++) {
        pc.px(cx, cy, deep)
        if (cy % 3 === 1) pc.px(cx + 1, cy, P.seaweed)
        if (rand() < 0.35) cx = Math.max(1, Math.min(14, cx + (rand() < 0.5 ? -1 : 1)))
      }
    }
  }
}

/**
 * A plot's ground. Variants 0–2 are plain and carry the ground; 3–5 are rare (see TILE_WEIGHTS in
 * the village's tiles) and each holds something the tide or the work has left there.
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
 * The strand, where the village has its ploughed field: damp sand raked into ripples above the
 * tide, with a ring of shingle set round each spot a find is laid out on. The rings are on the
 * village's grid of dimples, 8 px apart: variant 0 is the strand's top row, variant 1 every row
 * below it, which carries the grid on from the row above (see the village's `bed` tile).
 * Everything but the shell grit is drawn in the ground's own colours, so the strand takes its
 * plot's patches along with the rest of it.
 */
export function drawBed(variant, tone) {
  const [base, dark, light, deep] = groundOf(tone)
  const pc = new PixelCanvas(T, T)
  pc.rect(0, 0, T, T, base)
  // Ripples drawn across, the way the tide leaves them: a light crest and a dark trough.
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const s = y % 4
      if (s === 0) pc.px(x, y, deep)
      else if (s === 1) pc.px(x, y, dark)
      else if (s === 3 && (x * 3 + y) % 5) pc.px(x, y, light)
    }
  }
  for (const y0 of variant ? [-4, 4] : [4]) {
    for (const x0 of [0, 8]) {
      // A ring of shingle round the spot, so a bare one still reads as somewhere a find goes.
      pc.hline(x0 + 2, x0 + 5, y0 + 5, light)
      pc.hline(x0 + 3, x0 + 4, y0 + 4, base)
      pc.hline(x0 + 2, x0 + 5, y0 + 6, dark)
      pc.px(x0 + 1, y0 + 5, P.shellGrit)
      pc.px(x0 + 6, y0 + 4, P.shellShade)
    }
  }
  return pc
}

// ---------- the walk across a plot ----------

/** Where the walk runs across its tile: 8 px wide, down the middle, so arms meet their neighbours'. */
const LO = 4
const HI = 11

/**
 * A plank walk laid across the sand: boards 8 px wide down the middle of the tile, an arm out of
 * each linked side to its edge, on bearers, with the sand drifted up against both sides. The
 * boards of an arm run across the way it goes, as a boardwalk's do.
 */
export function drawTrail(variant, links, tone) {
  const t = toneOf(tone)
  const g = P.seaGround[t]
  const pc = new PixelCanvas(T, T)
  const rand = mulberry32(variant * 149 + links * 19 + t * 6151 + SEED.trail)
  texture(pc, rand, t)
  const N = links & 1
  const E = links & 2
  const S = links & 4
  const W = links & 8
  const down = N || S
  const across = E || W || !down
  /** Boards across a run that goes down the tile: one board every three rows. */
  const boardsDown = (x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) {
      const s = ((y % 3) + 3) % 3
      for (let x = x0; x <= x1; x++) pc.px(x, y, s === 2 ? P.driftwoodDark : s === 0 ? P.driftwoodLight : P.driftwood)
    }
    for (const x of [x0, x1]) pc.vline(x, y0, y1, P.driftwoodDark)
  }
  /** And along a run that goes across it. */
  const boardsAcross = (x0, y0, x1, y1) => {
    for (let x = x0; x <= x1; x++) {
      const s = ((x % 3) + 3) % 3
      for (let y = y0; y <= y1; y++) pc.px(x, y, s === 2 ? P.driftwoodDark : s === 0 ? P.driftwoodLight : P.driftwood)
    }
    for (const y of [y0, y1]) pc.hline(x0, x1, y, P.driftwoodDark)
  }
  // The sand the wind has banked against the edge of the boards.
  const drift = (x0, y0, x1, y1) => {
    for (let i = 0; i <= Math.max(x1 - x0, y1 - y0); i += 2) {
      const x = x0 === x1 ? x0 : x0 + i
      const y = y0 === y1 ? y0 : y0 + i
      pc.px(x, y, g[2])
      if ((x + y) % 3 === 0) pc.px(x0 === x1 ? x + 1 : x, y0 === y1 ? y + 1 : y, g[0])
    }
  }
  const dy0 = N ? 0 : LO
  const dy1 = S ? T - 1 : HI
  const ax0 = W ? 0 : LO
  const ax1 = E ? T - 1 : HI
  if (down) {
    boardsDown(LO, dy0, HI, dy1)
    drift(LO - 1, dy0, LO - 1, dy1)
    drift(HI + 1, dy0, HI + 1, dy1)
  }
  if (across) {
    boardsAcross(ax0, LO, ax1, HI)
    drift(ax0, LO - 1, ax1, LO - 1)
    drift(ax0, HI + 1, ax1, HI + 1)
  }
  // Something on the boards, by variant.
  if (variant === 1) shell(pc, 6, 9, 1)
  else if (variant === 2) {
    pc.px(7, 7, P.seaIron)
    pc.px(9, 11, P.seaIron)
  } else if (variant === 3) {
    // A knot of dried weed trodden into a joint.
    frond(pc, 6, 8, false)
  }
  return pc
}

// ---------- the way round a plot ----------

/**
 * The way round a plot: cobbles the sea has rounded, set in sand and never quite dry. Stones are
 * 3 px across in staggered courses of four rows, so the joints line up tile to tile. Variants 0–2
 * are plain; 3 has a rope dropped across it, 4 a puddle of seawater, 5 sand drifted over it.
 */
export function drawRoad(variant) {
  const pc = new PixelCanvas(T, T)
  const rand = mulberry32(variant * 149 + SEED.road * 6151)
  pc.rect(0, 0, T, T, P.quayCobble)
  for (let y = 0; y < T; y++) {
    const course = Math.floor(y / 4)
    for (let x = 0; x < T; x++) {
      const joint = (x + course * 2) % 4 === 3
      if (y % 4 === 3 || joint) pc.px(x, y, P.quaySeam)
      // Rounded stones: the light catches the top left of each one and its foot stays dark.
      else if (y % 4 === 0 && !joint) pc.px(x, y, P.quayCobbleLight)
      else if (y % 4 === 2) pc.px(x, y, P.quayCobbleDark)
    }
  }
  scatter(rand, 10, (x, y) => pc.px(x, y, P.quayCobbleDark))
  scatter(rand, 6, (x, y) => pc.px(x, y, P.quayCobbleLight))
  // Sand finds the joints first, so it is scattered along them rather than over the stones.
  for (let i = 0; i < 8; i++) {
    const x = Math.floor(rand() * T)
    const y = Math.floor(rand() * 4) * 4 + 3
    pc.px(x, y, P.seaGround[SAND][0])
    if (rand() < 0.4) pc.px(x, y - 1, P.seaGround[SAND][2])
  }
  if (variant === 3) {
    // A rope led away across the stones to whatever is tied on at the end of it.
    for (let x = 0; x < T; x++) {
      const y = 7 + Math.round(Math.sin(x * 0.5) * 2)
      pc.px(x, y, (x & 1) ? P.rope : P.ropeDark)
      pc.px(x, y + 1, P.ropeDark)
    }
    shell(pc, 3, 13, 0)
  } else if (variant === 4) {
    // Seawater standing in a hollow, with the weed that lives in it.
    pc.ellipse(8, 8, 5.5, 3, P.tidePool)
    pc.ellipse(8, 8, 4, 2, P.tidePoolLight)
    pc.hline(5, 7, 10, P.seaweed)
    pc.px(11, 7, P.seaweedDark)
  } else if (variant === 5) {
    const sandc = P.seaGround[SAND]
    for (let i = 0; i < 5; i++) {
      const x = Math.floor(rand() * 11)
      const y = Math.floor(rand() * 13)
      pc.hline(x, x + 4, y, sandc[0])
      pc.hline(x + 1, x + 3, y + 1, sandc[2])
    }
    grit(pc, 12, 11, 1)
  }
  return pc
}

// ---------- fences ----------

/** How far a swag of rope dips between its posts, by column. Period five: five divides fifteen. */
const SWAG = [2, 1, 0, 1, 2]
/** How high each column of a groyne's baulks stands. Period five, likewise; -1 is the gap. */
const BAULK = [4, 3, 3, 5, -1]

/** A post of salted timber down a column, from y0 to y1. */
function post(pc, x, y0, y1) {
  pc.vline(x, y0, y1, P.driftwood)
  pc.vline(x + 1, y0, y1, P.driftwoodDark)
  pc.px(x, y0, P.driftwoodLight)
}

/** A run of net between two posts, over y0..y1: a diamond mesh on a period of three. */
function mesh(pc, x0, x1, y0, y1) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      // Both diagonals on a period of three, so column 0 and column 15 carry the same threads.
      const a = ((x + y) % 3 + 3) % 3
      const b = ((x - y) % 3 + 3) % 3
      if (a === 0 || b === 0) pc.px(x, y, a === 0 && b === 0 ? P.netTwine : P.netTwineDark)
    }
  }
}

/**
 * Each style draws a run across the tile (x from a to b, at the fence's height), a run down it
 * (y from a to b), and the post that stands at a corner or the end of a run.
 */
const FENCE_DRAW = {
  // Rope slung between salted posts, two swags of it, the way a quay keeps people off the edge.
  rope: {
    across(pc, a, b) {
      for (let x = a; x <= b; x++) {
        const s = x % 5
        if (s === 0) post(pc, x, 5, 14)
        pc.px(x, 7 + SWAG[s], P.ropeLight)
        pc.px(x, 8 + SWAG[s], P.ropeDark)
        pc.px(x, 11 + SWAG[s], P.rope)
        pc.px(x, 12 + SWAG[s], P.ropeDark)
      }
    },
    down(pc, a, b) {
      post(pc, 6, a, b)
      for (let y = a; y <= b; y++) {
        const s = y % 5
        pc.px(9 + (SWAG[s] > 1 ? 1 : 0), y, P.ropeLight)
        pc.px(10 + (SWAG[s] > 1 ? 1 : 0), y, P.ropeDark)
      }
    },
    post(pc) {
      // A bollard: a squat post with a rope turn round its head and the tail hanging down.
      pc.rect(6, 3, 4, 13, P.driftwood)
      pc.vline(6, 3, 15, P.driftwoodLight)
      pc.vline(9, 3, 15, P.driftwoodDark)
      pc.hline(5, 10, 3, P.driftwoodLight)
      pc.hline(5, 10, 4, P.driftwoodDark)
      for (const y of [6, 8]) {
        pc.hline(5, 10, y, P.rope)
        pc.hline(5, 10, y + 1, P.ropeDark)
      }
      pc.vline(11, 9, 12, P.ropeDark)
      return pc
    },
  },
  // Nets hung out to dry between posts, with the corks still knotted into them.
  net: {
    across(pc, a, b) {
      pc.hline(a, b, 4, P.ropeLight)
      pc.hline(a, b, 5, P.ropeDark)
      mesh(pc, a, b, 6, 14)
      for (let x = a; x <= b; x++) {
        if (x % 5 === 0) post(pc, x, 3, 15)
        // A cork every fifth column: the mesh alone read as a wire fence from a distance.
        if (x % 5 === 3) {
          pc.hline(x - 1, x, 9, P.rope)
          pc.px(x - 1, 10, P.ropeDark)
        }
      }
    },
    down(pc, a, b) {
      pc.vline(5, a, b, P.ropeLight)
      pc.vline(6, a, b, P.ropeDark)
      mesh(pc, 7, 11, a, b)
      for (let y = a; y <= b; y++) if (y % 5 === 3) pc.hline(9, 10, y, P.rope)
    },
    post(pc) {
      post(pc, 7, 2, 15)
      pc.hline(6, 9, 2, P.driftwoodLight)
      // The net gathered in and knotted off at the post.
      mesh(pc, 9, 13, 5, 13)
      pc.hline(9, 11, 4, P.rope)
      pc.px(10, 6, P.rope)
      return pc
    },
  },
  // Groyne baulks: tarred timbers driven in side by side, with a walk plank pegged along the top.
  groyne: {
    across(pc, a, b) {
      for (let x = a; x <= b; x++) {
        const top = BAULK[x % 5]
        if (top < 0) {
          pc.vline(x, 6, 15, P.quaySeam)
          continue
        }
        pc.vline(x, top, 15, P.pitch)
        pc.px(x, top, P.tarboardLight)
        if (x % 5 === 0) pc.vline(x, top + 1, 15, P.tarboard)
      }
      pc.hline(a, b, 8, P.driftwood)
      pc.hline(a, b, 9, P.driftwoodDark)
      for (let x = a; x <= b; x++) if (x % 5 === 2) pc.px(x, 8, P.seaIron)
    },
    down(pc, a, b) {
      for (let y = a; y <= b; y++) {
        const s = y % 5
        pc.hline(5, 10, y, s === 4 ? P.quaySeam : P.pitch)
        pc.px(5, y, s === 4 ? P.quaySeam : P.tarboardLight)
        pc.px(10, y, P.tarboard)
        if (s === 2) pc.hline(6, 9, y, P.driftwood)
      }
    },
    post(pc) {
      // The end baulk of a run, the tallest, with the weed high up it where the tide reaches.
      pc.rect(5, 1, 7, 15, P.pitch)
      pc.hline(5, 11, 1, P.tarboardLight)
      pc.vline(11, 2, 15, P.tarboard)
      pc.vline(5, 2, 15, P.tarboardLight)
      pc.hline(5, 11, 6, P.driftwood)
      pc.hline(5, 11, 7, P.driftwoodDark)
      for (const [x, y] of [[6, 11], [9, 13], [7, 14]]) {
        pc.hline(x, x + 1, y, P.seaweed)
        pc.px(x + 2, y + 1, P.seaweedDark)
      }
      return pc
    },
  },
  // Painted railing along the front, the way a promenade is railed: two rails and a standard
  // every third column, kept white and going rusty at the fixings.
  railing: {
    across(pc, a, b) {
      pc.hline(a, b, 5, P.sailCloth)
      pc.hline(a, b, 6, P.sailClothShade)
      pc.hline(a, b, 10, P.sailCloth)
      pc.hline(a, b, 11, P.sailClothShade)
      for (let x = a; x <= b; x++) {
        if (x % 3) continue
        pc.vline(x, 4, 14, P.sailCloth)
        pc.px(x, 14, P.seaIron)
        pc.px(x, 4, P.sailClothShade)
        pc.px(x, 8, P.rust)
      }
    },
    down(pc, a, b) {
      pc.vline(6, a, b, P.sailCloth)
      pc.vline(7, a, b, P.sailClothShade)
      pc.vline(10, a, b, P.sailCloth)
      for (let y = a; y <= b; y++) if (y % 3 === 0) pc.hline(5, 11, y, P.sailClothShade)
    },
    post(pc) {
      // A corner standard, heavier than the rest, with a ball on top and its foot in concrete.
      pc.vline(7, 3, 15, P.sailCloth)
      pc.vline(8, 3, 15, P.sailClothShade)
      pc.hline(6, 9, 2, P.sailCloth)
      pc.px(7, 1, P.sailCloth)
      pc.px(8, 2, P.rust)
      pc.hline(6, 9, 5, P.sailCloth)
      pc.hline(6, 9, 6, P.sailClothShade)
      pc.hline(6, 9, 10, P.sailCloth)
      pc.hline(6, 9, 11, P.sailClothShade)
      pc.hline(6, 9, 15, P.seastoneDark)
      return pc
    },
  },
}
const STYLES = ['rope', 'net', 'groyne', 'railing']

/**
 * A plot's fence, one tile of it. A run reaches the edge of the tile on a linked side and stops
 * in the middle otherwise, so it ends in a post at a gap and turns a proper corner.
 */
export function drawFence(style, mask) {
  const pc = new PixelCanvas(T, T)
  const f = FENCE_DRAW[STYLES[style]] || FENCE_DRAW.rope
  const across = mask & (2 | 8)
  const down = mask & (1 | 4)
  if (across) f.across(pc, mask & 8 ? 0 : 7, mask & 2 ? T - 1 : 8)
  if (down) f.down(pc, mask & 1 ? 0 : 7, mask & 4 ? T - 1 : 8)
  const straight = mask === (2 | 8) || mask === (1 | 4)
  if (!straight) f.post(pc)
  return pc
}

/**
 * What gathers at a fence's foot: sand and shingle banked against it, dried weed, a shell and a
 * tuft of marram grass. `mask` as the fence's (1 N, 2 E, 4 S, 8 W). Drawn in the ground's own
 * colours where it can be, so the patches tint it along with the ground round it.
 */
export function drawVerge(mask, tone) {
  const pc = new PixelCanvas(T, T)
  const [, dark, light, deep] = groundOf(tone)
  const rand = mulberry32(mask * 883 + toneOf(tone) * 149 + 23)
  // Marram grass, which is what grows where nothing else will.
  const marram = (x, y) => {
    pc.px(x, y, P.seaweed)
    pc.px(x, y - 1, P.shoreLichen)
    pc.px(x + 1, y, P.seaweedDark)
    pc.hline(x, x + 1, y + 1, deep)
  }
  const bank = (x, y) => {
    pc.hline(x, x + 2, y, light)
    pc.px(x + 1, y - 1, light)
    pc.px(x, y + 1, dark)
  }
  const wrack = (x, y) => {
    pc.hline(x, x + 2, y, P.wrack)
    pc.px(x + 3, y + 1, P.wrackDark)
  }
  const across = mask & (2 | 8)
  const down = mask & (1 | 4)
  if (across) {
    const x0 = mask & 8 ? 0 : 4
    const x1 = mask & 2 ? T - 3 : 10
    bank(x0 + Math.floor(rand() * 2), 14)
    for (let x = x0 + 3; x <= x1; x += 3) {
      const r = rand()
      if (r < 0.4) bank(x, 14)
      else if (r < 0.65) wrack(x, 14)
      else if (r < 0.8) marram(x, 14)
    }
    for (let x = x0; x <= x1; x++) if (rand() < 0.2) pc.px(x, 15, dark)
  }
  if (down) {
    // Beside the run, but not on the side a run across leaves by: there it would be banked up the
    // face of the fence rather than at its foot.
    const left = !(mask & 8)
    const right = !(mask & 2)
    for (let y = mask & 1 ? 2 : 5; y <= (mask & 4 ? 13 : 10); y += 3) {
      if (left && rand() < 0.5) bank(1, y)
      if (right && rand() < 0.5) wrack(11, y)
    }
    if (right) marram(12, mask & 4 ? 13 : 9)
    else if (left) marram(2, mask & 4 ? 13 : 9)
  }
  if (!across && !down) {
    bank(3, 14)
    wrack(10, 14)
    marram(7, 13)
  }
  return pc
}

/**
 * The plot's ground spilling over the edge of the way: sand blown out onto the cobbles and shell
 * grit in their joints. Variant `side * 2 + k`, as the village's grass fringe: side 0 top, 1
 * right, 2 bottom, 3 left of the way's tile, k one of two scatters, and 8 more leaves the mouth
 * of a walk open.
 */
export function drawFringe(variant, tone) {
  const pc = new PixelCanvas(T, T)
  const [base, dark, light] = groundOf(tone)
  const mouth = variant >= 8
  const side = (variant & 7) >> 1
  const rand = mulberry32(variant * 661 + toneOf(tone) * 79 + 43)
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
    set(i, 0, r < 0.7 ? base : light)
    if (r > 0.85) set(i, 1, base)
    n++
  }
  // Shell grit and sand carried a good way further out than the drift reaches.
  for (let s = 0; s < 4; s++) {
    const i = Math.floor(rand() * T)
    if (open(i) || rand() < 0.3) continue
    set(i, 2 + Math.floor(rand() * 3), s % 2 ? P.shellGrit : dark)
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

/** A lobster pot: a withy dome on a flat base, its hoops showing and a net eye in the side. */
function pot(pc, cx, cy, rx, ry) {
  for (let y = 0; y <= ry; y++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y / (ry + 1)) ** 2)))
    pc.hline(cx - half, cx + half, cy - y, (y & 1) ? P.rope : P.ropeDark)
  }
  pc.hline(cx - rx, cx + rx, cy + 1, P.driftwoodDark)
  pc.hline(cx - rx + 1, cx + rx - 1, cy, P.ropeLight)
  pc.px(cx, cy - Math.round(ry / 2), P.netTwineDark)
  pc.px(cx + 1, cy - Math.round(ry / 2), P.netTwine)
}

/** Flat things that lie about on a plot: `deco.<kind>.<variant>`, over the ground of `tone`. */
export function drawCover(kind, variant, tone) {
  const pc = new PixelCanvas(T, T)
  const [, dark, light] = groundOf(tone)
  if (kind === 'pots') {
    pot(pc, 6, 13, 4, 5)
    if (variant) pot(pc, 12, 9, 3, 4)
    pc.px(1, 14, P.rope)
    pc.px(2, 13, P.ropeDark)
    return dropShadow(pc)
  }
  if (kind === 'nets') {
    // A net heaped up where it was dropped, with its corks and its foot rope in it.
    const heap = (x0, y0, w, h) => {
      for (let y = y0; y < y0 + h; y++) {
        for (let x = x0; x < x0 + w; x++) {
          const a = ((x + y) % 3 + 3) % 3
          const b = ((x - y) % 3 + 3) % 3
          if (a === 0 || b === 0) pc.px(x, y, a === 0 && b === 0 ? P.netTwine : P.netTwineDark)
        }
      }
      pc.hline(x0, x0 + w - 1, y0 + h - 1, P.ropeDark)
    }
    heap(2, 8, 10, 6)
    if (variant) heap(9, 4, 6, 5)
    for (const [x, y] of [[4, 10], [8, 12], [11, 6]]) {
      pc.hline(x, x + 1, y, P.rope)
      pc.px(x, y + 1, P.ropeDark)
    }
    return pc
  }
  if (kind === 'shells') {
    const n = variant ? 7 : 4
    for (let i = 0; i < n; i++) shell(pc, 1 + ((i * 5) % 12), 4 + ((i * 7) % 10), i)
    return pc
  }
  if (kind === 'weed') {
    // A mat of wrack the tide left, still wet in the middle of it.
    const n = variant ? 9 : 5
    for (let i = 0; i < n; i++) frond(pc, 1 + ((i * 4) % 12), 5 + ((i * 5) % 9), i % 3 === 0)
    return pc
  }
  if (kind === 'driftwood') {
    // A branch or a broken plank, bleached white and going soft.
    pc.hline(2, 12, 11, P.driftwoodLight)
    pc.hline(2, 12, 12, P.driftwood)
    pc.hline(3, 11, 13, P.driftwoodDark)
    for (const x of [5, 9]) pc.px(x, 12, P.driftwoodDark)
    if (variant) {
      pc.line(6, 10, 11, 6, P.driftwood)
      pc.line(6, 11, 11, 7, P.driftwoodDark)
      pc.px(12, 5, P.driftwoodLight)
    }
    return dropShadow(pc)
  }
  // Floats and buoys, come ashore or set down and forgotten.
  for (const [x, y, r, i] of [[5, 11, 3, 0], [11, 9, 2.5, 1], [9, 14, 2, 3]]) {
    const c = buoyOf(i)
    pc.ellipse(x, y, r, r * 0.9, c)
    pc.ellipse(x - r * 0.3, y - r * 0.3, r * 0.4, r * 0.35, P.shellWhite)
    pc.hline(x - Math.round(r), x + Math.round(r), y + Math.round(r * 0.9), dark)
    pc.px(x, y - Math.round(r * 0.9) - 1, P.seaIron)
  }
  pc.px(2, 13, light)
  return dropShadow(pc)
}

/**
 * Where things lie: slow noise, a step every few tiles, so they gather in drifts along a line
 * rather than peppering the ground, and only some tiles in a drift, so a drift thins out
 * raggedly. Octaves of value noise bunch round 0.5, so a drift is where it rises into its top
 * third or so.
 */
const DRIFT_SCALE = 1 / 4.5
const WEED_DRIFT = 0.62
const WEED_FILL = 0.3
const WORK_DRIFT = 0.68
/** How much of a working drift holds anything, by ground: the quay and the boards most. */
const WORK_FILL = [0.16, 0.2, 0.34, 0.34]
/** What gathers in a drift, by ground: finds along the strand, gear where the work is. */
const WORK = ['shells', 'weed', 'pots', 'pots']
/** And what the tide leaves everywhere between the drifts. */
const TIDE = ['weed', 'weed', 'nets', 'nets']
/** The odd thing, anywhere, by ground. */
const ODDS = [
  ['driftwood', 'floats', 'shells', 'weed'],
  ['driftwood', 'weed', 'floats', 'shells'],
  ['nets', 'floats', 'driftwood', 'pots'],
  ['nets', 'pots', 'floats', 'weed'],
]
const ODD_SHARE = 0.03

/** What lies on the plot ground tile (tx, ty), if anything: `{ kind, variant }`, or null. */
export function seaCover(tx, ty, tone) {
  const t = toneOf(tone)
  const h = lattice(tx, ty, 491)
  const v = lattice(tx, ty, 492)
  const x = tx * DRIFT_SCALE
  const y = ty * DRIFT_SCALE
  if (fbm(x, y, 437) > WORK_DRIFT) {
    const kind = WORK[t]
    if (h < WORK_FILL[t]) return { kind, variant: Math.floor(v * COVER_VARIANTS[kind]) }
  } else if (fbm(x, y, 431) > WEED_DRIFT) {
    const kind = TIDE[t]
    if (h < WEED_FILL) return { kind, variant: v < 0.55 ? 0 : 1 }
  }
  if (h > 1 - ODD_SHARE) {
    const list = ODDS[t]
    const kind = list[Math.floor(v * list.length)]
    return { kind, variant: Math.floor(lattice(tx, ty, 493) * COVER_VARIANTS[kind]) }
  }
  return null
}

/** The ground's plain colours, each paired with its dry partner and the one the tide wets. */
export function patches(tone) {
  const t = toneOf(tone)
  return [P.seaGround[t], P.seaGroundSunny[t], P.seaGroundLush[t]]
}

// The parts the harbour's buildings and landmarks are built from too.
export { buoyOf, frond, pot, shell }
