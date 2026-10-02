// New Year's Eve buildings: what each thread builds in a village on the last night of the year,
// drawn the way the village's buildings are (src/render/sprites/buildings.js): the plot's wall
// material and paint family on them, its accent on the doors and awnings, and a finished one
// weathered by its wear.
//
// Contract (see ThemePack in ../index.js and the village's src/render/sprites/buildings.js):
// - A thread's building kind (KINDS in src/sim/building.js) maps to one of ours through `fitted`.
// - Every sprite is BUILDING_W (32) wide and 48 tall, its bottom row on the ground. Down a
//   courtyard's sides (`fitted(kind, variant, false)`) nothing is drawn above row DOORSTEP_CLEAR
//   (9), outline included, at every stage: the villager at the door of the house above stands there.
// - Stages 0 and 1 are the ground being made ready; 2 is the building without its roof
//   (`roof: false`) inside a staging of poles and ladders; 3 is finished. Stage 3 is weathered by
//   `wear` exactly as the village's buildings are (see drawBuilding there).
// - `wall` indexes THEMES['new-years-eve'].dims.wall; `roofs` its paint families; `accent` is the
//   plot's colour, for doors and awnings. Every colour from the palette.
//
// Windows keep the village's glass colours and its warm lit yellow: the weathering pass finds
// windows by those exact colours (GLASS_COLORS in weathering.js). The party lights are the one
// thing here that glows whether or not somebody is in; they are decoration, never a window.
//
// The framing parts (a pitched roof, the staging's poles) are the farm's own: a party is built by
// the same carpenters. What is drawn here is the party on them.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { BUILDING_W, DOORSTEP_CLEAR, drawGradeTrim } from '../../sprites/buildings.js'
import { lookFor, weather } from '../../sprites/weathering.js'
import { mulberry32, pick, rngFor } from '../../../sim/rng.js'
import { THEMES } from '../../../sim/themes.js'
import { KEPT } from '../../../sim/wear.js'
import { roofOver, staging } from '../farm/buildings.js'

/** A thread's building, by its kind, on New Year's Eve. */
export const PARTY_KINDS = {
  house: 'partyhouse', cottage: 'cabin', shop: 'ballroom', barn: 'ballroom', windmill: 'clocktower',
  workshop: 'cabin', well: 'bandstand', farm: 'partyhouse', tower: 'clocktower', greenhouse: 'bandstand', stall: 'bandstand',
}
const MATERIALS = THEMES['new-years-eve'].dims.wall
/**
 * The paint a plot's buildings share, by its `roofs`: three related colours each, as indices into
 * the palette's nyePaint (magenta, gold, teal, violet, champagne, coral, midnight blue, silver).
 * One family per sub-theme, which is what tells one street from the next.
 */
const PAINT_FAMILIES = [[0, 3, 4], [1, 5, 4], [2, 6, 4], [3, 0, 4]]
/** The champagne every trim, sill and window frame is painted. */
const TRIM = P.nyePaint[4]
const BULBS = P.nyeBulb
const HEIGHT = 48
/** The highest row anything may be drawn on, leaving the outline its row above. */
const ceiling = (low) => (low ? DOORSTEP_CLEAR + 1 : 1)

export function fitted(kind, variant, roomy) {
  return { kind: PARTY_KINDS[kind] || 'cabin', low: !roomy }
}

export const heightOf = () => HEIGHT

/** A bandstand is low and wide; the rest stand as wide as their plot. */
export function shadowOf(kind) {
  return kind === 'cabin' ? 30 : 34
}

/** Nothing here moves: the smoke does that. */
export const buildingFrames = () => 1

const box = (pc, x0, y0, x1, y1, c) => pc.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, c)

/** Where smoke leaves a finished building: the cabin's stack. */
export function chimneyOf(kind, variant = 0, wall = 0, roofs = 0, low = false) {
  if (kind === 'cabin') return { x: 24, y: cabinSpec(low).stackTop }
  return null
}

// ---------- shared parts ----------

const specRand = (kind, variant) => rngFor(`nye:${kind}:${variant}`)
/** A roof's or an awning's paint: the first two of the family; the champagne is for trim. */
const roofPaintOf = (roofs, i) => {
  const f = PAINT_FAMILIES[(roofs || 0) % PAINT_FAMILIES.length]
  return P.nyePaint[f[Math.abs(Math.floor(i)) % 2]]
}
const materialOf = (r, wall) => (r() < 0.7 ? MATERIALS[(wall || 0) % MATERIALS.length] : pick(r, MATERIALS))

