// Holi buildings: what each thread builds in a village on the day of colours, drawn the way the
// village's buildings are (src/render/sprites/buildings.js): the plot's wall material and paint
// family on them, its accent on the doors and awnings, and a finished one weathered by its wear.
//
// Contract (see ThemePack in ../index.js and the village's src/render/sprites/buildings.js):
// - A thread's building kind (KINDS in src/sim/building.js) maps to a Holi kind through `fitted`.
// - Every sprite is BUILDING_W (32) wide and 48 tall, its bottom row on the ground. Down a
//   courtyard's sides (`fitted(kind, variant, false)`) nothing is drawn above row DOORSTEP_CLEAR
//   (9), outline included, at every stage: the villager at the door of the house above stands there.
// - Stages 0 and 1 are the ground being made ready; 2 is the building without its roof
//   (`roof: false`) inside a staging of poles and ladders; 3 is finished. Stage 3 is weathered by
//   `wear` exactly as the village's buildings are (see drawBuilding there).
// - `wall` indexes THEMES.holi.dims.wall; `roofs` its paint families; `accent` is the plot's
//   colour, for doors and awnings. Every colour from the palette.
//
// Windows keep the village's glass colours and its warm lit yellow: the weathering pass finds
// windows by those exact colours (GLASS_COLORS in weathering.js).
//
// The framing parts (a window, a door, a pitched roof, the poles of the staging) are the farm's
// own: a Holi village is built by the same carpenters. What is drawn here is the colour on them.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { BUILDING_W, DOORSTEP_CLEAR, drawGradeTrim } from '../../sprites/buildings.js'
import { lookFor, weather } from '../../sprites/weathering.js'
import { mulberry32, pick, rngFor } from '../../../sim/rng.js'
import { THEMES } from '../../../sim/themes.js'
import { KEPT } from '../../../sim/wear.js'
import { box, doorOf, paneOf, roofOver, staging } from '../farm/buildings.js'

/** A thread's building, by its kind, in a Holi village. */
export const HOLI_KINDS = {
  house: 'homehouse', cottage: 'lanehouse', shop: 'colourshop', barn: 'gatehall', windmill: 'gatehall',
  workshop: 'lanehouse', well: 'pyre', farm: 'gatehall', tower: 'homehouse', greenhouse: 'colourshop', stall: 'pyre',
}
const MATERIALS = THEMES.holi.dims.wall
const GULAL = P.holiGulal
/**
 * The paint a plot's buildings share, by its `roofs`: three related colours each, as indices into
 * the palette's holiPaint (magenta, green, marigold, blue, white, saffron, violet, terracotta).
 * One family per sub-theme, which is what tells one street from the next.
 */
const PAINT_FAMILIES = [[0, 6, 4], [5, 7, 4], [2, 1, 4], [3, 1, 4]]
/** The white every trim, sill and window frame is painted. */
const TRIM = P.holiPaint[4]
const HEIGHT = 48
/** The highest row anything may be drawn on, leaving the outline its row above. */
const ceiling = (low) => (low ? DOORSTEP_CLEAR + 1 : 1)

export function fitted(kind, variant, roomy) {
  return { kind: HOLI_KINDS[kind] || 'lanehouse', low: !roomy }
}

export const heightOf = () => HEIGHT

/** A bonfire's stack is narrower than a house; the rest stand as wide as their plot. */
export function shadowOf(kind) {
  return kind === 'pyre' ? 26 : 34
}

/** Nothing here moves: the smoke does that. */
export const buildingFrames = () => 1

/** Where smoke leaves a finished building: the lane house's stack and the sweet-maker's. */
export function chimneyOf(kind, variant = 0, wall = 0, roofs = 0, low = false) {
  if (kind === 'lanehouse') return { x: 24, y: laneSpec(low).stackTop }
  if (kind === 'colourshop') return { x: 24, y: shopSpec(low).stackTop }
  return null
}

