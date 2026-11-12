// Wild West buildings: what each thread builds in a frontier town, drawn the way the village's
// buildings are (src/render/sprites/buildings.js): the plot's wall material and paint family on
// them, its accent on the doors, and a finished one weathered by its wear.
//
// Contract (see ThemePack in ../index.js and the village's src/render/sprites/buildings.js):
// - A thread's building kind (KINDS in src/sim/building.js) maps to a frontier kind through `fitted`.
// - Every sprite is BUILDING_W (32) wide and 48 tall, its bottom row on the ground. Down a
//   courtyard's sides (`fitted(kind, variant, false)`) nothing is drawn above row DOORSTEP_CLEAR
//   (9), outline included, at every stage: the villager at the door of the house above stands there.
// - Stages 0 and 1 are the lot being pegged out and the frame going up; 2 is the building without
//   its roof (`roof: false`) inside a staging of poles and ladders; 3 is finished. Stage 3 is
//   weathered by `wear` exactly as the village's buildings are (see drawBuilding there).
// - `wall` indexes THEMES['wild-west'].dims.wall; `roofs` its paint families; `accent` is the
//   plot's colour, for the doors. Every colour from the palette.
//
// Windows keep the village's glass colours and its warm lit yellow: the weathering pass finds
// windows by those exact colours (GLASS_COLORS in weathering.js).
//
// The framing parts (a window, a plank door, the poles of the staging, a roof's slope) are the
// farm's own: a frontier town is put up by the same carpenters. What is drawn here is the town.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { BUILDING_W, DOORSTEP_CLEAR, drawGradeTrim } from '../../sprites/buildings.js'
import { lookFor, weather } from '../../sprites/weathering.js'
import { mulberry32, pick, rngFor } from '../../../sim/rng.js'
import { THEMES } from '../../../sim/themes.js'
import { KEPT } from '../../../sim/wear.js'
import { box, doorOf, paneOf, roofOver, staging } from '../farm/buildings.js'

/** A thread's building, by its kind, on the frontier. A house is a saloon, or one in four a mission. */
const WEST_KINDS = {
  house: 'saloon', cottage: 'cabin', shop: 'store', barn: 'cabin', windmill: 'windpump',
  workshop: 'store', well: 'mine', farm: 'windpump', tower: 'watertower', greenhouse: 'mission', stall: 'store',
}
const MATERIALS = THEMES['wild-west'].dims.wall
/**
 * The paint a plot's buildings share, by its `roofs`: three related colours each, as indices into
 * the palette's wwPaint (barn red, rust, mustard, sage, sky blue, turquoise, saddle brown, cream).
 * One family per sub-theme, which is what tells one street from the next; the cream is the trim.
 */
const PAINT_FAMILIES = [[0, 2, 7], [6, 1, 7], [1, 3, 7], [4, 0, 7], [5, 1, 7]]
const TRIM = P.wwPaint[7]
const HEIGHT = 48
const BASE = 46
/** The highest row anything may be drawn on, leaving the outline its row above. */
const ceiling = (low) => (low ? DOORSTEP_CLEAR + 1 : 1)

export function fitted(kind, variant, roomy) {
  const k = kind === 'house' && variant % 4 === 3 ? 'mission' : WEST_KINDS[kind] || 'cabin'
  return { kind: k, low: !roomy }
}

export const heightOf = () => HEIGHT

/** The tower's legs and the windpump's stand narrower than a building's walls. */
export function shadowOf(kind) {
  return kind === 'watertower' || kind === 'windpump' ? 24 : 34
}

/** Nothing here moves: the smoke does that. */
export const buildingFrames = () => 1

/** Where smoke leaves a finished building: the cabin's stone chimney, the store's stovepipe. */
export function chimneyOf(kind, variant = 0, wall = 0, roofs = 0, low = false) {
  if (kind === 'cabin') return cabinSpec(variant, low).chimney
  if (kind === 'store') return { x: storeSpec(variant, low).pipeX, y: storeSpec(variant, low).pipeTop }
  return null
}

// ---------- shared parts ----------

const specRand = (kind, variant) => rngFor(`west:${kind}:${variant}`)
const familyOf = (roofs) => PAINT_FAMILIES[(roofs || 0) % PAINT_FAMILIES.length]
/** A front's or a roof's paint: one of the first two of the family; the cream is for trim. */
const paintOf = (roofs, i) => P.wwPaint[familyOf(roofs)[Math.abs(Math.floor(i)) % 2]]
const materialOf = (r, wall) => (r() < 0.7 ? MATERIALS[(wall || 0) % MATERIALS.length] : pick(r, MATERIALS))