/** A wall of one of the theme's five materials, x0..x1 by y0..y1. */
function wallOf(pc, x0, y0, x1, y1, material, rand) {
  if (material === 'midnight') {
    // Midnight-blue plaster, lighter where the party lights fall on it, a star or two of confetti.
    box(pc, x0, y0, x1, y1, P.nyePlaster)
    for (let x = x0 + 3; x <= x1; x += 6) pc.vline(x, y0, y1, P.nyePlasterDark)
    pc.hline(x0, x1, y0, P.nyePlasterLight)
    for (let i = 0; i < 6; i++) pc.px(x0 + Math.floor(rand() * (x1 - x0 + 1)), y0 + Math.floor(rand() * (y1 - y0 + 1)), i % 2 ? P.nyePlasterLight : BULBS[i % BULBS.length])
  } else if (material === 'stucco') {
    // Champagne stucco: a rough coat, speckled light and dark.
    box(pc, x0, y0, x1, y1, P.nyeStucco)
    for (let i = 0; i < 18; i++) pc.px(x0 + Math.floor(rand() * (x1 - x0 + 1)), y0 + Math.floor(rand() * (y1 - y0 + 1)), i % 2 ? P.nyeStuccoDark : P.nyeStuccoLight)
    pc.hline(x0, x1, y1, P.nyeStuccoDark)
  } else if (material === 'nightbrick') {
    // Soot-dark brick in running bond, a scrap of confetti caught in the mortar.
    box(pc, x0, y0, x1, y1, P.sootBrick)
    for (let y = y0; y <= y1; y++) {
      const row = y - y0
      if (row % 3 === 2) pc.hline(x0, x1, y, P.sootBrickDark)
      else for (let x = x0; x <= x1; x++) if ((x - x0 + (Math.floor(row / 3) % 2) * 3) % 6 === 5) pc.px(x, y, P.sootBrickDark)
    }
    for (let i = 0; i < 3; i++) pc.px(x0 + Math.floor(rand() * (x1 - x0 + 1)), y0 + Math.floor(rand() * (y1 - y0 + 1)), BULBS[i % BULBS.length])
  } else if (material === 'marble') {
    // White marble in dressed blocks, a grey vein through some of them.
    box(pc, x0, y0, x1, y1, P.nyeMarble)
    for (let y = y0 + 5; y <= y1; y += 6) pc.hline(x0, x1, y, P.nyeMarbleDark)
    for (let x = x0 + 4; x <= x1; x += 8) for (let y = y0; y <= y1; y += 12) pc.vline(x + ((y / 12) % 2) * 4, y, Math.min(y1, y + 5), P.nyeMarbleDark)
    pc.hline(x0, x1, y0, P.nyeMarbleLight)
    for (let i = 0; i < 5; i++) {
      const x = x0 + Math.floor(rand() * (x1 - x0 - 3))
      const y = y0 + Math.floor(rand() * (y1 - y0 - 3))
      pc.line(x, y, x + 3, y + 2, P.nyeMarbleVein)
    }
  } else {
    // Round logs laid one on another, each lit on top, shadowed under, a pale end at the corners.
    box(pc, x0, y0, x1, y1, P.barnTimber)
    for (let y = y0; y <= y1; y += 4) {
      pc.hline(x0, x1, y, P.barnTimberLight)
      if (y + 3 <= y1) pc.hline(x0, x1, y + 3, P.barnTimberDark)
      for (const x of [x0, x1 - 1]) pc.rect(x, y, 2, Math.min(3, y1 - y + 1), P.oakBrown)
    }
    for (let i = 0; i < 4; i++) pc.px(x0 + 2 + Math.floor(rand() * (x1 - x0 - 3)), y0 + Math.floor(rand() * (y1 - y0 + 1)), P.barnTimberDark)
  }
}

