// Eid buildings: what each thread builds in a festival village, drawn the way the village's
// buildings are (src/render/sprites/buildings.js): the plot's wall material and paint family on
// them, its accent on the doors and awnings, and a finished one weathered by its wear.
//
// Contract (see ThemePack in ../index.js and the village's src/render/sprites/buildings.js):
// - A thread's building kind (KINDS in src/sim/building.js) maps to an Eid kind through `fitted`.
// - Every sprite is BUILDING_W (32) wide and 48 tall, its bottom row on the ground. Down a
//   courtyard's sides (`fitted(kind, variant, false)`) nothing is drawn above row DOORSTEP_CLEAR
//   (9), outline included, at every stage: the villager at the door of the house above stands there.
// - Stages 0 and 1 are the ground being made ready; 2 is the building without its roof
//   (`roof: false`) inside a staging of poles and ladders; 3 is finished. Stage 3 is weathered by
//   `wear` exactly as the village's buildings are (see drawBuilding there).
// - `wall` indexes THEMES.eid.dims.wall; `roofs` its paint families; `accent` is the
//   plot's colour, for doors and awnings. Every colour from the palette.
//
// Windows keep the village's glass colours and its warm lit yellow: the weathering pass finds
// windows by those exact colours (GLASS_COLORS in weathering.js).
//
// The framing parts (a window, a door, a pitched roof, the poles of the staging) are the farm's
// own: a festival village is built by the same carpenters. What is drawn here is the festival on them.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { BUILDING_W, DOORSTEP_CLEAR, drawGradeTrim } from '../../sprites/buildings.js'
import { lookFor, weather } from '../../sprites/weathering.js'
import { mulberry32, pick, rngFor } from '../../../sim/rng.js'
import { THEMES } from '../../../sim/themes.js'
import { KEPT } from '../../../sim/wear.js'
import { baleAt, box, doorOf, paneOf, roofOver, staging } from '../farm/buildings.js'

/** A thread's building, by its kind, in a festival village. */
export const EID_KINDS = {
  house: 'homestead', cottage: 'cabin', shop: 'bakery', barn: 'souk', windmill: 'souk',
  workshop: 'cabin', well: 'feast', farm: 'souk', tower: 'homestead', greenhouse: 'bakery', stall: 'feast',
}
const MATERIALS = THEMES.eid.dims.wall
/**
 * The paint a plot's buildings share, by its `roofs`: three related colours each, as indices into
 * the palette's eidPaint (teal, gold, deep blue, rose, cream, walnut, plum, palm green). One family per sub-theme, which is what tells one street from the next.
 */
const PAINT_FAMILIES = [[0, 5, 4], [1, 5, 4], [3, 2, 4], [2, 6, 4]]
/** The cream every trim, sill and window frame is painted (the farm's white, seen by candlelight). */
const TRIM = P.eidPaint[4]
const HEIGHT = 48
/** The highest row anything may be drawn on, leaving the outline its row above. */
const ceiling = (low) => (low ? DOORSTEP_CLEAR + 1 : 1)

export function fitted(kind, variant, roomy) {
  return { kind: EID_KINDS[kind] || 'cabin', low: !roomy }
}

export const heightOf = () => HEIGHT

/** A long table and a cabin's woodpile are low; the rest stand as wide as their plot. */
export function shadowOf(kind) {
  return kind === 'feast' ? 34 : kind === 'cabin' ? 30 : 34
}

/** Nothing here moves: the smoke does that. */
export const buildingFrames = () => 1

/** Where smoke leaves a finished building: the homestead's and the cabin's stacks, the bakery's oven. */
export function chimneyOf(kind, variant = 0, wall = 0, roofs = 0, low = false) {
  if (kind === 'homestead') return { x: 25, y: homesteadSpec(low).stackTop }
  if (kind === 'cabin') return { x: 24, y: cabinSpec(low).stackTop }
  if (kind === 'bakery') return { x: 24, y: bakerySpec(low).stackTop }
  return null
}

// ---------- shared parts ----------

const specRand = (kind, variant) => rngFor(`thanks:${kind}:${variant}`)
const paintOf = (roofs, i) => {
  const f = PAINT_FAMILIES[(roofs || 0) % PAINT_FAMILIES.length]
  return P.eidPaint[f[Math.abs(Math.floor(i)) % f.length]]
}
/** A roof's or an awning's paint: the first two of the family; the cream is for trim. */
const roofPaintOf = (roofs, i) => {
  const f = PAINT_FAMILIES[(roofs || 0) % PAINT_FAMILIES.length]
  return P.eidPaint[f[Math.abs(Math.floor(i)) % 2]]
}
const materialOf = (r, wall) => (r() < 0.7 ? MATERIALS[(wall || 0) % MATERIALS.length] : pick(r, MATERIALS))