/** A wall of one of the theme's five materials, x0..x1 by y0..y1. Clapboard is painted `paint`. */
function wallOf(pc, x0, y0, x1, y1, material, paint, rand) {
  if (material === 'clapboard') {
    // Painted boards lapped one over the next: a shadow under every third row, lit along its top.
    box(pc, x0, y0, x1, y1, paint)
    for (let y = y0; y <= y1; y++) {
      const k = (y - y0) % 3
      if (k === 2) pc.hline(x0, x1, y, shade(paint, -0.22))
      else if (k === 0) pc.hline(x0, x1, y, shade(paint, 0.12))
    }
    pc.vline(x0, y0, y1, TRIM)
    pc.vline(x1, y0, y1, TRIM)
  } else if (material === 'logs') {
    // Logs laid one on another, three rows each, their ends showing at the corners.
    box(pc, x0, y0, x1, y1, P.wwLog)
    for (let y = y0; y <= y1; y++) {
      const k = (y - y0) % 3
      if (k === 0) pc.hline(x0, x1, y, P.wwLogLight)
      else if (k === 2) pc.hline(x0, x1, y, P.wwLogDark)
      if (k === 1) {
        pc.px(x0, y, P.wwLogEnd)
        pc.px(x1, y, P.wwLogEnd)
      }
    }
    for (let i = 0; i < 6; i++) pc.px(x0 + 2 + Math.floor(rand() * (x1 - x0 - 3)), y0 + 1 + 3 * Math.floor(rand() * Math.max(1, (y1 - y0) / 3)), P.wwLogDark)
  } else if (material === 'adobe') {
    // Mud brick under a coat of whitewash, worn through to the brick in patches, the corners round.
    box(pc, x0, y0, x1, y1, P.wwWhitewash)
    // A strip too small for a patch (a step of a false front, a row of a gable) is all whitewash.
    const roomy = y1 - y0 >= 6 && x1 - x0 >= 8
    for (let i = 0; roomy && i < 3; i++) {
      const px = x0 + 2 + Math.floor(rand() * Math.max(1, x1 - x0 - 6))
      const py = y0 + 3 + Math.floor(rand() * Math.max(1, y1 - y0 - 6))
      box(pc, px, py, px + 3, py + 1, P.wwAdobe)
      pc.hline(px, px + 3, py + 2, P.wwAdobeDark)
      pc.px(px + 1, py, P.wwAdobeLight)
    }
    pc.vline(x1, y0, y1, P.wwBoneShade)
    pc.hline(x0, x1, y1, P.wwAdobe)
    if (roomy) {
      pc.clearPx(x0, y0)
      pc.clearPx(x1, y0)
    }
  } else if (material === 'barnwood') {
    // Grey boards stood on end, weathered silver, a knot here and there.
    box(pc, x0, y0, x1, y1, P.wwBarnwood)
    for (let x = x0 + 2; x <= x1; x += 3) pc.vline(x, y0, y1, P.wwBarnwoodDark)
    for (let x = x0; x <= x1; x += 3) pc.px(x, y0, P.wwBarnwoodLight)
    for (let i = 0; i < 5; i++) pc.px(x0 + Math.floor(rand() * (x1 - x0 + 1)), y0 + Math.floor(rand() * (y1 - y0 + 1)), P.wwBarnwoodDark)
  } else {
    // Dressed stone in courses, each block lit along its top.
    box(pc, x0, y0, x1, y1, P.wwStone)
    for (let y = y0; y <= y1; y++) {
      const row = y - y0
      const off = (Math.floor(row / 4) % 2) * 3
      for (let x = x0; x <= x1; x++) {
        const u = (x - x0 + off) % 6
        if (row % 4 === 3 || u === 5) pc.px(x, y, P.wwStoneDark)
        else if (row % 4 === 0) pc.px(x, y, P.wwStoneLight)
      }
    }
  }
}

/** A post from y0 down to y1, lit on its left. */
function postAt(pc, x, y0, y1) {
  pc.vline(x, y0, y1, P.wwTimber)
  pc.px(x, y0, P.wwTimberLight)
}

