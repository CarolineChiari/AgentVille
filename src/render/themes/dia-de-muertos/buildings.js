// Día de los Muertos buildings: what each thread builds in a village keeping the Day of the Dead,
// drawn the way the village's buildings are (src/render/sprites/buildings.js): the plot's wall
// material and paint family on them, its accent on the doors and awnings, and a finished one
// weathered by its wear.
//
// Contract (see ThemePack in ../index.js and the village's src/render/sprites/buildings.js):
// - A thread's building kind (KINDS in src/sim/building.js) maps to one of these through `fitted`.
// - Every sprite is BUILDING_W (32) wide and 48 tall, its bottom row on the ground. Down a
//   courtyard's sides (`fitted(kind, variant, false)`) nothing is drawn above row DOORSTEP_CLEAR
//   (9), outline included, at every stage: the villager at the door of the house above stands there.
// - Stages 0 and 1 are the ground being made ready; 2 is the building without its roof
//   (`roof: false`) inside a staging of poles and ladders; 3 is finished. Stage 3 is weathered by
//   `wear` exactly as the village's buildings are (see drawBuilding there).
// - `wall` indexes THEMES['dia-de-muertos'].dims.wall; `roofs` its paint families; `accent` is the
//   plot's colour, for doors and awnings. Every colour from the palette.
//
// Windows keep the village's glass colours and its warm lit yellow: the weathering pass finds
// windows by those exact colours (GLASS_COLORS in weathering.js).
//
// The framing parts (a window, a door, a pitched roof, the poles of the staging) are the farm's
// own, as every festival theme's are. What is drawn here is the festival on them: papel picado
// under the eaves, an arch of cempasúchil over the door, candles on the step, and the ofrenda.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { BUILDING_W, DOORSTEP_CLEAR, drawGradeTrim } from '../../sprites/buildings.js'
import { lookFor, weather } from '../../sprites/weathering.js'
import { mulberry32, pick, rngFor } from '../../../sim/rng.js'
import { THEMES } from '../../../sim/themes.js'
import { KEPT } from '../../../sim/wear.js'
import { box, doorOf, paneOf, roofOver, staging } from '../farm/buildings.js'

/** A thread's building, by its kind, in a village keeping the Day of the Dead. */
export const MUERTOS_KINDS = {
  house: 'casa', cottage: 'casita', shop: 'panaderia', barn: 'mercado', windmill: 'mercado',
  workshop: 'casita', well: 'ofrenda', farm: 'mercado', tower: 'casa', greenhouse: 'panaderia', stall: 'ofrenda',
}
const MATERIALS = THEMES['dia-de-muertos'].dims.wall
/**
 * The paint a plot's buildings share, by its `roofs`: three related colours each, as indices into
 * the palette's muertosPaint (rosa mexicano, cempasúchil, turquoise, violet, yellow, cream, cobalt,
 * lime). One family per sub-theme, which is what tells one street from the next.
 */
const PAINT_FAMILIES = [[0, 4, 5], [1, 0, 5], [2, 6, 5], [3, 1, 5]]
/** The cream every trim, sill and window frame is painted. */
const TRIM = P.muertosPaint[5]
/** The colours papel picado is cut from, in the order a string of it is hung. */
const PICADO = [P.muertosPaint[0], P.muertosPaint[1], P.muertosPaint[2], P.muertosPaint[3], P.muertosPaint[4], P.muertosPaint[7]]
const HEIGHT = 48
/** The highest row anything may be drawn on, leaving the outline its row above. */
const ceiling = (low) => (low ? DOORSTEP_CLEAR + 1 : 1)

export function fitted(kind, variant, roomy) {
  return { kind: MUERTOS_KINDS[kind] || 'casita', low: !roomy }
}

export const heightOf = () => HEIGHT

/** The ofrenda stands narrower than a house; the rest stand as wide as their plot. */
export function shadowOf(kind) {
  return kind === 'ofrenda' ? 30 : kind === 'casita' ? 30 : 34
}

/** Nothing here moves: the smoke and the candlelight do that. */
export const buildingFrames = () => 1

