// Space colony buildings: what each thread builds on another world, drawn the way the village's
// buildings are (src/render/sprites/buildings.js): the plot's wall material and paint family on
// them, its accent on the hatches and awnings, and a finished one weathered by its wear.
//
// Contract (see ThemePack in ../index.js and the village's src/render/sprites/buildings.js):
// - A thread's building kind (KINDS in src/sim/building.js) maps to a colony kind through `fitted`.
// - Every sprite is BUILDING_W (32) wide and 48 tall, its bottom row on the ground. Down a
//   courtyard's sides (`fitted(kind, variant, false)`) nothing is drawn above row DOORSTEP_CLEAR
//   (9), outline included, at every stage: the villager at the door of the house above stands there.
// - Stages 0 and 1 are the ground being made ready; 2 is the building without its cover
//   (`roof: false`) inside a staging of poles and ladders; 3 is finished. Stage 3 is weathered by
//   `wear` exactly as the village's buildings are (see drawBuilding there).
// - `wall` indexes THEMES['space-colony'].dims.wall; `roofs` its paint families; `accent` is the
//   plot's colour, for hatches and awnings. Every colour from the palette.
//
// Windows keep the village's glass colours and its warm lit yellow: the weathering pass finds
// windows by those exact colours (GLASS_COLORS in weathering.js).
//
// The framing parts (a window, a door, the poles of the staging) are the farm's own: a colony is
// built by the same carpenters. What is drawn here is the colony on them.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { BUILDING_W, DOORSTEP_CLEAR, drawGradeTrim } from '../../sprites/buildings.js'
import { lookFor, weather } from '../../sprites/weathering.js'
import { mulberry32, pick, rngFor } from '../../../sim/rng.js'
import { THEMES } from '../../../sim/themes.js'
import { KEPT } from '../../../sim/wear.js'
import { box, doorOf, paneOf, staging } from '../farm/buildings.js'

/** A thread's building, by its kind, in a colony. */
export const SPACE_KINDS = {
  house: 'dome', cottage: 'module', shop: 'lab', barn: 'rig', windmill: 'rocket',
  workshop: 'module', well: 'rig', farm: 'glasshouse', tower: 'rocket', greenhouse: 'glasshouse', stall: 'rig',
}
const MATERIALS = THEMES['space-colony'].dims.wall
/**
 * The paint a plot's buildings share, by its `roofs`: three related colours each, as indices into
 * the palette's spacePaint (blue, orange, green, red, hull white, slate, violet, yellow). One
 * family per sub-theme, which is what tells one settlement from the next.
 */
const PAINT_FAMILIES = [[0, 5, 4], [1, 5, 4], [2, 7, 4], [3, 5, 4], [6, 0, 4]]
/** The hull white every trim and window frame is painted. */
const TRIM = P.spacePaint[4]
const HEIGHT = 48
const BASE = 46
/** The highest row anything may be drawn on, leaving the outline its row above. */
const ceiling = (low) => (low ? DOORSTEP_CLEAR + 1 : 1)

export function fitted(kind, variant, roomy) {
  return { kind: SPACE_KINDS[kind] || 'module', low: !roomy }
}

export const heightOf = () => HEIGHT

/** A rig and a rocket's pad stand as wide as their plot; the rest too. */
export function shadowOf(kind) {
  return kind === 'rocket' ? 30 : 34
}

/** Nothing here moves: the smoke does that. */
export const buildingFrames = () => 1

/** Where steam leaves a finished building: the habitat module's vent stack. */
export function chimneyOf(kind, variant = 0, wall = 0, roofs = 0, low = false) {
  if (kind === 'module') return { x: 24, y: moduleSpec(low).stackTop }
  return null
}

// ---------- shared parts ----------

