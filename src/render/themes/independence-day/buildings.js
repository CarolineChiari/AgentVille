// Independence Day buildings: what each thread builds in an Independence Day village, drawn the way the village's
// buildings are (src/render/sprites/buildings.js): the plot's wall material and paint family on
// them, its accent on the doors and awnings, and a finished one weathered by its wear.
//
// Contract (see ThemePack in ../index.js and the village's src/render/sprites/buildings.js):
// - A thread's building kind (KINDS in src/sim/building.js) maps to a parade kind through `fitted`.
// - Every sprite is BUILDING_W (32) wide and 48 tall, its bottom row on the ground. Down a
//   courtyard's sides (`fitted(kind, variant, false)`) nothing is drawn above row DOORSTEP_CLEAR
//   (9), outline included, at every stage: the villager at the door of the house above stands there.
// - Stages 0 and 1 are the ground being made ready; 2 is the building without its roof
//   (`roof: false`) inside a staging of poles and ladders; 3 is finished. Stage 3 is weathered by
//   `wear` exactly as the village's buildings are (see drawBuilding there).
// - `wall` indexes THEMES['independence-day'].dims.wall; `roofs` its paint families; `accent` is the
//   plot's colour, for doors and awnings. Every colour from the palette.
//
// Windows keep the village's glass colours and its warm lit yellow: the weathering pass finds
// windows by those exact colours (GLASS_COLORS in weathering.js).
//
// The framing parts (a window, a door, a pitched roof, the poles of the staging) are the farm's
// own: an Independence Day village is built by the same carpenters. What is drawn here is the Fourth of July on them.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { BUILDING_W, DOORSTEP_CLEAR, drawGradeTrim } from '../../sprites/buildings.js'
import { lookFor, weather } from '../../sprites/weathering.js'
import { mulberry32, pick, rngFor } from '../../../sim/rng.js'
import { THEMES } from '../../../sim/themes.js'
import { KEPT } from '../../../sim/wear.js'
import { baleAt, box, doorOf, paneOf, roofOver, staging } from '../farm/buildings.js'

/** A thread's building, by its kind, in an Independence Day village. */
export const PARADE_KINDS = {
  house: 'homestead', cottage: 'cabin', shop: 'bakery', barn: 'partybarn', windmill: 'partybarn',
  workshop: 'cabin', well: 'feast', farm: 'partybarn', tower: 'homestead', greenhouse: 'bakery', stall: 'feast',
}
const MATERIALS = THEMES['independence-day'].dims.wall
/**
 * The paint a plot's buildings share, by its `roofs`: three related colours each, as indices into
 * the palette's paradePaint (cranberry, burnt orange, mustard, sage, cream, chestnut, plum, slate
 * teal). One family per sub-theme, which is what tells one street from the next.
 */
const PAINT_FAMILIES = [[0, 5, 4], [1, 5, 4], [3, 2, 4], [2, 6, 4]]
/** The cream every trim, sill and window frame is painted (the farm's white, seen by candlelight). */
const TRIM = P.paradePaint[4]
const HEIGHT = 48
/** The highest row anything may be drawn on, leaving the outline its row above. */
const ceiling = (low) => (low ? DOORSTEP_CLEAR + 1 : 1)