/** A window with its frame, lit from within when the thread is. Glass colours are the village's. */
function pane(pc, x, y, w, h, lit) {
  box(pc, x, y, x + w - 1, y + h - 1, TRIM)
  box(pc, x + 1, y + 1, x + w - 2, y + h - 2, lit ? P.windowLit : P.window)
  if (lit && w > 4 && h > 4) box(pc, x + 2, y + 2, x + w - 3, y + h - 3, P.windowLitCore)
  else if (!lit) pc.px(x + 1, y + 1, P.windowShine)
  if (w >= 5) pc.vline(Math.round(x + (w - 1) / 2), y + 1, y + h - 2, TRIM)
  if (h >= 5) pc.hline(x + 1, x + w - 2, Math.round(y + (h - 1) / 2), TRIM)
  pc.hline(x - 1, x + w, y + h, P.nyeStuccoDark) // the sill
}

/** A door in the plot's colour with a gilt handle and a pale step, its foot on `base`. */
function door(pc, x, base, w, h, accent) {
  const top = base - h + 1
  box(pc, x, top, x + w - 1, base, accent)
  pc.hline(x, x + w - 1, top, shade(accent, 0.2))
  pc.vline(x, top, base, shade(accent, -0.25))
  pc.hline(x + 1, x + w - 2, top + 2, shade(accent, -0.2))
  pc.px(x + w - 2, base - Math.round(h / 2), P.gilt)
  pc.hline(x - 1, x + w, base, P.nyeMarbleDark)
}

/** A string of party lights from (x0, y) to (x1, y), sagging `sag` rows in the middle. */
function stringOf(pc, x0, x1, y, sag, lim = 0, seed = 0) {
  for (let x = x0; x <= x1; x++) {
    const yy = y + Math.round(Math.sin(((x - x0) / Math.max(1, x1 - x0)) * Math.PI) * sag)
    if (yy < lim) continue
    pc.px(x, yy, P.nyeWire)
    if ((x - x0) % 3 === 1) pc.px(x, yy + 1, BULBS[(((x - x0) / 3 | 0) + seed) % BULBS.length])
  }
}

/** A balloon at (cx, cy) with a string down to y. */
function balloonAt(pc, cx, cy, c, y) {
  pc.ellipse(cx + 0.5, cy + 0.5, 2.3, 3, c)
  pc.px(cx - 1, cy - 1, P.nyeSpark[0])
  pc.vline(cx, cy + 4, y, P.nyeFuse)
}

/** A sparkler stood upright at (x, y), its foot on row y: a steel wire and a burst at the top. */
function sparklerAt(pc, x, y, h = 7) {
  pc.vline(x, y - h, y, P.nyeWand)
  const t = y - h - 1
  pc.px(x, t, P.nyeSpark[0])
  pc.px(x - 1, t, P.nyeSpark[1])
  pc.px(x + 1, t, P.nyeSpark[1])
  pc.px(x, t - 1, P.nyeSpark[1])
  pc.px(x, t + 1, P.nyeSpark[2])
  pc.px(x - 2, t - 1, P.nyeSpark[2])
  pc.px(x + 2, t - 1, P.nyeSpark[2])
  pc.px(x - 2, t + 1, P.nyeSpark[1])
  pc.px(x + 2, t + 1, P.nyeSpark[1])
}

/** A gift box, its foot on row y: wrapped in a colour with a gilt ribbon. */
function giftAt(pc, x, y, w, h, c) {
  box(pc, x, y - h + 1, x + w - 1, y, c)
  pc.hline(x, x + w - 1, y - h + 1, shade(c, 0.25))
  pc.vline(x + (w >> 1), y - h + 1, y, P.gilt)
  pc.hline(x, x + w - 1, y - (h >> 1), P.gilt)
  pc.px(x + (w >> 1) - 1, y - h, P.gilt)
  pc.px(x + (w >> 1) + 1, y - h, P.gilt)
}

/** A checked dance floor, two rows deep, from x0 to x1 with its lower row on y. */
function floorStrip(pc, x0, x1, y) {
  for (let x = x0; x <= x1; x++) {
    const a = (x >> 1) & 1
    pc.px(x, y - 1, a ? P.nyeGround[2][2] : P.nyePaint[2])
    pc.px(x, y, a ? P.nyePaint[2] : P.nyeGround[2][1])
  }
}

// ---------- the ground being made ready ----------