const specRand = (kind, variant) => rngFor(`space:${kind}:${variant}`)
const familyOf = (roofs) => PAINT_FAMILIES[(roofs || 0) % PAINT_FAMILIES.length]
/** A roof's or an awning's paint: the first two of the family; the white is for trim. */
const roofPaintOf = (roofs, i) => P.spacePaint[familyOf(roofs)[Math.abs(Math.floor(i)) % 2]]
const materialOf = (r, wall) => (r() < 0.7 ? MATERIALS[(wall || 0) % MATERIALS.length] : pick(r, MATERIALS))

/** A wall of one of the theme's five materials, x0..x1 by y0..y1. */
function wallOf(pc, x0, y0, x1, y1, material, rand) {
  if (material === 'hull') {
    // Painted hull panels: seams every eight columns, rivets along the top, shaded at the foot.
    box(pc, x0, y0, x1, y1, P.spaceHull)
    for (let x = x0 + 4; x <= x1; x += 8) pc.vline(x, y0, y1, P.spaceHullDark)
    for (let x = x0 + 1; x <= x1; x += 4) pc.px(x, y0 + 2, P.spaceHullDark)
    pc.hline(x0, x1, y0, P.spaceHullLight)
    pc.hline(x0, x1, y1 - 1, P.spaceHullDark)
  } else if (material === 'brick') {
    // Sintered regolith brick in even courses, each lit along its top.
    box(pc, x0, y0, x1, y1, P.spaceBrick)
    for (let y = y0; y <= y1; y++) {
      const row = y - y0
      const off = (Math.floor(row / 4) % 2) * 4
      for (let x = x0; x <= x1; x++) {
        const u = (x - x0 + off) % 8
        if (row % 4 === 3 || u === 7) pc.px(x, y, P.spaceBrickDark)
        else if (row % 4 === 0) pc.px(x, y, P.spaceBrickLight)
      }
    }
  } else if (material === 'plating') {
    // Dark steel plates, bolted, a hazard stripe along the foot.
    box(pc, x0, y0, x1, y1, P.spacePlate)
    for (let x = x0 + 5; x <= x1; x += 10) pc.vline(x, y0, y1, P.spacePlateDark)
    for (let y = y0 + 6; y <= y1; y += 8) pc.hline(x0, x1, y, P.spacePlateDark)
    for (let x = x0 + 1; x <= x1; x += 5) pc.px(x, y0 + 2, P.spacePlateLight)
    pc.hline(x0, x1, y0, P.spacePlateLight)
    for (let x = x0; x <= x1; x++) pc.px(x, y1 - 1, x % 4 < 2 ? P.spaceHazard : P.spacePlateDark)
  } else if (material === 'glass') {
    // Dome glass in tall panes: mullions, a glint across each.
    box(pc, x0, y0, x1, y1, P.spaceGlass)
    for (let x = x0 + 3; x <= x1; x += 6) pc.vline(x, y0, y1, P.spaceGlassDark)
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if ((x + y) % 9 === 0 && x % 6 !== 3) pc.px(x, y, P.spaceGlassLight)
    pc.hline(x0, x1, y0, P.spaceGlassLight)
    pc.hline(x0, x1, y1, P.spaceGlassDark)
  } else {
    // Greenhouse panels: green glass over grow lights, a glow along each seam.
    box(pc, x0, y0, x1, y1, P.spaceGreenPanel)
    for (let x = x0 + 2; x <= x1; x += 5) pc.vline(x, y0, y1, P.spaceGreenDark)
    for (let i = 0; i < 9; i++) pc.px(x0 + Math.floor(rand() * (x1 - x0 + 1)), y0 + Math.floor(rand() * (y1 - y0 + 1)), P.spaceGreenGlow)
    pc.hline(x0, x1, y0, P.spaceGreenGlow)
    pc.hline(x0, x1, y1, P.spaceGreenDark)
  }
}

/** A beacon lamp: three pixels of colour c with a bright heart, `lit` lighting it. */
function beaconAt(pc, x, y, c = P.spacePaint[3], lit = true) {
  pc.hline(x - 1, x + 1, y, lit ? c : shade(c, -0.5))
  pc.px(x, y - 1, lit ? P.spaceGlow : shade(c, -0.4))
}