export function fitted(kind, variant, roomy) {
  return { kind: PARADE_KINDS[kind] || 'cabin', low: !roomy }
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

const specRand = (kind, variant) => rngFor(`july:${kind}:${variant}`)
const paintOf = (roofs, i) => {
  const f = PAINT_FAMILIES[(roofs || 0) % PAINT_FAMILIES.length]
  return P.paradePaint[f[Math.abs(Math.floor(i)) % f.length]]
}
/** A roof's or an awning's paint: the first two of the family; the cream is for trim. */
const roofPaintOf = (roofs, i) => {
  const f = PAINT_FAMILIES[(roofs || 0) % PAINT_FAMILIES.length]
  return P.paradePaint[f[Math.abs(Math.floor(i)) % 2]]
}
const materialOf = (r, wall) => (r() < 0.7 ? MATERIALS[(wall || 0) % MATERIALS.length] : pick(r, MATERIALS))

/** A wall of one of the theme's five materials, x0..x1 by y0..y1. */
function wallOf(pc, x0, y0, x1, y1, material, rand) {
  if (material === 'clapboard') {
    // White clapboard: lapped boards, each lip in shadow.
    box(pc, x0, y0, x1, y1, P.porchWhite)
    for (let y = y0 + 2; y <= y1; y += 3) {
      pc.hline(x0, x1, y, P.porchWhiteDark)
      if (y + 1 <= y1) pc.hline(x0, x1, y + 1, P.porchWhiteLight)
    }
    for (let i = 0; i < 4; i++) pc.px(x0 + Math.floor(rand() * (x1 - x0 + 1)), y0 + Math.floor(rand() * (y1 - y0 + 1)), P.porchWhiteDark)
  } else if (material === 'redbarn') {
    // Board and batten painted barn red, a batten over every joint, dark where it is wet at the foot.
    box(pc, x0, y0, x1, y1, P.barnRed)
    for (let x = x0 + 1; x <= x1; x += 4) {
      pc.vline(x, y0, y1, P.barnRedLight)
      pc.vline(x + 1, y0, y1, P.barnRedDark)
    }
    pc.hline(x0, x1, y1, P.barnRedDark)
    for (let i = 0; i < 4; i++) pc.px(x0 + Math.floor(rand() * (x1 - x0 + 1)), y1 - 1 - Math.floor(rand() * 3), P.barnRedDark)
  } else if (material === 'logs') {
    // Round logs laid one on another, each lit on top, shadowed under, with a pale end showing at
    // the corners where they cross.
    box(pc, x0, y0, x1, y1, P.barnTimber)
    for (let y = y0; y <= y1; y += 4) {
      pc.hline(x0, x1, y, P.barnTimberLight)
      if (y + 3 <= y1) pc.hline(x0, x1, y + 3, P.barnTimberDark)
      for (const x of [x0, x1 - 1]) pc.rect(x, y, 2, Math.min(3, y1 - y + 1), P.oakBrown)
      pc.px(x0, y + 1, P.hayDark)
      pc.px(x1 - 1, y + 1, P.hayDark)
    }
    for (let i = 0; i < 4; i++) pc.px(x0 + 2 + Math.floor(rand() * (x1 - x0 - 3)), y0 + Math.floor(rand() * (y1 - y0 + 1)), P.barnTimberDark)
  } else if (material === 'fieldstone') {
    // Fieldstone in rough courses, the joints wide and the top of every stone catching the light.
    box(pc, x0, y0, x1, y1, P.fieldstone)
    for (let y = y0; y <= y1; y++) {
      const row = y - y0
      const off = (Math.floor(row / 4) * 5) % 7
      for (let x = x0; x <= x1; x++) {
        const s = (x - x0 + off) % 7
        if (row % 4 === 3 || s === 6) pc.px(x, y, P.fieldstoneDark)
        else if (row % 4 === 0 && s > 0 && s < 5) pc.px(x, y, P.fieldstoneLight)
      }
    }
    for (let i = 0; i < 3; i++) pc.px(x0 + 1 + Math.floor(rand() * (x1 - x0 - 1)), y1 - Math.floor(rand() * 3), P.flagRed)
  } else {
    // Brick in running bond, with a gold star or two in the mortar.
    box(pc, x0, y0, x1, y1, P.brick)
    for (let y = y0; y <= y1; y++) {
      const row = y - y0
      if (row % 3 === 2) pc.hline(x0, x1, y, P.brickDark)
      else for (let x = x0; x <= x1; x++) if ((x - x0 + (Math.floor(row / 3) % 2) * 3) % 6 === 5) pc.px(x, y, P.brickDark)
    }
    for (let i = 0; i < 3; i++) pc.px(x0 + Math.floor(rand() * (x1 - x0 + 1)), y0 + Math.floor(rand() * (y1 - y0 + 1)), P.starGold)
  }
}

/** A small flag planted at (cx, y), its foot on row y, `r` rows to half the height of its pole. Striped in `c`. */
function flagAt(pc, cx, y, r = 3, c = P.flagRed) {
  const top = y - 2 * r - 2
  pc.vline(cx, top, y, P.porchWhiteDark)
  pc.px(cx, top - 1, P.starGold)
  pc.hline(cx + 1, cx + 3, top, c)
  pc.hline(cx + 1, cx + 3, top + 1, P.flagWhite)
  if (r >= 2) pc.hline(cx + 1, cx + 3, top + 2, c)
  pc.px(cx + 1, top + 1, P.flagBlue)
  pc.hline(cx - 1, cx + 1, y, P.lawnSoilDark)
}

/**
 * A flagpole at (cx, y): a tall white pole with a gold ball, a full flag flying from it (blue
 * canton, stripes below) and a rope tied off at the foot. `h` rows tall.
 */
function flagpoleAt(pc, cx, y, h = 12) {
  pc.vline(cx, y - h, y, P.porchWhite)
  pc.vline(cx + 1, y - h + 1, y, P.porchWhiteDark)
  pc.px(cx, y - h - 1, P.starGold)
  const fw = Math.min(8, Math.max(5, h - 4))
  const fy = y - h + 1
  for (let i = 0; i < 6; i++) pc.hline(cx + 2, cx + 1 + fw, fy + i, i % 2 ? P.flagWhite : P.flagRed)
  pc.rect(cx + 2, fy, 3, 3, P.flagBlue)
  pc.px(cx + 3, fy + 1, P.flagWhite)
  pc.hline(cx - 1, cx + 2, y, P.lawnSoilDark)
}

/** A wreath of red, white and blue ribbon and gold stars at (cx, cy), hung on a door. */
function wreathAt(pc, cx, cy) {
  const ring = [[-2, 0], [-2, -1], [-1, -2], [0, -2], [1, -2], [2, -1], [2, 0], [2, 1], [1, 2], [0, 2], [-1, 2], [-2, 1]]
  const cols = [P.flagRed, P.flagWhite, P.flagBlue, P.starGold]
  ring.forEach(([dx, dy], i) => pc.px(cx + dx, cy + dy, cols[i % cols.length]))
  pc.px(cx, cy + 2, P.flagRed)
  pc.px(cx - 1, cy + 3, P.flagBlue)
  pc.px(cx + 1, cy + 3, P.flagBlue)
}

/** A pie at (x, y), five wide with its foot on row y: a crimped rim and a golden dome. */
function pieAt(pc, x, y) {
  pc.hline(x, x + 4, y, P.crustDark)
  pc.hline(x, x + 4, y - 1, P.crust)
  pc.hline(x + 1, x + 3, y - 2, P.crustLight)
  pc.px(x + 2, y - 3, P.crustLight)
  pc.px(x + 1, y - 1, P.crustLight)
  pc.px(x + 3, y - 1, P.pieFilling)
}

/** A row of little flags along the ground at x0.., red, blue and gold in turn. */
function flagRow(pc, x0, y, n) {
  const kinds = [[P.flagRed, 2], [P.flagBlue, 1], [P.starGold, 1]]
  let x = x0
  for (let i = 0; i < n; i++) {
    const [c, r] = kinds[i % kinds.length]
    flagAt(pc, x + 1, y, r, c)
    x += 2 * r + 3
  }
}

// ---------- the ground being made ready ----------

function site(pc, rand, stage, oy, variant) {
  const Y = (y) => y + oy
  const [, shadeC, light, deep] = P.paradeGround[2]
  pc.ellipse(16, Y(43), 15.5, 4.5, shadeC)
  for (let i = 0; i < 12; i++) pc.px(2 + Math.floor(rand() * 28), Y(40 + Math.floor(rand() * 7)), i % 2 ? light : deep)
  // Confetti round it, whatever the ground.
  for (let i = 0; i < 8; i++) pc.px(2 + Math.floor(rand() * 28), Y(39 + Math.floor(rand() * 8)), [P.flagRed, P.flagBlue, P.flagWhite][i % 3])
  const left = variant % 2 === 0
  if (stage === 0) {
    // Cleared and marked out: stakes with a twine run between them, a flagpole at one end and a
    // couple of flags waiting to go up.
    for (const dx of [-13, -6, 0, 6, 13]) {
      pc.vline(16 + dx, Y(37), Y(43), P.barnTimber)
      pc.px(16 + dx, Y(37), P.barnTimberLight)
    }
    pc.hline(3, 29, Y(38), P.hayLight)
    flagpoleAt(pc, left ? 26 : 5, Y(44), 12)
    flagAt(pc, left ? 8 : 22, Y(44), 3)
    flagAt(pc, left ? 14 : 16, Y(45), 2, P.flagBlue)
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
  flagAt(pc, left ? 26 : 5, Y(45), 2)
}

// ---------- homestead: the family house, a pie on the sill and a wreath on the door ----------

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
  wreathAt(pc, dx + 3, s.base - 7)
  // Windows up and down; a pie cooling on the sill of the one beside the door.
  const wx = doorLeft ? 18 : 6
  paneOf(pc, wx, s.base - 11, 7, 7, o.lit)
  pieAt(pc, wx + 1, s.base - 5)
  paneOf(pc, 6, s.wallTop + 3, 6, 7, o.lit)
  paneOf(pc, 20, s.wallTop + 3, 6, 7, o.lit)
  // Pumpkins on the step between them, and a corn shock at the far end of the wall.
  flagAt(pc, 14, s.base - 1, 3)
  flagAt(pc, doorLeft ? 18 : 12, s.base - 1, 1, P.flagBlue)
  flagpoleAt(pc, doorLeft ? 29 : 2, s.base, 12)
  if (!o.roof) return { x0: 3, x1: 28, top: s.wallTop }
  const color = roofPaintOf(o.roofs, tone)
  const top = roofOver(pc, 1, 30, s.wallTop - 1, 10, color, lim)
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
  const material = r() < 0.6 ? 'logs' : materialOf(r, o.wall)
  wallOf(pc, 5, s.wallTop, 26, s.base, material, o.rand)
  pc.hline(5, 26, s.base, P.fieldstoneDark)
  const dx = doorLeft ? 8 : 18
  doorOf(pc, dx, s.base - 1, 5, 10, o.accent)
  pc.hline(dx, dx + 4, s.base - 5, shade(o.accent, -0.3))
  paneOf(pc, doorLeft ? 16 : 8, s.wallTop + 5, 7, 6, o.lit)
  // Firewood stacked at the other end, and a flag on the step.
  const wx = doorLeft ? 23 : 1
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 4; i++) {
      pc.rect(wx + i * 2 - (row % 2), s.base - 2 - row * 2, 2, 2, (i + row) % 2 ? P.barnTimberLight : P.barnTimber)
      pc.px(wx + i * 2 - (row % 2), s.base - 2 - row * 2, P.hayDark)
    }
  }
  flagAt(pc, doorLeft ? 14 : 15, s.base - 1, 2)
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