function site(pc, rand, stage, oy, variant) {
  const Y = (y) => y + oy
  const [, shadeC, light, deep] = P.nyeGround[0]
  pc.ellipse(16, Y(43), 15.5, 4.5, shadeC)
  for (let i = 0; i < 12; i++) pc.px(2 + Math.floor(rand() * 28), Y(40 + Math.floor(rand() * 7)), i % 2 ? light : deep)
  // Confetti round it, whatever the ground.
  for (let i = 0; i < 9; i++) pc.px(2 + Math.floor(rand() * 28), Y(39 + Math.floor(rand() * 8)), BULBS[i % BULBS.length])
  const left = variant % 2 === 0
  if (stage === 0) {
    // Cleared and marked out: stakes with a string of lights run between them, a balloon at one
    // end and a gift or two waiting.
    for (const dx of [-13, -6, 0, 6, 13]) {
      pc.vline(16 + dx, Y(37), Y(43), P.nyeWand)
      pc.px(16 + dx, Y(37), P.nyeSpark[0])
    }
    stringOf(pc, 3, 29, Y(37), 1, 0, variant)
    balloonAt(pc, left ? 26 : 5, Y(33), P.nyePaint[0], Y(43))
    giftAt(pc, left ? 8 : 20, Y(44), 6, 5, P.nyePaint[2])
    giftAt(pc, left ? 15 : 14, Y(45), 4, 3, P.nyePaint[3])
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
  stringOf(pc, 7, 25, Y(25), 1, 0, variant + 2)
  giftAt(pc, left ? 14 : 6, Y(44), 6, 4, P.nyePaint[1])
  balloonAt(pc, left ? 26 : 5, Y(35), P.nyePaint[5], Y(45))
}

// ---------- party house: a dance floor on the roof, lights strung over it and a disco ball ----------

function partyhouseSpec(low = false) {
  const base = 46
  return { base, wallTop: low ? base - 22 : base - 28 }
}

function partyhouse(pc, o) {
  const s = partyhouseSpec(o.low)
  const lim = ceiling(o.low)
  const r = specRand('partyhouse', o.variant)
  const material = materialOf(r, o.wall)
  const tone = Math.floor(r() * 3)
  const doorLeft = r() < 0.5
  wallOf(pc, 4, s.wallTop, 27, s.base, material, o.rand)
  pc.hline(4, 27, s.base, P.nyeMarbleDark)
  const dx = doorLeft ? 7 : 19
  door(pc, dx, s.base - 1, 6, 11, o.accent)
  // A balloon cluster tied to the door's hinge side, and a gift on the step.
  balloonAt(pc, doorLeft ? 4 : 28, s.base - 14, P.nyePaint[(tone + 1) % 8], s.base - 1)
  balloonAt(pc, doorLeft ? 2 : 30, s.base - 11, P.nyePaint[(tone + 3) % 8], s.base - 1)
  giftAt(pc, doorLeft ? 15 : 12, s.base - 1, 4, 3, P.nyePaint[tone % 3])
  const wx = doorLeft ? 17 : 6
  pane(pc, wx, s.base - 12, 8, 8, o.lit)
  pane(pc, 6, s.wallTop + 3, 6, 7, o.lit)
  pane(pc, 20, s.wallTop + 3, 6, 7, o.lit)
  if (!o.roof) return { x0: 3, x1: 28, top: s.wallTop }
  // The roof is a deck: a parapet in the plot's paint along the front, the dance floor behind it
  // with a rail round, a speaker at one end and a disco ball turning on its pole at the other.
  const color = roofPaintOf(o.roofs, tone)
  box(pc, 3, s.wallTop - 3, 28, s.wallTop, color)
  pc.hline(3, 28, s.wallTop - 3, shade(color, 0.25))
  pc.hline(3, 28, s.wallTop, shade(color, -0.3))
  floorStrip(pc, 4, 27, s.wallTop - 4)
  for (const x of [3, 9, 16, 22, 28]) pc.vline(x, Math.max(lim, s.wallTop - 8), s.wallTop - 4, P.nyeWand)
  stringOf(pc, 3, 28, Math.max(lim, s.wallTop - 9), 2, lim, tone)
  const sx = doorLeft ? 23 : 5
  box(pc, sx, Math.max(lim, s.wallTop - 8), sx + 3, s.wallTop - 4, P.nyeWandDark)
  pc.px(sx + 1, Math.max(lim, s.wallTop - 8) + 1, P.nyeWand)
  pc.px(sx + 2, s.wallTop - 6, P.nyeWand)
  const bx = doorLeft ? 11 : 20
  const by = Math.max(lim + 2, s.wallTop - 7)
  pc.ellipse(bx + 0.5, by + 0.5, 2.4, 2.4, P.nyePaint[7])
  pc.px(bx - 1, by - 1, P.nyeSpark[0])
  pc.px(bx + 1, by + 1, P.nyeWand)
  pc.px(bx, by - 3, P.nyeWand)
  return null
}

// ---------- cabin: logs under snow, a string of lights along the eaves, a sparkler by the door ----------

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
  pc.hline(5, 26, s.base, P.nyeSnowShade)
  const dx = doorLeft ? 8 : 18
  door(pc, dx, s.base - 1, 5, 10, o.accent)
  pane(pc, doorLeft ? 16 : 8, s.wallTop + 5, 7, 6, o.lit)
  // A sparkler stuck in the snow by the step, and a drift against the wall.
  sparklerAt(pc, doorLeft ? 14 : 15, s.base - 1, 6)
  pc.hline(doorLeft ? 22 : 5, doorLeft ? 26 : 9, s.base - 1, P.nyeSnow)
  pc.hline(doorLeft ? 23 : 6, doorLeft ? 25 : 8, s.base - 2, P.nyeSnow)
  if (!o.roof) return { x0: 4, x1: 27, top: s.wallTop }
  for (let y = s.stackTop; y <= s.wallTop; y++) {
    pc.hline(21, 25, y, (y - s.stackTop) % 3 === 2 ? P.fieldstoneDark : P.fieldstone)
    pc.px(21, y, P.fieldstoneLight)
  }
  pc.hline(20, 26, s.stackTop, P.nyeSnow)
  const yBot = s.wallTop - 1
  roofOver(pc, 2, 29, yBot, 11, roofPaintOf(o.roofs, tone), lim)
  // Snow lying along the slopes.
  const mid = 15.5
  for (let x = 2; x <= 29; x++) {
    const y = Math.max(lim, yBot - 11 + Math.round((Math.abs(x - mid) / 13.5) * 11))
    pc.px(x, y, P.nyeSnow)
    pc.px(x, y + 1, x % 3 ? P.nyeSnow : P.nyeSnowShade)
  }
  for (let y = s.stackTop; y <= s.wallTop - 7; y++) {
    pc.hline(21, 25, y, (y - s.stackTop) % 3 === 2 ? P.fieldstoneDark : P.fieldstone)
    pc.px(21, y, P.fieldstoneLight)
  }
  pc.hline(20, 26, s.stackTop, P.nyeSnow)
  // The string of lights along the eaves.
  stringOf(pc, 3, 28, yBot + 2, 1, lim, tone)
  return null
}