/** A barrel standing with its foot on row y: hooped, its staves lit on the left. */
function barrelAt(pc, x, y) {
  box(pc, x, y - 5, x + 4, y, P.wwTimber)
  pc.vline(x, y - 5, y, P.wwTimberLight)
  pc.vline(x + 4, y - 5, y, P.wwTimberDark)
  for (const yy of [y - 4, y - 1]) pc.hline(x, x + 4, yy, P.wwIron)
  pc.hline(x + 1, x + 3, y - 6, P.wwTimberDark)
}

/** A lantern hung at (x, y): a tin cap, glass that glows when `lit`. */
function lanternAt(pc, x, y, lit) {
  pc.px(x, y - 1, P.wwIron)
  pc.hline(x - 1, x + 1, y, P.wwIron)
  pc.hline(x - 1, x + 1, y + 1, lit ? P.windowLit : P.window)
  pc.px(x, y + 2, P.wwIron)
}

/** A boardwalk along the front: planks from x0 to x1 on its foot row, a step down at each end. */
function boardwalk(pc, x0, x1) {
  pc.hline(x0, x1, BASE - 1, P.wwTimberLight)
  pc.hline(x0, x1, BASE, P.wwTimberDark)
  for (let x = x0 + 2; x < x1; x += 4) pc.px(x, BASE - 1, P.wwTimber)
}

// ---------- the lot being made ready ----------

function site(pc, rand, stage, variant) {
  pc.ellipse(16, 43, 15.5, 4.5, P.wwLaneDark)
  pc.ellipse(16, 42.5, 13, 3, P.wwLane)
  for (let i = 0; i < 12; i++) pc.px(2 + Math.floor(rand() * 28), 40 + Math.floor(rand() * 7), i % 2 ? P.wwLaneEdge : P.wwLaneLight)
  const left = variant % 2 === 0
  if (stage === 0) {
    // Pegged out: stakes at the corners with a line strung between them, lumber stacked and a
    // keg of nails waiting.
    for (const dx of [-13, -4, 4, 13]) {
      pc.vline(16 + dx, 37, 43, P.wwTimber)
      pc.px(16 + dx, 37, P.wwTimberLight)
    }
    pc.hline(3, 29, 38, P.wwPaper)
    const lx = left ? 18 : 4
    for (let i = 0; i < 3; i++) {
      pc.hline(lx, lx + 9, 44 - i * 2, P.wwTimberLight)
      pc.hline(lx, lx + 9, 45 - i * 2, P.wwTimberDark)
    }
    barrelAt(pc, left ? 6 : 22, 45)
    return
  }
  // The frame up: sill, studs and a plate across the top, a brace, a ladder against it.
  box(pc, 4, 42, 27, 43, P.wwTimberDark)
  pc.hline(4, 27, 42, P.wwTimberLight)
  for (let x = 5; x <= 26; x += 5) postAt(pc, x, 25, 41)
  pc.hline(4, 27, 24, P.wwTimberLight)
  pc.hline(4, 27, 25, P.wwTimberDark)
  pc.line(6, 41, 14, 26, P.wwTimber)
  pc.line(26, 41, 18, 26, P.wwTimber)
  const lx = left ? 2 : 29
  const dx = left ? 1 : -1
  pc.line(lx, 43, lx + dx * 5, 22, P.wwTimberLight)
  pc.line(lx + dx, 43, lx + dx * 6, 22, P.wwTimber)
  for (let i = 0; i < 7; i++) {
    const t = i / 7
    pc.hline(lx + Math.round(dx * t * 5), lx + Math.round(dx * (1 + t * 5)), 42 - i * 3, P.wwTimberDark)
  }
  barrelAt(pc, left ? 22 : 6, 45)
}

// ---------- saloon: a false front, a balcony, batwing doors ----------