// ---------- bakery: pies in the window, a striped awning, the oven's chimney ----------

function bakerySpec(low = false) {
  const base = 46
  const wallTop = low ? base - 22 : base - 26
  return { base, wallTop, stackTop: Math.max(DOORSTEP_CLEAR + 1, wallTop - 10) }
}

function bakery(pc, o) {
  const s = bakerySpec(o.low)
  const lim = ceiling(o.low)
  const r = specRand('bakery', o.variant)
  const material = r() < 0.6 ? pick(r, ['brick', 'clapboard']) : materialOf(r, o.wall)
  const tone = Math.floor(r() * 3)
  const doorLeft = r() < 0.5
  wallOf(pc, 4, s.wallTop, 27, s.base, material, o.rand)
  pc.hline(4, 27, s.base, P.fieldstoneDark)
  const wx = doorLeft ? 13 : 4
  paneOf(pc, wx, s.base - 14, 14, 9, o.lit)
  // Pies on the shelf across the shop window, the rims showing above the sill.
  pc.hline(wx + 1, wx + 12, s.base - 9, P.barnTimberDark)
  for (const i of [0, 1, 2]) pieAt(pc, wx + 1 + i * 4, s.base - 10)
  doorOf(pc, doorLeft ? 6 : 22, s.base - 1, 5, 12, o.accent)
  // The sign across the front: a pie with a lattice top on the plot's paint.
  const fx = doorLeft ? 4 : 15
  const sign = roofPaintOf(o.roofs, tone + 1)
  box(pc, fx, s.wallTop + 2, fx + 12, s.wallTop + 8, sign)
  pc.hline(fx, fx + 12, s.wallTop + 2, shade(sign, 0.2))
  pc.hline(fx, fx + 12, s.wallTop + 8, shade(sign, -0.3))
  pc.ellipse(fx + 6.5, s.wallTop + 5.5, 3, 2, P.crust)
  pc.line(fx + 4, s.wallTop + 4, fx + 8, s.wallTop + 7, P.crustDark)
  pc.line(fx + 8, s.wallTop + 4, fx + 4, s.wallTop + 7, P.crustDark)
  // A wreath on the door and a flag or two beside it.
  wreathAt(pc, (doorLeft ? 6 : 22) + 2, s.base - 8)
  flagAt(pc, doorLeft ? 11 : 20, s.base - 1, 2)
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

// ---------- party barn: doors thrown open, hay in the loft, flags along the front ----------

function partybarn(pc, o) {
  const r = specRand('partybarn', o.variant)
  const tone = Math.floor(r() * 3)
  const material = r() < 0.6 ? 'redbarn' : materialOf(r, o.wall)
  const base = 46
  const eave = o.low ? base - 20 : base - 24
  const lim = ceiling(o.low)
  wallOf(pc, 3, eave, 28, base, material, o.rand)
  pc.hline(3, 28, base, P.fieldstoneDark)
  const trim = TRIM
  // The big doors, trimmed in cream with a cross brace on each leaf.
  const dy = base - 15
  box(pc, 9, dy, 22, base - 1, P.barnRedDark)
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
  // The loft door above, hay spilling out of it.
  const ly = eave + 1
  box(pc, 13, ly, 18, ly + 5, P.interior)
  pc.hline(13, 18, ly + 5, P.hay)
  pc.hline(12, 19, ly + 6, P.hayDark)
  for (const x of [13, 15, 18]) pc.px(x, ly + 4, P.hayLight)
  for (const x of [12, 19]) pc.vline(x, ly - 1, ly + 5, trim)
  pc.hline(12, 19, ly - 1, trim)
  paneOf(pc, 4, base - 13, 4, 5, o.lit)
  paneOf(pc, 24, base - 13, 4, 5, o.lit)
  // Outside: a flagpole by one door, a row of little flags along the foot of the other.
  flagpoleAt(pc, 6, base, 11)
  flagRow(pc, 23, base, 2)
  if (!o.roof) return { x0: 2, x1: 29, top: eave }
  const top = roofOver(pc, 1, 30, eave - 1, o.low ? 10 : 13, roofPaintOf(o.roofs, tone), lim)
  const hood = Math.max(lim + 1, eave - 3)
  box(pc, 13, hood, 18, hood + 1, trim)
  pc.vline(15, hood + 2, hood + 3, P.farmIron)
  // A string of pennants along the ridge, where there is room for one.
  if (top - 2 >= lim) {
    for (let x = 6; x <= 26; x += 2) pc.px(x, top - 1 + (x % 4 === 0 ? 1 : 0), [P.flagRed, P.flagWhite, P.flagBlue][(x >> 1) % 3])
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
  // The dishes: pies at the ends, a roast in the middle left, and the cornucopia at the centre.
  pieAt(pc, 3, top - 1)
  pieAt(pc, 24, top - 1)
  pc.ellipse(10.5, top - 2, 3.5, 2.2, P.crustDark)
  pc.ellipse(10, top - 3, 2.5, 1.4, P.crust)
  pc.px(8, top - 2, P.crustLight)
  pc.px(13, top - 3, P.crustLight)
  // The horn of plenty: a woven basket on its side, its mouth to the right, everything spilling.
  pc.line(15, top - 1, 17, top - 3, P.barnTimberDark)
  pc.rect(16, top - 4, 6, 4, P.hay)
  pc.hline(16, 21, top - 4, P.hayLight)
  pc.hline(16, 21, top - 1, P.hayDark)
  pc.px(16, top - 5, P.hayDark)
  flagAt(pc, 20, top - 3, 1)
  pc.px(22, top - 3, P.cranberry)
  pc.px(23, top - 2, P.cranberryLight)
  pc.px(19, top - 6, P.apple)
  pc.px(18, top - 5, P.kernelPlum)
  pc.px(22, top - 5, P.kernelGold)
  // Candles, lit when somebody is in.
  for (const x of [7, 22]) {
    pc.vline(x, top - 4, top - 1, TRIM)
    pc.px(x, top - 5, o.lit ? P.flameTip : P.barnTimberDark)
  }
  // The bunting sagging between the posts: triangles of red, white and blue.
  const cols = [P.flagRed, P.flagWhite, P.flagBlue]
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

const KINDS = { homestead, cabin, bakery, partybarn, feast }
/** The table is set on the ground: it needs no staging. */
const NO_STAGING = new Set(['feast'])

/**
 * @param {{ kind: string, stage: number, accent: string, variant: number, lit: boolean, frame?: number, wall?: number, roofs?: number, low?: boolean, wear?: number }} o
 */
export function drawParadeBuilding(o) {
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
    rand: mulberry32(seed), accent: o.accent || P.paradePaint[0], lit: Boolean(o.lit), roof: o.stage >= 3, variant,
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