/** A wall of one of the theme's five materials, x0..x1 by y0..y1. */
function wallOf(pc, x0, y0, x1, y1, material, rand) {
  if (material === 'whitewash') {
    // Whitewashed plaster: smooth, a shade darker where it has weathered, light along the top.
    box(pc, x0, y0, x1, y1, P.eidWhitewash)
    pc.hline(x0, x1, y0, P.eidWhitewashLight)
    for (let i = 0; i < 6; i++) pc.px(x0 + Math.floor(rand() * (x1 - x0 + 1)), y0 + Math.floor(rand() * (y1 - y0 + 1)), P.eidWhitewashDark)
    pc.hline(x0, x1, y1 - 1, P.eidWhitewashDark)
  } else if (material === 'sandstone') {
    // Dressed sandstone in even courses, each block lit along its top.
    box(pc, x0, y0, x1, y1, P.eidSandstone)
    for (let y = y0; y <= y1; y++) {
      const row = y - y0
      const off = (Math.floor(row / 4) % 2) * 4
      for (let x = x0; x <= x1; x++) {
        const u = (x - x0 + off) % 8
        if (row % 4 === 3 || u === 7) pc.px(x, y, P.eidSandstoneDark)
        else if (row % 4 === 0) pc.px(x, y, P.eidSandstoneLight)
      }
    }
  } else if (material === 'tilework') {
    // Glazed tile in blue and teal, set on the diagonal, every tile with a pale heart.
    box(pc, x0, y0, x1, y1, P.glazeBlue)
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const u = (x + y) % 6
        const v = (x - y + 60) % 6
        if (u === 0 || v === 0) pc.px(x, y, P.glazeBlueDark)
        else if (u === 3 && v === 3) pc.px(x, y, P.glazeWhite)
        else if ((u + v) % 6 === 0) pc.px(x, y, P.glazeTeal)
      }
    }
    pc.hline(x0, x1, y0, P.glazeWhite)
  } else if (material === 'clay') {
    // Sun-dried clay, rendered smooth and lit from the top left, with the odd crack.
    box(pc, x0, y0, x1, y1, P.clay)
    for (let y = y0; y <= y1; y += 5) pc.hline(x0, x1, y, P.clayLight)
    pc.vline(x0, y0, y1, P.clayLight)
    pc.vline(x1, y0, y1, P.clayDark)
    for (let i = 0; i < 5; i++) pc.px(x0 + 1 + Math.floor(rand() * (x1 - x0 - 1)), y0 + Math.floor(rand() * (y1 - y0 + 1)), P.clayDark)
  } else {
    // A carved screen: wood in a diamond mesh over a dark room behind it.
    box(pc, x0, y0, x1, y1, P.barnTimberDark)
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if ((x + y) % 4 === 0) pc.px(x, y, P.barnTimberLight)
        else if ((x - y + 80) % 4 === 0) pc.px(x, y, P.barnTimber)
      }
    }
    pc.hline(x0, x1, y0, P.barnTimberLight)
    pc.hline(x0, x1, y1, P.barnTimber)
  }
}

/** A standing lantern at (cx, y), its foot on row y, `r` rows to its half-height, glass of colour `c`. */
function lanternAt(pc, cx, y, r = 3, c = P.eidPaint[1]) {
  const h = 2 * r
  pc.hline(cx - 1, cx + 1, y, P.eidBrassDark)
  pc.rect(cx - 1, y - h, 3, h, c)
  pc.px(cx - 1, y - h + 1, shade(c, 0.35))
  pc.vline(cx + 1, y - h + 1, y - 1, shade(c, -0.3))
  pc.px(cx, y - Math.ceil(h / 2), P.glowCandle)
  pc.hline(cx - 1, cx + 1, y - h - 1, P.eidBrassLight)
  pc.px(cx, y - h - 2, P.eidBrass)
}

