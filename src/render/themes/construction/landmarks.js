// The site's landmarks: what a plot's work has raised in the middle of its setting-out yard, from
// a surveyor's peg to a tower topped out with a tree and the plot's flag. Same contract as the
// village's (src/render/sprites/landmarks.js): 32 px wide, the same height per tier, bottom row on
// the ground, stages 0 to 3 as a building's, `lit` windows after dark and `busy` while somebody on
// the plot is in. The plot's paint (`roofs`) goes on the machines, its accent on flags and signs.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { LANDMARK_HEIGHTS, LANDMARK_W } from '../../sprites/landmarks.js'
import { mulberry32 } from '../../../sim/rng.js'
import { box, bulb, corrugated, ladder, osb, paintOf, pane, siteScaffold, trafficCone, worklight } from './buildings.js'

const TOP_TIER = LANDMARK_HEIGHTS.length - 1
const tierOf = (tier) => Math.max(0, Math.min(TOP_TIER, Math.floor(Number(tier) || 0)))

/** The same heights as the village's, so a plot's landmark stands as tall whichever theme it wears. */
export const heightOf = (tier) => LANDMARK_HEIGHTS[tierOf(tier)]
/** A peg casts none worth drawing; a crane's is its mast's, narrow. */
export const shadowOf = (tier) => [0, 30, 20, 20, 30, 32][tierOf(tier)]
/** The crane's load swings, and the topping-out flag flies. */
export const landmarkFrames = (tier, stage) => (stage >= 3 && (tierOf(tier) === 3 || tierOf(tier) === TOP_TIER) ? 2 : 1)

/** Trodden site ground under everything, speckled. */
function ground(pc, H, rand) {
  pc.ellipse(16, H - 4, 15.5, 3.5, P.dirt)
  for (let i = 0; i < 12; i++) pc.px(2 + Math.floor(rand() * 28), H - 6 + Math.floor(rand() * 5), P.dirtDark)
}

/** Stages 0 and 1: pegs and a line, then a pad poured and the first tubes up. */
function groundwork(pc, H, stage, rand) {
  ground(pc, H, rand)
  if (stage === 0) {
    for (const x of [3, 28]) {
      pc.vline(x, H - 10, H - 3, P.wood)
      pc.px(x, H - 10, P.hiVis[1])
    }
    pc.hline(3, 28, H - 9, P.white)
    trafficCone(pc, 8, H - 3)
    box(pc, 17, H - 6, 26, H - 3, P.plank)
    pc.hline(17, 26, H - 6, P.plankLight)
    return
  }
  box(pc, 3, H - 6, 28, H - 3, P.concrete)
  pc.hline(3, 28, H - 6, P.concreteLight)
  const top = Math.max(1, H - 6 - Math.min(20, H - 8))
  siteScaffold(pc, 4, 27, top, H - 6)
}

/** A flag on a pole in the plot's colour; `frame` flies it the other way. */
function flag(pc, x, top, accent, frame = 0) {
  const len = frame % 2 ? [6, 7, 8, 7, 5] : [7, 8, 8, 7, 6]
  len.forEach((n, i) => pc.hline(x + 1, x + n, top + i, i === 0 ? shade(accent, 0.2) : accent))
  pc.clearPx(x + len[2], top + 2)
}