/** A supply crate at (x, y), its foot on row y: w wide, h tall, a hazard stripe across. */
function crateAt(pc, x, y, w = 7, h = 4, c = P.spacePaint[1]) {
  box(pc, x, y - h + 1, x + w - 1, y, c)
  pc.hline(x, x + w - 1, y - h + 1, shade(c, 0.25))
  pc.hline(x, x + w - 1, y, shade(c, -0.3))
  pc.vline(x + w - 1, y - h + 1, y, shade(c, -0.3))
  if (h > 3) for (let i = 1; i < w - 1; i++) pc.px(x + i, y - 1, i % 2 ? P.spaceHazard : P.spacePlateDark)
}

/** A solar panel at (x, y): w wide and h tall, tilted, cells in a grid, on a pole to row `foot`. */
function solarAt(pc, x, y, w, h, foot) {
  for (let r = 0; r < h; r++) {
    const sk = h - 1 - r
    for (let i = 0; i < w; i++) {
      pc.px(x + sk + i, y + r, i % 4 === 0 || r % 3 === 2 ? P.spaceSolarGrid : P.spaceSolar)
    }
    pc.px(x + sk, y + r, P.spaceSolarLight)
  }
  const px = x + Math.floor((w + h) / 2)
  pc.vline(px, y + h, foot, P.spacePlate)
}

/** A radar dish at (cx, cy): a bowl facing up and right on its arm, a red tip on the feed. */
function dishAt(pc, cx, cy, clip) {
  pc.ellipse(cx, cy, 6, 3.2, P.spaceHullDark)
  pc.ellipse(cx + 0.5, cy - 0.5, 5, 2.4, P.spaceHull)
  pc.hline(cx - 3, cx + 2, cy - 1, P.spaceHullLight)
  pc.line(cx, cy, cx + 4, Math.max(clip, cy - 3), P.spacePlateLight)
  pc.px(cx + 4, Math.max(clip, cy - 3), P.spacePaint[3])
  pc.vline(cx, cy + 3, cy + 5, P.spacePlate)
}

// ---------- the ground being made ready ----------

function site(pc, rand, stage, variant) {
  pc.ellipse(16, 43, 15.5, 4.5, P.spacePlate)
  pc.ellipse(16, 42.5, 13, 3, P.spacePlateLight)
  for (let i = 0; i < 12; i++) pc.px(2 + Math.floor(rand() * 28), 40 + Math.floor(rand() * 7), i % 2 ? P.spacePlateDark : P.spaceLaneDark)
  const left = variant % 2 === 0
  if (stage === 0) {
    // Surveyed and marked out: stakes with hazard tape between them, a beacon on each corner
    // stake, a crate and a cone of dust waiting.
    for (const dx of [-13, -6, 0, 6, 13]) {
      pc.vline(16 + dx, 37, 43, P.spacePlate)
      pc.px(16 + dx, 37, P.spacePlateLight)
    }
    for (let x = 3; x <= 29; x++) pc.px(x, 38, x % 4 < 2 ? P.spaceHazard : P.spacePlateDark)
    beaconAt(pc, 3, 36, P.spacePaint[3], false)
    beaconAt(pc, 29, 36, P.spacePaint[3], false)
    crateAt(pc, left ? 20 : 6, 44, 7, 4)
    crateAt(pc, left ? 8 : 20, 45, 5, 3, P.spacePaint[0])
    return
  }
  // The frame up: a skid on the ground, two masts and a beam across, braced, a ladder against it
  // and the crates stacked at its foot.
  box(pc, 4, 41, 27, 43, P.spacePlateDark)
  pc.hline(4, 27, 41, P.spacePlateLight)
  for (const x of [7, 24]) {
    box(pc, x, 25, x + 1, 41, P.spacePlate)
    pc.vline(x, 25, 41, P.spacePlateLight)
  }
  pc.hline(6, 26, 24, P.spacePlateLight)
  pc.hline(6, 26, 25, P.spacePlateDark)
  for (let x = 11; x <= 21; x += 5) pc.vline(x, 26, 40, P.spacePlateDark)
  pc.line(8, 40, 23, 27, P.spacePlate)
  pc.line(8, 27, 23, 40, P.spacePlate)
  beaconAt(pc, 16, 23, P.spacePaint[3], false)
  const lx = left ? 2 : 29
  const dx = left ? 1 : -1
  pc.line(lx, 43, lx + dx * 5, 24, P.spacePlateLight)
  pc.line(lx + dx, 43, lx + dx * 6, 24, P.spacePlate)
  for (let i = 0; i < 6; i++) {
    const t = i / 6
    pc.hline(lx + Math.round(dx * t * 5), lx + Math.round(dx * (1 + t * 5)), 42 - i * 3, P.spacePlateDark)
  }
  crateAt(pc, left ? 16 : 6, 44, 7, 4)
  crateAt(pc, left ? 26 : 4, 45, 4, 3, P.spacePaint[0])
}

