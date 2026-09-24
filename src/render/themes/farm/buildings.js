// Farm buildings: what each thread builds on a working farm, drawn the way the village's buildings
// are (src/render/sprites/buildings.js): the plot's wall material and paint family on them, its
// accent on the doors, the tractor and the shop's awning, and a finished one weathered by its wear.
//
// Contract (see ThemePack in ../index.js and the village's src/render/sprites/buildings.js):
// - A thread's building kind (KINDS in src/sim/building.js) maps to a farm kind through `fitted`.
// - Every sprite is BUILDING_W (32) wide and heightOf() tall, its bottom row on the ground.
// - Down a courtyard's sides (`fitted(kind, variant, false)`) a building is 48 tall and draws
//   nothing above row DOORSTEP_CLEAR (9), outline included, at every stage: the villager at the
//   door of the house above stands there.
// - Stages 0 and 1 are the ground being made ready; 2 is the building without its roof
//   (`roof: false`) inside a staging of poles and ladders; 3 is finished. Stage 3 is weathered by
//   `wear` exactly as the village's buildings are (see drawBuilding there).
// - `wall` indexes THEMES.farm.dims.wall; `roofs` its paint families; `accent` is the plot's
//   colour, for doors, the tractor and awnings. Every colour from the palette.
//
// Windows keep the village's glass colours and its warm lit yellow: the weathering pass finds
// windows by those exact colours (GLASS_COLORS in weathering.js), so a pane in a colour of this
// theme's own would never crack or get boarded up as a building aged. A polytunnel's sheeting is
// polythene, never glass, for the same reason the other way round.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { BUILDING_W, DOORSTEP_CLEAR } from '../../sprites/buildings.js'
import { lookFor, weather } from '../../sprites/weathering.js'
import { mulberry32, pick, rngFor } from '../../../sim/rng.js'
import { THEMES } from '../../../sim/themes.js'
import { KEPT } from '../../../sim/wear.js'

/** A thread's building, by its kind, on a farm. */
export const FARM_KINDS = {
  house: 'farmhouse', cottage: 'shepherdshut', shop: 'farmshop', barn: 'redbarn', windmill: 'windpump',
  workshop: 'machineshed', well: 'handpump', farm: 'henhouse', tower: 'silo', greenhouse: 'polytunnel', stall: 'honesty',
}
const TALL = { windpump: 60, silo: 60 }
/** What a windpump or a silo is built as down the sides, where there is no room for its height. */
const STAND_INS = ['shepherdshut', 'farmshop', 'redbarn', 'henhouse']
const MATERIALS = THEMES.farm.dims.wall
/**
 * The paint a plot's buildings share, by its `roofs`: three related colours each, as indices into
 * the palette's farmPaint (barn red, tractor green, harvest yellow, sky blue, trim white, tractor
 * orange, slate, oxide). One family per sub-theme, which is what tells one farm from the next.
 */
const PAINT_FAMILIES = [[0, 7, 4], [6, 3, 4], [2, 1, 4], [1, 0, 4], [5, 2, 4]]
/** The white every farm paints its trim, its barn doors' braces and its window frames. */
const TRIM = P.farmPaint[4]
/** The highest row anything may be drawn on, leaving the outline its row above. */
const ceiling = (low) => (low ? DOORSTEP_CLEAR + 1 : 1)

export function fitted(kind, variant, roomy) {
  const own = FARM_KINDS[kind] || 'shepherdshut'
  if (roomy) return { kind: own, low: false }
  if (TALL[own]) return { kind: STAND_INS[variant % STAND_INS.length], low: true }
  return { kind: own, low: true }
}

export function heightOf(kind) {
  return TALL[kind] || 48
}

/** A pump, a stall and a hen house are small; a polytunnel sits low and wide. */
export function shadowOf(kind) {
  if (kind === 'handpump' || kind === 'honesty' || kind === 'henhouse') return 26
  return 34
}

/** The windpump's wheel turns between frames; nothing else here moves. */
export const buildingFrames = (kind, stage) => (kind === 'windpump' && stage >= 3 ? 2 : 1)

/** Where smoke leaves a finished building: the farmhouse's stack and the shepherd's hut's stove. */
export function chimneyOf(kind, variant = 0, wall = 0, roofs = 0, low = false) {
  if (kind === 'farmhouse') return { x: 25, y: farmhouseSpec(low).stackTop }
  if (kind === 'shepherdshut') return { x: 23, y: hutSpec(low).flueTop }
  return null
}

// ---------- shared parts ----------

/** Each kind's shape comes from its own stream, apart from the one that scatters texture. */
const specRand = (kind, variant) => rngFor(`farm:${kind}:${variant}`)
const box = (pc, x0, y0, x1, y1, c) => pc.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, c)
/** One of the plot's paint family, turning through it by `i`. */
const paintOf = (roofs, i) => {
  const f = PAINT_FAMILIES[(roofs || 0) % PAINT_FAMILIES.length]
  return P.farmPaint[f[Math.abs(Math.floor(i)) % f.length]]
}
/**
 * The paint on a roof or a barn's boards: the first two of the family only. The trim white every
 * family ends in is for the trim — a whole white roof read as snow on it.
 */
const roofPaintOf = (roofs, i) => {
  const f = PAINT_FAMILIES[(roofs || 0) % PAINT_FAMILIES.length]
  return P.farmPaint[f[Math.abs(Math.floor(i)) % 2]]
}
/** The material a building is built of: mostly its plot's, now and then another. */
const materialOf = (r, wall) => (r() < 0.7 ? MATERIALS[(wall || 0) % MATERIALS.length] : pick(r, MATERIALS))