/** A date palm at (cx, y): a ringed trunk and a crown of fronds, `h` rows tall. */
function palmAt(pc, cx, y, h = 12) {
  for (let i = 0; i < h - 4; i++) pc.px(cx, y - i, i % 2 ? P.clay : P.clayDark)
  const t = y - h + 4
  pc.hline(cx - 3, cx + 3, t, P.palmGreen)
  pc.line(cx, t, cx - 3, t + 2, P.palmGreen)
  pc.line(cx, t, cx + 3, t + 2, P.palmGreenDark)
  pc.line(cx, t, cx - 2, t - 2, P.palmGreenDark)
  pc.line(cx, t, cx + 2, t - 2, P.palmGreen)
  pc.px(cx, t - 2, P.palmGreen)
  pc.px(cx - 1, t + 1, P.dateBrown) // dates in the crown
  pc.px(cx + 1, t + 1, P.dateBrown)
}

/** A crescent and star at (cx, cy), hung over a door or set on a sign: three rows to a side. */
function crescentAt(pc, cx, cy) {
  const ring = [[-2, 0], [-2, -1], [-1, -2], [0, -2], [-1, 2], [0, 2], [-2, 1], [1, -1], [1, 1]]
  ring.forEach(([dx, dy]) => pc.px(cx + dx, cy + dy, P.eidBrassLight))
  pc.px(cx + 2, cy, P.gilt)
}

/** Ma'amoul on a plate at (x, y), five wide with its foot on row y: sugar-dusted domes on brass. */
function sweetsAt(pc, x, y) {
  pc.hline(x, x + 4, y, P.eidBrassDark)
  pc.hline(x, x + 4, y - 1, P.eidBrassLight)
  pc.hline(x + 1, x + 3, y - 2, P.eidSandstone)
  pc.px(x + 2, y - 3, P.sugarDust)
  pc.px(x + 1, y - 2, P.sugarDust)
  pc.px(x + 3, y - 2, P.honey)
}

/** A row of lanterns along the ground at x0.., in turn gold, rose and teal. */
function lanternRow(pc, x0, y, n) {
  const kinds = [[P.eidPaint[1], 2], [P.eidPaint[3], 1], [P.eidPaint[0], 1]]
  let x = x0
  for (let i = 0; i < n; i++) {
    const [c, r] = kinds[i % kinds.length]
    lanternAt(pc, x + r + 1, y, r, c)
    x += 2 * r + 3
  }
}

/** A crescent finial on a ridge at column cx, if there is room under the ceiling `lim`. */
function finial(pc, cx, top, lim) {
  if (top - 4 < lim) return
  pc.vline(cx, top - 2, top - 1, P.eidBrassDark)
  pc.px(cx - 1, top - 3, P.eidBrassLight)
  pc.px(cx - 1, top - 4, P.eidBrassLight)
  pc.px(cx, top - 5 < lim ? top - 4 : top - 5, P.eidBrassLight)
  pc.px(cx + 1, top - 3, P.gilt)
}

// ---------- the ground being made ready ----------

function site(pc, rand, stage, oy, variant) {
  const Y = (y) => y + oy
  const [, shadeC, light, deep] = P.eidGround[2]
  pc.ellipse(16, Y(43), 15.5, 4.5, shadeC)
  for (let i = 0; i < 12; i++) pc.px(2 + Math.floor(rand() * 28), Y(40 + Math.floor(rand() * 7)), i % 2 ? light : deep)
  // Petals round it, whatever the ground.
  for (let i = 0; i < 8; i++) pc.px(2 + Math.floor(rand() * 28), Y(39 + Math.floor(rand() * 8)), [P.eidPaint[3], P.eidBrassLight, P.sugarDust][i % 3])
  const left = variant % 2 === 0
  if (stage === 0) {
    // Cleared and marked out: stakes with a twine run between them, a palm at one end and a
    // couple of lanterns waiting to be hung.
    for (const dx of [-13, -6, 0, 6, 13]) {
      pc.vline(16 + dx, Y(37), Y(43), P.barnTimber)
      pc.px(16 + dx, Y(37), P.barnTimberLight)
    }
    pc.hline(3, 29, Y(38), P.eidBrassLight)
    palmAt(pc, left ? 26 : 5, Y(44), 12)
    lanternAt(pc, left ? 8 : 22, Y(44), 3)
    lanternAt(pc, left ? 14 : 16, Y(45), 2, P.eidPaint[3])
    return
  }
  // The frame up: a sill on the ground, corner posts and a wall plate, studs between them, a
  // ladder against it and the boards stacked at its foot.
  box(pc, 4, Y(41), 27, Y(43), P.barnTimberDark)
  pc.hline(4, 27, Y(41), P.barnTimber)
  for (const x of [7, 24]) {
    box(pc, x, Y(27), x + 1, Y(41), P.barnTimber)
    pc.vline(x, Y(27), Y(41), P.barnTimberLight)
  }
  pc.hline(6, 26, Y(26), P.barnTimberLight)
  pc.hline(6, 26, Y(27), P.barnTimberDark)
  for (let x = 11; x <= 21; x += 5) pc.vline(x, Y(28), Y(40), P.barnTimberDark)
  pc.line(8, Y(40), 23, Y(28), P.barnTimber)
  const lx = left ? 2 : 29
  const dx = left ? 1 : -1
  pc.line(lx, Y(43), lx + dx * 5, Y(24), P.barnTimberLight)
  pc.line(lx + dx, Y(43), lx + dx * 6, Y(24), P.barnTimber)
  for (let i = 0; i < 6; i++) {
    const t = i / 6
    pc.hline(lx + Math.round(dx * t * 5), lx + Math.round(dx * (1 + t * 5)), Y(42 - i * 3), P.barnTimberDark)
  }
  baleAt(pc, left ? 16 : 6, Y(44), 6, 3)
  lanternAt(pc, left ? 26 : 5, Y(45), 2)
}