// ---------- shared parts ----------

const specRand = (kind, variant) => rngFor(`holi:${kind}:${variant}`)
/** A roof's, parapet's or awning's paint: the first two of the family; the white is for trim. */
const roofPaintOf = (roofs, i) => {
  const f = PAINT_FAMILIES[(roofs || 0) % PAINT_FAMILIES.length]
  return P.holiPaint[f[Math.abs(Math.floor(i)) % 2]]
}
const materialOf = (r, wall) => (r() < 0.7 ? MATERIALS[(wall || 0) % MATERIALS.length] : pick(r, MATERIALS))

const WALLS = {
  whitewash: [P.holiWhite, P.holiWhiteDark, P.holiWhiteLight],
  pinkwash: [P.holiPink, P.holiPinkDark, P.holiPinkLight],
  yellowwash: [P.holiYellow, P.holiYellowDark, P.holiYellowLight],
  bluewash: [P.holiBlue, P.holiBlueDark, P.holiBlueLight],
  sandstone: [P.holiSandstone, P.holiSandstoneDark, P.holiSandstoneLight],
}

/** A wall of one of the theme's five materials, x0..x1 by y0..y1. */
function wallOf(pc, x0, y0, x1, y1, material, rand) {
  const [base, dark, light] = WALLS[material] || WALLS.whitewash
  box(pc, x0, y0, x1, y1, base)
  if (material === 'sandstone') {
    // Dressed blocks in courses, each course's top edge catching the light, the joints staggered.
    for (let y = y0; y <= y1; y++) {
      const row = y - y0
      const off = (Math.floor(row / 4) * 5) % 8
      for (let x = x0; x <= x1; x++) {
        const s = (x - x0 + off) % 8
        if (row % 4 === 3 || s === 7) pc.px(x, y, dark)
        else if (row % 4 === 0 && s < 6) pc.px(x, y, light)
      }
    }
    return
  }
  // Limewash: trowelled, soft patches lighter and darker, a damp band at the foot.
  for (let i = 0; i < 9; i++) pc.px(x0 + Math.floor(rand() * (x1 - x0 + 1)), y0 + Math.floor(rand() * (y1 - y0 + 1)), i % 2 ? light : dark)
  pc.hline(x0, x1, y1 - 1, dark)
  pc.vline(x1, y0, y1, dark)
  pc.vline(x0, y0, y1, light)
}

/**
 * Colour thrown at a wall: `n` blots of gulal, each with a few drops off it. Drawn before the
 * windows and doors, so those stay clear.
 */
function splashes(pc, rand, x0, y0, x1, y1, n) {
  for (let i = 0; i < n; i++) {
    const cx = x0 + 2 + Math.floor(rand() * Math.max(1, x1 - x0 - 3))
    const cy = y0 + 2 + Math.floor(rand() * Math.max(1, y1 - y0 - 6))
    const c = GULAL[Math.floor(rand() * GULAL.length)]
    const rx = 1.2 + rand() * 1.6
    pc.ellipse(cx, cy, rx, 1 + rand() * 1.2, c)
    pc.px(cx - 1, cy - 1, shade(c, 0.3))
    for (let d = 0; d < 3; d++) {
      const dx = Math.round((rand() - 0.5) * 7)
      const dy = Math.round((rand() - 0.5) * 5)
      const px = cx + dx
      const py = cy + dy
      if (px >= x0 && px <= x1 && py >= y0 && py <= y1) pc.px(px, py, c)
    }
  }
}

/** A pot of gulal at (cx, y), its foot on row y: a clay pot with the powder heaped on it. */
function potAt(pc, cx, y, c, r = 2) {
  pc.rect(cx - r, y - r - 1, 2 * r + 1, r + 1, P.matka)
  pc.vline(cx - r, y - r - 1, y, P.matkaLight)
  pc.vline(cx + r, y - r - 1, y, P.matkaDark)
  pc.hline(cx - r, cx + r, y, P.matkaDark)
  pc.hline(cx - r, cx + r, y - r - 1, P.matkaLight)
  pc.hline(cx - r + 1, cx + r - 1, y - r - 2, c)
  pc.px(cx, y - r - 3, shade(c, 0.3))
}