// ---------- clock tower: the face at one minute to midnight, a spire, an entrance below ----------

function clocktower(pc, o) {
  const r = specRand('clocktower', o.variant)
  const tone = Math.floor(r() * 3)
  const material = materialOf(r, o.wall)
  const base = 46
  const lim = ceiling(o.low)
  const top = o.low ? base - 24 : base - 30
  // The entrance hall at the foot, then the tower standing out of it.
  wallOf(pc, 9, top, 22, base - 9, material, o.rand)
  wallOf(pc, 4, base - 10, 27, base, material, o.rand)
  pc.hline(4, 27, base, P.nyeMarbleDark)
  pc.hline(3, 28, base - 10, P.gilt)
  pc.hline(3, 28, base - 11, P.giltDark)
  door(pc, 13, base - 1, 6, 10, o.accent)
  pane(pc, 6, base - 8, 5, 6, o.lit)
  pane(pc, 21, base - 8, 5, 6, o.lit)
  // The face: a gilt ring round champagne, the hands a minute from twelve, ticks at the quarters.
  const cy = top + 7
  pc.ellipse(16.5, cy + 0.5, 5.8, 5.8, P.gilt)
  pc.ellipse(16.5, cy + 0.5, 4.7, 4.7, P.nyeClockFace)
  for (const [x, y] of [[16, cy - 4], [16, cy + 5], [12, cy], [21, cy]]) pc.px(x, y, P.nyeWandDark)
  pc.line(16, cy, 15, cy - 2, P.nyeWandDark) // the hour hand, almost at twelve
  pc.line(16, cy, 16, cy - 3, P.nyePaint[0]) // the minute hand, a minute short
  pc.px(16, cy, P.giltDark)
  // A cornice under the face, and a lit slit window below that when there is room.
  pc.hline(8, 23, cy + 7, P.gilt)
  pc.hline(8, 23, cy + 8, P.giltDark)
  if (cy + 12 < base - 12) pane(pc, 14, cy + 10, 4, 5, o.lit)
  // Streamers from the cornice to the hall roof, either side.
  for (const [x0, x1] of [[9, 4], [22, 27]]) pc.line(x0, cy + 8, x1, base - 11, BULBS[(tone + x0) % BULBS.length])
  if (!o.roof) return { x0: 8, x1: 23, top }
  // The spire, in the plot's paint, with a gilt ball and a pole.
  const spire = roofOver(pc, 8, 23, top - 1, 9, roofPaintOf(o.roofs, tone), lim)
  const fy = Math.max(lim, spire - 3)
  if (fy < spire) {
    pc.vline(16, fy, spire, P.nyeWand)
    pc.px(16, fy, P.gilt)
    pc.px(15, fy, P.nyeSpark[1])
    pc.px(17, fy, P.nyeSpark[1])
  }
  return null
}