// ---------- homestead: the family house, sweets on the sill and a crescent over the door ----------

function homesteadSpec(low = false) {
  const base = 46
  const wallTop = low ? base - 22 : base - 28
  return { base, wallTop, stackTop: Math.max(DOORSTEP_CLEAR + 1, wallTop - 11) }
}

function homestead(pc, o) {
  const s = homesteadSpec(o.low)
  const lim = ceiling(o.low)
  const r = specRand('homestead', o.variant)
  const material = materialOf(r, o.wall)
  const tone = Math.floor(r() * 3)
  const doorLeft = r() < 0.5
  wallOf(pc, 4, s.wallTop, 27, s.base, material, o.rand)
  pc.hline(4, 27, s.base, P.fieldstoneDark)
  const dx = doorLeft ? 7 : 19
  // The porch over the door: two posts and a little gabled roof.
  doorOf(pc, dx, s.base - 1, 6, 11, o.accent)
  for (const x of [dx - 1, dx + 6]) pc.vline(x, s.base - 12, s.base - 1, TRIM)
  crescentAt(pc, dx + 3, s.base - 7)
  // Windows up and down; a plate of sweets on the sill of the one beside the door.
  const wx = doorLeft ? 18 : 6
  paneOf(pc, wx, s.base - 11, 7, 7, o.lit)
  sweetsAt(pc, wx + 1, s.base - 5)
  paneOf(pc, 6, s.wallTop + 3, 6, 7, o.lit)
  paneOf(pc, 20, s.wallTop + 3, 6, 7, o.lit)
  // Lanterns on the step between them, and a date palm at the far end of the wall.
  lanternAt(pc, 14, s.base - 1, 3)
  lanternAt(pc, doorLeft ? 18 : 12, s.base - 1, 1, P.eidPaint[3])
  palmAt(pc, doorLeft ? 29 : 2, s.base, 12)
  if (!o.roof) return { x0: 3, x1: 28, top: s.wallTop }
  const color = roofPaintOf(o.roofs, tone)
  const top = roofOver(pc, 1, 30, s.wallTop - 1, 10, color, lim)
  finial(pc, 16, top, lim)
  // The stack at the gable end, of fieldstone.
  for (let y = s.stackTop; y <= s.wallTop - 6; y++) {
    pc.hline(23, 27, y, (y - s.stackTop) % 3 === 2 ? P.fieldstoneDark : P.fieldstone)
    pc.px(23, y, P.fieldstoneLight)
  }
  pc.hline(22, 28, s.stackTop, P.fieldstoneLight)
  roofOver(pc, dx - 2, dx + 7, s.base - 13, 3, roofPaintOf(o.roofs, tone + 1), lim)
  if (!o.low) paneOf(pc, (doorLeft ? 11 : 20) - 2, top + 6, 5, 4, o.lit)
  return null
}

// ---------- cabin: logs and a fieldstone chimney, a stack of firewood ----------

function cabinSpec(low = false) {
  const base = 46
  const wallTop = low ? base - 18 : base - 22
  return { base, wallTop, stackTop: Math.max(DOORSTEP_CLEAR + 1, wallTop - 10) }
}