/** Where smoke leaves a finished building: the casa's and the casita's chimneys, the panadería's oven. */
export function chimneyOf(kind, variant = 0, wall = 0, roofs = 0, low = false) {
  if (kind === 'casa') return { x: 25, y: casaSpec(low).stackTop }
  if (kind === 'casita') return { x: 24, y: casitaSpec(low).stackTop }
  if (kind === 'panaderia') return { x: 24, y: panaderiaSpec(low).stackTop }
  return null
}

// ---------- shared parts ----------

const specRand = (kind, variant) => rngFor(`muertos:${kind}:${variant}`)
/** A roof's or an awning's paint: the first two of the family; the cream is for trim. */
const roofPaintOf = (roofs, i) => {
  const f = PAINT_FAMILIES[(roofs || 0) % PAINT_FAMILIES.length]
  return P.muertosPaint[f[Math.abs(Math.floor(i)) % 2]]
}
const materialOf = (r, wall) => (r() < 0.7 ? MATERIALS[(wall || 0) % MATERIALS.length] : pick(r, MATERIALS))

/** A wall of one of the theme's five materials, x0..x1 by y0..y1. */
function wallOf(pc, x0, y0, x1, y1, material, rand) {
  if (material === 'pinkwash' || material === 'bluewash') {
    // Stucco washed a bright colour: smooth, flecked a shade darker, light along the top, a
    // painted band along its foot.
    const [base, dark, light] = material === 'pinkwash'
      ? [P.muertosPink, P.muertosPinkDark, P.muertosPinkLight]
      : [P.muertosBlue, P.muertosBlueDark, P.muertosBlueLight]
    box(pc, x0, y0, x1, y1, base)
    pc.hline(x0, x1, y0, light)
    for (let i = 0; i < 6; i++) pc.px(x0 + Math.floor(rand() * (x1 - x0 + 1)), y0 + 1 + Math.floor(rand() * (y1 - y0)), dark)
    pc.hline(x0, x1, y1 - 2, dark)
    pc.hline(x0, x1, y1 - 1, dark)
  } else if (material === 'adobe') {
    // Sun-dried adobe bricks under a thin render, the courses showing through where it has worn.
    box(pc, x0, y0, x1, y1, P.muertosAdobe)
    for (let y = y0; y <= y1; y++) {
      const row = y - y0
      const off = (Math.floor(row / 3) % 2) * 3
      for (let x = x0; x <= x1; x++) {
        const u = (x - x0 + off) % 6
        if (row % 3 === 2 && rand() < 0.6) pc.px(x, y, P.muertosAdobeDark)
        else if (u === 5 && row % 3 !== 2 && rand() < 0.4) pc.px(x, y, P.muertosAdobeDark)
      }
    }
    pc.hline(x0, x1, y0, P.muertosAdobeLight)
    pc.vline(x0, y0, y1, P.muertosAdobeLight)
  } else if (material === 'talavera') {
    // Talavera tile: white glaze, a cobalt flower on every tile, the grout between them.
    box(pc, x0, y0, x1, y1, P.talavera)
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const u = (x - x0) % 5
        const v = (y - y0) % 5
        if (u === 4 || v === 4) pc.px(x, y, P.talaveraDark)
        else if ((u === 1 || u === 3) && (v === 1 || v === 3)) pc.px(x, y, P.talaveraBlue)
        else if (u === 2 && v === 2) pc.px(x, y, P.muertosPaint[4])
      }
    }
    pc.hline(x0, x1, y0, P.white)
  } else {
    // Pink cantera, the volcanic stone of a church front: dressed blocks in courses, each lit along its top.
    box(pc, x0, y0, x1, y1, P.cantera)
    for (let y = y0; y <= y1; y++) {
      const row = y - y0
      const off = (Math.floor(row / 4) % 2) * 5
      for (let x = x0; x <= x1; x++) {
        const u = (x - x0 + off) % 10
        if (row % 4 === 3 || u === 9) pc.px(x, y, P.canteraDark)
        else if (row % 4 === 0) pc.px(x, y, P.canteraLight)
      }
    }
  }
}

/**
 * A string of papel picado from x0 to x1, its cord on row y: little cut-paper flags in turn, each
 * with a hole cut through it. Only drawn where its flags would hang below the ceiling `lim`.
 */