/** A wall of one of the theme's five materials, x0..x1 by y0..y1. */
function wallOf(pc, x0, y0, x1, y1, material, rand, paint = null) {
  if (material === 'barnboard') {
    // Board and batten, painted: wide boards with a batten over every joint, each batten lit on
    // its left and shadowed on its right, and the paint gone dark along the foot where it's wet.
    const face = paint || P.farmPaint[0]
    const lit = shade(face, 0.18)
    const dark = shade(face, -0.26)
    box(pc, x0, y0, x1, y1, face)
    for (let x = x0 + 1; x <= x1; x += 4) {
      pc.vline(x, y0, y1, lit)
      pc.vline(x + 1, y0, y1, dark)
    }
    pc.hline(x0, x1, y1, dark)
    for (let i = 0; i < 4; i++) pc.px(x0 + Math.floor(rand() * (x1 - x0 + 1)), y1 - 1 - Math.floor(rand() * 3), dark)
  } else if (material === 'weatherboard') {
    // Weatherboard left bare until it has gone silver: lapped boards across, each lip in shadow.
    box(pc, x0, y0, x1, y1, P.weatherboard)
    for (let y = y0 + 2; y <= y1; y += 3) {
      pc.hline(x0, x1, y, P.weatherboardDark)
      if (y + 1 <= y1) pc.hline(x0, x1, y + 1, P.weatherboardLight)
    }
    for (let i = 0; i < 5; i++) pc.px(x0 + Math.floor(rand() * (x1 - x0 + 1)), y0 + Math.floor(rand() * (y1 - y0 + 1)), P.weatherboardDark)
  } else if (material === 'fieldstone') {
    // Fieldstone: rounded stones out of the ploughland in rough courses, the joints wide and the
    // top of every stone catching the light.
    box(pc, x0, y0, x1, y1, P.fieldstone)
    for (let y = y0; y <= y1; y++) {
      const row = y - y0
      const course = Math.floor(row / 4)
      const off = (course * 5) % 7
      for (let x = x0; x <= x1; x++) {
        const s = (x - x0 + off) % 7
        if (row % 4 === 3 || s === 6) pc.px(x, y, P.fieldstoneDark)
        else if (row % 4 === 0 && s > 0 && s < 5) pc.px(x, y, P.fieldstoneLight)
        // The stones' corners rounded off into the joint.
        else if (row % 4 === 2 && (s === 0 || s === 5)) pc.px(x, y, P.fieldstoneDark)
      }
    }
    for (let i = 0; i < 3; i++) pc.px(x0 + 1 + Math.floor(rand() * (x1 - x0 - 1)), y1 - Math.floor(rand() * 3), P.moss)
  } else if (material === 'whitewash') {
    // Whitewash over stone, the way a byre is kept, with the foot tarred black against the muck.
    box(pc, x0, y0, x1, y1, P.whitewash)
    for (let i = 0; i < 6; i++) {
      const x = x0 + Math.floor(rand() * (x1 - x0 + 1))
      pc.px(x, y0 + 1 + Math.floor(rand() * Math.max(1, y1 - y0 - 4)), P.whitewashShade)
    }
    pc.hline(x0, x1, y1, P.farmIron)
    pc.hline(x0, x1, y1 - 1, P.farmIron)
    pc.hline(x0, x1, y1 - 2, P.whitewashShade)
  } else {
    // Corrugated tin: a light column and a shaded one, and rust creeping up from the foot.
    box(pc, x0, y0, x1, y1, P.tin)
    for (let x = x0; x <= x1; x++) {
      const s = (x - x0) % 3
      if (s === 0) pc.vline(x, y0, y1, P.tinLight)
      else if (s === 2) pc.vline(x, y0, y1, P.tinDark)
    }
    pc.hline(x0, x1, y1, P.tinRust)
    for (let i = 0; i < 5; i++) pc.px(x0 + Math.floor(rand() * (x1 - x0 + 1)), y1 - Math.floor(rand() * 4), P.tinRust)
  }
}

/**
 * A pitched roof over x0..x1, its eaves on `yBot` and its ridge `rise` rows above them: sheets
 * laid down the slope in the plot's paint, a barge board along each verge and a ridge cap.
 * @returns the highest row it drew
 */
function roofOver(pc, x0, x1, yBot, rise, color, limit = 0) {
  const mid = (x0 + x1) / 2
  const half = Math.max(1, (x1 - x0) / 2)
  const light = shade(color, 0.2)
  const dark = shade(color, -0.26)
  let top = yBot
  for (let x = x0; x <= x1; x++) {
    const t = Math.abs(x - mid) / half
    const y = Math.max(limit, yBot - rise + Math.round(t * rise))
    top = Math.min(top, y)
    pc.vline(x, y, yBot, color)
    pc.px(x, y, x < mid ? light : dark)
    // Sheets down the slope: a shaded seam every fourth column, which reads as a sheeted roof.
    if (x % 4 === 0) pc.vline(x, y + 2, yBot - 1, dark)
  }
  pc.hline(x0, x1, yBot, dark)
  pc.hline(x0 + 1, x1 - 1, yBot + 1, P.barnTimberDark) // the fascia under the eaves
  const m = Math.round(mid)
  const ridge = Math.max(limit, yBot - rise)
  pc.hline(m - 1, m + 1, ridge, light)
  return Math.min(top, ridge)
}

/**
 * A gambrel roof, the barn's: a steep lower pitch and a shallow upper one, which is what makes a
 * barn a barn from across the field. `rise` is the whole height from eaves to ridge.
 * @returns the highest row it drew
 */
function gambrelOver(pc, x0, x1, yBot, rise, color, limit = 0) {
  const mid = (x0 + x1) / 2
  const half = Math.max(1, (x1 - x0) / 2)
  const light = shade(color, 0.2)
  const dark = shade(color, -0.26)
  // The knee, where the pitch changes: a third of the way in, and two thirds of the way up.
  const kneeT = 0.62
  const kneeRise = Math.round(rise * 0.66)
  let top = yBot
  for (let x = x0; x <= x1; x++) {
    const t = Math.abs(x - mid) / half // 0 at the ridge, 1 at the eaves
    const up = t > kneeT ? Math.round(((1 - t) / (1 - kneeT)) * kneeRise) : kneeRise + Math.round(((kneeT - t) / kneeT) * (rise - kneeRise))
    const y = Math.max(limit, yBot - up)
    top = Math.min(top, y)
    pc.vline(x, y, yBot, color)
    pc.px(x, y, x < mid ? light : dark)
    if (x % 4 === 2) pc.vline(x, y + 2, yBot - 1, dark)
  }
  // The trim along the knee, where a barn's roof is always painted white.
  for (let x = x0; x <= x1; x++) {
    const t = Math.abs(x - mid) / half
    if (Math.abs(t - kneeT) < 0.08) pc.px(x, Math.max(limit, yBot - kneeRise), TRIM)
  }
  pc.hline(x0, x1, yBot, dark)
  pc.hline(x0 + 1, x1 - 1, yBot + 1, TRIM)
  return top
}

/** A window with its glazing bars, painted frame and sill, lit from within when the thread is. */
function paneOf(pc, x, y, w, h, lit) {
  const glass = lit ? P.windowLit : P.window
  box(pc, x, y, x + w - 1, y + h - 1, TRIM)
  box(pc, x + 1, y + 1, x + w - 2, y + h - 2, glass)
  if (lit && w > 4 && h > 4) box(pc, x + 2, y + 2, x + w - 3, y + h - 3, P.windowLitCore)
  else if (!lit) pc.px(x + 1, y + 1, P.windowShine)
  const mx = Math.round(x + (w - 1) / 2)
  const my = Math.round(y + (h - 1) / 2)
  if (w >= 5) pc.vline(mx, y + 1, y + h - 2, TRIM)
  if (h >= 5) pc.hline(x + 1, x + w - 2, my, TRIM)
  pc.hline(x - 1, x + w, y + h, P.barnTimberDark) // the sill
}