function saloon(pc, o) {
  const lim = ceiling(o.low)
  const r = specRand('saloon', o.variant)
  const material = r() < 0.75 ? (r() < 0.6 ? 'clapboard' : materialOf(r, o.wall)) : materialOf(r, o.wall)
  const tone = Math.floor(r() * 3)
  const paint = paintOf(o.roofs, tone)
  const wallTop = o.low ? BASE - 28 : BASE - 32
  wallOf(pc, 3, wallTop, 28, BASE, material, paint, o.rand)
  boardwalk(pc, 1, 30)
  // Upstairs: two sash windows under the false front.
  paneOf(pc, 7, wallTop + 4, 5, 6, o.lit)
  paneOf(pc, 20, wallTop + 4, 5, 6, o.lit)
  // Downstairs: the batwing doors, the dark room behind them, a window either side.
  const dy = BASE - 10
  box(pc, 13, dy, 18, BASE - 2, P.wwBedDeep)
  pc.hline(13, 18, dy, TRIM)
  box(pc, 13, dy + 3, 15, dy + 7, o.accent)
  box(pc, 16, dy + 3, 18, dy + 7, shade(o.accent, -0.2))
  pc.px(15, dy + 5, shade(o.accent, 0.3))
  paneOf(pc, 5, dy + 1, 6, 6, o.lit)
  paneOf(pc, 21, dy + 1, 6, 6, o.lit)
  if (!o.roof) return { x0: 2, x1: 29, top: wallTop }
  // The porch roof over the boardwalk, on two posts, and the balcony rail on it.
  const porch = BASE - 13
  for (const x of [2, 29]) postAt(pc, x, porch + 1, BASE - 2)
  pc.hline(1, 30, porch, P.wwTin)
  pc.hline(1, 30, porch + 1, P.wwTinDark)
  pc.hline(2, 29, porch - 3, P.wwTimberLight)
  for (let x = 2; x <= 29; x += 3) pc.vline(x, porch - 2, porch - 1, P.wwTimber)
  // The false front: the facade carried up past the roof, a cornice, and the sign board.
  const front = Math.max(lim, wallTop - 6)
  wallOf(pc, 4, front, 27, wallTop - 1, material, paint, o.rand)
  pc.hline(3, 28, front, TRIM)
  pc.hline(3, 28, front + 1, shade(TRIM, -0.25))
  // A stepped crest in the middle, where there is room above the cornice.
  if (front - 2 >= lim) {
    box(pc, 11, front - 2, 20, front - 1, paint)
    pc.hline(11, 20, front - 2, TRIM)
  }
  const sy = front + 3
  box(pc, 7, sy, 24, sy + 3, P.wwPaper)
  pc.hline(7, 24, sy + 3, P.wwBoneShade)
  // The lettering, in the plot's paint: a word's worth of strokes.
  for (let x = 9; x <= 22; x += 2) pc.px(x, sy + 1 + (x % 4 === 1 ? 0 : 1), shade(paint, -0.3))
  lanternAt(pc, 5, porch + 2, o.lit)
  lanternAt(pc, 26, porch + 2, o.lit)
  return null
}

// ---------- store: a stepped false front, display windows under a striped awning ----------

function storeSpec(variant, low = false) {
  const r = specRand('store', variant)
  const flip = r() < 0.5
  const wallTop = low ? BASE - 24 : BASE - 28
  return { flip, wallTop, pipeX: flip ? 6 : 25, pipeTop: Math.max(DOORSTEP_CLEAR + 2, wallTop - 10) }
}

function store(pc, o) {
  const lim = ceiling(o.low)
  const s = storeSpec(o.variant, o.low)
  const r = specRand('store:look', o.variant)
  const material = r() < 0.6 ? 'clapboard' : materialOf(r, o.wall)
  const tone = Math.floor(r() * 3)
  const paint = paintOf(o.roofs, tone + 1)
  wallOf(pc, 3, s.wallTop, 28, BASE, material, paint, o.rand)
  boardwalk(pc, 1, 30)
  // A door in the middle, display windows either side of it.
  doorOf(pc, 13, BASE - 2, 6, 11, o.accent)
  paneOf(pc, 4, BASE - 13, 8, 9, o.lit)
  paneOf(pc, 20, BASE - 13, 8, 9, o.lit)
  if (!o.roof) return { x0: 2, x1: 29, top: s.wallTop }
  // The tin roof behind the front, with its stovepipe.
  roofOver(pc, 4, 27, s.wallTop - 1, 4, P.wwTin, lim)
  pc.vline(s.pipeX, s.pipeTop, s.wallTop - 2, P.wwIron)
  pc.hline(s.pipeX - 1, s.pipeX + 1, s.pipeTop, P.wwIronLight)
  // The stepped front: three steps up to a flat top, each edged in trim.
  const top = Math.max(lim + 1, s.wallTop - 8)
  const steps = [[3, 28, s.wallTop - 2], [7, 24, Math.round((s.wallTop - 2 + top) / 2)], [11, 20, top]]
  for (const [x0, x1, y] of steps) {
    wallOf(pc, x0, y, x1, s.wallTop - 1, material, paint, o.rand)
    pc.hline(x0, x1, y, TRIM)
  }
  // The sign, painted on the front.
  box(pc, 6, s.wallTop + 2, 25, s.wallTop + 5, TRIM)
  for (let x = 8; x <= 23; x += 2) pc.px(x, s.wallTop + 3 + (x % 3 === 0 ? 1 : 0), paint === P.wwPaint[7] ? P.wwTimberDark : shade(paint, -0.3))
  // The awning over the windows, striped in the plot's paint and the trim.
  const aw = BASE - 16
  for (let x = 2; x <= 29; x++) {
    const c = Math.floor(x / 3) % 2 ? paint : TRIM
    pc.vline(x, aw, aw + 1, c)
    pc.px(x, aw + 2, x % 3 === 1 ? shade(c, -0.2) : P.wwTimberDark)
  }
  // Goods on the boardwalk: a barrel and a crate at the far end from the door.
  barrelAt(pc, s.flip ? 23 : 4, BASE - 2)
  return null
}

