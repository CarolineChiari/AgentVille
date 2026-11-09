// Labor Day buildings: what each thread builds in a Labor Day village, drawn the way the village's
// buildings are (src/render/sprites/buildings.js): the plot's wall material and paint family on
// them, its accent on the doors and awnings, and a finished one weathered by its wear. A meeting
// hall with banners on poles, a bakery with loaves in the window, a carpenter's workshop with its
// doors open and a long picnic table under bunting. Banners and bunting are plain cloth in plain
// colours: no emblem of any union or company is drawn.
//
// Contract (see ThemePack in ../index.js and the village's src/render/sprites/buildings.js):
// - A thread's building kind (KINDS in src/sim/building.js) maps to a Labor Day kind through `fitted`.
// - Every sprite is BUILDING_W (32) wide and 48 tall, its bottom row on the ground. Down a
//   courtyard's sides (`fitted(kind, variant, false)`) nothing is drawn above row DOORSTEP_CLEAR
//   (9), outline included, at every stage: the villager at the door of the house above stands there.
// - Stages 0 and 1 are the ground being made ready; 2 is the building without its roof
//   (`roof: false`) inside a staging of poles and ladders; 3 is finished. Stage 3 is weathered by
//   `wear` exactly as the village's buildings are (see drawBuilding there).
// - `wall` indexes THEMES['labor-day'].dims.wall; `roofs` its paint families; `accent` is the
//   plot's colour, for doors and awnings. Every colour from the palette.
//
// Windows keep the village's glass colours and its warm lit yellow: the weathering pass finds
// windows by those exact colours (GLASS_COLORS in weathering.js).
//
// The framing parts (a window, a door, a pitched roof, the poles of the staging) are the farm's
// own: a Labor Day village is built by the same carpenters. What is drawn here is the day on them.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { BUILDING_W, DOORSTEP_CLEAR, drawGradeTrim } from '../../sprites/buildings.js'
import { lookFor, weather } from '../../sprites/weathering.js'
import { mulberry32, pick, rngFor } from '../../../sim/rng.js'
import { THEMES } from '../../../sim/themes.js'
import { KEPT } from '../../../sim/wear.js'
import { box, doorOf, paneOf, roofOver, staging } from '../farm/buildings.js'

/** A thread's building, by its kind, in a Labor Day village. */
export const LABOR_KINDS = {
  house: 'hall', cottage: 'workshop', shop: 'bakery', barn: 'workshop', windmill: 'bakery',
  workshop: 'workshop', well: 'picnic', farm: 'hall', tower: 'hall', greenhouse: 'bakery', stall: 'picnic',
}
const MATERIALS = THEMES['labor-day'].dims.wall
/**
 * The paint a plot's buildings share, by its `roofs`: three related colours each, as indices into
 * the palette's laborPaint (navy, brick red, forest green, mustard, cream, charcoal, teal, rust).
 * One family per sub-theme, which is what tells one street from the next.
 */
const PAINT_FAMILIES = [[0, 1, 4], [2, 3, 4], [1, 5, 4], [6, 7, 4]]
/** The cream every trim, sill and window frame is painted. */
const TRIM = P.laborPaint[4]
const HEIGHT = 48
/** The highest row anything may be drawn on, leaving the outline its row above. */
const ceiling = (low) => (low ? DOORSTEP_CLEAR + 1 : 1)

export function fitted(kind, variant, roomy) {
  return { kind: LABOR_KINDS[kind] || 'workshop', low: !roomy }
}

export const heightOf = () => HEIGHT

/** A picnic table is low; the rest stand as wide as their plot. */
export function shadowOf(kind) {
  return kind === 'picnic' ? 34 : kind === 'workshop' ? 32 : 34
}

/** Nothing here moves: the smoke does that. */
export const buildingFrames = () => 1

/** Where smoke leaves a finished building: the hall's stack, the bakery's oven, the workshop's stovepipe. */
export function chimneyOf(kind, variant = 0, wall = 0, roofs = 0, low = false) {
  if (kind === 'hall') return { x: 25, y: hallSpec(low).stackTop }
  if (kind === 'workshop') return { x: 24, y: workshopSpec(low).stackTop }
  if (kind === 'bakery') return { x: 24, y: bakerySpec(low).stackTop }
  return null
}