function cabin(pc, o) {
  const s = cabinSpec(o.low)
  const lim = ceiling(o.low)
  const r = specRand('cabin', o.variant)
  const tone = Math.floor(r() * 3)
  const doorLeft = r() < 0.5
  // A cabin is logs more often than not, whatever else the plot is built of.
  const material = r() < 0.6 ? 'clay' : materialOf(r, o.wall)
  wallOf(pc, 5, s.wallTop, 26, s.base, material, o.rand)
  pc.hline(5, 26, s.base, P.fieldstoneDark)
  const dx = doorLeft ? 8 : 18
  doorOf(pc, dx, s.base - 1, 5, 10, o.accent)
  pc.hline(dx, dx + 4, s.base - 5, shade(o.accent, -0.3))
  paneOf(pc, doorLeft ? 16 : 8, s.wallTop + 5, 7, 6, o.lit)
  // Folded rugs stacked at the other end, and a lantern on the step.
  const wx = doorLeft ? 23 : 1
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 4; i++) {
      pc.rect(wx + i * 2 - (row % 2), s.base - 2 - row * 2, 2, 2, [P.eidPaint[0], P.eidPaint[3], P.eidPaint[1], P.eidPaint[2]][(i + row) % 4])
      pc.px(wx + i * 2 - (row % 2), s.base - 2 - row * 2, P.eidBrassDark)
    }
  }
  lanternAt(pc, doorLeft ? 14 : 15, s.base - 1, 2)
  if (!o.roof) return { x0: 4, x1: 27, top: s.wallTop }
  for (let y = s.stackTop; y <= s.wallTop; y++) {
    pc.hline(21, 25, y, (y - s.stackTop) % 3 === 2 ? P.fieldstoneDark : P.fieldstone)
    pc.px(21, y, P.fieldstoneLight)
  }
  pc.hline(20, 26, s.stackTop, P.fieldstoneLight)
  roofOver(pc, 2, 29, s.wallTop - 1, 11, roofPaintOf(o.roofs, tone), lim)
  for (let y = s.stackTop; y <= s.wallTop - 7; y++) {
    pc.hline(21, 25, y, (y - s.stackTop) % 3 === 2 ? P.fieldstoneDark : P.fieldstone)
    pc.px(21, y, P.fieldstoneLight)
  }
  pc.hline(20, 26, s.stackTop, P.fieldstoneLight)
  return null
}

// ---------- bakery: sweets in the window, a striped awning, the oven's chimney ----------

function bakerySpec(low = false) {
  const base = 46
  const wallTop = low ? base - 22 : base - 26
  return { base, wallTop, stackTop: Math.max(DOORSTEP_CLEAR + 1, wallTop - 10) }
}

function bakery(pc, o) {
  const s = bakerySpec(o.low)
  const lim = ceiling(o.low)
  const r = specRand('bakery', o.variant)
  const material = r() < 0.6 ? pick(r, ['sandstone', 'whitewash']) : materialOf(r, o.wall)
  const tone = Math.floor(r() * 3)
  const doorLeft = r() < 0.5
  wallOf(pc, 4, s.wallTop, 27, s.base, material, o.rand)
  pc.hline(4, 27, s.base, P.fieldstoneDark)
  const wx = doorLeft ? 13 : 4
  paneOf(pc, wx, s.base - 14, 14, 9, o.lit)
  // Sweets on the shelf across the shop window, the rims showing above the sill.
  pc.hline(wx + 1, wx + 12, s.base - 9, P.barnTimberDark)
  for (const i of [0, 1, 2]) sweetsAt(pc, wx + 1 + i * 4, s.base - 10)
  doorOf(pc, doorLeft ? 6 : 22, s.base - 1, 5, 12, o.accent)
  // The sign across the front: a crescent on the plot's paint.
  const fx = doorLeft ? 4 : 15
  const sign = roofPaintOf(o.roofs, tone + 1)
  box(pc, fx, s.wallTop + 2, fx + 12, s.wallTop + 8, sign)
  pc.hline(fx, fx + 12, s.wallTop + 2, shade(sign, 0.2))
  pc.hline(fx, fx + 12, s.wallTop + 8, shade(sign, -0.3))
  crescentAt(pc, fx + 6, s.wallTop + 5)
  // A crescent over the door and a lantern beside it.
  crescentAt(pc, (doorLeft ? 6 : 22) + 2, s.base - 8)
  lanternAt(pc, doorLeft ? 11 : 20, s.base - 1, 2)
  if (!o.roof) return { x0: 3, x1: 28, top: s.wallTop }
  // The oven's chimney, brick, at the back of the roof.
  for (let y = s.stackTop; y <= s.wallTop - 5; y++) {
    pc.hline(23, 26, y, (y - s.stackTop) % 3 === 2 ? P.brickDark : P.brick)
    pc.px(23, y, P.brickDark)
  }
  pc.hline(22, 27, s.stackTop, P.brickDark)
  roofOver(pc, 1, 30, s.wallTop - 1, 9, roofPaintOf(o.roofs, tone), lim)
  for (let y = s.stackTop; y <= s.wallTop - 8; y++) {
    pc.hline(23, 26, y, (y - s.stackTop) % 3 === 2 ? P.brickDark : P.brick)
    pc.px(23, y, P.brickDark)
  }
  pc.hline(22, 27, s.stackTop, P.brickDark)
  // The awning over the window, striped in the plot's colour and cream.
  for (let x = wx - 1; x <= wx + 14; x++) {
    const c = ((x >> 1) & 1) ? o.accent : TRIM
    pc.px(x, s.base - 16, c)
    pc.px(x, s.base - 15, shade(c, -0.22))
  }
  pc.hline(wx - 1, wx + 14, s.base - 17, P.barnTimberDark)
  return null
}