/** A heap of powder on a plate: a cone on a round tray at (cx, y). */
function coneAt(pc, cx, y, c, h = 3) {
  pc.hline(cx - 2, cx + 2, y, P.brassDark)
  for (let i = 0; i < h; i++) pc.hline(cx - (h - 1 - i) - (i === 0 ? 0 : 0), cx + (h - 1 - i), y - 1 - i, i === h - 1 ? shade(c, 0.3) : c)
  pc.hline(cx - h, cx + h, y - 1, shade(c, -0.15))
}

/**
 * A pichkari at (x, y), the water gun standing on its nozzle end: a bamboo barrel with a tank of
 * colour at the foot and a plunger handle on top. Five rows tall.
 */
function pichkariAt(pc, x, y, c) {
  pc.vline(x, y - 4, y, P.bamboo)
  pc.px(x, y - 4, P.bambooLight)
  pc.hline(x - 1, x + 1, y - 5, P.farmIron) // the plunger's handle
  pc.rect(x + 1, y - 2, 2, 3, c) // the tank of colour
  pc.px(x + 1, y - 2, shade(c, 0.3))
  pc.px(x, y, P.brassDark)
}

/** A string of marigold flowers hung from x0 to x1 at y, sagging a row in the middle. */
function garlandOver(pc, x0, x1, y) {
  for (let x = x0; x <= x1; x++) {
    const sag = x > x0 + 1 && x < x1 - 1 ? 1 : 0
    pc.px(x, y + sag, (x & 1) ? P.marigold : P.marigoldLight)
    if (x % 3 === 0) pc.px(x, y + sag + 1, P.marigoldDark)
  }
}

/** Paper flags strung between two poles from x0 to x1, their tops on row `top`, in the four colours. */
function flagsBetween(pc, x0, x1, top, low) {
  pc.vline(x0, top, top + (low ? 5 : 7), P.bamboo)
  pc.vline(x1, top, top + (low ? 5 : 7), P.bamboo)
  pc.px(x0, top, P.bambooLight)
  pc.px(x1, top, P.bambooLight)
  for (let x = x0 + 1; x < x1; x++) {
    const y = top + Math.round(Math.sin(((x - x0) / (x1 - x0)) * Math.PI) * 2)
    pc.px(x, y, P.bambooDark)
    if ((x - x0) % 3 === 1) {
      const c = GULAL[((x - x0) / 3 | 0) % 4]
      pc.px(x, y + 1, c)
      pc.px(x, y + 2, shade(c, -0.2))
    }
  }
}

// ---------- the ground being made ready ----------