// ---------- shared parts ----------

const specRand = (kind, variant) => rngFor(`labor:${kind}:${variant}`)
/** A roof's or an awning's paint: the first two of the family; the cream is for trim. */
const roofPaintOf = (roofs, i) => {
  const f = PAINT_FAMILIES[(roofs || 0) % PAINT_FAMILIES.length]
  return P.laborPaint[f[Math.abs(Math.floor(i)) % 2]]
}
const materialOf = (r, wall) => (r() < 0.7 ? MATERIALS[(wall || 0) % MATERIALS.length] : pick(r, MATERIALS))

/** A wall of one of the theme's five materials, x0..x1 by y0..y1. */
function wallOf(pc, x0, y0, x1, y1, material, rand) {
  if (material === 'clapboard') {
    // Cream clapboard: lapped boards, each lip in shadow.
    box(pc, x0, y0, x1, y1, P.laborCream)
    for (let y = y0 + 2; y <= y1; y += 3) {
      pc.hline(x0, x1, y, P.laborCreamDark)
      if (y + 1 <= y1) pc.hline(x0, x1, y + 1, P.laborCreamLight)
    }
    for (let i = 0; i < 4; i++) pc.px(x0 + Math.floor(rand() * (x1 - x0 + 1)), y0 + Math.floor(rand() * (y1 - y0 + 1)), P.laborCreamDark)
  } else if (material === 'planks') {
    // Upright planks, a batten over every joint, the foot of them dark where it is wet.
    box(pc, x0, y0, x1, y1, P.barnTimber)
    for (let x = x0 + 1; x <= x1; x += 4) {
      pc.vline(x, y0, y1, P.barnTimberLight)
      pc.vline(x + 1, y0, y1, P.barnTimberDark)
    }
    pc.hline(x0, x1, y1, P.barnTimberDark)
    for (let i = 0; i < 4; i++) pc.px(x0 + Math.floor(rand() * (x1 - x0 + 1)), y0 + Math.floor(rand() * (y1 - y0 - 3)), P.hayDark)
  } else if (material === 'plaster') {
    // Warm plaster, trowelled: pale patches and a darker splash here and there.
    box(pc, x0, y0, x1, y1, P.laborPlaster)
    for (let i = 0; i < 12; i++) pc.px(x0 + Math.floor(rand() * (x1 - x0 + 1)), y0 + Math.floor(rand() * (y1 - y0 + 1)), i % 2 ? P.laborPlasterLight : P.laborPlasterDark)
    pc.hline(x0, x1, y1 - 1, P.laborPlasterDark)
  } else if (material === 'sheet') {
    // Corrugated sheet steel, a ridge every third column, rust at the foot.
    box(pc, x0, y0, x1, y1, P.laborSheet)
    for (let x = x0; x <= x1; x++) {
      if ((x - x0) % 3 === 0) pc.vline(x, y0, y1, P.laborSheetLight)
      else if ((x - x0) % 3 === 2) pc.vline(x, y0, y1, P.laborSheetDark)
    }
    for (let i = 0; i < 3; i++) pc.px(x0 + Math.floor(rand() * (x1 - x0 + 1)), y1 - Math.floor(rand() * 3), P.laborPaint[7])
  } else {
    // Brick in running bond.
    box(pc, x0, y0, x1, y1, P.brick)
    for (let y = y0; y <= y1; y++) {
      const row = y - y0
      if (row % 3 === 2) pc.hline(x0, x1, y, P.brickDark)
      else for (let x = x0; x <= x1; x++) if ((x - x0 + (Math.floor(row / 3) % 2) * 3) % 6 === 5) pc.px(x, y, P.brickDark)
    }
  }
}

/**
 * A banner on a pole at cx, its foot on row y, `h` rows tall: a plain cloth of colour `ci` (an
 * index into the palette's laborBanner) hanging from a crossbar, swallow-tailed, one cream stripe.
 * It flies toward `dir` (1 right, -1 left). No emblem: the colour is all.
 */