// ---------- cabin: logs or boards, a stone chimney at the gable end, a porch ----------

function cabinSpec(variant, low = false) {
  const r = specRand('cabin', variant)
  const left = r() < 0.5
  const wallTop = low ? BASE - 18 : BASE - 20
  const x = left ? 4 : 25
  const top = Math.max(DOORSTEP_CLEAR + 2, wallTop - (low ? 12 : 16))
  return { left, wallTop, x, chimney: { x: x + 1, y: top } }
}

function cabin(pc, o) {
  const lim = ceiling(o.low)
  const s = cabinSpec(o.variant, o.low)
  const r = specRand('cabin:look', o.variant)
  const material = r() < 0.55 ? 'logs' : materialOf(r, o.wall)
  const tone = Math.floor(r() * 3)
  wallOf(pc, 3, s.wallTop, 28, BASE, material, paintOf(o.roofs, tone + 1), o.rand)
  pc.hline(3, 28, BASE, P.wwStoneDark)
  const doorX = s.left ? 17 : 9
  doorOf(pc, doorX, BASE - 1, 6, 11, o.accent)
  paneOf(pc, s.left ? 9 : 19, s.wallTop + 5, 5, 5, o.lit)
  if (!o.roof) return { x0: 2, x1: 29, top: s.wallTop }
  // The roof: a steep gable in the plot's paint, shingled.
  const color = paintOf(o.roofs, tone)
  roofOver(pc, 1, 30, s.wallTop - 1, o.low ? 8 : 11, color, lim)
  // The chimney, stone, up the gable end and through the roof.
  box(pc, s.x - 1, s.chimney.y, s.x + 2, BASE - 1, P.wwStone)
  for (let y = s.chimney.y + 1; y < BASE; y += 3) pc.hline(s.x - 1, s.x + 2, y, P.wwStoneDark)
  pc.vline(s.x - 1, s.chimney.y, BASE - 1, P.wwStoneLight)
  pc.hline(s.x - 1, s.x + 2, s.chimney.y, P.wwStoneDark)
  // The porch: a shed roof on two posts over the door.
  const py = BASE - 13
  for (const x of [doorX - 3, doorX + 8]) postAt(pc, x, py + 1, BASE - 1)
  pc.hline(doorX - 4, doorX + 9, py, P.wwTimberLight)
  pc.hline(doorX - 4, doorX + 9, py + 1, P.wwTimberDark)
  // A horseshoe over the door, the lucky way up.
  pc.px(doorX + 2, py - 2, P.wwIronLight)
  pc.px(doorX + 4, py - 2, P.wwIronLight)
  pc.hline(doorX + 2, doorX + 4, py - 1, P.wwIronLight)
  return null
}

// ---------- windpump: a lattice tower, the wheel and its tail vane, a tank at its foot ----------