function site(pc, rand, stage, oy, variant) {
  const Y = (y) => y + oy
  const [, shadeC, light, deep] = P.holiGround[2]
  pc.ellipse(16, Y(43), 15.5, 4.5, shadeC)
  for (let i = 0; i < 12; i++) pc.px(2 + Math.floor(rand() * 28), Y(40 + Math.floor(rand() * 7)), i % 2 ? light : deep)
  // Colour already thrown about the place, whatever the ground.
  for (let i = 0; i < 8; i++) pc.px(2 + Math.floor(rand() * 28), Y(39 + Math.floor(rand() * 8)), GULAL[i % GULAL.length])
  const left = variant % 2 === 0
  if (stage === 0) {
    // Cleared and marked out: bamboo stakes with a line of cloth strung between them, and a pot
    // of gulal and another of marigolds waiting by the end.
    for (const dx of [-13, -6, 0, 6, 13]) {
      pc.vline(16 + dx, Y(37), Y(43), P.bamboo)
      pc.px(16 + dx, Y(37), P.bambooLight)
    }
    pc.hline(3, 29, Y(38), GULAL[variant % 4])
    potAt(pc, left ? 26 : 5, Y(44), GULAL[(variant + 1) % 6], 3)
    potAt(pc, left ? 20 : 11, Y(45), P.marigold, 2)
    return
  }
  // The frame up: a sill on the ground, corner posts and a wall plate, studs between them, a
  // ladder against it and a pot or two at its foot.
  box(pc, 4, Y(41), 27, Y(43), P.bambooDark)
  pc.hline(4, 27, Y(41), P.bamboo)
  for (const x of [7, 24]) {
    box(pc, x, Y(27), x + 1, Y(41), P.bamboo)
    pc.vline(x, Y(27), Y(41), P.bambooLight)
  }
  pc.hline(6, 26, Y(26), P.bambooLight)
  pc.hline(6, 26, Y(27), P.bambooDark)
  for (let x = 11; x <= 21; x += 5) pc.vline(x, Y(28), Y(40), P.bambooDark)
  pc.line(8, Y(40), 23, Y(28), P.bamboo)
  const lx = left ? 2 : 29
  const dx = left ? 1 : -1
  pc.line(lx, Y(43), lx + dx * 5, Y(24), P.bambooLight)
  pc.line(lx + dx, Y(43), lx + dx * 6, Y(24), P.bamboo)
  for (let i = 0; i < 6; i++) {
    const t = i / 6
    pc.hline(lx + Math.round(dx * t * 5), lx + Math.round(dx * (1 + t * 5)), Y(42 - i * 3), P.bambooDark)
  }
  potAt(pc, left ? 17 : 8, Y(44), GULAL[(variant + 2) % 6], 3)
  potAt(pc, left ? 26 : 5, Y(45), P.marigold, 2)
}

// ---------- homehouse: a family home with a balcony, a flat roof and a terrace above ----------

function homeSpec(low = false) {
  const base = 46
  return { base, wallTop: low ? base - 24 : base - 30 }
}

function homehouse(pc, o) {
  const s = homeSpec(o.low)
  const lim = ceiling(o.low)
  const r = specRand('homehouse', o.variant)
  const material = materialOf(r, o.wall)
  const tone = Math.floor(r() * 3)
  const doorLeft = r() < 0.5
  wallOf(pc, 4, s.wallTop, 27, s.base, material, o.rand)
  splashes(pc, o.rand, 4, s.wallTop, 27, s.base - 3, 6)
  pc.hline(4, 27, s.base, P.holiSandstoneDark)
  const dx = doorLeft ? 7 : 19
  doorOf(pc, dx, s.base - 1, 6, 11, o.accent)
  garlandOver(pc, dx - 1, dx + 6, s.base - 13)
  // A window beside the door, and two above, over a ledge on the plot's paint.
  const wx = doorLeft ? 18 : 6
  paneOf(pc, wx, s.base - 11, 7, 7, o.lit)
  const ledge = roofPaintOf(o.roofs, tone + 1)
  paneOf(pc, 6, s.wallTop + 4, 6, 7, o.lit)
  paneOf(pc, 20, s.wallTop + 4, 6, 7, o.lit)
  pc.rect(3, s.base - 14, 26, 2, ledge)
  pc.hline(3, 28, s.base - 14, shade(ledge, 0.25))
  pc.hline(3, 28, s.base - 13, shade(ledge, -0.3))
  // Pots of marigolds on the ledge and a pot of gulal at the step.
  for (const x of [14, 16]) {
    pc.rect(x, s.base - 17, 2, 2, P.matka)
    pc.px(x, s.base - 18, P.marigold)
    pc.px(x + 1, s.base - 18, P.marigoldLight)
  }
  potAt(pc, doorLeft ? 15 : 14, s.base - 1, GULAL[(o.variant + 1) % 6], 2)
  if (!o.roof) return { x0: 3, x1: 28, top: s.wallTop }
  // The flat roof: a parapet in the plot's paint with a coping, and a terrace behind it.
  const color = roofPaintOf(o.roofs, tone)
  const top = s.wallTop - 5
  box(pc, 3, top, 28, s.wallTop - 1, color)
  pc.hline(2, 29, top, shade(color, 0.28))
  pc.hline(3, 28, top + 1, shade(color, 0.12))
  pc.hline(3, 28, s.wallTop - 1, shade(color, -0.3))
  for (let x = 6; x <= 26; x += 4) pc.vline(x, top + 2, s.wallTop - 2, shade(color, -0.2))
  // On the terrace: flags between two poles, a pot of gulal, and a pichkari leaning on the parapet.
  const flagTop = Math.max(lim + 1, top - (o.low ? 6 : 9))
  flagsBetween(pc, 5, 20, flagTop, true)
  potAt(pc, doorLeft ? 24 : 9, top - 1, GULAL[(o.variant + 3) % 6], 2)
  pichkariAt(pc, doorLeft ? 27 : 3, top - 1, GULAL[(o.variant + 4) % 6])
  return null
}