function bannerAt(pc, cx, y, h, ci, dir = 1) {
  const top = y - h
  pc.vline(cx, top, y, P.barnTimberLight)
  pc.vline(cx - dir, top + 1, y, P.barnTimberDark)
  pc.px(cx, top - 1, P.laborBrass)
  const x0 = Math.min(cx + dir, cx + dir * 4)
  const x1 = Math.max(cx + dir, cx + dir * 4)
  pc.hline(Math.min(cx, x1), Math.max(cx, x1), top + 1, P.barnTimber)
  const c = P.laborBanner[ci % 4]
  for (let x = x0; x <= x1; x++) {
    const tail = Math.abs(x - (x0 + x1) / 2) < 1 ? 5 : 7
    pc.vline(x, top + 2, top + tail, c)
    pc.px(x, top + 2, shade(c, 0.2))
    pc.px(x, top + 4, P.laborBanner[4])
  }
  pc.hline(cx - 1, cx + 1, y, P.laborChipsDark)
}

/** A loaf at (x, y), five wide with its foot on row y: a dark base, a golden crust and a score. */
function loafAt(pc, x, y) {
  pc.hline(x, x + 4, y, P.crustDark)
  pc.hline(x, x + 4, y - 1, P.crust)
  pc.hline(x + 1, x + 3, y - 2, P.crustLight)
  pc.px(x + 2, y - 1, P.crustDark)
}

/** A sheaf of wheat at (cx, y): a bound bundle with the ears fanned out above it. */
function sheafAt(pc, cx, y, ci = 1) {
  for (const dx of [-2, 0, 2]) {
    pc.line(cx, y, cx + dx, y - 5, P.hayDark)
    pc.px(cx + dx, y - 6, P.hayLight)
    pc.px(cx + dx, y - 7, P.hay)
  }
  pc.hline(cx - 1, cx + 1, y - 2, P.laborBanner[ci])
}

/** A pair of sawhorses with a plank across them, `w` wide, on row y. */
function sawhorseAt(pc, x, y, w = 9) {
  pc.rect(x, y - 5, w, 2, P.barnTimberLight)
  pc.hline(x, x + w - 1, y - 3, P.barnTimberDark)
  for (const lx of [x + 1, x + w - 3]) {
    pc.vline(lx, y - 3, y, P.barnTimber)
    pc.vline(lx + 1, y - 3, y, P.barnTimberDark)
  }
}

/** A short stack of lumber at x, y: boards laid crosswise, the ends showing. */
function lumberAt(pc, x, y, w = 8, rows = 3) {
  for (let i = 0; i < rows; i++) {
    const yy = y - 2 - i * 2
    pc.rect(x, yy, w, 2, i % 2 ? P.barnTimberLight : P.barnTimber)
    pc.hline(x, x + w - 1, yy + 1, P.barnTimberDark)
    pc.px(x + w - 1, yy, P.hayLight)
  }
}

// ---------- the ground being made ready ----------

function site(pc, rand, stage, oy, variant) {
  const Y = (y) => y + oy
  const [, shadeC, light, deep] = P.laborGround[2]
  pc.ellipse(16, Y(43), 15.5, 4.5, shadeC)
  for (let i = 0; i < 12; i++) pc.px(2 + Math.floor(rand() * 28), Y(40 + Math.floor(rand() * 7)), i % 2 ? light : deep)
  // Shavings round it, whatever the ground.
  for (let i = 0; i < 8; i++) pc.px(2 + Math.floor(rand() * 28), Y(39 + Math.floor(rand() * 8)), i % 2 ? P.laborChipsLight : P.laborChips)
  const left = variant % 2 === 0
  if (stage === 0) {
    // Cleared and marked out: stakes with a chalk line run between them, a banner pole at one end
    // and a lunch pail waiting on the ground.
    for (const dx of [-13, -6, 0, 6, 13]) {
      pc.vline(16 + dx, Y(37), Y(43), P.barnTimber)
      pc.px(16 + dx, Y(37), P.barnTimberLight)
    }
    pc.hline(3, 29, Y(38), P.laborBanner[4])
    bannerAt(pc, left ? 26 : 5, Y(44), 14, variant, left ? -1 : 1)
    pc.rect(left ? 9 : 19, Y(41), 5, 4, P.laborSteel)
    pc.hline(left ? 9 : 19, left ? 13 : 23, Y(41), P.laborBanner[4])
    pc.hline(left ? 9 : 19, left ? 13 : 23, Y(44), P.laborSteelDark)
    return
  }
  // The frame up: a sill on the ground, corner posts and a wall plate, studs between them, a
  // ladder against it and a sawhorse at its foot.
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
  sawhorseAt(pc, left ? 13 : 6, Y(45), 9)
  lumberAt(pc, left ? 24 : 2, Y(46), 6, 2)
}

