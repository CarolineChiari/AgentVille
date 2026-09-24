// The farm's landmarks: what a plot's work has raised in the middle of its field, from a stack of
// bales to a windmill with its sails going round. Same contract as the village's
// (src/render/sprites/landmarks.js): 32 px wide, the same height per tier, bottom row on the
// ground, stages 0 to 3 as a building's (2 goes up inside the theme's staging), `lit` lamps after
// dark and `busy` while somebody on the plot is in. The plot's paint family goes on the roofs and
// the doors, its accent on the scarecrow's coat, and a tower is built of its wall material.
//
// None of them is one of the farm's own buildings made bigger: barns, silos and windpumps are
// what threads build here, so a landmark has to be the plot's own centrepiece.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { LANDMARK_HEIGHTS, LANDMARK_W } from '../../sprites/landmarks.js'
import { mulberry32 } from '../../../sim/rng.js'
import { MATERIALS, TRIM, baleAt, box, doorOf, henAt, paintOf, paneOf, roofOver, roofPaintOf, roundBaleAt, site, staging, wallOf } from './buildings.js'

const TOP_TIER = LANDMARK_HEIGHTS.length - 1
const tierOf = (tier) => Math.max(0, Math.min(TOP_TIER, Math.floor(Number(tier) || 0)))

/** The same heights as the village's, so a plot's landmark stands as tall whichever theme it wears. */
export const heightOf = (tier) => LANDMARK_HEIGHTS[tierOf(tier)]
/** Bales and a scarecrow cast little; the towers cast a good deal. */
export const shadowOf = (tier) => [22, 16, 20, 30, 28, 30][tierOf(tier)]
/** The windmill's sails go round; the rest stand still. */
export const landmarkFrames = (tier, stage) => (stage >= 3 && tierOf(tier) === TOP_TIER ? 2 : 1)

// ---------- parts ----------

/** Trodden ground underfoot, and straw worked into it. */
function yard(pc, H, rand, rx = 14.5) {
  pc.ellipse(16, H - 4, rx, 3.5, P.farmGround[3][1])
  for (let i = 0; i < 9; i++) pc.px(3 + Math.floor(rand() * 26), H - 6 + Math.floor(rand() * 5), i % 2 ? P.hay : P.farmGround[3][2])
}

/** A hurricane lantern hung at (x, y), alight when the plot is. */
function lantern(pc, x, y, on) {
  pc.px(x, y - 1, P.farmIron)
  box(pc, x - 1, y, x + 1, y + 2, on ? P.windowLit : P.farmIronLight)
  if (on) pc.px(x, y + 1, P.windowLitCore)
  pc.hline(x - 1, x + 1, y + 3, P.farmIron)
}

// ---------- the tiers ----------