// ---------- dome: glass over a garden, on a ring of hull with its airlock ----------

function dome(pc, o) {
  const lim = ceiling(o.low)
  const r = specRand('dome', o.variant)
  const material = materialOf(r, o.wall)
  const doorLeft = r() < 0.5
  const tone = Math.floor(r() * 3)
  const ringTop = o.low ? BASE - 9 : BASE - 10
  const yc = ringTop - 1
  const ry = o.low ? yc - lim - 3 : Math.min(24, yc - lim - 2)
  const half = (y) => 13 * Math.sqrt(Math.max(0, 1 - ((yc - y) / ry) ** 2))
  const span = (y) => [Math.ceil(15.5 - half(y)), Math.floor(15.5 + half(y))]
  const top = yc - ry
  wallOf(pc, 2, ringTop, 29, BASE, material, o.rand)
  pc.hline(2, 29, BASE, P.spacePlateDark)
  const paint = roofPaintOf(o.roofs, tone)
  pc.hline(2, 29, ringTop, paint)
  pc.hline(2, 29, ringTop + 1, shade(paint, -0.28))
  const dx = doorLeft ? 5 : 21
  doorOf(pc, dx, BASE - 1, 6, 8, o.accent)
  paneOf(pc, doorLeft ? 18 : 6, ringTop + 3, 6, 5, o.lit)
  const ribs = (y) => {
    const [x0, x1] = span(y)
    pc.px(x0, y, P.spaceGlassDark)
    pc.px(x1, y, P.spaceGlassDark)
    for (const u of [-0.55, 0, 0.55]) pc.px(Math.round(15.5 + u * half(y)), y, P.spaceGlassDark)
  }
  if (o.roof) {
    for (let y = top; y <= yc; y++) {
      const [x0, x1] = span(y)
      pc.hline(x0, x1, y, P.spaceGlass)
      // The garden inside, lit from within after dark.
      if (y > yc - 10) pc.hline(x0 + 1, x1 - 1, y, o.lit ? P.windowLit : P.window)
      if (y - top > 1 && y - top < ry * 0.55) pc.px(x0 + 2, y, P.spaceGlassLight)
    }
    // Trees under the glass.
    for (const [tx, h] of [[9, 5], [15, 7], [22, 4]]) {
      pc.vline(tx, yc - 3, yc, P.spaceBrickDark)
      pc.ellipse(tx, yc - 3 - h / 2, 2.5, h / 2 + 0.5, P.spaceLeafDark)
      pc.px(tx - 1, yc - 4 - h / 2, P.spaceLeaf)
    }
    for (let y = top; y <= yc; y++) ribs(y)
    const lat = Math.round(yc - ry * 0.5)
    const [lx0, lx1] = span(lat)
    pc.hline(lx0, lx1, lat, P.spaceGlassDark)
    // A mast on the crown, a beacon on it, where there is room.
    const m = Math.min(5, top - lim - 1)
    if (m > 1) {
      pc.vline(15, top - m, top - 1, P.spacePlateLight)
      pc.px(15, top - m, o.lit ? P.spacePaint[3] : P.spacePlateDark)
    }
    return null
  }
  // Without its glass: only the ribs and the springing ring, inside a staging.
  for (let y = top; y <= yc; y++) ribs(y)
  return { x0: 3, x1: 28, top: top + 4 }
}