// ---------- hall: brick, double doors under a plain signboard, banners on poles either side ----------

function hallSpec(low = false) {
  const base = 46
  const wallTop = low ? base - 22 : base - 28
  return { base, wallTop, stackTop: Math.max(DOORSTEP_CLEAR + 1, wallTop - 11) }
}

function hall(pc, o) {
  const s = hallSpec(o.low)
  const lim = ceiling(o.low)
  const r = specRand('hall', o.variant)
  // A hall is brick more often than not, whatever else the plot is built of.
  const material = r() < 0.6 ? 'brick' : materialOf(r, o.wall)
  const tone = Math.floor(r() * 3)
  wallOf(pc, 4, s.wallTop, 27, s.base, material, o.rand)
  pc.hline(4, 27, s.base, P.fieldstoneDark)
  // Double doors, a leaf each, under a signboard in the plot's paint with a dashed line of lettering.
  doorOf(pc, 11, s.base - 1, 5, 13, o.accent)
  doorOf(pc, 16, s.base - 1, 5, 13, o.accent)
  const sign = roofPaintOf(o.roofs, tone + 1)
  box(pc, 9, s.base - 19, 22, s.base - 15, sign)
  pc.hline(9, 22, s.base - 19, shade(sign, 0.2))
  pc.hline(9, 22, s.base - 15, shade(sign, -0.3))
  for (let x = 11; x <= 20; x += 2) if (x % 6 !== 5) pc.hline(x, x + 1, s.base - 17, TRIM)
  // Tall windows either side, lit when somebody is in.
  paneOf(pc, 5, s.base - 15, 5, 9, o.lit)
  paneOf(pc, 22, s.base - 15, 5, 9, o.lit)
  // Banners on poles at either end: plain cloth, two colours from the plot's choice.
  bannerAt(pc, 2, s.base, 17, o.variant, 1)
  bannerAt(pc, 29, s.base, 17, o.variant + 1, -1)
  if (!o.roof) return { x0: 3, x1: 28, top: s.wallTop }
  const top = roofOver(pc, 1, 30, s.wallTop - 1, 10, roofPaintOf(o.roofs, tone), lim)
  // The stack at the gable end, of brick.
  for (let y = s.stackTop; y <= s.wallTop - 6; y++) {
    pc.hline(23, 27, y, (y - s.stackTop) % 3 === 2 ? P.brickDark : P.brick)
    pc.px(23, y, P.brickDark)
  }
  pc.hline(22, 28, s.stackTop, P.brickDark)
  roofOver(pc, 9, 22, s.wallTop + 3, 2, roofPaintOf(o.roofs, tone + 1), lim)
  if (!o.low && top + 6 < s.wallTop) paneOf(pc, 14, top + 6, 4, 4, o.lit)
  return null
}

// ---------- workshop: a carpenter's, doors thrown open, tools on the wall and lumber stacked outside ----------

function workshopSpec(low = false) {
  const base = 46
  const wallTop = low ? base - 20 : base - 24
  return { base, wallTop, stackTop: Math.max(DOORSTEP_CLEAR + 1, wallTop - 9) }
}