const TIERS = [
  function hayBales(pc, o) {
    const base = o.H - 2
    yard(pc, o.H, o.rand, 12)
    // A stack of small bales, built up a course at a time: one bale set down, then the bottom
    // course, then the courses above it. It has no site of its own, so its stages are the stack.
    baleAt(pc, 13, base, 8, 4)
    if (o.stage <= 0) return null
    baleAt(pc, 5, base, 8, 4)
    baleAt(pc, 21, base, 7, 4)
    if (!o.roof) return { x0: 4, x1: 28, top: base - 5 }
    baleAt(pc, 9, base - 4, 8, 4)
    baleAt(pc, 17, base - 4, 8, 4)
    baleAt(pc, 13, base - 8, 8, 4)
    // The pitchfork stuck in the top, and a hen come to see what's in it.
    pc.line(22, base - 8, 26, base - 18, P.barnTimber)
    pc.hline(25, 28, base - 18, P.farmIron)
    for (const x of [25, 27]) pc.px(x, base - 19, P.farmIron)
    henAt(pc, 3, base, 1, o.variant % 2 === 1)
    lantern(pc, 11, base - 12, o.lit || o.busy)
    return null
  },

  function scarecrow(pc, o) {
    const base = o.H - 2
    yard(pc, o.H, o.rand, 11)
    // The post and the crosspiece, the coat hung on them in the plot's colour.
    const x = 16
    box(pc, x - 1, base - 30, x, base, P.barnTimber)
    pc.vline(x - 1, base - 30, base, P.barnTimberLight)
    pc.hline(x - 11, x + 10, base - 24, P.barnTimberDark)
    if (!o.roof) return { x0: 4, x1: 28, top: base - 31 }
    const coat = o.accent
    box(pc, x - 5, base - 25, x + 4, base - 14, coat)
    pc.hline(x - 5, x + 4, base - 25, shade(coat, 0.2))
    pc.vline(x + 4, base - 24, base - 14, shade(coat, -0.3))
    for (const y of [base - 21, base - 17]) pc.px(x - 1, y, P.farmIron)
    // The sleeves out along the crosspiece, and straw poking from the cuffs.
    for (const dir of [-1, 1]) {
      const x0 = dir < 0 ? x - 10 : x + 5
      box(pc, x0, base - 25, x0 + 5, base - 23, shade(coat, -0.12))
      const cuff = dir < 0 ? x0 - 1 : x0 + 6
      pc.vline(cuff, base - 25, base - 22, P.hay)
      pc.px(cuff + dir, base - 23, P.hayLight)
    }
    // A patch on the coat, rope for a belt, straw legs out under it.
    box(pc, x + 1, base - 18, x + 3, base - 16, P.farmPaint[2])
    pc.hline(x - 5, x + 4, base - 15, P.hayDark)
    for (const dx of [-3, 2]) pc.vline(x + dx, base - 13, base - 10, P.hay)
    // The head, a sack stuffed with straw, and a straw hat on it.
    pc.ellipse(x - 0.5, base - 29, 3.5, 3.5, P.hayLight)
    pc.px(x - 2, base - 30, P.cowBlack)
    pc.px(x + 1, base - 30, P.cowBlack)
    pc.hline(x - 2, x + 1, base - 27, P.hayDark)
    pc.hline(x - 7, x + 6, base - 32, P.hay)
    box(pc, x - 3, base - 36, x + 2, base - 33, P.hay)
    pc.hline(x - 3, x + 2, base - 33, P.hatBand)
    // A crow on the crosspiece, not frightened in the least; a lantern hung off the other arm.
    pc.hline(x + 7, x + 9, base - 26, P.cowBlack)
    pc.px(x + 9, base - 27, P.cowBlack)
    pc.px(x + 10, base - 27, P.henBeak)
    pc.px(x + 6, base - 25, P.cowBlack)
    lantern(pc, x - 9, base - 22, o.lit || o.busy)
    return null
  },

  function dovecote(pc, o) {
    const base = o.H - 2
    yard(pc, o.H, o.rand)
    const x = 16
    // A stout post on a stone foot, and the cote on top of it.
    box(pc, x - 4, base - 3, x + 3, base, P.fieldstone)
    pc.hline(x - 4, x + 3, base - 3, P.fieldstoneLight)
    box(pc, x - 1, base - 28, x, base - 4, P.barnTimber)
    pc.vline(x - 1, base - 28, base - 4, P.barnTimberLight)
    pc.line(x - 1, base - 10, x - 6, base - 3, P.barnTimberDark)
    pc.line(x, base - 10, x + 5, base - 3, P.barnTimberDark)
    box(pc, x - 9, base - 38, x + 8, base - 28, TRIM)
    pc.vline(x + 8, base - 38, base - 28, P.whitewashShade)
    pc.hline(x - 10, x + 9, base - 28, P.barnTimberDark)
    // The holes the doves go in by, each with its little ledge, two rows of them.
    for (const y of [base - 36, base - 32]) {
      for (let hx = x - 7; hx <= x + 5; hx += 4) {
        box(pc, hx, y, hx + 1, y + 1, P.interior)
        pc.hline(hx - 1, hx + 2, y + 2, P.barnTimber)
      }
    }
    if (!o.roof) return { x0: 5, x1: 27, top: base - 39 }
    roofOver(pc, x - 11, x + 10, base - 39, 7, roofPaintOf(o.roofs, 0), 1)
    pc.vline(x, base - 49, base - 46, P.farmIron)
    pc.hline(x - 2, x + 2, base - 48, P.farmIronLight)
    // Doves on the ledges and the ridge: white, and small.
    for (const [dx, dy] of [[-8, -30], [5, -34], [-3, -46]]) {
      pc.hline(x + dx, x + dx + 1, base + dy, P.petalWhite)
      pc.px(x + dx - 1, base + dy - 1, P.petalWhite)
      pc.px(x + dx + 2, base + dy, P.fleeceShade)
    }
    lantern(pc, x + 3, base - 24, o.lit || o.busy)
    return null
  },

  function oastHouse(pc, o) {
    const base = o.H - 2
    yard(pc, o.H, o.rand)
    // The barn the hops are dried over: long and low, of the plot's walls.
    const material = MATERIALS[(o.wall || 0) % MATERIALS.length]
    wallOf(pc, 1, base - 13, 17, base, material === 'tin' ? 'weatherboard' : material, o.rand, paintOf(o.roofs, 1))
    doorOf(pc, 4, base - 1, 5, 9, o.accent)
    paneOf(pc, 11, base - 10, 5, 5, o.lit)
    // The kiln: a round tower of brick, its sides straight, the courses showing.
    for (let y = base - 30; y <= base; y++) {
      for (let x = 15; x <= 29; x++) {
        const t = (x - 15) / 14
        let c = t < 0.2 ? shade(P.brick, 0.14) : t > 0.75 ? P.brickDark : P.brick
        if ((y - base) % 3 === 0) c = P.mortar
        else if ((x + ((y - base) % 6 === 0 ? 0 : 2)) % 4 === 0) c = shade(c, -0.12)
        pc.px(x, y, c)
      }
    }
    pc.hline(15, 29, base, P.brickDark)
    paneOf(pc, 20, base - 22, 4, 5, o.lit)
    if (!o.roof) return { x0: 1, x1: 30, top: base - 31 }
    roofOver(pc, 0, 18, base - 14, 5, roofPaintOf(o.roofs, 0), 1)
    // The cone of the roof, steep, and the white cowl on top that turns its back to the wind.
    const cone = roofPaintOf(o.roofs, 0)
    for (let i = 0; i <= 14; i++) {
      const y = base - 31 - i
      const half = Math.round(8 - i * 0.45)
      pc.hline(22 - half, 22 + half, y, cone)
      pc.px(22 - half, y, shade(cone, 0.2))
      pc.px(22 + half, y, shade(cone, -0.3))
    }
    pc.hline(13, 31, base - 31, shade(cone, -0.3))
    box(pc, 19, base - 51, 25, base - 46, TRIM)
    pc.hline(19, 26, base - 52, P.whitewashShade)
    pc.vline(25, base - 51, base - 46, P.whitewashShade)
    pc.hline(26, 28, base - 47, TRIM) // the vane that turns it
    pc.px(22, base - 53, P.farmIron)
    return null
  },

  function waterTower(pc, o) {
    const base = o.H - 2
    yard(pc, o.H, o.rand)
    // Four legs on stone feet, braced, with a ladder up to the tank.
    const tankBot = base - 34
    for (const [x0, x1] of [[5, 8], [26, 23]]) {
      pc.line(x0, base, x1, tankBot, P.barnTimber)
      pc.line(x0 + (x0 < 16 ? 1 : -1), base, x1 + (x0 < 16 ? 1 : -1), tankBot, P.barnTimberDark)
      pc.hline(x0 - 1, x0 + 1, base, P.fieldstone)
    }
    for (const [x0, x1] of [[11, 12], [20, 19]]) pc.line(x0, base, x1, tankBot, P.barnTimberDark)
    for (const y of [base - 10, base - 22]) {
      const t = (base - y) / 34
      const h = Math.round(11 - t * 3)
      pc.hline(16 - h, 16 + h - 1, y, P.barnTimberLight)
      pc.line(16 - h, y, 16 + h - 3, y - 10, P.barnTimberDark)
    }
    pc.vline(15, tankBot, base, P.farmIron)
    pc.vline(17, tankBot, base, P.farmIron)
    for (let y = base - 2; y >= tankBot + 2; y -= 3) pc.hline(15, 17, y, P.farmIronLight)
    if (!o.roof) return { x0: 4, x1: 27, top: tankBot }
    // The tank: staves bound in hoops, and its conical lid in the plot's paint.
    const tankTop = tankBot - 16
    for (let x = 6; x <= 25; x++) {
      const c = x < 9 ? P.barnTimberLight : x > 22 ? P.barnTimberDark : P.barnTimber
      pc.vline(x, tankTop, tankBot, c)
      if (x % 3 === 0) pc.vline(x, tankTop, tankBot, P.barnTimberDark)
    }
    for (const y of [tankTop + 3, tankTop + 9, tankBot - 2]) pc.hline(6, 25, y, P.farmIron)
    pc.hline(5, 26, tankBot, P.barnTimberDark)
    const lid = roofPaintOf(o.roofs, 1)
    for (let i = 0; i <= 8; i++) {
      const y = tankTop - 1 - i
      const half = Math.round(11 - i * 1.25)
      pc.hline(16 - half, 15 + half, y, lid)
      pc.px(16 - half, y, shade(lid, 0.2))
      pc.px(15 + half, y, shade(lid, -0.3))
    }
    pc.vline(16, tankTop - 13, tankTop - 10, P.farmIron)
    pc.px(17, tankTop - 13, P.farmPaint[2])
    // A lamp on the leg for the yard at night, and a spout with a drip off it.
    lantern(pc, 9, base - 20, o.lit || o.busy)
    pc.hline(25, 28, tankBot - 3, P.farmIron)
    pc.vline(28, tankBot - 2, tankBot, P.farmIron)
    pc.px(28, tankBot + 3, P.waterLight)
    return null
  },

  function windmill(pc, o) {
    const base = o.H - 2
    yard(pc, o.H, o.rand)
    // A tower mill: its body tapering up to the cap, of the plot's walls where they will stand
    // that high, with a stage round it for reaching the sails.
    const material = MATERIALS[(o.wall || 0) % MATERIALS.length]
    const wallMat = material === 'tin' || material === 'barnboard' ? 'whitewash' : material
    const top = 22
    const halfAt = (y) => 5 + Math.round(((y - top) / (base - top)) * 6)
    const tower = new PixelCanvas(LANDMARK_W, o.H)
    wallOf(tower, 4, top, 27, base, wallMat, o.rand, null)
    for (let y = top; y <= base; y++) {
      const h = halfAt(y)
      for (let x = 4; x <= 27; x++) {
        if (x < 16 - h || x > 15 + h) continue
        const i = (y * LANDMARK_W + x) * 4
        for (let k = 0; k < 4; k++) pc.data[i + k] = tower.data[i + k]
      }
      pc.px(16 - h, y, P.fieldstoneLight)
      pc.px(15 + h, y, P.fieldstoneDark)
    }
    doorOf(pc, 13, base - 1, 6, 9, o.accent)
    paneOf(pc, 14, base - 22, 4, 5, o.lit)
    paneOf(pc, 14, top + 4, 4, 4, o.lit)
    // The stage round it, halfway up.
    const stage = base - 14
    pc.hline(3, 28, stage, P.barnTimberLight)
    pc.hline(3, 28, stage + 1, P.barnTimberDark)
    for (const x of [4, 27]) pc.line(x, stage + 1, x + (x < 16 ? 5 : -5), stage + 6, P.barnTimberDark)
    for (let x = 3; x <= 28; x += 5) pc.vline(x, stage - 3, stage, P.barnTimber)
    pc.hline(3, 28, stage - 3, P.barnTimber)
    if (!o.roof) return { x0: 3, x1: 28, top }
    // The cap, boat-shaped and in the plot's paint, and the fantail out behind it.
    const cap = roofPaintOf(o.roofs, 0)
    for (let i = 0; i <= 5; i++) {
      const half = 7 - Math.round(i * 0.9)
      pc.hline(16 - half, 15 + half, top - 1 - i, cap)
      pc.px(16 - half, top - 1 - i, shade(cap, 0.2))
      pc.px(15 + half, top - 1 - i, shade(cap, -0.3))
    }
    pc.hline(8, 23, top, shade(cap, -0.3))
    // The sails: four of them on the windshaft, turning an eighth of a turn between frames. The
    // frames are lattices of white; a solid white blade read as a propeller.
    const hub = { x: 16, y: top - 4 }
    const turn = (o.frame % 2) * (Math.PI / 4) + Math.PI / 8
    for (let s = 0; s < 4; s++) {
      const a = turn + (s * Math.PI) / 2
      const ca = Math.cos(a)
      const sa = Math.sin(a)
      for (let d = 2; d <= 16; d++) {
        const x = hub.x + ca * d
        const y = hub.y + sa * d
        pc.px(Math.round(x), Math.round(y), P.barnTimberDark) // the stock
        if (d < 5) continue
        for (let w = 1; w <= 3; w++) {
          const px = Math.round(x - sa * w)
          const py = Math.round(y + ca * w)
          pc.px(px, py, (d + w) % 3 === 0 ? P.barnTimber : TRIM)
        }
      }
    }
    pc.ellipse(hub.x + 0.5, hub.y + 0.5, 1.6, 1.6, P.farmIron)
    // Sacks of flour at the door, and a lamp by it.
    for (const x of [6, 22]) {
      box(pc, x, base - 4, x + 3, base, P.whitewash)
      pc.hline(x + 1, x + 2, base - 5, P.whitewashShade)
    }
    lantern(pc, 21, base - 10, o.lit || o.busy)
    roundBaleAt(pc, 4, base + 1, 3)
    return null
  },
]