// ---------- module: a habitat pod with a hatch, portholes, a solar panel and a vent ----------

function moduleSpec(low = false) {
  const bt = low ? BASE - 16 : BASE - 20
  return { bt, stackTop: Math.max(DOORSTEP_CLEAR + 2, bt - 12) }
}

function moduleB(pc, o) {
  const s = moduleSpec(o.low)
  const r = specRand('module', o.variant)
  const material = r() < 0.6 ? 'hull' : materialOf(r, o.wall)
  const tone = Math.floor(r() * 3)
  const doorLeft = r() < 0.5
  wallOf(pc, 3, s.bt, 28, BASE, material, o.rand)
  pc.hline(3, 28, BASE, P.spacePlateDark)
  const dx = doorLeft ? 6 : 19
  // The airlock: a hatch on the plot's accent in a steel frame, a stripe over it.
  box(pc, dx - 1, BASE - 12, dx + 6, BASE, P.spacePlate)
  doorOf(pc, dx, BASE - 1, 6, 11, o.accent)
  pc.hline(dx - 1, dx + 6, BASE - 12, P.spaceHazard)
  paneOf(pc, doorLeft ? 15 : 6, s.bt + 4, 5, 5, o.lit)
  paneOf(pc, doorLeft ? 22 : 13, s.bt + 4, 5, 5, o.lit)
  if (!o.roof) return { x0: 2, x1: 29, top: s.bt }
  const color = roofPaintOf(o.roofs, tone)
  for (let x = 2; x <= 29; x++) {
    const h = Math.round(5 * Math.sqrt(Math.max(0, 1 - ((x - 15.5) / 14) ** 2)))
    for (let y = s.bt - h; y < s.bt; y++) pc.px(x, y, y === s.bt - h ? shade(color, 0.25) : color)
    pc.px(x, s.bt - 1, shade(color, -0.28))
  }
  const top = s.bt - 5
  solarAt(pc, doorLeft ? 4 : 17, top - 7, 9, 5, top)
  // The vent stack, with its steaming cap.
  pc.vline(24, s.stackTop, top + 1, P.spacePlateLight)
  pc.vline(25, s.stackTop, top + 1, P.spacePlateDark)
  pc.hline(23, 26, s.stackTop, P.spacePlate)
  return null
}

// ---------- rocket: a rocket on its pad beside a gantry ----------