// ---------- ballroom: marble and gilt, tall windows each with a chandelier ----------

function ballroom(pc, o) {
  const r = specRand('ballroom', o.variant)
  const tone = Math.floor(r() * 3)
  const material = r() < 0.6 ? 'marble' : materialOf(r, o.wall)
  const base = 46
  const lim = ceiling(o.low)
  const eave = o.low ? base - 20 : base - 24
  wallOf(pc, 3, eave, 28, base, material, o.rand)
  pc.hline(3, 28, base, P.nyeMarbleDark)
  pc.hline(3, 28, eave, P.gilt)
  pc.hline(3, 28, eave + 1, P.giltDark)
  // Pilasters between the windows, gilt-capped.
  for (const x of [3, 11, 20, 27]) {
    box(pc, x, eave + 2, x + 1, base - 1, P.nyeMarbleLight)
    pc.vline(x + 1, eave + 2, base - 1, P.nyeMarbleDark)
    pc.px(x, eave + 2, P.gilt)
    pc.px(x + 1, eave + 2, P.gilt)
  }
  // Three tall windows. Lit, a chandelier hangs in each: a gilt hoop with a crystal at each end.
  for (const x of [5, 14, 22]) {
    const wy = eave + 4
    const h = base - 18 - wy + 3
    pane(pc, x, wy, 5, Math.max(7, h), o.lit)
    if (o.lit) {
      pc.hline(x + 1, x + 3, wy + 2, P.gilt)
      pc.px(x + 1, wy + 3, P.glitterGlow)
      pc.px(x + 3, wy + 3, P.glitterGlow)
      pc.px(x + 2, wy + 3, P.nyeSpark[0])
    }
  }
  // The double door under a gilt sign, with a magenta carpet down the steps.
  door(pc, 13, base - 1, 6, 12, o.accent)
  pc.vline(16, base - 12, base - 1, P.giltDark)
  box(pc, 12, base - 16, 19, base - 14, P.gilt)
  pc.px(14, base - 15, P.nyeSpark[0])
  pc.px(17, base - 15, P.nyeSpark[0])
  pc.hline(13, 18, base, P.nyePaint[0])
  if (!o.roof) return { x0: 2, x1: 29, top: eave }
  // The roof: a low hip in the plot's paint, a gilt cresting along it and a pennant at each end.
  const roof = roofOver(pc, 1, 30, eave - 1, o.low ? 7 : 9, roofPaintOf(o.roofs, tone), lim)
  for (let x = 4; x <= 27; x += 3) if (roof - 1 >= lim) pc.px(x, roof - 1, P.gilt)
  for (const x of [3, 28]) {
    const y0 = Math.max(lim, eave - 7)
    pc.vline(x, y0, eave - 2, P.nyeWand)
    pc.hline(x + (x < 16 ? 1 : -2), x + (x < 16 ? 2 : -1), y0, P.nyePaint[(tone + x) % 3])
    pc.hline(x + (x < 16 ? 1 : -2), x + (x < 16 ? 2 : -1), y0 + 1, P.nyePaint[(tone + x) % 3])
  }
  return null
}