const TIERS = [
  function surveyPeg(pc, o) {
    const base = o.H - 2
    ground(pc, o.H, o.rand)
    // A string line between two pegs, and the peg itself: orange-topped, a ribbon in the plot's colour.
    for (const x of [3, 28]) pc.vline(x, base - 6, base - 1, P.wood)
    pc.hline(3, 28, base - 5, P.white)
    box(pc, 15, base - 12, 16, base - 1, P.plank)
    pc.vline(16, base - 12, base - 1, P.plankDark)
    box(pc, 15, base - 13, 16, base - 12, P.safetyOrange)
    pc.hline(17, 19, base - 11, o.accent)
    pc.px(20, base - 10, o.accent)
    if (!o.roof) return
    // The surveyor's level on its tripod, set up over the peg.
    pc.line(8, base - 11, 5, base - 1, P.hose)
    pc.line(8, base - 11, 11, base - 1, P.hoseDark)
    pc.vline(8, base - 11, base - 2, P.hoseDark)
    box(pc, 5, base - 16, 11, base - 12, P.sitePaint[0])
    pc.hline(5, 11, base - 16, shade(P.sitePaint[0], 0.2))
    box(pc, 11, base - 15, 12, base - 14, P.steelDark)
    pc.px(6, base - 14, o.lit ? P.windowLitCore : P.window)
    if (o.busy) trafficCone(pc, 24, base)
  },

  function siteHut(pc, o) {
    const base = o.H - 2
    const paint = paintOf(o.roofs, o.variant)
    // Blocks under it, then the white cabin: its door, a window, steps up.
    for (const x of [4, 14, 24]) box(pc, x, base - 1, x + 3, base, P.concreteDark)
    corrugated(pc, 2, base - 20, 29, base - 2, P.cladWhite)
    pc.hline(2, 29, base - 2, shade(P.cladWhite, -0.2))
    box(pc, 6, base - 16, 11, base - 2, paint)
    pc.vline(11, base - 16, base - 2, shade(paint, -0.25))
    pc.px(10, base - 9, P.metal)
    pane(pc, 16, base - 15, 10, 7, o.lit)
    box(pc, 5, base, 12, base, P.steelDark)
    if (!o.roof) return
    box(pc, 1, base - 23, 30, base - 21, paint)
    pc.hline(1, 30, base - 23, shade(paint, 0.2))
    // The site board in the plot's colour, on the roof.
    pc.vline(10, base - 30, base - 24, P.steelDark)
    pc.vline(21, base - 30, base - 24, P.steelDark)
    box(pc, 7, base - 36, 24, base - 29, o.accent)
    pc.hline(7, 24, base - 36, shade(o.accent, 0.2))
    for (const [x0, x1, y] of [[9, 18, base - 34], [9, 21, base - 32]]) pc.hline(x0, x1, y, P.white)
  },

  function scaffoldTower(pc, o) {
    const base = o.H - 2
    // A free-standing tower of tube and boards, a ladder up its middle.
    for (const x of [4, 27]) {
      pc.vline(x, base - 38, base, P.metal)
      pc.vline(x + 1, base - 38, base, P.steelDark)
      box(pc, x - 1, base, x + 2, base, P.steelDark)
    }
    for (let y = base - 6; y > base - 38; y -= 8) {
      pc.hline(3, 28, y, P.plankLight)
      pc.hline(3, 28, y + 1, P.plank)
      pc.line(6, y + 7, 26, y + 2, P.metalDark)
    }
    ladder(pc, 14, base - 37, base)
    // Netting in the site's blue on the lower lifts.
    for (let y = base - 13; y < base - 7; y++) for (let x = 6; x <= 25; x++) if ((x + y) % 2 === 0) pc.px(x, y, P.tarp)
    if (!o.roof) return
    // The top lift, boarded and railed, a worklight on it and the plot's flag above.
    pc.hline(3, 28, base - 38, P.plankLight)
    pc.hline(3, 28, base - 37, P.plank)
    pc.hline(3, 28, base - 42, P.metal)
    for (const x of [4, 27]) pc.vline(x, base - 42, base - 38, P.metal)
    pc.vline(24, base - 45, base - 38, P.metalDark)
    flag(pc, 24, base - 45, o.accent)
    worklight(pc, 9, base - 39, o.lit)
  },

  function towerCrane(pc, o) {
    const base = o.H - 2
    const paint = paintOf(o.roofs, o.variant)
    const dark = shade(paint, -0.3)
    // Its footing, then the lattice mast.
    box(pc, 10, base - 2, 21, base, P.concrete)
    pc.hline(10, 21, base - 2, P.concreteLight)
    const topOf = o.roof ? base - 42 : base - 24
    for (const x of [12, 19]) pc.vline(x, topOf, base - 3, paint)
    for (let y = base - 3; y > topOf; y -= 6) {
      pc.hline(12, 19, y, dark)
      pc.line(13, y - 1, 18, y - 5, dark)
    }
    if (!o.roof) return
    // The jib across the top, the counterweight on its short arm, the cab under it.
    const jy = base - 46
    box(pc, 11, jy, 20, jy + 3, paint)
    pc.vline(15, jy - 7, jy, dark)
    pc.vline(16, jy - 7, jy, paint)
    pc.line(15, jy - 7, 1, jy, P.steelDark)
    pc.line(16, jy - 7, 30, jy + 1, P.steelDark)
    box(pc, 0, jy + 1, 30, jy + 2, paint)
    for (let x = 1; x < 30; x += 3) pc.px(x, jy + 1, dark)
    box(pc, 1, jy + 3, 5, jy + 7, P.concreteDark)
    box(pc, 17, jy + 4, 21, jy + 8, P.cladWhite)
    pane(pc, 18, jy + 5, 3, 3, o.lit)
    // The hook and its load, swinging.
    const hx = o.frame % 2 ? 26 : 27
    pc.line(27, jy + 3, hx, jy + 16, P.steelDark)
    box(pc, hx - 3, jy + 17, hx + 2, jy + 20, P.plank)
    pc.hline(hx - 3, hx + 2, jy + 17, P.plankLight)
    pc.px(28, jy, o.accent)
    pc.px(29, jy, o.accent)
    pc.px(28, jy - 1, o.accent)
  },

  function concreteCore(pc, o) {
    const base = o.H - 2
    const top = base - 48
    // The core, floor by floor, its window voids dark.
    box(pc, 6, top, 25, base, P.concrete)
    pc.vline(6, top, base, P.concreteLight)
    pc.vline(25, top, base, P.concreteDark)
    for (let y = base - 9; y > top; y -= 9) {
      pc.hline(6, 25, y, P.concreteDark)
      for (const x of [9, 17]) pane(pc, x, y - 6, 6, 5, o.lit, P.concreteDark)
    }
    box(pc, 13, base - 7, 18, base, P.steelDark)
    // A hoist up its side, in the plot's paint.
    const paint = paintOf(o.roofs, o.variant + 1)
    pc.vline(28, top + 4, base, P.metalDark)
    box(pc, 26, base - 22, 30, base - 16, paint)
    pc.hline(26, 30, base - 22, shade(paint, 0.2))
    if (!o.roof) return
    // Formwork going up on top, rebar through it, a worklight and the plot's flag.
    osb(pc, 5, top - 6, 26, top - 1, mulberry32(o.variant + 3))
    for (let x = 7; x <= 24; x += 3) pc.vline(x, top - 10, top - 7, P.rebar)
    worklight(pc, 22, top - 7, o.lit)
    pc.vline(9, top - 16, top - 7, P.metalDark)
    flag(pc, 9, top - 16, o.accent)
  },

  function toppedOut(pc, o) {
    const base = o.H - 2
    const top = base - 56
    // Steel and glass, floor by floor, lit where somebody is in.
    box(pc, 5, top, 26, base, P.steelDark)
    for (let y = top + 2; y < base - 6; y += 6) {
      for (let x = 7; x < 25; x += 4) {
        box(pc, x, y, x + 2, y + 3, o.lit && (x + y) % 3 !== 0 ? P.windowLit : P.glass)
        if (!o.lit) pc.px(x, y, P.glassLight)
      }
    }
    pc.vline(5, top, base, P.steel)
    // Its entrance, in the plot's colour.
    box(pc, 11, base - 6, 20, base, P.glass)
    box(pc, 11, base - 7, 20, base - 7, o.accent)
    pc.vline(15, base - 6, base, P.steelDark)
    pc.vline(16, base - 6, base, P.steelDark)
    if (!o.roof) return
    // Topped out: a parapet, a little evergreen tied to the top and the plot's flag flying.
    box(pc, 4, top - 2, 27, top, P.steel)
    pc.hline(4, 27, top - 2, P.steelLight)
    pc.vline(22, top - 14, top - 3, P.metalDark)
    flag(pc, 22, top - 14, o.accent, o.frame)
    for (let i = 0; i < 6; i++) pc.hline(10 - Math.floor(i / 2), 11 + Math.floor(i / 2), top - 9 + i, i % 2 ? P.pineDark : P.pine)
    pc.vline(10, top - 3, top - 1, P.trunk)
    pc.px(10, top - 10, P.hiVis[0])
  },
]