function rocket(pc, o) {
  const r = specRand('rocket', o.variant)
  const tone = Math.floor(r() * 3)
  const flip = r() < 0.5
  const top = o.low ? 11 : 3
  const cx = flip ? 19 : 12
  const gx = flip ? 4 : 23
  // The pad: a plate disc with a hazard rim.
  pc.ellipse(16, BASE - 1, 15.5, 2.5, P.spacePlate)
  pc.hline(2, 29, BASE, P.spacePlateDark)
  for (let x = 3; x <= 28; x += 4) pc.px(x, BASE - 1, P.spaceHazard)
  const color = roofPaintOf(o.roofs, tone)
  const bodyTop = top + (o.roof ? 10 : 12)
  const bodyBot = BASE - 6
  // Fins and the engine bell.
  for (let i = 0; i < 7; i++) {
    pc.hline(cx - 4 - Math.floor(i / 2), cx - 4, bodyBot - 6 + i, color)
    pc.hline(cx + 4, cx + 4 + Math.floor(i / 2), bodyBot - 6 + i, color)
  }
  pc.rect(cx - 2, bodyBot, 5, 3, P.spacePlateDark)
  pc.rect(cx - 3, bodyBot + 3, 7, 2, P.spacePlate)
  if (o.lit) pc.rect(cx - 1, bodyBot + 5, 3, 1, P.flameTip)
  // The body: hull, a band of paint, a porthole.
  const mat = o.roof ? P.spaceHull : P.spacePlate
  for (let y = bodyTop; y <= bodyBot; y++) {
    pc.hline(cx - 4, cx + 4, y, mat)
    pc.px(cx - 4, y, shade(mat, 0.2))
    pc.px(cx + 4, y, shade(mat, -0.25))
    pc.px(cx + 3, y, shade(mat, -0.12))
  }
  if (o.roof) {
    pc.rect(cx - 4, bodyTop + 4, 9, 2, color)
    pc.rect(cx - 4, bodyBot - 4, 9, 2, color)
    paneOf(pc, cx - 2, bodyTop + 8, 5, 5, o.lit)
    // The nose cone.
    for (let i = 0; i < 10; i++) {
      const hw = Math.round(4 * Math.sin((Math.PI / 2) * ((i + 1) / 10)))
      pc.hline(cx - hw, cx + hw, top + i, color)
      pc.px(cx - hw, top + i, shade(color, 0.25))
      pc.px(cx + hw, top + i, shade(color, -0.25))
    }
  } else {
    for (let y = bodyTop; y <= bodyBot; y += 6) pc.hline(cx - 4, cx + 4, y, P.spacePlateLight)
  }
  // The gantry: two legs, braced, with an arm to the rocket and a lamp on top.
  const gTop = top + 8
  for (const x of [gx, gx + 5]) pc.vline(x, gTop, BASE - 1, P.spacePlate)
  pc.vline(gx, gTop, BASE - 1, P.spacePlateLight)
  for (let y = gTop; y < BASE - 6; y += 6) {
    pc.line(gx, y, gx + 5, y + 6, P.spacePlateDark)
    pc.line(gx + 5, y, gx, y + 6, P.spacePlateDark)
    pc.hline(gx, gx + 5, y, P.spacePlateLight)
  }
  const armY = bodyTop + 6
  const ax0 = flip ? cx - 4 : cx + 4
  pc.hline(Math.min(ax0, gx + (flip ? 5 : 0)), Math.max(ax0, gx + (flip ? 5 : 0)), armY, P.spaceHazard)
  pc.hline(Math.min(ax0, gx + (flip ? 5 : 0)), Math.max(ax0, gx + (flip ? 5 : 0)), armY + 1, P.spacePlateDark)
  beaconAt(pc, gx + 2, gTop - 1, P.spacePaint[3], o.lit)
  return null
}

// ---------- lab: a research module with a radar dish, an antenna and a bank of screens ----------

function lab(pc, o) {
  const lim = ceiling(o.low)
  const r = specRand('lab', o.variant)
  const material = r() < 0.6 ? pick(r, ['hull', 'plating']) : materialOf(r, o.wall)
  const tone = Math.floor(r() * 3)
  const doorLeft = r() < 0.5
  const wallTop = o.low ? BASE - 22 : BASE - 26
  wallOf(pc, 4, wallTop, 27, BASE, material, o.rand)
  pc.hline(4, 27, BASE, P.spacePlateDark)
  // The instrument window along the front, screens glowing behind it.
  const wx = doorLeft ? 12 : 4
  paneOf(pc, wx, BASE - 14, 15, 9, o.lit)
  for (let x = wx + 2; x <= wx + 11; x += 3) pc.px(x, BASE - 8, o.lit ? P.spaceGreenGlow : P.spaceBedDark)
  doorOf(pc, doorLeft ? 5 : 22, BASE - 1, 5, 11, o.accent)
  // The sign: a paint plate across the top of the wall.
  const sign = roofPaintOf(o.roofs, tone + 1)
  box(pc, 6, wallTop + 2, 25, wallTop + 4, sign)
  pc.hline(6, 25, wallTop + 2, shade(sign, 0.25))
  pc.hline(6, 25, wallTop + 4, shade(sign, -0.3))
  if (!o.roof) return { x0: 3, x1: 28, top: wallTop }
  const roofTop = wallTop - 3
  const color = roofPaintOf(o.roofs, tone)
  box(pc, 3, roofTop, 28, wallTop - 1, color)
  pc.hline(3, 28, roofTop, shade(color, 0.25))
  pc.hline(3, 28, wallTop - 1, shade(color, -0.3))
  // The dish and the antenna mast, on the roof.
  dishAt(pc, doorLeft ? 8 : 22, Math.max(lim + 5, roofTop - 6), lim + 1)
  const mx = doorLeft ? 23 : 7
  const mt = Math.max(lim + 2, roofTop - 12)
  pc.vline(mx, mt, roofTop - 1, P.spacePlateLight)
  pc.hline(mx - 2, mx + 2, mt + 3, P.spacePlate)
  pc.hline(mx - 1, mx + 1, mt + 6, P.spacePlate)
  beaconAt(pc, mx, mt, P.spacePaint[3], o.lit)
  return null
}