// ---------- bandstand: a stage under a canopy, a drum kit, a microphone, a curtain of tinsel ----------

function bandstand(pc, o) {
  const r = specRand('bandstand', o.variant)
  const tone = Math.floor(r() * 3)
  const base = 46
  const top = base - 26
  // The stage floor, its front edge hung with lights.
  box(pc, 2, base - 5, 29, base, P.barnTimber)
  pc.hline(2, 29, base - 5, P.barnTimberLight)
  pc.hline(2, 29, base, P.barnTimberDark)
  for (let x = 3; x <= 28; x += 3) pc.px(x, base - 3, BULBS[((x - 3) / 3 + tone) % BULBS.length])
  // Posts either side.
  for (const x of [3, 28]) {
    pc.vline(x, top, base - 6, P.nyeWand)
    pc.vline(x + 1, top, base - 6, P.nyeWandDark)
  }
  if (!o.roof) return null
  // The backdrop: a curtain of violet tinsel in folds, a gilt star at its middle.
  box(pc, 5, top + 4, 26, base - 6, P.nyePaint[3])
  for (let x = 6; x <= 25; x += 3) pc.vline(x, top + 4, base - 6, P.nyePaint[0])
  for (let x = 7; x <= 25; x += 3) pc.vline(x, top + 5, base - 7, shade(P.nyePaint[3], 0.25))
  pc.px(16, top + 8, P.gilt)
  pc.hline(15, 17, top + 9, P.gilt)
  pc.px(16, top + 10, P.gilt)
  // The canopy: a striped awning in the plot's colours, scalloped along its hem.
  const a = roofPaintOf(o.roofs, tone)
  const b = TRIM
  for (let x = 1; x <= 30; x++) {
    const c = ((x >> 2) & 1) ? b : a
    box(pc, x, top, x, top + 3, c)
    pc.px(x, top + 4 + (x % 4 === 1 || x % 4 === 2 ? 1 : 0), shade(c, -0.15))
  }
  pc.hline(1, 30, top, shade(a, 0.25))
  for (let x = 3; x <= 28; x += 5) pc.px(x, top - 1, BULBS[(x + tone) % BULBS.length])
  // The drum kit: a bass drum front on, a snare either side with a cymbal over one.
  const dy = base - 6
  pc.ellipse(10.5, dy - 3.5, 3.4, 3.4, P.nyePaint[0])
  pc.ellipse(10.5, dy - 3.5, 1.6, 1.6, P.nyePaint[4])
  pc.hline(6, 14, dy, P.nyeWandDark)
  pc.hline(14, 17, dy - 6, P.gilt)
  pc.vline(15, dy - 5, dy, P.nyeWand)
  // The singer's microphone stand, and a speaker.
  pc.vline(21, dy - 8, dy, P.nyeWand)
  pc.px(21, dy - 9, P.nyeWandDark)
  pc.px(22, dy - 9, P.nyeWand)
  box(pc, 23, dy - 6, 26, dy, P.nyeWandDark)
  pc.px(24, dy - 4, P.nyeWand)
  pc.px(25, dy - 2, P.nyeWand)
  return null
}

// ---------- drawing one ----------

const KINDS = { partyhouse, cabin, clocktower, ballroom, bandstand }
/** The stage stands on the ground: it needs no staging. */
const NO_STAGING = new Set(['bandstand'])

/**
 * @param {{ kind: string, stage: number, accent: string, variant: number, lit: boolean, frame?: number, wall?: number, roofs?: number, low?: boolean, wear?: number, grade?: number }} o
 */
export function drawPartyBuilding(o) {
  const kind = KINDS[o.kind] ? o.kind : 'cabin'
  const variant = o.variant || 0
  const pc = new PixelCanvas(BUILDING_W, HEIGHT)
  const seed = variant * 6151 + 73
  if (o.stage <= 1) {
    site(pc, mulberry32(seed), o.stage, 0, variant)
    return pc.outline(P.outline)
  }
  const draw = KINDS[kind]
  const opts = {
    rand: mulberry32(seed), accent: o.accent || P.nyePaint[0], lit: Boolean(o.lit), roof: o.stage >= 3, variant,
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