function picadoRow(pc, x0, x1, y, lim, sag = 1) {
  if (y < lim) return
  const n = x1 - x0
  for (let x = x0; x <= x1; x++) {
    const dy = Math.round(Math.sin(((x - x0) / Math.max(1, n)) * Math.PI) * sag)
    pc.px(x, y + dy, P.muertosIron)
    const k = x - x0
    if (k % 4 === 3) continue
    const c = PICADO[Math.floor(k / 4) % PICADO.length]
    pc.px(x, y + dy + 1, c)
    pc.px(x, y + dy + 2, k % 4 === 1 ? shade(c, 0.45) : c)
    if (k % 4 !== 1) pc.px(x, y + dy + 3, shade(c, -0.2))
  }
}

/** A bloom of cempasúchil at (x, y), two by two: deep orange round a gold heart. */
function bloom(pc, x, y, i = 0) {
  pc.px(x, y, i % 2 ? P.marigold : P.marigoldDeep)
  pc.px(x + 1, y, P.marigold)
  pc.px(x, y + 1, P.marigold)
  pc.px(x + 1, y + 1, i % 3 ? P.marigoldLight : P.marigold)
}

/**
 * The arch of cempasúchil the family builds over the door (the arco), from x0 to x1, standing on
 * row `base`, its crown on row `top`: blooms all the way up both sides and across.
 */
function marigoldArch(pc, x0, x1, top, base) {
  let i = 0
  for (let y = base - 1; y > top + 1; y -= 2) {
    bloom(pc, x0, y, i++)
    bloom(pc, x1 - 1, y, i++)
  }
  for (let x = x0; x <= x1 - 1; x += 2) bloom(pc, x, top + (x === x0 || x >= x1 - 2 ? 1 : 0), i++)
}

/** A candle on row y at column x: a stub of wax and its flame. Candles burn day and night for the dead. */
function candleAt(pc, x, y, h = 2) {
  pc.vline(x, y - h + 1, y, P.candleWax)
  pc.px(x, y, P.candleWaxDark)
  pc.px(x, y - h, P.flameTip)
  pc.px(x, y - h - 1, P.glowCandle)
}

/** A sugar skull at (x, y), three wide with its chin on row y: white icing, dark eyes, a coloured crown. */
function skullAt(pc, x, y, c = P.muertosPaint[0]) {
  pc.hline(x, x + 2, y - 2, P.sugarSkull)
  pc.hline(x, x + 2, y - 1, P.sugarSkull)
  pc.px(x + 1, y, P.sugarSkullShade)
  pc.px(x, y - 1, P.muertosIron)
  pc.px(x + 2, y - 1, P.muertosIron)
  pc.px(x + 1, y - 3, c)
}

/** A pan de muerto at (x, y), four wide on row y: a round loaf, its bone crossing on top, sugared. */
function panAt(pc, x, y) {
  pc.hline(x, x + 3, y, P.panMuertoDark)
  pc.hline(x, x + 3, y - 1, P.panMuerto)
  pc.hline(x + 1, x + 2, y - 2, P.panMuerto)
  pc.px(x + 1, y - 1, P.sugarDust)
  pc.px(x + 2, y - 2, P.sugarDust)
}

/** A bucket of cut cempasúchil at (cx, y), `h` rows tall, for sale or for the graves. */
function bunchAt(pc, cx, y, h = 9) {
  pc.rect(cx - 2, y - 3, 5, 4, P.muertosIronLight)
  pc.hline(cx - 2, cx + 2, y - 3, P.headstoneLight)
  const top = y - Math.min(h, 9)
  for (let i = y - 4; i > top + 2; i--) pc.px(cx + ((i & 1) ? 0 : -1), i, P.palmGreenDark)
  const heads = [[-2, 1], [1, 0], [-1, -1], [2, 2], [0, 2]]
  heads.forEach(([dx, dy], i) => bloom(pc, cx + dx - 1, top + dy, i))
}

/** A bloom of cempasúchil set on the ridge at column cx, if there is room under the ceiling `lim`. */
function finial(pc, cx, top, lim) {
  if (top - 3 < lim) return
  pc.px(cx, top - 1, P.palmGreenDark)
  pc.hline(cx - 1, cx + 1, top - 2, P.marigold)
  pc.px(cx, top - 2, P.marigoldLight)
  pc.hline(cx - 1, cx + 1, top - 3, P.marigoldDeep)
}