// ---------- rig: a drill derrick with a crane and an ore cart on its rail ----------

function rig(pc, o) {
  const r = specRand('rig', o.variant)
  const tone = Math.floor(r() * 3)
  const flip = r() < 0.5
  const top = o.low ? 12 : 6
  const mx = flip ? 20 : 11
  // Skid plate under it all.
  box(pc, 2, BASE - 2, 29, BASE, P.spacePlateDark)
  for (let x = 2; x <= 29; x++) pc.px(x, BASE - 2, x % 4 < 2 ? P.spaceHazard : P.spacePlate)
  // The derrick: two legs to a crown, braced.
  pc.line(mx - 7, BASE - 3, mx, top + 3, P.spacePlateLight)
  pc.line(mx + 7, BASE - 3, mx, top + 3, P.spacePlate)
  for (let y = top + 8; y < BASE - 4; y += 7) {
    const hw = Math.round(((y - top - 3) / (BASE - 3 - top - 3)) * 7)
    pc.hline(mx - hw, mx + hw, y, P.spacePlateDark)
    pc.line(mx - hw, y, mx + hw, y + 7, P.spacePlateDark)
  }
  box(pc, mx - 2, top, mx + 2, top + 3, P.spacePlate)
  pc.hline(mx - 2, mx + 2, top, P.spacePlateLight)
  // The drill string, down the middle into the ground.
  pc.vline(mx, top + 4, BASE - 3, P.spacePlateDark)
  pc.vline(mx + 1, top + 4, BASE - 3, P.spaceHullDark)
  if (!o.roof) return null
  const paint = roofPaintOf(o.roofs, tone)
  beaconAt(pc, mx, top - 1, P.spacePaint[3], o.lit)
  // The crane: a boom out to the side, a cable and a hook with an ore bucket.
  const bx = flip ? mx - 2 : mx + 2
  const dir = flip ? -1 : 1
  pc.line(bx, top + 6, bx + dir * 9, top + 8, paint)
  pc.line(bx, top + 7, bx + dir * 9, top + 9, shade(paint, -0.3))
  pc.vline(bx + dir * 9, top + 9, top + 15, P.spacePlateDark)
  box(pc, bx + dir * 9 - 2, top + 16, bx + dir * 9 + 2, top + 19, P.spaceOre)
  pc.hline(bx + dir * 9 - 2, bx + dir * 9 + 2, top + 16, P.spaceOreLight)
  // The ore cart on its rail, heaped.
  const cx = flip ? 3 : 20
  pc.hline(cx - 1, cx + 10, BASE - 3, P.spacePlateDark)
  box(pc, cx, BASE - 9, cx + 8, BASE - 4, paint)
  pc.hline(cx, cx + 8, BASE - 9, shade(paint, 0.25))
  pc.hline(cx + 1, cx + 7, BASE - 10, P.spaceOre)
  pc.px(cx + 3, BASE - 11, P.spaceOreLight)
  pc.px(cx + 5, BASE - 10, P.spaceOreLight)
  for (const x of [cx + 1, cx + 7]) pc.px(x, BASE - 3, P.spaceBedDark)
  // The control cabin, window lit from within.
  const kx = flip ? 20 : 3
  box(pc, kx, BASE - 11, kx + 7, BASE - 3, P.spaceHull)
  paneOf(pc, kx + 1, BASE - 10, 4, 4, o.lit)
  pc.hline(kx, kx + 7, BASE - 11, TRIM)
  return null
}