// ---------- souk: an arcaded stall thrown open, cloth in the loft, lanterns lined up outside ----------

function souk(pc, o) {
  const r = specRand('souk', o.variant)
  const tone = Math.floor(r() * 3)
  const material = r() < 0.6 ? 'screen' : materialOf(r, o.wall)
  const base = 46
  const eave = o.low ? base - 20 : base - 24
  const lim = ceiling(o.low)
  wallOf(pc, 3, eave, 28, base, material, o.rand)
  pc.hline(3, 28, base, P.fieldstoneDark)
  const trim = TRIM
  // The big doors, trimmed in cream with a cross brace on each leaf.
  const dy = base - 15
  box(pc, 9, dy, 22, base - 1, P.barnTimberDark)
  for (const [x0, x1] of [[9, 15], [16, 22]]) {
    pc.hline(x0, x1, dy, trim)
    pc.hline(x0, x1, base - 1, trim)
    pc.vline(x0, dy, base - 1, trim)
    pc.vline(x1, dy, base - 1, trim)
    pc.line(x0, dy, x1, base - 1, trim)
    pc.line(x1, dy, x0, base - 1, trim)
  }
  pc.vline(15, dy + 1, base - 2, o.lit ? P.windowLit : P.interior)
  pc.vline(16, dy + 1, base - 2, o.lit ? P.windowLitCore : P.interior)
  // The loft above, cloth spilling out of it.
  const ly = eave + 1
  box(pc, 13, ly, 18, ly + 5, P.interior)
  pc.hline(13, 18, ly + 5, o.accent)
  pc.hline(12, 19, ly + 6, shade(o.accent, -0.3))
  for (const x of [13, 15, 18]) pc.px(x, ly + 4, shade(o.accent, 0.3))
  for (const x of [12, 19]) pc.vline(x, ly - 1, ly + 5, trim)
  pc.hline(12, 19, ly - 1, trim)
  paneOf(pc, 4, base - 13, 4, 5, o.lit)
  paneOf(pc, 24, base - 13, 4, 5, o.lit)
  // Outside: a palm by one door, a row of lanterns along the foot of the other.
  palmAt(pc, 6, base, 11)
  lanternRow(pc, 20, base, 2)
  if (!o.roof) return { x0: 2, x1: 29, top: eave }
  const top = roofOver(pc, 1, 30, eave - 1, o.low ? 10 : 13, roofPaintOf(o.roofs, tone), lim)
  finial(pc, 16, top, lim)
  const hood = Math.max(lim + 1, eave - 3)
  box(pc, 13, hood, 18, hood + 1, trim)
  pc.vline(15, hood + 2, hood + 3, P.farmIron)
  // A garland of lights and crescents along the ridge, where there is room for one.
  if (top - 2 >= lim) {
    for (let x = 6; x <= 26; x += 2) pc.px(x, top - 1 + (x % 4 === 0 ? 1 : 0), [P.eidPaint[3], P.eidBrassLight, P.eidPaint[0]][(x >> 1) % 3])
  }
  return null
}