/**
 * A plot's landmark, tier by tier.
 * @param {{ tier: number, stage: number, variant?: number, accent?: string, wall?: number, roofs?: number, lit?: boolean, busy?: boolean, frame?: number }} o
 */
export function drawFarmLandmark(o) {
  const tier = tierOf(o.tier)
  const H = heightOf(tier)
  const variant = o.variant || 0
  const pc = new PixelCanvas(LANDMARK_W, H)
  const rand = mulberry32(variant * 7919 + tier * 131 + 67)
  // A stack of bales is thrown up rather than built, so it has no site stages of its own.
  if (tier > 0 && o.stage <= 1) {
    site(pc, rand, o.stage, H - 48, variant)
    return pc.outline(P.outline)
  }
  const opts = {
    H, rand, variant, stage: o.stage, frame: o.frame || 0, roof: o.stage >= 3, lit: Boolean(o.lit), busy: Boolean(o.busy),
    accent: o.accent || P.farmPaint[0], roofs: o.roofs || 0, wall: o.wall || 0,
  }
  const up = TIERS[tier](pc, opts)
  if (o.stage === 2 && up) staging(pc, up.x0, up.x1, Math.max(1, up.top), H - 2)
  return pc.outline(P.outline)
}

// ---------- what a landmark brings with it ----------