// ---------- lane house: a small home with a tiled roof, a stack and colour at the door ----------

function laneSpec(low = false) {
  const base = 46
  const wallTop = low ? base - 18 : base - 22
  return { base, wallTop, stackTop: Math.max(DOORSTEP_CLEAR + 1, wallTop - 11) }
}

function lanehouse(pc, o) {
  const s = laneSpec(o.low)
  const lim = ceiling(o.low)
  const r = specRand('lanehouse', o.variant)
  const tone = Math.floor(r() * 3)
  const doorLeft = r() < 0.5
  const material = materialOf(r, o.wall)
  wallOf(pc, 5, s.wallTop, 26, s.base, material, o.rand)
  splashes(pc, o.rand, 5, s.wallTop, 26, s.base - 3, 5)
  pc.hline(5, 26, s.base, P.holiSandstoneDark)
  const dx = doorLeft ? 8 : 18
  doorOf(pc, dx, s.base - 1, 5, 10, o.accent)
  garlandOver(pc, dx - 1, dx + 5, s.base - 11)
  paneOf(pc, doorLeft ? 16 : 8, s.wallTop + 5, 7, 6, o.lit)
  // A big clay water-pot by the wall and a pichkari leaning on it, the way it is on the day.
  const wx = doorLeft ? 23 : 3
  pc.ellipse(wx + 1.5, s.base - 4, 3.2, 3.6, P.matka)
  pc.hline(wx, wx + 3, s.base - 8, P.matkaLight)
  pc.vline(wx - 1, s.base - 6, s.base - 2, P.matkaLight)
  pc.hline(wx, wx + 3, s.base - 1, P.matkaDark)
  pichkariAt(pc, doorLeft ? 14 : 15, s.base - 1, GULAL[(o.variant + 4) % 6])
  if (!o.roof) return { x0: 4, x1: 27, top: s.wallTop }
  const stack = (x) => {
    for (let y = s.stackTop; y <= s.wallTop; y++) {
      pc.hline(x, x + 4, y, (y - s.stackTop) % 3 === 2 ? P.holiSandstoneDark : P.holiSandstone)
      pc.px(x, y, P.holiSandstoneLight)
    }
    pc.hline(x - 1, x + 5, s.stackTop, P.holiSandstoneLight)
  }
  stack(21)
  const color = roofPaintOf(o.roofs, tone)
  roofOver(pc, 2, 29, s.wallTop - 1, 11, color, lim)
  for (let y = s.stackTop; y <= s.wallTop - 7; y++) {
    pc.hline(21, 25, y, (y - s.stackTop) % 3 === 2 ? P.holiSandstoneDark : P.holiSandstone)
    pc.px(21, y, P.holiSandstoneLight)
  }
  pc.hline(20, 26, s.stackTop, P.holiSandstoneLight)
  // A splash of colour on the roof itself, and a marigold garland along the eave.
  splashes(pc, o.rand, 8, s.wallTop - 6, 18, s.wallTop - 2, 1)
  for (let x = 3; x <= 28; x += 2) pc.px(x, s.wallTop + 1, x % 4 ? P.marigold : P.marigoldLight)
  return null
}