// ---------- feast: the long table set outdoors under a string of bunting ----------

function feast(pc, o) {
  const base = 46
  const top = base - 13
  // The two posts the bunting hangs from.
  for (const x of [1, 30]) {
    pc.vline(x, base - 28, base, P.barnTimber)
    pc.px(x, base - 28, P.barnTimberLight)
  }
  // Benches, front and back, on trestles.
  pc.rect(3, base - 5, 26, 2, P.barnTimberLight)
  pc.hline(3, 28, base - 3, P.barnTimberDark)
  for (const x of [5, 15, 25]) pc.vline(x, base - 3, base, P.barnTimberDark)
  // The table, under a linen cloth hanging to a scalloped hem.
  pc.rect(2, top, 28, 2, P.linen)
  pc.rect(2, top + 2, 28, 4, P.linenShade)
  for (let x = 2; x < 30; x += 2) pc.px(x, top + 6, P.linenShade)
  pc.hline(2, 29, top + 2, P.linen)
  for (const x of [4, 14, 24]) pc.vline(x, top + 6, top + 12, P.barnTimberDark)
  if (!o.roof) return null
  // The dishes: sweets at the ends, a tray of dates in the middle left, and the brass pitcher at the centre.
  sweetsAt(pc, 3, top - 1)
  sweetsAt(pc, 24, top - 1)
  pc.ellipse(10.5, top - 2, 3.5, 2.2, P.eidBrassDark)
  pc.ellipse(10, top - 3, 2.5, 1.4, P.dateBrown)
  pc.px(8, top - 2, P.honey)
  pc.px(13, top - 3, P.honey)
  // The pitcher: a brass ewer on a tray, a spout to the right, mint in its mouth.
  pc.line(15, top - 1, 17, top - 3, P.barnTimberDark)
  pc.rect(16, top - 4, 6, 4, P.eidBrass)
  pc.hline(16, 21, top - 4, P.eidBrassLight)
  pc.hline(16, 21, top - 1, P.eidBrassDark)
  pc.px(16, top - 5, P.eidBrassDark)
  lanternAt(pc, 20, top - 3, 1)
  pc.px(22, top - 3, P.pistachio)
  pc.px(23, top - 2, P.honey)
  pc.px(19, top - 6, P.palmGreen)
  pc.px(18, top - 5, P.palmGreenDark)
  pc.px(22, top - 5, P.palmGreen)
  // Little lamps, lit when somebody is in.
  for (const x of [7, 22]) {
    pc.vline(x, top - 4, top - 1, TRIM)
    pc.px(x, top - 5, o.lit ? P.flameTip : P.barnTimberDark)
  }
  // The bunting sagging between the posts: triangles of the festival colours.
  const cols = [P.eidPaint[0], P.eidPaint[1], P.eidPaint[2], P.eidPaint[3]]
  for (let x = 2; x <= 29; x++) {
    const y = base - 28 + Math.round(Math.sin(((x - 1) / 29) * Math.PI) * 4)
    pc.px(x, y, P.barnTimberDark)
    if (x % 4 < 3) {
      const c = cols[(x >> 2) % cols.length]
      pc.px(x, y + 1, c)
      if (x % 4 === 1) pc.px(x, y + 2, shade(c, -0.2))
    }
  }
  return null
}

// ---------- drawing one ----------

const KINDS = { homestead, cabin, bakery, souk, feast }
/** The table is set on the ground: it needs no staging. */
const NO_STAGING = new Set(['feast'])

/**
 * @param {{ kind: string, stage: number, accent: string, variant: number, lit: boolean, frame?: number, wall?: number, roofs?: number, low?: boolean, wear?: number }} o
 */
export function drawEidBuilding(o) {
  const kind = KINDS[o.kind] ? o.kind : 'cabin'
  const variant = o.variant || 0
  const pc = new PixelCanvas(BUILDING_W, HEIGHT)
  const seed = variant * 6151 + 61
  if (o.stage <= 1) {
    site(pc, mulberry32(seed), o.stage, 0, variant)
    return pc.outline(P.outline)
  }
  const draw = KINDS[kind]
  const opts = {
    rand: mulberry32(seed), accent: o.accent || P.eidPaint[0], lit: Boolean(o.lit), roof: o.stage >= 3, variant,
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
  return pc.outline(P.outline)
}