/** A ledged and braced door in the plot's colour, its foot on `base`, with a latch and a step. */
function doorOf(pc, x, base, w, h, accent) {
  const dark = shade(accent, -0.3)
  const light = shade(accent, 0.18)
  const top = base - h + 1
  box(pc, x, top, x + w - 1, base, accent)
  pc.hline(x, x + w - 1, top, light)
  // The ledges across and the brace between them: a Z, which is what a farm door is.
  pc.hline(x, x + w - 1, top + 2, dark)
  pc.hline(x, x + w - 1, base - 2, dark)
  pc.line(x, base - 3, x + w - 1, top + 3, dark)
  pc.px(x + w - 2, base - Math.round(h / 2), P.farmIron)
  pc.hline(x - 1, x + w, base, P.fieldstoneLight) // the step, worn pale
}

/**
 * A hen at (x, y), feet on row y, facing `dir`: white or brown by `brown`, a red comb and a
 * yellow beak, its tail up behind. Four rows of it, which is the least a hen reads as a hen at.
 */
function henAt(pc, x, y, dir = 1, brown = false) {
  const body = brown ? P.henBrown : P.hen
  const dark = shade(body, -0.24)
  pc.hline(x - 1, x + 1, y - 2, body)
  pc.hline(x - 1, x + 1, y - 1, dark)
  pc.px(x + dir * 2, y - 3, body) // the head
  pc.px(x + dir * 2, y - 4, P.henComb)
  pc.px(x + dir * 3, y - 3, P.henBeak)
  pc.px(x + dir, y - 2, body)
  pc.px(x - dir * 2, y - 3, dark) // the tail, cocked up behind
  pc.px(x - dir * 2, y - 2, body)
  pc.px(x, y, P.henBeak)
}

/** A small square bale at (x, y), its foot on row y, `w` long: two strings round it. */
function baleAt(pc, x, y, w = 7, h = 4) {
  box(pc, x, y - h + 1, x + w - 1, y, P.hay)
  pc.hline(x, x + w - 1, y - h + 1, P.hayLight)
  pc.hline(x, x + w - 1, y, P.hayDark)
  pc.vline(x + w - 1, y - h + 1, y, P.hayDark)
  for (const dx of [2, w - 3]) pc.vline(x + dx, y - h + 2, y - 1, P.hayDark)
}

/** A round bale at (cx, y), standing on its end at row y. */
function roundBaleAt(pc, cx, y, r = 4) {
  pc.ellipse(cx, y - r + 0.5, r, r, P.hay)
  pc.ellipse(cx - 1, y - r - 0.5, r * 0.55, r * 0.55, P.hayLight)
  for (let a = 0; a < 3; a++) pc.px(cx + a - 1, y - r + (a % 2), P.hayDark)
  pc.hline(cx - r + 1, cx + r - 1, y, P.hayDark)
}

/** Produce heaped in a crate at x..x+5 with its foot on y: apples, carrots, cabbages or eggs. */
function crateOf(pc, x, y, what) {
  box(pc, x, y - 3, x + 5, y, P.barnTimber)
  pc.hline(x, x + 5, y - 3, P.barnTimberLight)
  pc.hline(x, x + 5, y - 1, P.barnTimberDark)
  const c = [P.apple, P.farmPaint[5], P.vegLeaf, P.hen][what % 4]
  for (let i = 0; i < 3; i++) {
    pc.px(x + 1 + i * 2, y - 4, c)
    pc.px(x + 2 + i * 2, y - 4, shade(c, -0.2))
  }
  pc.px(x + 2, y - 5, shade(c, 0.2))
}

/**
 * The staging a building sits in while it is going up: timber poles with boards across them and
 * a ladder up one side.
 */
const LIFT = 8
function staging(pc, x0, x1, top, base) {
  const posts = x1 - x0 > 18 ? [x0, Math.round((x0 + x1) / 2), x1] : [x0, x1]
  for (const x of posts) {
    pc.vline(x, top, base, P.barnTimber)
    pc.px(x, top, P.barnTimberLight)
    pc.hline(x - 1, x + 1, base, P.barnTimberDark)
  }
  for (let y = base - LIFT; y >= top + 3; y -= LIFT) {
    pc.hline(x0, x1, y, P.barnTimberLight)
    pc.hline(x0, x1, y + 1, P.barnTimberDark)
  }
  // A ladder up the outside of the first post.
  for (let y = base - 2; y >= top + 2; y -= 3) pc.hline(x0 - 1, x0 + 1, y, P.barnTimberLight)
}

// ---------- the ground being made ready ----------