function workshop(pc, o) {
  const s = workshopSpec(o.low)
  const lim = ceiling(o.low)
  const r = specRand('workshop', o.variant)
  const tone = Math.floor(r() * 3)
  const doorLeft = r() < 0.5
  // A workshop is planks or sheet steel more often than not.
  const material = r() < 0.6 ? pick(r, ['planks', 'sheet']) : materialOf(r, o.wall)
  wallOf(pc, 4, s.wallTop, 27, s.base, material, o.rand)
  pc.hline(4, 27, s.base, P.fieldstoneDark)
  // The big doors open on a dark shop with a bench in it and, lit, the glow of a lamp.
  const dx = doorLeft ? 6 : 14
  const dy = s.base - 14
  box(pc, dx, dy, dx + 11, s.base - 1, o.lit ? P.windowLit : P.interior)
  if (o.lit) box(pc, dx + 3, dy + 3, dx + 8, s.base - 5, P.windowLitCore)
  pc.hline(dx + 1, dx + 10, s.base - 5, P.barnTimberLight)
  for (const x of [dx + 2, dx + 9]) pc.vline(x, s.base - 4, s.base - 1, P.barnTimberDark)
  for (const [x0, x1] of [[dx - 1, dx], [dx + 11, dx + 12]]) {
    box(pc, x0, dy, x1, s.base - 1, o.accent)
    pc.vline(x0, dy, s.base - 1, shade(o.accent, 0.18))
    pc.hline(x0, x1, dy + 3, shade(o.accent, -0.3))
  }
  pc.hline(dx - 1, dx + 12, dy - 1, TRIM)
  // Tools hung on the wall beside them: a saw, a hammer and a square.
  const tx = doorLeft ? 21 : 6
  pc.line(tx, s.wallTop + 4, tx + 4, s.wallTop + 8, P.laborSteel)
  pc.line(tx, s.wallTop + 5, tx + 4, s.wallTop + 9, P.laborSteelDark)
  pc.rect(tx + 4, s.wallTop + 7, 2, 3, o.accent)
  pc.vline(tx + 2, s.wallTop + 12, s.wallTop + 16, P.barnTimberDark)
  pc.rect(tx, s.wallTop + 11, 5, 2, P.laborSteel)
  paneOf(pc, doorLeft ? 21 : 7, s.base - 12, 5, 5, o.lit)
  // Lumber stacked beside the door and a sawhorse on the step.
  lumberAt(pc, doorLeft ? 20 : 3, s.base, 7, 3)
  if (!o.roof) return { x0: 3, x1: 28, top: s.wallTop }
  // The stovepipe: sheet steel, at the back of the roof. Drawn twice on purpose: the roof covers
  // its lower part, so the first pass is the part that shows beside the roof's slope and the second,
  // after the roof, the part standing above it. Dropping either changes the picture.
  for (let y = s.stackTop; y <= s.wallTop - 5; y++) {
    pc.hline(23, 25, y, P.laborSheet)
    pc.px(23, y, P.laborSheetLight)
    pc.px(25, y, P.laborSheetDark)
  }
  pc.hline(22, 26, s.stackTop, P.laborSheetDark)
  roofOver(pc, 1, 30, s.wallTop - 1, o.low ? 8 : 10, roofPaintOf(o.roofs, tone), lim)
  for (let y = s.stackTop; y <= s.wallTop - 8; y++) {
    pc.hline(23, 25, y, P.laborSheet)
    pc.px(23, y, P.laborSheetLight)
    pc.px(25, y, P.laborSheetDark)
  }
  pc.hline(22, 26, s.stackTop, P.laborSheetDark)
  return null
}

// ---------- bakery: loaves in the window, a striped awning, a wheat sheaf for a sign ----------

function bakerySpec(low = false) {
  const base = 46
  const wallTop = low ? base - 22 : base - 26
  return { base, wallTop, stackTop: Math.max(DOORSTEP_CLEAR + 1, wallTop - 10) }
}