// ---------- the ground being made ready ----------

function site(pc, rand, stage, variant) {
  const [, shadeC, light, deep] = P.muertosGround[1]
  pc.ellipse(16, 43, 15.5, 4.5, shadeC)
  for (let i = 0; i < 12; i++) pc.px(2 + Math.floor(rand() * 28), 40 + Math.floor(rand() * 7), i % 2 ? light : deep)
  // Petals strewn round it, whatever the ground: the path the dead follow home.
  for (let i = 0; i < 9; i++) pc.px(2 + Math.floor(rand() * 28), 39 + Math.floor(rand() * 8), [P.marigold, P.marigoldLight, P.muertosPaint[0]][i % 3])
  const left = variant % 2 === 0
  if (stage === 0) {
    // Cleared and marked out: stakes with a cord run between them, a bucket of marigolds at one
    // end and a candle or two set out.
    for (const dx of [-13, -6, 0, 6, 13]) {
      pc.vline(16 + dx, 37, 43, P.barnTimber)
      pc.px(16 + dx, 37, P.barnTimberLight)
    }
    picadoRow(pc, 3, 29, 37, 1, 1)
    bunchAt(pc, left ? 26 : 5, 45, 9)
    candleAt(pc, left ? 9 : 22, 45, 3)
    candleAt(pc, left ? 12 : 19, 45, 2)
    return
  }
  // The frame up: a sill on the ground, corner posts and a wall plate, studs between them, a
  // ladder against it and adobe bricks stacked at its foot.
  box(pc, 4, 41, 27, 43, P.barnTimberDark)
  pc.hline(4, 27, 41, P.barnTimber)
  for (const x of [7, 24]) {
    box(pc, x, 27, x + 1, 41, P.barnTimber)
    pc.vline(x, 27, 41, P.barnTimberLight)
  }
  pc.hline(6, 26, 26, P.barnTimberLight)
  pc.hline(6, 26, 27, P.barnTimberDark)
  for (let x = 11; x <= 21; x += 5) pc.vline(x, 28, 40, P.barnTimberDark)
  pc.line(8, 40, 23, 28, P.barnTimber)
  const lx = left ? 2 : 29
  const dx = left ? 1 : -1
  pc.line(lx, 43, lx + dx * 5, 24, P.barnTimberLight)
  pc.line(lx + dx, 43, lx + dx * 6, 24, P.barnTimber)
  for (let i = 0; i < 6; i++) {
    const t = i / 6
    pc.hline(lx + Math.round(dx * t * 5), lx + Math.round(dx * (1 + t * 5)), 42 - i * 3, P.barnTimberDark)
  }
  const bx = left ? 14 : 6
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 3; i++) {
      pc.rect(bx + i * 3 + row, 43 - row * 2, 3, 2, P.muertosAdobe)
      pc.px(bx + i * 3 + row, 43 - row * 2, P.muertosAdobeLight)
    }
  }
  candleAt(pc, left ? 26 : 5, 45, 2)
}

// ---------- casa: the family home, an arch of marigolds over the door and papel picado under the eaves ----------

function casaSpec(low = false) {
  const base = 46
  const wallTop = low ? base - 22 : base - 28
  return { base, wallTop, stackTop: Math.max(DOORSTEP_CLEAR + 1, wallTop - 11) }
}