/**
 * The farm's take on what a plot's landmark brings (propsOf in src/sim/shape.js), the same sizes
 * as the village's: a lantern hung on a crook, a bench of planks on two round bales, an old milk
 * churn or a half-barrel of flowers for its planters, and a five-bar gate's posts with a board
 * over them for its gateway. Null for any other static, which the village draws.
 */
export function drawFarmProp(sprite, variant, p = {}) {
  if (sprite === 'yardlamp') {
    const pc = new PixelCanvas(12, 30)
    // A post with a crook at the top and a hurricane lantern swinging from it.
    box(pc, 3, 4, 4, 29, P.barnTimber)
    pc.vline(3, 4, 29, P.barnTimberLight)
    pc.hline(3, 8, 3, P.farmIron)
    pc.vline(8, 4, 5, P.farmIron)
    box(pc, 6, 6, 10, 12, P.farmIron)
    box(pc, 7, 7, 9, 11, p.lit ? P.windowLit : P.glass)
    if (p.lit) pc.vline(8, 8, 10, P.windowLitCore)
    pc.hline(6, 10, 13, P.farmIron)
    pc.hline(1, 6, 29, P.fieldstoneDark)
    return pc.outline(P.outline)
  }
  if (sprite === 'yardbench') {
    // As the village's bench, two tiles long along the fence: its back on the west side. Planks
    // laid across two bales, which is what a farm sits on.
    const pc = new PixelCanvas(14, 32)
    for (const y0 of [2, 20]) {
      box(pc, 1, y0, 11, y0 + 9, P.hay)
      pc.vline(1, y0, y0 + 9, P.hayLight)
      pc.vline(11, y0, y0 + 9, P.hayDark)
      for (const y of [y0 + 2, y0 + 7]) pc.hline(1, 11, y, P.hayDark)
    }
    box(pc, 2, 1, 10, 30, P.barnTimber)
    for (const x of [2, 5, 8]) pc.vline(x, 1, 30, P.barnTimberLight)
    for (const x of [4, 7, 10]) pc.vline(x, 1, 30, P.barnTimberDark)
    box(pc, 0, 0, 1, 31, P.barnTimberDark)
    pc.vline(0, 0, 31, P.barnTimber)
    return pc.outline(P.outline)
  }
  if (sprite === 'yardplanter') {
    const pc = new PixelCanvas(16, 20)
    if (variant % 2 === 0) {
      // An old milk churn, retired, with flowers in the neck of it.
      box(pc, 4, 9, 11, 19, P.tin)
      pc.vline(4, 9, 19, P.tinLight)
      pc.vline(11, 9, 19, P.tinDark)
      for (const y of [12, 17]) pc.hline(4, 11, y, P.tinDark)
      box(pc, 6, 6, 9, 8, P.tin)
      pc.hline(5, 10, 6, P.tinLight)
      for (const x of [3, 12]) pc.px(x, 10, P.farmIron)
      for (const [x, y, c] of [[5, 2, P.blossom], [8, 1, P.farmPaint[2]], [11, 3, P.petalWhite], [7, 4, P.henComb]]) {
        pc.vline(x, y + 1, 6, P.vegLeafDark)
        pc.px(x, y, c)
        pc.px(x + 1, y, shade(c, -0.2))
      }
    } else {
      // A half-barrel of herbs and marigolds by the gate.
      box(pc, 2, 10, 13, 19, P.barnTimber)
      pc.vline(2, 10, 19, P.barnTimberLight)
      pc.vline(13, 10, 19, P.barnTimberDark)
      for (const y of [12, 17]) pc.hline(2, 13, y, P.farmIron)
      pc.hline(3, 12, 9, P.vegLeafDark)
      for (const [x, y] of [[4, 6], [7, 4], [10, 5], [12, 7]]) {
        pc.vline(x, y + 1, 9, P.vegLeaf)
        pc.ellipse(x, y, 1.5, 1.2, P.farmPaint[5])
        pc.px(x, y, P.farmPaint[2])
      }
    }
    return pc.outline(P.outline)
  }
  if (sprite === 'gateway') {
    // Two stout gateposts and the farm's board across them, with the five-bar gate swung open
    // against one post: open underneath, since a gateway is walked through.
    const pc = new PixelCanvas(32, 30)
    for (const x of [2, 27]) {
      box(pc, x, 5, x + 2, 29, P.barnTimber)
      pc.vline(x, 5, 29, P.barnTimberLight)
      pc.vline(x + 2, 5, 29, P.barnTimberDark)
      pc.hline(x - 1, x + 3, 29, P.fieldstoneDark)
    }
    box(pc, 1, 2, 30, 6, P.barnTimber)
    pc.hline(1, 30, 2, P.barnTimberLight)
    pc.hline(1, 30, 6, P.barnTimberDark)
    // What's painted on the board: a cockerel's silhouette and a sheaf either side of it.
    pc.hline(13, 17, 4, P.cowBlack)
    pc.px(18, 3, P.cowBlack)
    pc.px(12, 3, P.cowBlack)
    pc.px(18, 2, P.henComb)
    for (const x of [6, 24]) {
      pc.vline(x, 3, 5, P.hay)
      pc.px(x - 1, 3, P.hayLight)
      pc.px(x + 1, 3, P.hayLight)
    }
    // The gate, swung back flat against the left-hand post: its bars seen end on.
    for (let y = 12; y <= 26; y += 3) pc.hline(5, 7, y, TRIM)
    pc.vline(7, 11, 27, P.whitewashShade)
    pc.px(5, 13, P.farmIron)
    pc.px(5, 24, P.farmIron)
    return pc.outline(P.outline)
  }
  return null
}