function windpump(pc, o) {
  const r = specRand('windpump', o.variant)
  const flip = r() < 0.5
  const tone = Math.floor(r() * 3)
  const paint = paintOf(o.roofs, tone)
  const top = o.low ? 15 : 9
  const cx = flip ? 19 : 12
  // The tank at its foot: a round stock tank, water showing over the rim.
  const tx = flip ? 2 : 20
  box(pc, tx, BASE - 6, tx + 9, BASE, P.wwTin)
  pc.hline(tx, tx + 9, BASE - 6, P.wwTinLight)
  for (const y of [BASE - 3, BASE]) pc.hline(tx, tx + 9, y, P.wwTinDark)
  pc.hline(tx + 1, tx + 8, BASE - 7, P.water)
  // The tower: four legs to a platform, braced in X.
  pc.line(cx - 6, BASE, cx - 1, top + 7, P.wwTimberLight)
  pc.line(cx + 6, BASE, cx + 1, top + 7, P.wwTimber)
  for (let y = top + 12; y < BASE - 2; y += 7) {
    const hw = Math.round(1 + ((y - top - 7) / (BASE - top - 7)) * 5)
    pc.hline(cx - hw, cx + hw, y, P.wwTimberDark)
    pc.line(cx - hw, y, cx + hw + 1, y + 7, P.wwTimberDark)
  }
  pc.vline(cx, top + 7, BASE - 1, P.wwIronLight) // the pump rod
  if (!o.roof) {
    // Without its wheel: a gin pole up the side to hoist it.
    pc.vline(cx + 3, top + 2, top + 7, P.wwTimberLight)
    return null
  }
  // The wheel: a ring of blades round the hub, facing out.
  const hy = top + 4
  pc.ellipse(cx, hy, 5, 5, P.wwTin)
  for (let a = 0; a < 12; a++) {
    const t = (a / 12) * Math.PI * 2
    pc.line(cx, hy, Math.round(cx + Math.cos(t) * 5), Math.round(hy + Math.sin(t) * 5), a % 2 ? P.wwTinDark : P.wwTinLight)
  }
  pc.px(cx, hy, P.wwIron)
  // The tail vane, out behind it, in the plot's paint.
  const dir = flip ? -1 : 1
  pc.hline(cx + dir * 1, cx + dir * 8, hy, P.wwIron)
  const vx0 = Math.min(cx + dir * 6, cx + dir * 10)
  box(pc, vx0, hy - 3, vx0 + 4, hy + 1, paint)
  pc.hline(vx0, vx0 + 4, hy - 3, shade(paint, 0.25))
  return null
}

// ---------- water tower: a wooden tank on its legs, a spout swung out over the track ----------

function watertower(pc, o) {
  const lim = ceiling(o.low)
  const r = specRand('watertower', o.variant)
  const flip = r() < 0.5
  const tone = Math.floor(r() * 3)
  const paint = paintOf(o.roofs, tone)
  const tankBot = o.low ? BASE - 16 : BASE - 20
  const tankTop = Math.max(lim + 6, tankBot - 14)
  // The legs: four timbers, braced.
  for (const x of [6, 12, 19, 25]) postAt(pc, x, tankBot, BASE)
  for (let y = tankBot + 4; y < BASE - 2; y += 8) {
    pc.hline(6, 25, y, P.wwTimberDark)
    pc.line(6, y, 12, y + 8, P.wwTimberDark)
    pc.line(25, y, 19, y + 8, P.wwTimberDark)
  }
  // The ladder up one leg.
  const lx = flip ? 27 : 3
  pc.vline(lx, tankBot - 2, BASE, P.wwTimberLight)
  for (let y = BASE - 2; y > tankBot; y -= 3) pc.px(lx + (flip ? 1 : -1), y, P.wwTimberLight)
  if (!o.roof) {
    // Only the floor of the tank so far, staves stacked beside it.
    pc.hline(4, 27, tankBot, P.wwTimberLight)
    pc.hline(4, 27, tankBot + 1, P.wwTimberDark)
    return { x0: 4, x1: 27, top: tankTop }
  }
  // The tank: staves bound in iron hoops.
  box(pc, 5, tankTop, 26, tankBot, P.wwTimber)
  for (let x = 6; x <= 25; x += 3) pc.vline(x, tankTop, tankBot, P.wwTimberDark)
  pc.vline(5, tankTop, tankBot, P.wwTimberLight)
  for (let y = tankTop + 3; y < tankBot; y += 4) pc.hline(5, 26, y, P.wwIron)
  // The company's name on a painted band, in the plot's paint.
  box(pc, 9, tankTop + 5, 22, tankTop + 7, paint)
  pc.hline(9, 22, tankTop + 5, shade(paint, 0.25))
  // Its conical cap.
  const capTop = Math.max(lim, tankTop - 5)
  for (let y = capTop; y < tankTop; y++) {
    const hw = Math.round(3 + ((y - capTop) / Math.max(1, tankTop - capTop)) * 9)
    pc.hline(16 - hw, 15 + hw, y, y === capTop ? P.wwTinLight : P.wwTin)
    pc.px(15 + hw, y, P.wwTinDark)
  }
  // The spout, swung out over the track.
  const sx = flip ? 4 : 27
  const sd = flip ? -1 : 1
  pc.line(flip ? 6 : 25, tankBot - 3, sx + sd * 2, tankBot + 4, P.wwTimberDark)
  pc.px(sx + sd * 2, tankBot + 5, P.water)
  if (o.lit) lanternAt(pc, flip ? 23 : 8, tankBot + 2, true)
  return null
}