// ---------- colour shop: trays of gulal under a striped awning ----------

function shopSpec(low = false) {
  const base = 46
  const wallTop = low ? base - 22 : base - 26
  return { base, wallTop, stackTop: Math.max(DOORSTEP_CLEAR + 1, wallTop - 10) }
}

function colourshop(pc, o) {
  const s = shopSpec(o.low)
  const lim = ceiling(o.low)
  const r = specRand('colourshop', o.variant)
  const material = r() < 0.6 ? pick(r, ['whitewash', 'pinkwash', 'yellowwash']) : materialOf(r, o.wall)
  const tone = Math.floor(r() * 3)
  const doorLeft = r() < 0.5
  wallOf(pc, 4, s.wallTop, 27, s.base, material, o.rand)
  pc.hline(4, 27, s.base, P.holiSandstoneDark)
  const wx = doorLeft ? 13 : 4
  paneOf(pc, wx, s.base - 14, 14, 9, o.lit)
  // The counter across the shop window, with a tray of gulal heaped in a cone in each colour.
  box(pc, wx - 1, s.base - 8, wx + 14, s.base - 5, P.matka)
  pc.hline(wx - 1, wx + 14, s.base - 8, P.matkaLight)
  pc.hline(wx - 1, wx + 14, s.base - 5, P.matkaDark)
  for (let i = 0; i < 4; i++) coneAt(pc, wx + 2 + i * 4, s.base - 9, GULAL[(i + o.variant) % 6], 3)
  doorOf(pc, doorLeft ? 6 : 22, s.base - 1, 5, 12, o.accent)
  // The sign across the front: a splash of every colour on the plot's paint.
  const fx = doorLeft ? 4 : 15
  const sign = roofPaintOf(o.roofs, tone + 1)
  box(pc, fx, s.wallTop + 2, fx + 12, s.wallTop + 8, sign)
  pc.hline(fx, fx + 12, s.wallTop + 2, shade(sign, 0.2))
  pc.hline(fx, fx + 12, s.wallTop + 8, shade(sign, -0.3))
  for (let i = 0; i < 4; i++) pc.ellipse(fx + 2.5 + i * 2.6, s.wallTop + 5.5, 1.2, 1.5, GULAL[i])
  potAt(pc, doorLeft ? 11 : 20, s.base - 1, GULAL[(o.variant + 2) % 6], 2)
  if (!o.roof) return { x0: 3, x1: 28, top: s.wallTop }
  // The stack of the sweet-maker's range at the back of the roof.
  const stack = (to) => {
    for (let y = s.stackTop; y <= to; y++) {
      pc.hline(23, 26, y, (y - s.stackTop) % 3 === 2 ? P.holiSandstoneDark : P.holiSandstone)
      pc.px(23, y, P.holiSandstoneDark)
    }
    pc.hline(22, 27, s.stackTop, P.holiSandstoneDark)
  }
  stack(s.wallTop - 5)
  roofOver(pc, 1, 30, s.wallTop - 1, 9, roofPaintOf(o.roofs, tone), lim)
  stack(s.wallTop - 8)
  // The awning over the window, striped in the plot's colour and white.
  for (let x = wx - 1; x <= wx + 14; x++) {
    const c = ((x >> 1) & 1) ? o.accent : TRIM
    pc.px(x, s.base - 16, c)
    pc.px(x, s.base - 15, shade(c, -0.22))
  }
  pc.hline(wx - 1, wx + 14, s.base - 17, P.matkaDark)
  return null
}