/** @param {{ tier: number, stage: number, variant?: number, accent?: string, wall?: number, roofs?: number, lit?: boolean, busy?: boolean, frame?: number }} o */
export function drawSiteLandmark(o) {
  const tier = tierOf(o.tier)
  const H = LANDMARK_HEIGHTS[tier]
  const pc = new PixelCanvas(LANDMARK_W, H)
  const variant = o.variant || 0
  const rand = mulberry32(variant * 4001 + tier * 97 + 11)
  // A peg is knocked in, not built: after its line is set out, the peg stands alone.
  if (o.stage === 0 || (o.stage === 1 && tier > 0)) {
    groundwork(pc, H, o.stage, rand)
    return pc.outline(P.outline)
  }
  const opts = {
    H, rand, variant, frame: o.frame || 0, roof: o.stage >= 3, lit: Boolean(o.lit), busy: Boolean(o.busy),
    accent: o.accent || P.safetyOrange, roofs: o.roofs || 0,
  }
  TIERS[tier](pc, opts)
  // Stage 2 goes up in scaffold, except what has nothing to climb: a peg, a cabin, a crane's mast.
  if (o.stage === 2 && (tier === 4 || tier === 5)) siteScaffold(pc, 3, 28, Math.round(H * 0.4), H - 2)
  return pc.outline(P.outline)
}