// ---------- mine: a timbered adit into the rock, rails out of it, a cart of ore ----------

function mine(pc, o) {
  const lim = ceiling(o.low)
  const r = specRand('mine', o.variant)
  const flip = r() < 0.5
  const tone = Math.floor(r() * 3)
  const paint = paintOf(o.roofs, tone)
  const rockTop = o.low ? lim + 8 : 14
  // The rock it is driven into: a flat-topped outcrop of red rock, near-sheer sides stepping out
  // a little at each band of strata, lit on the left. Flat on top and square-shouldered, so it
  // reads as a cliff face rather than as a heap or a tent.
  const [base, dark, light, deep] = P.wwGround[3]
  for (let y = rockTop; y <= BASE; y++) {
    const band = Math.floor((y - rockTop) / 6)
    const hw = Math.min(15, 11 + band + (y === rockTop ? -1 : 0))
    const x0 = 16 - hw
    const x1 = 15 + hw
    pc.hline(x0, x1, y, base)
    pc.px(x0, y, light)
    pc.px(x1, y, dark)
    if ((y - rockTop) % 6 === 5) pc.hline(x0 + 1, x1 - 1, y, dark)
  }
  pc.hline(6, 25, rockTop, light)
  for (let i = 0; i < 14; i++) pc.px(3 + Math.floor(o.rand() * 26), rockTop + 2 + Math.floor(o.rand() * (BASE - rockTop - 2)), i % 2 ? dark : deep)
  // The adit: a dark mouth framed in timber.
  const ax = flip ? 15 : 8
  box(pc, ax, BASE - 14, ax + 8, BASE, P.wwBedDeep)
  postAt(pc, ax - 1, BASE - 14, BASE)
  postAt(pc, ax + 9, BASE - 14, BASE)
  pc.hline(ax - 2, ax + 10, BASE - 15, P.wwTimberLight)
  pc.hline(ax - 2, ax + 10, BASE - 14, P.wwTimberDark)
  // The rails, running out of the mouth.
  pc.hline(ax, flip ? 0 : 31, BASE, P.wwIronLight)
  for (let x = ax + 1; flip ? x >= 0 : x <= 31; x += flip ? -3 : 3) pc.px(x, BASE - 1, P.wwTimberDark)
  if (!o.roof) return null
  // A lantern on the frame, and the cart of ore out on the rails.
  lanternAt(pc, ax + 4, BASE - 12, o.lit)
  const cx = flip ? 3 : 22
  box(pc, cx, BASE - 6, cx + 7, BASE - 2, paint)
  pc.hline(cx, cx + 7, BASE - 6, shade(paint, 0.25))
  pc.vline(cx + 7, BASE - 5, BASE - 2, shade(paint, -0.3))
  pc.hline(cx + 1, cx + 6, BASE - 7, P.wwStoneDark)
  pc.px(cx + 2, BASE - 8, P.wwGold)
  pc.px(cx + 5, BASE - 8, P.wwGoldLight)
  for (const x of [cx + 1, cx + 6]) pc.px(x, BASE - 1, P.wwIron)
  // The headframe over the shaft, up on the hill, where there is room.
  const hx = flip ? 6 : 25
  const ht = Math.max(lim + 1, rockTop - 8)
  if (rockTop - ht > 3) {
    pc.line(hx - 3, rockTop + 2, hx, ht, P.wwTimberLight)
    pc.line(hx + 3, rockTop + 2, hx, ht, P.wwTimber)
    pc.hline(hx - 2, hx + 2, ht + 1, P.wwTimberDark)
    pc.px(hx, ht, P.wwIronLight) // the sheave
  }
  return null
}

// ---------- mission: adobe under a bell gable, a heavy door ----------