// ---------- gate hall: a wide arched gateway, pots of gulal either side, flags above ----------

function gatehall(pc, o) {
  const r = specRand('gatehall', o.variant)
  const tone = Math.floor(r() * 3)
  const material = r() < 0.6 ? 'sandstone' : materialOf(r, o.wall)
  const base = 46
  const eave = o.low ? base - 22 : base - 28
  wallOf(pc, 3, eave, 28, base, material, o.rand)
  splashes(pc, o.rand, 3, eave, 28, base - 3, 6)
  pc.hline(3, 28, base, P.holiSandstoneDark)
  // The gateway: an arch into the dark of the courtyard, framed in white, doors folded back.
  const ay = base - 17
  box(pc, 10, ay + 3, 21, base - 1, P.interior)
  pc.ellipse(15.5, ay + 4, 6, 4, P.interior)
  pc.hline(11, 20, ay, TRIM)
  pc.px(10, ay + 1, TRIM)
  pc.px(21, ay + 1, TRIM)
  pc.vline(9, ay + 2, base - 1, TRIM)
  pc.vline(22, ay + 2, base - 1, TRIM)
  pc.px(9, ay + 1, TRIM)
  pc.px(22, ay + 1, TRIM)
  box(pc, 7, ay + 3, 8, base - 1, o.accent)
  box(pc, 23, ay + 3, 24, base - 1, o.accent)
  // Through it: the courtyard in the light, and a lamp in the dark when somebody is in.
  pc.vline(15, ay + 5, base - 1, o.lit ? P.windowLit : P.holiGround[2][1])
  pc.vline(16, ay + 5, base - 1, o.lit ? P.windowLitCore : P.holiGround[2][0])
  garlandOver(pc, 10, 21, ay - 1)
  paneOf(pc, 4, base - 13, 4, 5, o.lit)
  paneOf(pc, 24, base - 13, 4, 5, o.lit)
  // Pots of gulal at each side of the step.
  potAt(pc, 5, base, GULAL[(o.variant + 1) % 6], 2)
  potAt(pc, 26, base, GULAL[(o.variant + 3) % 6], 2)
  if (!o.roof) return { x0: 2, x1: 29, top: eave }
  const color = roofPaintOf(o.roofs, tone)
  const top = eave - 6
  box(pc, 2, top, 29, eave - 1, color)
  pc.hline(1, 30, top, shade(color, 0.28))
  pc.hline(2, 29, top + 1, shade(color, 0.12))
  pc.hline(2, 29, eave - 1, shade(color, -0.3))
  // Notches in the parapet: a wall of merlons along the top.
  for (let x = 3; x <= 28; x += 4) pc.rect(x, top - 2, 2, 2, color)
  for (let x = 3; x <= 28; x += 4) pc.hline(x, x + 1, top - 2, shade(color, 0.28))
  // A pole at each end with flags between them, where there is room above.
  const lim = ceiling(o.low)
  const flagTop = Math.max(lim + 1, top - (o.low ? 3 : 7))
  if (flagTop <= top - 4) flagsBetween(pc, 6, 25, flagTop, true)
  return null
}

// ---------- pyre: the bonfire of Holika Dahan, a stack of logs ready for the evening ----------