function casa(pc, o) {
  const s = casaSpec(o.low)
  const lim = ceiling(o.low)
  const r = specRand('casa', o.variant)
  const material = materialOf(r, o.wall)
  const tone = Math.floor(r() * 3)
  const doorLeft = r() < 0.5
  wallOf(pc, 4, s.wallTop, 27, s.base, material, o.rand)
  pc.hline(4, 27, s.base, P.canteraDark)
  const dx = doorLeft ? 7 : 19
  doorOf(pc, dx, s.base - 1, 6, 11, o.accent)
  marigoldArch(pc, dx - 2, dx + 7, s.base - 14, s.base - 1)
  // A window beside the door with a sugar skull and a loaf on its sill, and two above.
  const wx = doorLeft ? 18 : 6
  paneOf(pc, wx, s.base - 11, 7, 7, o.lit)
  pc.hline(wx - 1, wx + 7, s.base - 4, TRIM)
  skullAt(pc, wx, s.base - 5, roofPaintOf(o.roofs, tone + 1))
  panAt(pc, wx + 3, s.base - 5)
  paneOf(pc, 6, s.wallTop + 3, 6, 7, o.lit)
  paneOf(pc, 20, s.wallTop + 3, 6, 7, o.lit)
  // Candles along the step, and a bucket of cempasúchil at the far end of the wall.
  for (const x of doorLeft ? [15, 17] : [14, 16]) candleAt(pc, x, s.base - 1, 2)
  bunchAt(pc, doorLeft ? 29 : 2, s.base, 10)
  if (!o.roof) return { x0: 3, x1: 28, top: s.wallTop }
  const color = roofPaintOf(o.roofs, tone)
  const top = roofOver(pc, 1, 30, s.wallTop - 1, 10, color, lim)
  finial(pc, 16, top, lim)
  // The chimney at the gable end, of cantera.
  for (let y = s.stackTop; y <= s.wallTop - 6; y++) {
    pc.hline(23, 27, y, (y - s.stackTop) % 3 === 2 ? P.canteraDark : P.cantera)
    pc.px(23, y, P.canteraLight)
  }
  pc.hline(22, 28, s.stackTop, P.canteraLight)
  // Papel picado strung under the eaves, across the whole front.
  picadoRow(pc, 4, 27, s.wallTop, lim, 2)
  if (!o.low) paneOf(pc, (doorLeft ? 11 : 20) - 2, top + 6, 5, 4, o.lit)
  return null
}

// ---------- casita: a small adobe house, a stack of firewood and a candle in the window ----------

function casitaSpec(low = false) {
  const base = 46
  const wallTop = low ? base - 18 : base - 22
  return { base, wallTop, stackTop: Math.max(DOORSTEP_CLEAR + 1, wallTop - 10) }
}

function casita(pc, o) {
  const s = casitaSpec(o.low)
  const lim = ceiling(o.low)
  const r = specRand('casita', o.variant)
  const tone = Math.floor(r() * 3)
  const doorLeft = r() < 0.5
  // A casita is adobe more often than not, whatever else the plot is built of.
  const material = r() < 0.6 ? 'adobe' : materialOf(r, o.wall)
  wallOf(pc, 5, s.wallTop, 26, s.base, material, o.rand)
  pc.hline(5, 26, s.base, P.canteraDark)
  const dx = doorLeft ? 8 : 18
  doorOf(pc, dx, s.base - 1, 5, 10, o.accent)
  pc.hline(dx, dx + 4, s.base - 5, shade(o.accent, -0.3))
  // Marigolds hung either side of the door in a garland.
  for (let y = s.base - 10; y <= s.base - 2; y += 2) {
    bloom(pc, dx - 2, y, y)
    bloom(pc, dx + 5, y, y + 1)
  }
  paneOf(pc, doorLeft ? 16 : 8, s.wallTop + 5, 7, 6, o.lit)
  // Firewood stacked at the other end, and candles on the step.
  const wx = doorLeft ? 23 : 1
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 4; i++) {
      pc.rect(wx + i * 2 - (row % 2), s.base - 2 - row * 2, 2, 2, P.barnTimber)
      pc.px(wx + i * 2 - (row % 2), s.base - 2 - row * 2, P.barnTimberLight)
    }
  }
  candleAt(pc, doorLeft ? 14 : 15, s.base - 1, 3)
  candleAt(pc, doorLeft ? 16 : 13, s.base - 1, 2)
  if (!o.roof) return { x0: 4, x1: 27, top: s.wallTop }
  const stack = () => {
    for (let y = s.stackTop; y <= s.wallTop - 7; y++) {
      pc.hline(21, 25, y, (y - s.stackTop) % 3 === 2 ? P.muertosAdobeDark : P.muertosAdobe)
      pc.px(21, y, P.muertosAdobeLight)
    }
    pc.hline(20, 26, s.stackTop, P.muertosAdobeLight)
  }
  stack()
  roofOver(pc, 2, 29, s.wallTop - 1, 11, roofPaintOf(o.roofs, tone), lim)
  stack()
  picadoRow(pc, 5, 26, s.wallTop, lim, 1)
  return null
}

// ---------- panadería: pan de muerto in the window, a striped awning, the oven's chimney ----------