function mission(pc, o) {
  const lim = ceiling(o.low)
  const r = specRand('mission', o.variant)
  const material = r() < 0.8 ? 'adobe' : materialOf(r, o.wall)
  const tone = Math.floor(r() * 3)
  const wallTop = o.low ? BASE - 20 : BASE - 22
  wallOf(pc, 3, wallTop, 28, BASE, material, paintOf(o.roofs, tone), o.rand)
  pc.hline(3, 28, BASE, P.wwAdobeDark)
  // The door: heavy planks under a round arch, in the plot's accent.
  doorOf(pc, 13, BASE - 1, 6, 12, o.accent)
  pc.hline(14, 17, BASE - 13, o.accent)
  paneOf(pc, 5, wallTop + 6, 4, 5, o.lit)
  paneOf(pc, 23, wallTop + 6, 4, 5, o.lit)
  // Vigas: the roof beams' ends poking through the wall under the parapet.
  for (let x = 5; x <= 27; x += 4) pc.px(x, wallTop + 2, P.wwTimberDark)
  if (!o.roof) return { x0: 2, x1: 29, top: wallTop }
  // The parapet, and over the middle the bell gable: a curved front with a bell in its arch.
  pc.hline(3, 28, wallTop, P.wwBoneShade)
  const gTop = Math.max(lim + 1, wallTop - (o.low ? 9 : 14))
  const gh = wallTop - gTop
  for (let y = gTop; y < wallTop; y++) {
    const t = (y - gTop) / Math.max(1, gh)
    const hw = Math.round(4 + Math.sqrt(t) * 6)
    wallOf(pc, 16 - hw, y, 15 + hw, y, material, paintOf(o.roofs, tone), o.rand)
  }
  pc.hline(12, 19, gTop, P.wwBoneShade)
  // The arch, and the bell hung in it.
  const by = gTop + Math.max(2, Math.floor(gh / 2) - 2)
  box(pc, 14, by, 17, by + 3, P.wwBedDeep)
  pc.hline(15, 16, by - 1, P.wwBedDeep)
  pc.hline(15, 16, by + 1, P.wwGold)
  pc.hline(14, 17, by + 2, P.wwGold)
  pc.px(14, by + 2, P.wwGoldLight)
  return null
}

// ---------- drawing one ----------

const KINDS = { saloon, store, cabin, windpump, watertower, mine, mission }
/** A windpump and a mine stand on the ground as they are: they need no staging. */
const NO_STAGING = new Set(['windpump', 'mine'])

/**
 * @param {{ kind: string, stage: number, accent: string, variant: number, lit: boolean, frame?: number, wall?: number, roofs?: number, low?: boolean, wear?: number, grade?: number }} o
 */
export function drawWestBuilding(o) {
  const kind = KINDS[o.kind] ? o.kind : 'cabin'
  const variant = o.variant || 0
  const pc = new PixelCanvas(BUILDING_W, HEIGHT)
  const seed = variant * 6151 + 89
  // Down a courtyard's side nothing may reach the walkway above, whatever it was drawn with.
  const clip = (c) => {
    if (o.low) for (let y = 0; y < DOORSTEP_CLEAR + 1; y++) for (let x = 0; x < BUILDING_W; x++) c.clearPx(x, y)
    return c
  }
  if (o.stage <= 1) {
    site(pc, mulberry32(seed), o.stage, variant)
    return clip(pc).outline(P.outline)
  }
  const draw = KINDS[kind]
  const opts = {
    rand: mulberry32(seed), accent: o.accent || P.wwPaint[0], lit: Boolean(o.lit), roof: o.stage >= 3, variant,
    wall: o.wall || 0, roofs: o.roofs || 0, low: Boolean(o.low),
  }
  const sc = draw(pc, opts)
  if (o.stage === 2 && !NO_STAGING.has(kind) && sc) {
    staging(pc, sc.x0, sc.x1, Math.max(ceiling(opts.low), sc.top), HEIGHT - 2)
  }
  const look = o.stage >= 3 ? lookFor(o.wear ?? KEPT) : null
  if (look) {
    // As the village's: roof told from walls by the building drawn without it, every drawing given
    // the same texture stream as the first.
    const again = (roof) => {
      const other = new PixelCanvas(BUILDING_W, HEIGHT)
      draw(other, { ...opts, rand: mulberry32(seed), roof })
      return other
    }
    weather(pc, again(false), look, variant, [])
  }
  if (o.stage >= 3) drawGradeTrim(pc, o)
  return clip(pc).outline(P.outline)
}