// ---------- what a landmark brings with it ----------

/**
 * The site's take on what a plot's landmark brings (propsOf in src/sim/shape.js), the same sizes as
 * the village's: a lighting mast for its lamp, a stack of scaffold boards on trestles for its bench,
 * cones and a water barrier for its planters, and a site entrance for its gateway. Null for any
 * other static, which the village draws.
 */
export function drawSiteProp(sprite, variant, p = {}) {
  if (sprite === 'yardlamp') {
    const pc = new PixelCanvas(12, 30)
    box(pc, 2, 25, 9, 29, P.concrete)
    pc.hline(2, 9, 25, P.concreteLight)
    pc.vline(5, 6, 24, P.steel)
    pc.vline(6, 6, 24, P.steelDark)
    box(pc, 1, 2, 10, 6, P.steelDark)
    for (const x of [2, 7]) box(pc, x, 3, x + 2, 5, p.lit ? P.windowLitCore : P.windowShine)
    return pc.outline(P.outline)
  }
  if (sprite === 'yardbench') {
    const pc = new PixelCanvas(14, 32)
    for (const y of [3, 27]) {
      box(pc, 1, y, 12, y + 1, P.steelDark)
      pc.px(1, y + 2, P.steelDark)
      pc.px(12, y + 2, P.steelDark)
    }
    box(pc, 2, 1, 11, 29, P.plank)
    for (const x of [4, 7, 10]) pc.vline(x, 1, 29, P.plankDark)
    pc.vline(2, 1, 29, P.plankLight)
    return pc.outline(P.outline)
  }
  if (sprite === 'yardplanter') {
    const pc = new PixelCanvas(16, 20)
    if (variant % 2 === 0) {
      trafficCone(pc, 5, 18)
      trafficCone(pc, 11, 19)
      box(pc, 2, 16, 8, 19, P.sack)
      pc.hline(2, 8, 16, P.sackDark)
    } else {
      // A water-filled barrier block, red and white.
      box(pc, 2, 9, 13, 19, P.barrierRed)
      box(pc, 2, 13, 13, 15, P.white)
      pc.hline(2, 13, 9, P.barrierRedLight)
      pc.vline(13, 9, 19, P.barrierRedDark)
      box(pc, 6, 7, 9, 8, P.barrierRedDark)
    }
    return pc.outline(P.outline)
  }
  if (sprite === 'gateway') {
    // The site entrance: two posts and a striped beam across, a sign on it. Open underneath.
    const pc = new PixelCanvas(32, 30)
    for (const x of [2, 28]) {
      box(pc, x, 6, x + 1, 29, P.steel)
      pc.vline(x + 1, 6, 29, P.steelDark)
    }
    for (let x = 1; x <= 30; x++) pc.vline(x, 4, 7, Math.floor(x / 3) % 2 ? P.hardHat[0] : P.outline)
    box(pc, 10, 0, 21, 5, P.safetyOrange)
    pc.hline(10, 21, 0, shade(P.safetyOrange, 0.2))
    pc.hline(12, 19, 2, P.white)
    return pc.outline(P.outline)
  }
  return null
}