function panaderiaSpec(low = false) {
  const base = 46
  const wallTop = low ? base - 22 : base - 26
  return { base, wallTop, stackTop: Math.max(DOORSTEP_CLEAR + 1, wallTop - 10) }
}

function panaderia(pc, o) {
  const s = panaderiaSpec(o.low)
  const lim = ceiling(o.low)
  const r = specRand('panaderia', o.variant)
  const material = r() < 0.6 ? pick(r, ['pinkwash', 'talavera']) : materialOf(r, o.wall)
  const tone = Math.floor(r() * 3)
  const doorLeft = r() < 0.5
  wallOf(pc, 4, s.wallTop, 27, s.base, material, o.rand)
  pc.hline(4, 27, s.base, P.canteraDark)
  const wx = doorLeft ? 13 : 4
  paneOf(pc, wx, s.base - 14, 14, 9, o.lit)
  // Loaves of pan de muerto on the shelf across the shop window.
  pc.hline(wx + 1, wx + 12, s.base - 7, P.barnTimberDark)
  for (const i of [0, 1, 2]) panAt(pc, wx + 1 + i * 4, s.base - 8)
  doorOf(pc, doorLeft ? 6 : 22, s.base - 1, 5, 12, o.accent)
  // The sign across the front: a loaf painted on the plot's paint.
  const fx = doorLeft ? 4 : 15
  const sign = roofPaintOf(o.roofs, tone + 1)
  box(pc, fx, s.wallTop + 2, fx + 12, s.wallTop + 8, sign)
  pc.hline(fx, fx + 12, s.wallTop + 2, shade(sign, 0.2))
  pc.hline(fx, fx + 12, s.wallTop + 8, shade(sign, -0.3))
  panAt(pc, fx + 5, s.wallTop + 6)
  // A candle either side of the door.
  for (const x of doorLeft ? [5, 12] : [21, 28]) candleAt(pc, x, s.base - 1, 2)
  if (!o.roof) return { x0: 3, x1: 28, top: s.wallTop }
  const stack = (to) => {
    for (let y = s.stackTop; y <= to; y++) {
      pc.hline(23, 26, y, (y - s.stackTop) % 3 === 2 ? P.brickDark : P.brick)
      pc.px(23, y, P.brickDark)
    }
    pc.hline(22, 27, s.stackTop, P.brickDark)
  }
  stack(s.wallTop - 5)
  roofOver(pc, 1, 30, s.wallTop - 1, 9, roofPaintOf(o.roofs, tone), lim)
  stack(s.wallTop - 8)
  // The awning over the window, striped in the plot's colour and cream.
  for (let x = wx - 1; x <= wx + 14; x++) {
    const c = ((x >> 1) & 1) ? o.accent : TRIM
    pc.px(x, s.base - 16, c)
    pc.px(x, s.base - 15, shade(c, -0.22))
  }
  pc.hline(wx - 1, wx + 14, s.base - 17, P.barnTimberDark)
  return null
}

// ---------- mercado: a market hall thrown open, buckets of cempasúchil out front ----------

function mercado(pc, o) {
  const r = specRand('mercado', o.variant)
  const tone = Math.floor(r() * 3)
  const material = r() < 0.6 ? pick(r, ['cantera', 'bluewash']) : materialOf(r, o.wall)
  const base = 46
  const eave = o.low ? base - 20 : base - 24
  const lim = ceiling(o.low)
  wallOf(pc, 3, eave, 28, base, material, o.rand)
  pc.hline(3, 28, base, P.canteraDark)
  // The arched opening: a dark hall behind, its arch trimmed in cream.
  const dy = base - 15
  box(pc, 9, dy, 22, base - 1, o.lit ? P.windowLit : P.interior)
  if (o.lit) box(pc, 11, dy + 3, 20, base - 3, P.windowLitCore)
  pc.hline(11, 20, dy - 1, TRIM)
  pc.px(10, dy, TRIM)
  pc.px(21, dy, TRIM)
  pc.vline(9, dy + 1, base - 1, TRIM)
  pc.vline(22, dy + 1, base - 1, TRIM)
  pc.px(9, dy, shade(TRIM, -0.2))
  pc.px(22, dy, shade(TRIM, -0.2))
  // Bunches heaped on the counter inside.
  pc.hline(10, 21, base - 6, P.barnTimberLight)
  pc.rect(10, base - 5, 12, 4, P.barnTimberDark)
  for (let x = 11; x <= 19; x += 3) bloom(pc, x, base - 8, x)
  paneOf(pc, 4, base - 13, 4, 5, o.lit)
  paneOf(pc, 24, base - 13, 4, 5, o.lit)
  // Outside: buckets of cempasúchil either side of the door.
  bunchAt(pc, 6, base, 9)
  bunchAt(pc, 26, base, 8)
  if (!o.roof) return { x0: 2, x1: 29, top: eave }
  const top = roofOver(pc, 1, 30, eave - 1, o.low ? 10 : 13, roofPaintOf(o.roofs, tone), lim)
  finial(pc, 16, top, lim)
  // Papel picado strung from the eaves, two strings, where there is room for the second.
  picadoRow(pc, 3, 28, eave, lim, 2)
  if (!o.low && top + 4 < eave - 3) picadoRow(pc, 7, 24, top + 5, lim, 1)
  return null
}