function bakery(pc, o) {
  const s = bakerySpec(o.low)
  const lim = ceiling(o.low)
  const r = specRand('bakery', o.variant)
  const material = r() < 0.6 ? pick(r, ['plaster', 'brick']) : materialOf(r, o.wall)
  const tone = Math.floor(r() * 3)
  const doorLeft = r() < 0.5
  wallOf(pc, 4, s.wallTop, 27, s.base, material, o.rand)
  pc.hline(4, 27, s.base, P.fieldstoneDark)
  const wx = doorLeft ? 13 : 4
  paneOf(pc, wx, s.base - 14, 14, 9, o.lit)
  // Loaves on the shelf across the shop window, the crusts showing above the sill.
  pc.hline(wx + 1, wx + 12, s.base - 9, P.barnTimberDark)
  for (const i of [0, 1, 2]) loafAt(pc, wx + 1 + i * 4, s.base - 10)
  doorOf(pc, doorLeft ? 6 : 22, s.base - 1, 5, 12, o.accent)
  // The sign across the front, on the plot's paint, with a sheaf of wheat on it.
  const fx = doorLeft ? 4 : 15
  const sign = roofPaintOf(o.roofs, tone + 1)
  box(pc, fx, s.wallTop + 2, fx + 12, s.wallTop + 8, sign)
  pc.hline(fx, fx + 12, s.wallTop + 2, shade(sign, 0.2))
  pc.hline(fx, fx + 12, s.wallTop + 8, shade(sign, -0.3))
  for (const dx of [-3, 0, 3]) {
    pc.line(fx + 6, s.wallTop + 7, fx + 6 + dx, s.wallTop + 4, P.hayLight)
    pc.px(fx + 6 + dx, s.wallTop + 3, P.hay)
  }
  pc.hline(fx + 5, fx + 7, s.wallTop + 6, TRIM)
  // A small banner at the door's side.
  bannerAt(pc, doorLeft ? 11 : 20, s.base - 1, 11, o.variant + 2, doorLeft ? 1 : -1)
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

// ---------- picnic: the long gingham table set outdoors under a string of plain bunting ----------

function picnic(pc, o) {
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
  // The table, under a gingham cloth hanging to a scalloped hem.
  pc.rect(2, top, 28, 2, P.laborGingham)
  pc.rect(2, top + 2, 28, 4, P.laborGinghamDark)
  for (let x = 2; x < 30; x += 4) pc.rect(x, top, 2, 6, P.laborBanner[4])
  for (let x = 2; x < 30; x += 2) pc.px(x, top + 6, P.laborGinghamDark)
  for (const x of [4, 14, 24]) pc.vline(x, top + 6, top + 12, P.barnTimberDark)
  if (!o.roof) return null
  // The spread: loaves at the ends, a pail of lemonade, a bowl of salad and a pie.
  loafAt(pc, 3, top - 1)
  loafAt(pc, 24, top - 1)
  pc.rect(10, top - 4, 5, 4, P.laborSteel)
  pc.hline(10, 14, top - 4, P.laborBanner[4])
  pc.hline(10, 14, top - 1, P.laborSteelDark)
  pc.px(9, top - 3, P.farmIron)
  pc.ellipse(18.5, top - 1.5, 3, 1.8, P.laborBanner[4])
  pc.ellipse(18.5, top - 2.2, 2.2, 1.2, P.vegLeafDark)
  pc.px(17, top - 3, P.apple)
  pc.px(20, top - 3, P.laborBanner[3])
  // Candles in jars, lit when somebody is in.
  for (const x of [7, 22]) {
    pc.vline(x, top - 4, top - 1, TRIM)
    pc.px(x, top - 5, o.lit ? P.flameTip : P.barnTimberDark)
  }
  // The bunting sagging between the posts: triangles in plain colours.
  for (let x = 2; x <= 29; x++) {
    const y = base - 28 + Math.round(Math.sin(((x - 1) / 29) * Math.PI) * 4)
    pc.px(x, y, P.barnTimberDark)
    if (x % 4 < 3) {
      const c = P.laborBanner[(x >> 2) % 4]
      pc.px(x, y + 1, c)
      if (x % 4 === 1) pc.px(x, y + 2, shade(c, -0.2))
    }
  }
  return null
}

// ---------- drawing one ----------

const KINDS = { hall, workshop, bakery, picnic }
/** The table is set on the ground: it needs no staging. */
const NO_STAGING = new Set(['picnic'])

/**
 * @param {{ kind: string, stage: number, accent: string, variant: number, lit: boolean, frame?: number, wall?: number, roofs?: number, low?: boolean, wear?: number }} o
 */
export function drawLaborBuilding(o) {
  const kind = KINDS[o.kind] ? o.kind : 'workshop'
  const variant = o.variant || 0
  const pc = new PixelCanvas(BUILDING_W, HEIGHT)
  const seed = variant * 6151 + 61
  if (o.stage <= 1) {
    site(pc, mulberry32(seed), o.stage, 0, variant)
    return pc.outline(P.outline)
  }
  const draw = KINDS[kind]
  const opts = {
    rand: mulberry32(seed), accent: o.accent || P.laborPaint[0], lit: Boolean(o.lit), roof: o.stage >= 3, variant,
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