// ---------- glasshouse: a hydroponic greenhouse glowing green, racks of crops inside ----------

function glasshouse(pc, o) {
  const r = specRand('glasshouse', o.variant)
  const material = r() < 0.65 ? 'greenhouse' : materialOf(r, o.wall)
  const tone = Math.floor(r() * 3)
  const doorLeft = r() < 0.5
  const wallTop = o.low ? BASE - 16 : BASE - 18
  wallOf(pc, 2, wallTop, 29, BASE, material, o.rand)
  pc.hline(2, 29, BASE, P.spacePlateDark)
  // The glazing: racks of crops glowing under their lamps, behind pale mullions.
  const gx0 = doorLeft ? 11 : 4
  box(pc, gx0, wallTop + 2, gx0 + 16, BASE - 2, o.lit ? P.spaceGreenGlow : P.spaceGreenPanel)
  for (let y = wallTop + 5; y < BASE - 2; y += 5) {
    pc.hline(gx0, gx0 + 16, y, P.spaceGreenDark)
    for (let x = gx0 + 1; x <= gx0 + 15; x += 3) {
      pc.px(x, y - 1, P.spaceLeaf)
      pc.px(x + 1, y - 2, P.spaceLeafDark)
    }
  }
  for (let x = gx0; x <= gx0 + 16; x += 4) pc.vline(x, wallTop + 2, BASE - 2, P.spaceHullLight)
  pc.hline(gx0, gx0 + 16, wallTop + 2, P.spaceHullLight)
  doorOf(pc, doorLeft ? 4 : 23, BASE - 1, 5, 10, o.accent)
  // A water tank at the other end.
  box(pc, doorLeft ? 21 : 24, BASE - 8, doorLeft ? 27 : 29, BASE, P.spacePaint[4])
  pc.hline(doorLeft ? 21 : 24, doorLeft ? 27 : 29, BASE - 8, P.spaceHullLight)
  pc.rect(doorLeft ? 22 : 25, BASE - 5, 4, 2, P.water)
  if (!o.roof) return { x0: 1, x1: 30, top: wallTop }
  // The arched glass roof, lit green from the racks inside.
  const rise = o.low ? 8 : 14
  const color = roofPaintOf(o.roofs, tone)
  for (let x = 1; x <= 30; x++) {
    const h = Math.round(rise * Math.sqrt(Math.max(0, 1 - ((x - 15.5) / 15) ** 2)))
    for (let y = wallTop - h; y < wallTop; y++) pc.px(x, y, y === wallTop - h ? P.spaceGlassLight : o.lit ? P.spaceGreenGlow : P.spaceGlass)
    if (x % 5 === 0) pc.vline(x, wallTop - h, wallTop - 1, P.spaceHullDark)
  }
  pc.hline(1, 30, wallTop - 1, color)
  pc.hline(1, 30, wallTop, shade(color, -0.28))
  return null
}

// ---------- drawing one ----------

const KINDS = { dome, module: moduleB, rocket, lab, rig, glasshouse }
/** A rig and a rocket on its pad stand on the ground: they need no staging. */
const NO_STAGING = new Set(['rig', 'rocket'])

/**
 * @param {{ kind: string, stage: number, accent: string, variant: number, lit: boolean, frame?: number, wall?: number, roofs?: number, low?: boolean, wear?: number }} o
 */
export function drawSpaceBuilding(o) {
  const kind = KINDS[o.kind] ? o.kind : 'module'
  const variant = o.variant || 0
  const pc = new PixelCanvas(BUILDING_W, HEIGHT)
  const seed = variant * 6151 + 71
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
    rand: mulberry32(seed), accent: o.accent || P.spacePaint[0], lit: Boolean(o.lit), roof: o.stage >= 3, variant,
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