function pyre(pc, o) {
  const base = 46
  const h = o.low ? 28 : 34
  const top = base - h
  // A ring of stones round the foot, so the fire sits on swept ground.
  pc.ellipse(16, base - 1, 12, 2.5, P.fieldstoneDark)
  pc.ellipse(16, base - 2, 11, 2, P.holiGround[3][1])
  for (let x = 6; x <= 26; x += 4) pc.rect(x, base - 1, 3, 2, P.fieldstone)
  // The logs: lines of timber leaning on each other to a point, lit on top, shadowed underneath.
  const lean = (x0, x1, y0, y1, c) => {
    pc.line(x0, y0, x1, y1, c)
    pc.line(x0 + 1, y0, x1 + 1, y1, c === P.barnTimber ? P.barnTimberDark : P.barnTimber)
  }
  const apex = 16
  const topY = top + 6
  lean(5, apex - 1, base - 3, topY, P.barnTimberLight)
  lean(27, apex + 1, base - 3, topY, P.barnTimber)
  lean(9, apex - 1, base - 3, topY + 4, P.barnTimber)
  lean(23, apex + 1, base - 3, topY + 4, P.barnTimberLight)
  lean(13, apex, base - 3, topY + 2, P.barnTimberLight)
  lean(19, apex, base - 3, topY + 2, P.barnTimber)
  // Logs laid across the foot, ends showing.
  for (let i = 0; i < 4; i++) {
    const x = 7 + i * 5
    pc.rect(x, base - 6 - (i % 2), 5, 3, i % 2 ? P.barnTimber : P.barnTimberLight)
    pc.hline(x, x + 4, base - 4 - (i % 2), P.barnTimberDark)
    pc.px(x, base - 5 - (i % 2), P.oakBrown)
  }
  pc.hline(11, 21, base - 10, P.barnTimberDark)
  if (!o.roof) return null
  // Garlands of marigold looped round it, and gulal in a pot at its foot, waiting for the day.
  for (let x = 7; x <= 25; x++) {
    const y = base - 13 + Math.round(Math.sin(((x - 7) / 18) * Math.PI) * 3)
    pc.px(x, y, x & 1 ? P.marigold : P.marigoldLight)
    if (x % 4 === 0) pc.px(x, y + 1, P.roseRed)
  }
  potAt(pc, 4, base, GULAL[(o.variant + 2) % 6], 2)
  if (o.lit) {
    // Lit: flame climbing out of the top, bright in the middle, sparks above it.
    const fy = topY + 2
    pc.ellipse(apex + 0.5, fy, 5, 5, P.flame)
    pc.ellipse(apex + 0.5, fy + 1, 3.4, 3.6, P.flameTip)
    pc.ellipse(apex + 0.5, fy + 2, 1.8, 2.2, P.flameCore)
    pc.vline(apex, Math.max(ceiling(o.low), fy - 8), fy - 4, P.flame)
    pc.px(apex + 1, Math.max(ceiling(o.low), fy - 9), P.flameTip)
    pc.px(apex - 4, fy - 6, P.flameTip)
    pc.px(apex + 5, fy - 5, P.flame)
  } else {
    // Unlit: a coil of dry grass and a few cakes of dung-fuel stacked on top, no flame.
    pc.ellipse(apex + 0.5, topY + 1, 3, 2, P.hay)
    pc.hline(apex - 2, apex + 3, topY, P.hayLight)
    pc.hline(apex - 2, apex + 3, topY + 2, P.hayDark)
  }
  return null
}

// ---------- drawing one ----------

const KINDS = { homehouse, lanehouse, colourshop, gatehall, pyre }
/** The bonfire's stack is its own frame: it needs no staging. */
const NO_STAGING = new Set(['pyre'])

/**
 * @param {{ kind: string, stage: number, accent: string, variant: number, lit: boolean, frame?: number, wall?: number, roofs?: number, low?: boolean, wear?: number }} o
 */
export function drawHoliBuilding(o) {
  const kind = KINDS[o.kind] ? o.kind : 'lanehouse'
  const variant = o.variant || 0
  const pc = new PixelCanvas(BUILDING_W, HEIGHT)
  const seed = variant * 6151 + 81
  if (o.stage <= 1) {
    site(pc, mulberry32(seed), o.stage, 0, variant)
    return pc.outline(P.outline)
  }
  const draw = KINDS[kind]
  const opts = {
    rand: mulberry32(seed), accent: o.accent || P.holiPaint[0], lit: Boolean(o.lit), roof: o.stage >= 3, variant,
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