function site(pc, rand, stage, oy, variant) {
  const Y = (y) => y + oy
  pc.ellipse(16, Y(43), 15.5, 4.5, P.farmGround[2][1])
  for (let i = 0; i < 12; i++) pc.px(2 + Math.floor(rand() * 28), Y(40 + Math.floor(rand() * 7)), i % 2 ? P.farmGround[2][2] : P.farmGround[2][3])
  const left = variant % 2 === 0
  if (stage === 0) {
    // Pegged out: stakes knocked in with a line run round them, and a barrow of stone waiting.
    for (const dx of [-13, -6, 0, 6, 13]) {
      pc.vline(16 + dx, Y(37), Y(43), P.barnTimber)
      pc.px(16 + dx, Y(37), P.barnTimberLight)
    }
    pc.hline(3, 29, Y(38), P.hayLight)
    // The barrow: a tray on one wheel, its handles back on the ground.
    const bx = left ? 18 : 6
    box(pc, bx, Y(38), bx + 7, Y(41), P.farmPaint[1])
    pc.hline(bx, bx + 7, Y(38), shade(P.farmPaint[1], 0.2))
    pc.ellipse(bx + 3, Y(38), 2.5, 1.2, P.fieldstone)
    pc.ellipse(bx + 8, Y(43), 1.6, 1.6, P.farmIron)
    pc.line(bx - 3, Y(44), bx, Y(41), P.barnTimberDark)
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
  pc.line(8, Y(40), 23, Y(28), P.barnTimber) // the brace across it
  const lx = left ? 2 : 29
  const dx = left ? 1 : -1
  pc.line(lx, Y(43), lx + dx * 5, Y(24), P.barnTimberLight)
  pc.line(lx + dx, Y(43), lx + dx * 6, Y(24), P.barnTimber)
  for (let i = 0; i < 6; i++) {
    const t = i / 6
    pc.hline(lx + Math.round(dx * t * 5), lx + Math.round(dx * (1 + t * 5)), Y(42 - i * 3), P.barnTimberDark)
  }
  const bx = left ? 16 : 6
  for (let i = 0; i < 2; i++) {
    pc.hline(bx, bx + 9, Y(44 - i * 2), P.barnTimberLight)
    pc.hline(bx, bx + 9, Y(43 - i * 2), P.barnTimber)
  }
  baleAt(pc, left ? 5 : 21, Y(44), 6, 3)
}

// ---------- farmhouse: the house the farm is run from ----------

function farmhouseSpec(low = false) {
  const base = 46
  const wallTop = low ? base - 22 : base - 28
  return { base, wallTop, stackTop: Math.max(DOORSTEP_CLEAR + 1, wallTop - 11) }
}

function farmhouse(pc, o) {
  const s = farmhouseSpec(o.low)
  const lim = ceiling(o.low)
  const r = specRand('farmhouse', o.variant)
  const material = materialOf(r, o.wall)
  const tone = Math.floor(r() * 3)
  const doorLeft = r() < 0.5
  wallOf(pc, 4, s.wallTop, 27, s.base, material, o.rand, paintOf(o.roofs, tone + 1))
  pc.hline(4, 27, s.base, P.fieldstoneDark)
  const dx = doorLeft ? 7 : 19
  // The porch over the door: two posts and a little gabled roof in the plot's paint.
  doorOf(pc, dx, s.base - 1, 6, 11, o.accent)
  for (const x of [dx - 1, dx + 6]) pc.vline(x, s.base - 12, s.base - 1, TRIM)
  // Windows up and down, and a climbing rose up beside the door.
  paneOf(pc, doorLeft ? 18 : 6, s.base - 11, 7, 7, o.lit)
  paneOf(pc, 6, s.wallTop + 3, 6, 7, o.lit)
  paneOf(pc, 20, s.wallTop + 3, 6, 7, o.lit)
  const rx = doorLeft ? 14 : 16
  for (let y = s.base - 1; y >= s.base - 13; y--) pc.px(rx + ((y >> 1) & 1), y, P.vegLeafDark)
  for (const y of [s.base - 5, s.base - 9, s.base - 12]) {
    pc.px(rx + 1, y, P.vegLeaf)
    pc.px(rx, y - 1, P.blossom)
  }
  if (!o.roof) return { x0: 3, x1: 28, top: s.wallTop }
  const color = roofPaintOf(o.roofs, tone)
  // The stack at the gable end, of the same stone as the fields.
  for (let y = s.stackTop; y <= s.wallTop; y++) {
    pc.hline(23, 27, y, (y - s.stackTop) % 3 === 2 ? P.fieldstoneDark : P.fieldstone)
  }
  pc.vline(23, s.stackTop, s.wallTop, P.fieldstoneLight)
  const top = roofOver(pc, 1, 30, s.wallTop - 1, 10, color, lim)
  for (let y = s.stackTop; y <= s.wallTop - 6; y++) {
    pc.hline(23, 27, y, (y - s.stackTop) % 3 === 2 ? P.fieldstoneDark : P.fieldstone)
    pc.px(23, y, P.fieldstoneLight)
  }
  pc.hline(22, 28, s.stackTop, P.fieldstoneLight)
  // The porch roof, over the door.
  roofOver(pc, dx - 2, dx + 7, s.base - 13, 3, roofPaintOf(o.roofs, tone + 1), lim)
  // A dormer in the roof, when there is height for it.
  if (!o.low) {
    const mx = doorLeft ? 11 : 20
    paneOf(pc, mx - 2, top + 6, 5, 4, o.lit)
  }
  return null
}

// ---------- shepherd's hut: a hut on iron wheels, with a stove ----------

function hutSpec(low = false) {
  const base = 46
  const wallTop = low ? base - 17 : base - 20
  return { base, wallTop, flueTop: Math.max(DOORSTEP_CLEAR + 2, wallTop - 8) }
}

function shepherdshut(pc, o) {
  const s = hutSpec(o.low)
  const lim = ceiling(o.low)
  const r = specRand('shepherdshut', o.variant)
  const tone = Math.floor(r() * 3)
  const paint = roofPaintOf(o.roofs, tone + 1)
  const floor = s.base - 6
  // The iron wheels it stands on, and the chassis between them.
  for (const x of [8, 23]) {
    pc.ellipse(x, s.base - 3, 3.5, 3.5, P.farmIron)
    pc.ellipse(x, s.base - 3, 1.5, 1.5, P.farmIronLight)
    for (const [ex, ey] of [[0, -3], [3, 0], [0, 3], [-3, 0]]) pc.px(x + ex, s.base - 3 + ey, P.farmIronLight)
  }
  pc.hline(4, 27, floor, P.farmIron)
  // The body, boarded and painted: a hut is always somebody's favourite colour.
  wallOf(pc, 4, s.wallTop, 27, floor - 1, 'barnboard', o.rand, paint)
  // The stable door at the end with its steps down, and a window with a sill of geraniums.
  doorOf(pc, 5, floor - 1, 5, 11, o.accent)
  pc.hline(5, 9, floor - 6, shade(o.accent, -0.3)) // where the stable door splits
  for (let i = 0; i < 3; i++) pc.hline(2 - i, 5 - i, floor + 1 + i * 2, P.barnTimber)
  paneOf(pc, 14, s.wallTop + 4, 7, 6, o.lit)
  for (const x of [14, 17, 20]) pc.px(x, s.wallTop + 9, P.henComb)
  // The stove pipe out of the back of the roof.
  for (let y = s.flueTop; y <= s.wallTop + 2; y++) pc.px(23, y, (y & 1) ? P.farmIron : P.farmIronLight)
  if (!o.roof) return { x0: 3, x1: 28, top: s.wallTop }
  // The roof: a curve of corrugated tin, bent over the hoops rather than pitched.
  const top = Math.max(lim, s.wallTop - 5)
  for (let x = 2; x <= 29; x++) {
    const t = Math.abs(x - 15.5) / 13.5
    const y = Math.max(lim, Math.round(s.wallTop - 5 + t * t * 5))
    pc.vline(x, y, s.wallTop, (x % 3 === 0) ? P.tinDark : P.tin)
    pc.px(x, y, P.tinLight)
  }
  pc.hline(2, 29, s.wallTop, P.tinDark)
  pc.hline(22, 24, Math.max(lim, s.flueTop - 1), P.farmIronLight)
  pc.vline(23, Math.max(lim, s.flueTop), top + 1, P.farmIron)
  return null
}

// ---------- farm shop: where the farm sells what it grows ----------

function farmshop(pc, o) {
  const r = specRand('farmshop', o.variant)
  const material = materialOf(r, o.wall)
  const tone = Math.floor(r() * 3)
  const base = 46
  const wallTop = o.low ? base - 22 : base - 26
  const lim = ceiling(o.low)
  wallOf(pc, 4, wallTop, 27, base, material, o.rand, paintOf(o.roofs, tone + 1))
  pc.hline(4, 27, base, P.fieldstoneDark)
  const doorLeft = r() < 0.5
  const wx = doorLeft ? 13 : 4
  // The shop window with the stock in it, and the door beside it.
  paneOf(pc, wx, base - 14, 14, 9, o.lit)
  doorOf(pc, doorLeft ? 6 : 22, base - 1, 5, 12, o.accent)
  // The sign board across the front, with an apple painted on it.
  const fx = doorLeft ? 4 : 15
  const sign = roofPaintOf(o.roofs, tone + 1)
  box(pc, fx, wallTop + 2, fx + 12, wallTop + 8, sign)
  pc.hline(fx, fx + 12, wallTop + 2, shade(sign, 0.2))
  pc.hline(fx, fx + 12, wallTop + 8, shade(sign, -0.3))
  pc.ellipse(fx + 6, wallTop + 5.5, 2, 2, P.apple)
  pc.px(fx + 5, wallTop + 4, shade(P.apple, 0.3))
  pc.px(fx + 6, wallTop + 3, P.vegLeafDark)
  pc.px(fx + 7, wallTop + 3, P.vegLeaf)
  // Crates of what's in season out in front, stacked on a trestle and on the ground.
  const cx = doorLeft ? 13 : 4
  pc.hline(cx - 1, cx + 14, base - 4, P.barnTimberDark)
  for (const x of [cx, cx + 13]) pc.vline(x, base - 3, base, P.barnTimberDark)
  crateOf(pc, cx, base - 5, 0)
  crateOf(pc, cx + 7, base - 5, 1 + (o.variant % 3))
  if (!o.roof) return { x0: 3, x1: 28, top: wallTop }
  roofOver(pc, 1, 30, wallTop - 1, 9, roofPaintOf(o.roofs, tone), lim)
  // The awning over the crates, striped in the plot's colour and white.
  for (let x = cx - 1; x <= cx + 14; x++) {
    const c = ((x >> 1) & 1) ? o.accent : TRIM
    pc.px(x, base - 16, c)
    pc.px(x, base - 15, shade(c, -0.22))
  }
  pc.hline(cx - 1, cx + 14, base - 17, P.barnTimberDark)
  return null
}

// ---------- red barn: a gambrel-roofed barn with a hay loft ----------

function redbarn(pc, o) {
  const r = specRand('redbarn', o.variant)
  const tone = Math.floor(r() * 3)
  // A barn is board and batten more often than not, whatever else the plot is built of.
  const material = r() < 0.55 ? 'barnboard' : materialOf(r, o.wall)
  const base = 46
  const eave = o.low ? base - 20 : base - 24
  const lim = ceiling(o.low)
  wallOf(pc, 3, eave, 28, base, material, o.rand, roofPaintOf(o.roofs, tone))
  pc.hline(3, 28, base, P.fieldstoneDark)
  // The big doors, trimmed in white with a cross brace on each leaf: the barn's face.
  const dy = base - 15
  box(pc, 9, dy, 22, base - 1, shade(roofPaintOf(o.roofs, tone), -0.12))
  for (const [x0, x1] of [[9, 15], [16, 22]]) {
    pc.hline(x0, x1, dy, TRIM)
    pc.hline(x0, x1, base - 1, TRIM)
    pc.vline(x0, dy, base - 1, TRIM)
    pc.vline(x1, dy, base - 1, TRIM)
    pc.line(x0, dy, x1, base - 1, TRIM)
    pc.line(x1, dy, x0, base - 1, TRIM)
  }
  // Open a crack between them: a lamp inside when somebody's working.
  pc.vline(15, dy + 1, base - 2, o.lit ? P.windowLit : P.interior)
  pc.vline(16, dy + 1, base - 2, o.lit ? P.windowLitCore : P.interior)
  // The loft door above, open, with hay spilling out of it.
  const ly = eave + 1
  box(pc, 13, ly, 18, ly + 5, P.interior)
  pc.hline(13, 18, ly + 5, P.hay)
  pc.hline(12, 19, ly + 6, P.hayDark)
  for (const x of [13, 15, 18]) pc.px(x, ly + 4, P.hayLight)
  for (const x of [12, 19]) pc.vline(x, ly - 1, ly + 5, TRIM)
  pc.hline(12, 19, ly - 1, TRIM)
  // Little windows either side, and a bale by the door.
  paneOf(pc, 4, base - 13, 4, 5, o.lit)
  paneOf(pc, 24, base - 13, 4, 5, o.lit)
  baleAt(pc, 24, base, 6, 3)
  if (!o.roof) return { x0: 2, x1: 29, top: eave }
  const top = gambrelOver(pc, 1, 30, eave - 1, o.low ? 12 : 16, roofPaintOf(o.roofs, tone + 1), lim)
  // The hay hood jutting out over the loft door, and its hoist hook.
  const hood = Math.max(lim + 1, eave - 3)
  box(pc, 13, hood, 18, hood + 1, TRIM)
  pc.vline(15, hood + 2, hood + 3, P.farmIron)
  // A weathervane on the ridge, a cockerel on it, where there is room for one.
  if (top - 5 >= lim) {
    pc.vline(16, top - 4, top - 1, P.farmIron)
    pc.hline(14, 18, top - 2, P.farmIronLight)
    pc.hline(15, 17, top - 5, P.farmIron)
    pc.px(17, top - 6, P.farmIron)
  }
  return null
}

// ---------- windpump: a lattice tower with its wheel in the wind ----------

function windpump(pc, o) {
  const r = specRand('windpump', o.variant)
  const tone = Math.floor(r() * 3)
  const base = 58
  const hub = { x: 15, y: 11 }
  // The tank at the foot it fills, and the trough it spills into.
  box(pc, 18, base - 9, 29, base, P.tin)
  for (let x = 18; x <= 29; x += 3) pc.vline(x, base - 9, base, P.tinDark)
  pc.hline(18, 29, base - 9, P.tinLight)
  pc.hline(18, 29, base - 5, P.tinDark)
  pc.hline(18, 29, base, P.tinRust)
  box(pc, 1, base - 3, 9, base, P.barnTimber)
  pc.hline(2, 8, base - 3, P.window)
  pc.hline(1, 9, base - 3, P.barnTimberDark)
  box(pc, 2, base - 2, 8, base - 2, P.waterLight)
  // The tower: four legs coming in towards the head, braced across on the way up.
  const halfAt = (y) => Math.round(2 + ((y - (hub.y + 4)) / (base - hub.y - 4)) * 9)
  for (let y = hub.y + 4; y <= base; y++) {
    const h = halfAt(y)
    pc.px(hub.x - h, y, P.tinDark)
    pc.px(hub.x + h, y, P.tinDark)
    pc.px(hub.x - Math.round(h / 3), y, P.tin)
    pc.px(hub.x + Math.round(h / 3), y, P.tin)
  }
  for (let y = hub.y + 10; y <= base - 4; y += 9) {
    const h = halfAt(y)
    pc.hline(hub.x - h, hub.x + h, y, P.tinLight)
    pc.line(hub.x - h, y, hub.x + halfAt(y + 8), y + 8, P.tinDark)
  }
  // The pump rod down the middle, and the platform under the head.
  pc.vline(hub.x, hub.y + 4, base - 4, P.farmIron)
  pc.hline(hub.x - 4, hub.x + 4, hub.y + 5, P.barnTimber)
  pc.hline(hub.x - 4, hub.x + 4, hub.y + 6, P.barnTimberDark)
  if (!o.roof) return { x0: 3, x1: 28, top: hub.y + 4 }
  // The tail vane out behind, in the plot's paint, which keeps the wheel into the wind.
  const vane = paintOf(o.roofs, tone)
  pc.hline(hub.x + 1, hub.x + 9, hub.y, P.farmIron)
  box(pc, hub.x + 9, hub.y - 4, hub.x + 14, hub.y + 3, vane)
  pc.hline(hub.x + 9, hub.x + 14, hub.y - 4, shade(vane, 0.2))
  pc.vline(hub.x + 14, hub.y - 4, hub.y + 3, shade(vane, -0.28))
  // The wheel: sixteen blades on a ring, turning half a blade between frames.
  const turn = (o.frame % 2) * (Math.PI / 16)
  for (let i = 0; i < 16; i++) {
    const a = turn + (i * Math.PI) / 8
    for (let d = 3; d <= 9; d++) {
      const x = Math.round(hub.x + Math.cos(a) * d)
      const y = Math.round(hub.y + Math.sin(a) * d * 0.95)
      pc.px(x, y, d >= 8 ? P.tinLight : i % 2 ? P.tin : P.tinDark)
    }
  }
  pc.ellipse(hub.x + 0.5, hub.y + 0.5, 2, 2, P.farmIron)
  pc.px(hub.x, hub.y, P.farmIronLight)
  return null
}

// ---------- silo: grain stored up out of the damp ----------

function silo(pc, o) {
  const r = specRand('silo', o.variant)
  const material = materialOf(r, o.wall)
  const tone = Math.floor(r() * 3)
  const base = 58
  const top = 14
  // The shed at its foot where the grain is loaded out, of the plot's own walls.
  wallOf(pc, 1, base - 14, 12, base, material === 'tin' ? 'weatherboard' : material, o.rand, paintOf(o.roofs, tone + 1))
  doorOf(pc, 3, base - 1, 5, 10, o.accent)
  paneOf(pc, 9, base - 11, 3, 4, o.lit)
  pc.hline(1, 12, base, P.fieldstoneDark)
  // The bin: a cylinder of ribbed tin, bands round it, shaded round its curve.
  for (let x = 11; x <= 28; x++) {
    const t = (x - 11) / 17
    const c = t < 0.2 ? P.tinLight : t > 0.75 ? P.tinDark : P.tin
    pc.vline(x, top, base, c)
  }
  for (let y = top + 3; y <= base; y += 4) pc.hline(11, 28, y, P.tinDark)
  for (let y = top + 4; y <= base; y += 4) {
    pc.px(12, y, P.tinLight)
    pc.px(27, y, P.farmIronLight)
  }
  pc.hline(11, 28, base, P.tinRust)
  // A ladder up the side of it, caged at the top.
  pc.vline(26, top + 2, base - 2, P.farmIron)
  pc.vline(28, top + 2, base - 2, P.farmIron)
  for (let y = top + 3; y <= base - 3; y += 3) pc.hline(26, 28, y, P.farmIronLight)
  if (!o.roof) return { x0: 10, x1: 29, top }
  // The shed's roof, and the silo's cone with its hatch and the auger over to the shed.
  roofOver(pc, 0, 13, base - 15, 4, roofPaintOf(o.roofs, tone), 1)
  const cone = paintOf(o.roofs, tone)
  for (let x = 10; x <= 29; x++) {
    const t = Math.abs(x - 19.5) / 9.5
    const y = Math.round(top - 8 + t * 8)
    pc.vline(x, y, top, x < 19 ? shade(cone, 0.14) : cone)
    pc.px(x, y, shade(cone, 0.24))
  }
  pc.hline(10, 29, top, shade(cone, -0.3))
  box(pc, 18, top - 10, 21, top - 8, P.tinLight)
  pc.hline(18, 21, top - 10, P.farmIronLight)
  pc.line(12, top + 4, 4, base - 16, P.farmIron)
  pc.line(12, top + 5, 4, base - 15, P.farmIronLight)
  return null
}

// ---------- machine shed: open-fronted, with the tractor in it ----------

function machineshed(pc, o) {
  const r = specRand('machineshed', o.variant)
  const material = materialOf(r, o.wall)
  const tone = Math.floor(r() * 3)
  const base = 46
  const eave = o.low ? base - 21 : base - 25
  const lim = ceiling(o.low)
  wallOf(pc, 2, eave, 29, base, material, o.rand, paintOf(o.roofs, tone + 1))
  box(pc, 5, eave + 3, 26, base, P.interior)
  pc.hline(2, 29, base, P.fieldstoneDark)
  if (o.lit) {
    pc.hline(11, 20, eave + 4, P.lampGlow)
    pc.px(15, eave + 5, P.windowLitCore)
  }
  // The tractor, in the plot's colour: a bonnet out front, the cab behind it, a big back wheel
  // and a small front one, and the exhaust up out of the bonnet.
  const facing = o.variant % 2 ? 1 : -1
  const cx = 16
  const X = (dx) => cx + facing * dx
  const body = o.accent
  const bodyDark = shade(body, -0.3)
  const ground = base - 1
  for (let dx = -2; dx <= 7; dx++) {
    pc.vline(X(dx), ground - 9, ground - 5, body)
    pc.px(X(dx), ground - 9, shade(body, 0.2))
  }
  for (let dx = -6; dx <= -1; dx++) pc.vline(X(dx), ground - 15, ground - 5, dx === -6 || dx === -1 ? bodyDark : P.window)
  pc.hline(X(-7), X(0), ground - 16, bodyDark)
  pc.hline(X(-6), X(-1), ground - 15, bodyDark)
  pc.vline(X(5), ground - 13, ground - 10, P.farmIron)
  pc.ellipse(X(-4) + 0.5, ground - 3.5, 4.5, 4.5, P.cowBlack)
  pc.ellipse(X(-4) + 0.5, ground - 3.5, 2, 2, P.farmPaint[2])
  pc.ellipse(X(6) + 0.5, ground - 1.5, 2.5, 2.5, P.cowBlack)
  pc.px(X(6), ground - 2, P.farmPaint[2])
  // Posts across the open front, and a window in the gable end.
  for (const x of [3, 28]) {
    box(pc, x, eave + 2, x + 1, base - 1, P.barnTimber)
    pc.vline(x, eave + 2, base - 1, P.barnTimberLight)
  }
  if (!o.roof) return { x0: 2, x1: 29, top: eave }
  roofOver(pc, 0, 31, eave - 1, o.low ? 8 : 9, roofPaintOf(o.roofs, tone), lim)
  // Diesel on the floor, and a can by the door.
  pc.hline(21, 24, base, P.farmIron)
  box(pc, 27, base - 4, 29, base - 1, P.farmPaint[0])
  pc.px(27, base - 5, P.farmIron)
  return null
}

// ---------- hand pump: a trough and a pump in the yard ----------

function handpump(pc, o) {
  const r = specRand('handpump', o.variant)
  const tone = Math.floor(r() * 3)
  const base = 46
  const top = o.low ? base - 22 : base - 27
  const lim = ceiling(o.low)
  // The trough: a long stone one, the water in it and the moss along its lip.
  box(pc, 3, base - 8, 21, base, P.fieldstone)
  pc.hline(3, 21, base - 8, P.fieldstoneLight)
  pc.hline(3, 21, base, P.fieldstoneDark)
  box(pc, 5, base - 7, 19, base - 4, P.water)
  pc.hline(6, 18, base - 7, P.waterLight)
  pc.px(9, base - 6, P.waterGlint)
  for (const x of [4, 12, 20]) pc.px(x, base - 8, P.moss)
  // The pump: a cast-iron column in the plot's paint, a spout over the trough and a long handle.
  const stand = paintOf(o.roofs, tone)
  box(pc, 22, top + 6, 26, base - 1, stand)
  pc.vline(22, top + 6, base - 1, shade(stand, 0.2))
  pc.vline(26, top + 6, base - 1, shade(stand, -0.28))
  pc.hline(21, 27, top + 5, shade(stand, 0.2))
  pc.hline(21, 27, top + 6, shade(stand, -0.28))
  pc.hline(19, 22, top + 10, P.farmIron)
  pc.px(19, top + 11, P.farmIronLight)
  pc.vline(27, top + 7, top + 8, P.farmIron)
  pc.line(27, top + 7, 31, top + 3, P.farmIron)
  // A pail under the spout and a hen on the trough's end, as there always is.
  box(pc, 16, base - 5, 20, base - 1, P.tin)
  pc.hline(16, 20, base - 5, P.tinLight)
  pc.hline(15, 21, base - 6, P.farmIron)
  henAt(pc, 7, base - 9, 1, o.variant % 2 === 1)
  if (!o.roof) return { x0: 3, x1: 28, top: top + 5 }
  // A little roof on two posts over the pump, so the water stays clean.
  for (const x of [20, 28]) {
    pc.vline(x, top + 4, base - 1, P.barnTimber)
    pc.px(x, top + 4, P.barnTimberLight)
  }
  roofOver(pc, 18, 30, top + 3, 5, roofPaintOf(o.roofs, tone + 1), lim)
  return null
}

// ---------- hen house: a coop on legs with its run ----------

function henhouse(pc, o) {
  const r = specRand('henhouse', o.variant)
  const tone = Math.floor(r() * 3)
  const base = 46
  const floor = base - 7
  const eave = o.low ? base - 20 : base - 22
  const lim = ceiling(o.low)
  const left = o.variant % 2 === 0
  const hx0 = left ? 3 : 15
  const hx1 = hx0 + 13
  // The run: a wire pen along the other side, posts and mesh, hens scratching about in it.
  const rx0 = left ? 17 : 1
  const rx1 = rx0 + 13
  for (let y = base - 12; y <= base; y++) {
    for (let x = rx0; x <= rx1; x++) if ((x + y) % 3 === 0 || (x - y + 30) % 3 === 0) pc.px(x, y, P.fenceWire)
  }
  for (const x of [rx0, rx1]) pc.vline(x, base - 13, base, P.barnTimber)
  pc.hline(rx0, rx1, base - 13, P.barnTimberDark)
  henAt(pc, rx0 + 4, base - 1, 1, false)
  henAt(pc, rx0 + 10, base - 3, -1, true)
  // The coop on its legs, and the ramp down from its pop hole.
  for (const x of [hx0 + 1, hx1 - 1]) pc.vline(x, floor, base, P.barnTimberDark)
  wallOf(pc, hx0, eave, hx1, floor, 'barnboard', o.rand, paintOf(o.roofs, tone))
  pc.hline(hx0, hx1, floor, P.barnTimberDark)
  const pop = left ? hx1 - 4 : hx0 + 2
  box(pc, pop, floor - 4, pop + 2, floor - 1, P.interior)
  const rampDir = left ? 1 : -1
  const ramp0 = left ? pop + 2 : pop
  pc.line(ramp0, floor, ramp0 + rampDir * 6, base, P.barnTimber)
  for (let i = 1; i < 6; i += 2) pc.px(ramp0 + rampDir * i, floor + i + 1, P.barnTimberDark)
  paneOf(pc, left ? hx0 + 2 : hx1 - 5, eave + 3, 4, 4, o.lit)
  // The nest box on the side, its lid painted to match, and eggs by it.
  const nx = left ? hx0 - 3 : hx1 + 1
  box(pc, nx, floor - 7, nx + 2, floor - 2, P.barnTimber)
  pc.hline(nx, nx + 2, floor - 7, P.barnTimberLight)
  pc.px(left ? hx0 + 4 : hx1 - 4, base, P.hen)
  pc.px(left ? hx0 + 6 : hx1 - 6, base, P.hen)
  if (!o.roof) return { x0: hx0 - 1, x1: hx1 + 1, top: eave }
  roofOver(pc, hx0 - 2, hx1 + 2, eave - 1, 6, roofPaintOf(o.roofs, tone + 1), lim)
  // A cockerel on the ridge of the run's gate post.
  henAt(pc, left ? rx1 - 1 : rx0 + 1, base - 13, left ? -1 : 1, true)
  return null
}

// ---------- polytunnel: a hoop house of polythene ----------

function polytunnel(pc, o) {
  const base = 46
  const crown = o.low ? base - 17 : base - 20
  const lim = ceiling(o.low)
  const h = base - crown
  const profile = (x) => {
    const t = Math.abs(x - 15.5) / 14.5
    return Math.max(lim, Math.round(crown + (1 - Math.sqrt(Math.max(0, 1 - t * t))) * h))
  }
  // The rows of crops in the ground inside and out, lettuces along the front.
  for (let x = 2; x <= 29; x += 3) {
    pc.px(x, base, P.vegLeafDark)
    pc.px(x + 1, base, P.vegLeaf)
    pc.px(x, base - 1, P.vegLeafLight)
  }
  if (o.roof) {
    // The sheeting over the hoops, milky, with the hoops showing through it as ribs.
    for (let x = 1; x <= 30; x++) {
      const y = profile(x)
      pc.vline(x, y, base - 2, P.polythene)
      pc.px(x, y, P.polytheneShade)
      if (x % 6 === 3) pc.vline(x, y + 1, base - 2, P.polytheneShade)
    }
    // What's growing inside, seen as shadows through the sheet.
    for (let x = 4; x <= 27; x += 4) {
      pc.vline(x, base - 8, base - 3, P.vegLeafLight)
      pc.px(x + 1, base - 6, P.vegLeafLight)
    }
  } else {
    // The hoops up with nothing over them yet.
    for (let x = 1; x <= 30; x++) {
      if (x % 6 === 3 || x === 1 || x === 30) pc.vline(x, profile(x), base - 2, P.tinDark)
      pc.px(x, profile(x), P.tin)
    }
  }
  // The timber end door, open, and a glow in it when somebody's inside.
  box(pc, 12, base - 12, 19, base - 1, P.barnTimber)
  box(pc, 13, base - 11, 18, base - 1, o.lit ? P.windowLit : P.interior)
  if (o.lit) box(pc, 14, base - 9, 17, base - 3, P.windowLitCore)
  for (let y = base - 9; y <= base - 1; y += 3) pc.hline(13, 18, y, P.vegLeafDark)
  pc.hline(11, 20, base - 12, P.barnTimberLight)
  pc.hline(0, 31, base - 1, P.farmGround[2][3])
  if (!o.roof) return null
  // Its hem held down in a trench, and a watering can left at the door.
  pc.hline(1, 30, base - 2, P.polytheneShade)
  box(pc, 22, base - 4, 25, base - 1, P.farmPaint[1])
  pc.line(25, base - 3, 27, base - 5, P.farmPaint[1])
  return null
}

// ---------- honesty stall: a roadside stand, and a tin for the money ----------

function honesty(pc, o) {
  const r = specRand('honesty', o.variant)
  const tone = Math.floor(r() * 3)
  const base = 46
  const eave = base - 20
  const lim = ceiling(o.low)
  for (const x of [6, 25]) {
    pc.vline(x, eave + 2, base - 1, P.barnTimber)
    pc.vline(x + (x < 16 ? 1 : -1), eave + 2, base - 1, P.barnTimberDark)
    pc.hline(x - 1, x + 1, base, P.barnTimberDark)
  }
  // The shelf, with boxes of eggs, jars of honey and a bunch of flowers in a bucket.
  box(pc, 4, base - 11, 27, base - 9, P.barnTimberLight)
  pc.hline(4, 27, base - 9, P.barnTimberDark)
  for (let i = 0; i < 3; i++) {
    const x = 5 + i * 4
    box(pc, x, base - 13, x + 2, base - 12, P.barnTimber)
    pc.px(x, base - 13, P.hen)
    pc.px(x + 2, base - 13, P.hen)
  }
  for (const x of [18, 21]) {
    box(pc, x, base - 14, x + 1, base - 12, P.hayDark)
    pc.hline(x, x + 1, base - 15, P.farmPaint[tone % 2 ? 0 : 3])
  }
  box(pc, 24, base - 13, 26, base - 12, P.tin)
  for (const [x, c] of [[24, P.blossom], [25, P.farmPaint[2]], [26, P.henComb]]) pc.px(x, base - 15, c)
  pc.vline(25, base - 14, base - 14, P.vegLeaf)
  // The honesty box on its post, and a chalkboard propped against the leg.
  box(pc, 13, base - 8, 17, base - 5, P.farmPaint[1])
  pc.hline(14, 16, base - 8, P.farmIron)
  box(pc, 1, base - 7, 4, base - 1, P.cowBlack)
  pc.hline(1, 4, base - 7, P.barnTimber)
  pc.px(2, base - 5, P.whitewash)
  pc.px(3, base - 3, P.whitewash)
  crateOf(pc, 17, base, o.variant)
  if (!o.roof) return { x0: 4, x1: 27, top: eave + 2 }
  roofOver(pc, 3, 28, eave + 1, 6, roofPaintOf(o.roofs, tone), lim)
  return null
}

// ---------- drawing one ----------

const KINDS = { farmhouse, shepherdshut, farmshop, redbarn, windpump, machineshed, handpump, henhouse, silo, polytunnel, honesty }
/** Nothing to put up: these need no staging. A polytunnel's staging is its own hoops. */
const NO_STAGING = new Set(['handpump', 'honesty', 'polytunnel'])

/**
 * @param {{ kind: string, stage: number, accent: string, variant: number, lit: boolean, frame?: number, wall?: number, roofs?: number, low?: boolean, wear?: number }} o
 */
export function drawFarmBuilding(o) {
  const kind = KINDS[o.kind] ? o.kind : 'shepherdshut'
  const variant = o.variant || 0
  const H = heightOf(kind)
  const pc = new PixelCanvas(BUILDING_W, H)
  const seed = variant * 6151 + 61
  if (o.stage <= 1) {
    site(pc, mulberry32(seed), o.stage, H - 48, variant)
    return pc.outline(P.outline)
  }
  const draw = KINDS[kind]
  const frameNo = o.frame || 0
  const opts = {
    rand: mulberry32(seed), accent: o.accent || P.farmPaint[0], lit: Boolean(o.lit), roof: o.stage >= 3, frame: frameNo, variant,
    wall: o.wall || 0, roofs: o.roofs || 0, low: Boolean(o.low),
  }
  const sc = draw(pc, opts)
  if (o.stage === 2 && !NO_STAGING.has(kind) && sc) {
    staging(pc, sc.x0, sc.x1, Math.max(ceiling(opts.low), sc.top), H - 2)
  }
  const look = o.stage >= 3 ? lookFor(o.wear ?? KEPT) : null
  if (look) {
    // As the village's: roof told from walls by the building drawn without it, whatever moves
    // between frames left alone, every drawing given the same texture stream as the first.
    const again = (roof, f) => {
      const other = new PixelCanvas(BUILDING_W, H)
      draw(other, { ...opts, rand: mulberry32(seed), roof, frame: f })
      return other
    }
    const frames = buildingFrames(kind, o.stage)
    const others = []
    for (let f = 0; f < frames; f++) if (f !== frameNo % frames) others.push(again(true, f))
    weather(pc, again(false, 0), look, variant, others)
  }
  return pc.outline(P.outline)
}

// The parts the farm's landmarks are built from too (see landmarks.js).
export { MATERIALS, TRIM, baleAt, box, doorOf, henAt, paintOf, paneOf, roofOver, roofPaintOf, roundBaleAt, site, staging, wallOf }