// ---------- ofrenda: the family altar set out in the open, tier on tier under an arch of marigolds ----------

function ofrenda(pc, o) {
  const base = 46
  const lim = ceiling(o.low)
  const r = specRand('ofrenda', o.variant)
  const cloth = roofPaintOf(o.roofs, Math.floor(r() * 3))
  // Three tiers, each draped in cloth: the earth, the living and, on top, the heavens.
  const tiers = [[5, 26, base - 6, 6], [8, 23, base - 12, 6], [11, 20, base - 17, 5]]
  tiers.forEach(([x0, x1, y, h], i) => {
    const c = i === 1 ? TRIM : cloth
    pc.rect(x0, y, x1 - x0 + 1, h, c)
    pc.hline(x0, x1, y, shade(c, 0.25))
    // The cloth's hem, cut like papel picado.
    for (let x = x0; x <= x1; x += 2) pc.px(x, y + h - 1, shade(c, -0.3))
  })
  if (!o.roof) return null
  // On the tiers: pan and candles below, sugar skulls in the middle, photographs at the top.
  panAt(pc, 6, base - 7)
  panAt(pc, 22, base - 7)
  for (const x of [12, 14, 17, 19]) candleAt(pc, x, base - 7, x % 2 ? 3 : 2)
  skullAt(pc, 9, base - 13, P.muertosPaint[2])
  skullAt(pc, 20, base - 13, P.muertosPaint[0])
  bloom(pc, 13, base - 14, 0)
  bloom(pc, 17, base - 14, 1)
  // Framed photographs of the ones remembered, a face's light on each.
  for (const x of [11, 17]) {
    pc.rect(x, base - 22, 4, 5, P.barnTimberDark)
    pc.rect(x + 1, base - 21, 2, 3, P.sugarSkullShade)
    pc.px(x + 1, base - 21, P.linen)
  }
  candleAt(pc, 16, base - 18, 3)
  // The arch of cempasúchil over it all, standing clear of the tiers, papel picado strung across it.
  const top = Math.max(lim + 1, base - 32)
  marigoldArch(pc, 1, 30, top, base)
  picadoRow(pc, 4, 27, top + 3, lim, 2)
  return null
}

// ---------- drawing one ----------

const KINDS = { casa, casita, panaderia, mercado, ofrenda }
/** The altar is set out on the ground: it needs no staging. */
const NO_STAGING = new Set(['ofrenda'])

/**
 * @param {{ kind: string, stage: number, accent: string, variant: number, lit: boolean, frame?: number, wall?: number, roofs?: number, low?: boolean, wear?: number, grade?: number }} o
 */
export function drawMuertosBuilding(o) {
  const kind = KINDS[o.kind] ? o.kind : 'casita'
  const variant = o.variant || 0
  const pc = new PixelCanvas(BUILDING_W, HEIGHT)
  const seed = variant * 6151 + 67
  if (o.stage <= 1) {
    site(pc, mulberry32(seed), o.stage, variant)
    return pc.outline(P.outline)
  }
  const draw = KINDS[kind]
  const opts = {
    rand: mulberry32(seed), accent: o.accent || P.muertosPaint[0], lit: Boolean(o.lit), roof: o.stage >= 3, variant,
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
