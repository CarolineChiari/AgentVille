// Seaside buildings: what each thread builds in a harbour, drawn the way the village's buildings
// are (src/render/sprites/buildings.js): the plot's wall material and paint family on them, its
// accent on the doors, awnings and hulls, and a finished one weathered by its wear — which the
// salt gets at faster than anything inland.
//
// Contract (see ThemePack in ../index.js and the village's src/render/sprites/buildings.js):
// - A thread's building kind (KINDS in src/sim/building.js) maps to a harbour kind through `fitted`.
// - Every sprite is BUILDING_W (32) wide and heightOf() tall, its bottom row on the ground.
// - Down a courtyard's sides (`fitted(kind, variant, false)`) a building is 48 tall and draws
//   nothing above row DOORSTEP_CLEAR (9), outline included, at every stage: the villager at the
//   door of the house above stands there.
// - Stages 0 and 1 are the ground being made ready; 2 is the building without its roof
//   (`roof: false`) inside a staging of lashed poles; 3 is finished. Stage 3 is weathered by
//   `wear` exactly as the village's buildings are (see drawBuilding there).
// - `wall` indexes THEMES.seaside.dims.wall; `roofs` its paint families; `accent` is the plot's
//   colour, for doors, awnings and boats. Every colour from the palette.
//
// Windows keep the village's glass colours and its warm lit yellow: the weathering pass finds
// windows by those exact colours (GLASS_COLORS in weathering.js), so a pane in a colour of this
// theme's own would never crack, break or get boarded up as a building aged. The harbour's own
// greens and reds go on what is not a window — a lamp, a hull's bow, a painted door.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { BUILDING_W, DOORSTEP_CLEAR } from '../../sprites/buildings.js'
import { lookFor, weather } from '../../sprites/weathering.js'
import { mulberry32, pick, rngFor } from '../../../sim/rng.js'
import { THEMES } from '../../../sim/themes.js'
import { KEPT } from '../../../sim/wear.js'
import { buoyOf, frond, pot, shell } from './ground.js'

/** A thread's building, by its kind, in a harbour. */
export const SEA_KINDS = {
  house: 'quayhouse', cottage: 'hut', shop: 'chandlery', barn: 'netloft', windmill: 'lookout',
  workshop: 'boatshed', well: 'pump', farm: 'oysterbeds', tower: 'daymark', greenhouse: 'sailloft', stall: 'fishstall',
}
const TALL = { lookout: 60, daymark: 60 }
/** What a lookout or a daymark is built as down the sides, where there is no room for its height. */
const STAND_INS = ['hut', 'chandlery', 'netloft', 'sailloft']
const MATERIALS = THEMES.seaside.dims.wall
/**
 * The paint a plot's buildings share, by its `roofs`: three related colours each, as indices into
 * the palette's harbourPaint (cobalt, harbour red, buoy yellow, mint, gull white, coral, slate
 * blue, teal). One family per sub-theme, which is what tells one quay from the next.
 */
const PAINT_FAMILIES = [[0, 1, 4], [1, 5, 4], [2, 0, 4], [6, 3, 4], [3, 6, 4]]
/** The highest row anything may be drawn on, leaving the outline its row above. */
const ceiling = (low) => (low ? DOORSTEP_CLEAR + 1 : 1)

export function fitted(kind, variant, roomy) {
  const own = SEA_KINDS[kind] || 'hut'
  if (roomy) return { kind: own, low: false }
  if (TALL[own]) return { kind: STAND_INS[variant % STAND_INS.length], low: true }
  return { kind: own, low: true }
}

export function heightOf(kind) {
  return TALL[kind] || 48
}

/** A pump and a stall are small; oyster beds lie flat on the sand and cast nothing worth drawing. */
export function shadowOf(kind) {
  if (kind === 'oysterbeds') return 0
  return kind === 'pump' || kind === 'fishstall' ? 26 : 34
}

/** The flags on the lookout's mast blow between frames; nothing else here moves. */
export const buildingFrames = (kind, stage) => (kind === 'lookout' && stage >= 3 ? 2 : 1)

/**
 * Where smoke leaves a finished building: the quay house's stack, the hut's little stove pipe and
 * the tar kettle at the boat shed. Nothing else here is alight.
 */
export function chimneyOf(kind, variant = 0, wall = 0, roofs = 0, low = false) {
  if (kind === 'quayhouse') return { x: 25, y: quayhouseSpec(low).stackTop }
  if (kind === 'hut') return { x: 7, y: hutSpec(low).flueTop }
  if (kind === 'boatshed') return { x: 26, y: boatshedSpec(low).kettleTop }
  return null
}

// ---------- shared parts ----------

/** Each kind's shape comes from its own stream, apart from the one that scatters texture. */
const specRand = (kind, variant) => rngFor(`sea:${kind}:${variant}`)
const box = (pc, x0, y0, x1, y1, c) => pc.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, c)
/** One of the plot's paint family, turning through it by `i`. */
const paintOf = (roofs, i) => {
  const f = PAINT_FAMILIES[(roofs || 0) % PAINT_FAMILIES.length]
  return P.harbourPaint[f[Math.abs(Math.floor(i)) % f.length]]
}
/**
 * The paint on a roof: the first two of the family only. The gull white every family ends in is
 * for the trim — a whole roof of it read as bleached rather than as painted, and washed out
 * against a limewashed wall.
 */
const roofPaintOf = (roofs, i) => {
  const f = PAINT_FAMILIES[(roofs || 0) % PAINT_FAMILIES.length]
  return P.harbourPaint[f[Math.abs(Math.floor(i)) % 2]]
}
/** The material a building is built of: mostly its plot's, now and then another. */
const materialOf = (r, wall) => (r() < 0.7 ? MATERIALS[(wall || 0) % MATERIALS.length] : pick(r, MATERIALS))

/** A wall of one of the theme's five materials, x0..x1 by y0..y1. */
function wallOf(pc, x0, y0, x1, y1, material, rand, paint = null) {
  if (material === 'clinker') {
    // Clinker boarding: planks lapped over each other and painted, every board's lip in shadow.
    // Painted in the plot's colour when it has one, which is what a harbour front looks like.
    const face = paint || P.clinker
    box(pc, x0, y0, x1, y1, face)
    const lip = shade(face, -0.24)
    const lit = shade(face, 0.2)
    for (let y = y0 + 2; y <= y1; y += 3) {
      pc.hline(x0, x1, y, lip)
      if (y + 1 <= y1) pc.hline(x0, x1, y + 1, lit)
    }
    for (let i = 0; i < 4; i++) pc.px(x0 + Math.floor(rand() * (x1 - x0 + 1)), y0 + Math.floor(rand() * (y1 - y0 + 1)), lip)
  } else if (material === 'limewash') {
    // Whitewash over rubble: flat and bright, with the lime flaking at the foot where it is wet.
    box(pc, x0, y0, x1, y1, P.limewash)
    pc.hline(x0, x1, y0, P.limewash)
    for (let i = 0; i < 7; i++) {
      const x = x0 + Math.floor(rand() * (x1 - x0 + 1))
      pc.px(x, y0 + 1 + Math.floor(rand() * (y1 - y0 - 1)), P.limewashShade)
    }
    for (let x = x0; x <= x1; x++) if ((x * 3) % 5 < 2) pc.px(x, y1, P.seastoneDark)
    pc.hline(x0, x1, y1 - 1, P.limewashShade)
  } else if (material === 'tarboard') {
    // Boarding tarred against the weather, the battens standing off it.
    box(pc, x0, y0, x1, y1, P.tarboard)
    for (let x = x0 + 1; x <= x1; x += 4) pc.vline(x, y0, y1, P.pitch)
    for (let x = x0 + 2; x <= x1; x += 4) pc.vline(x, y0, y1, P.tarboardLight)
    pc.hline(x0, x1, y0, P.tarboardLight)
  } else if (material === 'seastone') {
    // Shore stone: whatever the beach gave, laid in rough courses with wide joints.
    box(pc, x0, y0, x1, y1, P.seastone)
    for (let y = y0; y <= y1; y++) {
      const course = Math.floor((y - y0) / 4)
      for (let x = x0; x <= x1; x++) {
        if ((y - y0) % 4 === 3 || (x + course * 3) % 5 === 4) pc.px(x, y, P.seastoneDark)
        else if ((y - y0) % 4 === 0) pc.px(x, y, P.seastoneLight)
      }
    }
    for (let i = 0; i < 3; i++) pc.px(x0 + 1 + Math.floor(rand() * (x1 - x0 - 1)), y1 - Math.floor(rand() * 3), P.shoreLichen)
  } else {
    // Galvanised sheet, corrugated: a light column and a shaded one, and rust along the foot.
    box(pc, x0, y0, x1, y1, P.corrugated)
    for (let x = x0; x <= x1; x++) {
      const s = (x - x0) % 3
      if (s === 0) pc.vline(x, y0, y1, P.corrugatedLight)
      else if (s === 2) pc.vline(x, y0, y1, P.corrugatedDark)
    }
    pc.hline(x0, x1, y1, P.rustDark)
    for (let i = 0; i < 5; i++) pc.px(x0 + Math.floor(rand() * (x1 - x0 + 1)), y1 - Math.floor(rand() * 4), P.rust)
  }
}

/**
 * A roof over x0..x1, its eaves on `yBot` and its ridge `rise` rows above them, with a ridge board
 * along the top and the eaves overhanging into a shadow. Shallower than a cottage's: a harbour
 * roof is slate or pantile laid low against the wind, and a steep one read as inland.
 * @returns the highest row it drew
 */
function roofOver(pc, x0, x1, yBot, rise, color, limit = 0, finial = null) {
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
    pc.px(x, y, light)
    pc.px(x, y + 1, dark)
    // Pantiles: a shaded column every third one, which is what reads as a tiled roof at 1×.
    if (x % 3 === 0) pc.vline(x, y + 2, yBot - 1, dark)
  }
  pc.hline(x0, x1, yBot, dark)
  pc.hline(x0, x1, yBot + 1, P.driftwoodDark) // the eaves board, overhanging
  const m = Math.round(mid)
  const ridge = Math.max(limit, yBot - rise)
  pc.hline(m - 2, m + 2, ridge, light)
  if (finial && ridge - 1 >= limit) {
    pc.vline(m, ridge - 2, ridge - 1, finial)
    return ridge - 2
  }
  return ridge
}

/** A window with its glazing bars and a sill, lit from within when the thread is. */
function paneOf(pc, x, y, w, h, lit) {
  const glass = lit ? P.windowLit : P.window
  box(pc, x, y, x + w - 1, y + h - 1, P.driftwoodDark)
  box(pc, x + 1, y + 1, x + w - 2, y + h - 2, glass)
  if (lit && w > 4 && h > 4) box(pc, x + 2, y + 2, x + w - 3, y + h - 3, P.windowLitCore)
  else if (!lit) pc.px(x + 1, y + 1, P.windowShine)
  const mx = Math.round(x + (w - 1) / 2)
  const my = Math.round(y + (h - 1) / 2)
  if (w >= 5) pc.vline(mx, y + 1, y + h - 2, P.sailClothShade)
  if (h >= 5) pc.hline(x + 1, x + w - 2, my, P.sailClothShade)
  pc.hline(x - 1, x + w, y + h - 1, P.sailCloth) // the sill, painted white as they all are
}

/** A plank door in the plot's colour, its foot on `base`, with a brass knob and a step. */
function doorOf(pc, x, base, w, h, accent) {
  const dark = shade(accent, -0.3)
  const light = shade(accent, 0.18)
  box(pc, x, base - h + 1, x + w - 1, base, accent)
  for (let i = 1; i < w; i += 2) pc.vline(x + i, base - h + 2, base, dark)
  pc.hline(x, x + w - 1, base - h + 1, light)
  pc.px(x + w - 2, base - Math.round(h / 2), P.brass)
  pc.hline(x - 1, x + w, base, P.seastoneLight) // the step, worn pale
}

/** A striped awning over x0..x1 on row y, in the plot's colour and sailcloth white. */
function awning(pc, x0, x1, y, accent) {
  for (let x = x0; x <= x1; x++) {
    const c = ((x >> 1) & 1) ? accent : P.sailCloth
    pc.px(x, y, c)
    pc.px(x, y + 1, shade(c, -0.22))
  }
  pc.hline(x0, x1, y - 1, P.driftwoodDark)
  // The scalloped hem, which is how an awning ends: every third column, so it reads as cloth
  // hanging rather than as a string of bunting.
  for (let x = x0 + 1; x <= x1; x += 3) pc.px(x, y + 2, ((x >> 1) & 1) ? shade(accent, -0.3) : P.sailClothShade)
}

/** A buoy hung on a wall at (x, y), which is where a spare one lives. */
function buoyAt(pc, x, y, i) {
  const c = buoyOf(i)
  pc.ellipse(x, y, 2.5, 3, c)
  // A band round its middle and a shaded foot: without them a pale float read as a blank blob.
  pc.hline(x - 2, x + 2, y, shade(c, -0.3))
  pc.hline(x - 1, x + 1, y + 2, shade(c, -0.3))
  pc.px(x - 1, y - 1, shade(c, 0.3))
  pc.px(x, y - 4, P.rope)
  pc.px(x, y - 3, P.seaIron)
}

/**
 * A life ring at (x, y): white with two opposite quarters painted red, and the hole open through
 * the middle of it. The hole is what makes it a ring rather than a white disc at this size.
 */
function ringAt(pc, x, y) {
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const d = dx * dx + dy * dy
      if (d > 10 || d < 2.5) continue
      // Opposite quarters red, the way a life ring is painted.
      pc.px(x + dx, y + dy, (dx < 0) === (dy < 0) ? P.lampRed : P.shellWhite)
    }
  }
  pc.px(x - 2, y - 2, P.shellWhite)
  pc.px(x, y - 4, P.rope)
}

/**
 * A gull standing at (x, y) with its feet on row y, facing `dir`: a white body, a grey folded
 * wing, black wingtips and a yellow beak. Four rows of it rather than three: at three it read as
 * an insect over the roof rather than as a bird sitting on it.
 */
function gullAt(pc, x, y, dir = 1) {
  // The head and the beak, above the body.
  pc.px(x - dir, y - 3, P.gull)
  pc.px(x - dir * 2, y - 3, P.gullBeak)
  // The body: white, with the wing folded along it and the tips out behind.
  pc.hline(x - 1, x + 2, y - 2, P.gull)
  pc.px(x - dir, y - 2, P.gull)
  pc.hline(x - 1, x + 1, y - 1, P.gullGrey)
  pc.px(x + dir * 2, y - 1, P.gullDark)
  pc.px(x + dir * 2, y - 2, P.gullGrey)
  // And the legs.
  pc.px(x, y, P.gullBeak)
  pc.px(x + (dir > 0 ? -1 : 1), y, P.gullBeak)
}

/** A coil of rope on the ground at (x, y). */
function coilAt(pc, x, y) {
  pc.ellipse(x, y, 3.5, 1.6, P.ropeDark)
  pc.ellipse(x, y - 1, 2.5, 1.2, P.rope)
  pc.px(x, y - 1, P.ropeLight)
}

/**
 * A hull on trestles or hauled up, x0..x1 with its keel on `base`: tarred below the waterline,
 * painted above it in `color`, with the sheer line running up to a raised bow at `bowRight`.
 */
function hullAt(pc, x0, x1, base, color, bowRight = true) {
  const light = shade(color, 0.2)
  const dark = shade(color, -0.3)
  const len = x1 - x0
  for (let x = x0; x <= x1; x++) {
    const t = (x - x0) / len
    // The sheer: she rises to the bow and, less, to the stern, so the top edge is a curve rather
    // than a straight line. Without it a hull read as a painted box.
    const rise = Math.round(((bowRight ? t : 1 - t) ** 2 * 6) + ((bowRight ? 1 - t : t) ** 3 * 3))
    const top = base - 4 - rise
    pc.vline(x, top, base - 2, color)
    pc.px(x, top, light) // the gunwale, catching the light all along her
    pc.px(x, top + 1, dark)
    pc.vline(x, base - 2, base, P.pitch) // below the waterline
    if (x % 5 === 0) pc.px(x, top + 3, dark)
  }
  pc.hline(x0, x1, base - 3, dark) // the rubbing strake
  pc.hline(x0 + 1, x1 - 1, base - 2, P.sailClothShade) // and the white line above the tar
  const bow = bowRight ? x1 : x0
  pc.vline(bow, base - 11, base - 4, shade(color, -0.4))
  pc.px(bow, base - 12, bowRight ? P.lampGreen : P.lampRed) // her light, on the bow
}

/**
 * The staging a building sits in while it is going up: larch poles lashed with rope and a lift or
 * two of boards, the way a boatyard stages a hull. Nothing galvanised in this harbour.
 */
const LIFT = 8
function staging(pc, x0, x1, top, base) {
  const posts = x1 - x0 > 18 ? [x0, Math.round((x0 + x1) / 2), x1] : [x0, x1]
  for (const x of posts) {
    pc.vline(x, top, base, P.driftwood)
    pc.px(x, top, P.driftwoodLight)
    pc.hline(x - 1, x + 1, base, P.driftwoodDark)
  }
  for (let y = base - LIFT; y >= top + 3; y -= LIFT) {
    pc.hline(x0, x1, y, P.driftwoodLight)
    pc.hline(x0, x1, y + 1, P.driftwood)
    for (const x of posts) pc.px(x, y, P.rope)
  }
  pc.px(x0 + 1, top + 1, P.rope)
}

// ---------- the ground being made ready ----------

function site(pc, rand, stage, oy, variant) {
  const Y = (y) => y + oy
  pc.ellipse(16, Y(43), 15.5, 4.5, P.seaGround[0][3])
  for (let i = 0; i < 12; i++) pc.px(2 + Math.floor(rand() * 28), Y(40 + Math.floor(rand() * 7)), P.shellGrit)
  const left = variant % 2 === 0
  if (stage === 0) {
    // The plot marked out the way anything is marked out here: stakes driven into the sand with a
    // line of rope run round them, and a float tied on so nobody walks into it.
    for (const dx of [-13, -6, 0, 6, 13]) {
      pc.vline(16 + dx, Y(36), Y(43), P.driftwood)
      pc.px(16 + dx, Y(36), P.driftwoodLight)
    }
    for (let x = 3; x <= 29; x++) pc.px(x, Y(37 + (x % 7 === 3 ? 1 : 0)), (x & 1) ? P.rope : P.ropeDark)
    buoyAt(pc, left ? 10 : 22, Y(41), 1)
    frond(pc, left ? 24 : 6, Y(44), false)
    return
  }
  // The frame up: a sill plate bedded on the sand, corner posts and a head plate, studs between
  // them, and a ladder leaning on it. What is waiting to go in is stacked at its foot rather than
  // in front of it, or the stack hid the frame it belongs to.
  box(pc, 4, Y(41), 27, Y(43), P.driftwoodDark)
  pc.hline(4, 27, Y(41), P.driftwood)
  for (const x of [7, 24]) {
    box(pc, x, Y(27), x + 1, Y(41), P.driftwood)
    pc.vline(x, Y(27), Y(41), P.driftwoodLight)
  }
  pc.hline(6, 26, Y(26), P.driftwoodLight)
  pc.hline(6, 26, Y(27), P.driftwoodDark)
  for (let x = 11; x <= 21; x += 5) pc.vline(x, Y(28), Y(40), P.driftwoodDark)
  pc.hline(8, 23, Y(34), P.driftwood) // the noggin across them
  // The ladder against the frame, up the side nobody is working on.
  const lx = left ? 2 : 29
  const dx = left ? 1 : -1
  pc.line(lx, Y(43), lx + dx * 5, Y(24), P.driftwoodLight)
  pc.line(lx + dx, Y(43), lx + dx * 6, Y(24), P.driftwood)
  for (let i = 0; i < 6; i++) {
    const t = i / 6
    pc.hline(lx + Math.round(dx * t * 5), lx + Math.round(dx * (1 + t * 5)), Y(42 - i * 3), P.driftwoodDark)
  }
  // Boards and a heap of shingle at the foot of it.
  const bx = left ? 16 : 6
  for (let i = 0; i < 2; i++) {
    pc.hline(bx, bx + 9, Y(44 - i * 2), P.driftwoodLight)
    pc.hline(bx, bx + 9, Y(43 - i * 2), P.driftwood)
  }
  pc.ellipse(left ? 9 : 23, Y(43), 4, 2.5, P.seaGround[1][0])
  pc.ellipse(left ? 9 : 23, Y(42), 2.5, 1.5, P.seaGround[1][2])
}

// ---------- quayhouse: a tall house on the harbour front ----------

function quayhouseSpec(low = false) {
  const base = 46
  const wallTop = low ? base - 22 : base - 28
  return { base, wallTop, stackTop: Math.max(DOORSTEP_CLEAR + 1, wallTop - 10) }
}

function quayhouse(pc, o) {
  const s = quayhouseSpec(o.low)
  const lim = ceiling(o.low)
  const r = specRand('quayhouse', o.variant)
  const material = materialOf(r, o.wall)
  const tone = Math.floor(r() * 3)
  const doorLeft = r() < 0.5
  const paint = paintOf(o.roofs, tone + 1)
  wallOf(pc, 4, s.wallTop, 27, s.base, material, o.rand, paint)
  pc.hline(4, 27, s.base, P.seastoneDark)
  const doorX = doorLeft ? 6 : 21
  doorOf(pc, doorX, s.base - 1, 6, 11, o.accent)
  paneOf(pc, doorLeft ? 16 : 9, s.base - 11, 7, 7, o.lit)
  paneOf(pc, 19, s.wallTop + 4, 7, 8, o.lit)
  // The loft door with the hoist beam out over it, and the block hanging off the end of the beam:
  // what a harbour house has instead of a front garden, for getting a catch or a cargo up off the
  // quay. Always the left-hand bay, because the stack goes up the right-hand one; both sit on the
  // wall under the eaves, so the roof goes on over them.
  const loft = s.wallTop + 4
  box(pc, 5, loft, 11, loft + 7, P.driftwoodDark)
  box(pc, 6, loft + 1, 10, loft + 7, o.lit ? P.windowLit : P.interior)
  pc.vline(8, loft + 1, loft + 7, P.driftwoodDark)
  pc.hline(4, 12, loft - 1, P.driftwood)
  pc.hline(3, 12, loft - 2, P.driftwoodLight)
  pc.hline(3, 12, loft - 3, P.driftwood)
  pc.vline(3, loft - 1, loft + 1, P.ropeDark)
  pc.px(3, loft + 2, P.seaIron)
  buoyAt(pc, doorLeft ? 15 : 17, s.base - 15, o.variant)
  if (!o.roof) return { x0: 3, x1: 28, top: s.wallTop }
  const color = roofPaintOf(o.roofs, tone)
  const top = roofOver(pc, 1, 30, s.wallTop - 1, 10, color, lim)
  // The stack at the gable end, and a gull sitting on the ridge as one always is.
  for (let y = s.stackTop; y <= s.wallTop; y += 3) {
    pc.hline(23, 27, y, P.seastone)
    pc.hline(23, 27, y + 1, P.seastoneDark)
    pc.hline(23, 27, y + 2, P.seastoneLight)
  }
  pc.hline(22, 28, s.stackTop, P.seastoneLight)
  gullAt(pc, 11, Math.max(lim + 3, top), 1)
  return null
}

// ---------- hut: a beach hut with its doors thrown open ----------

function hutSpec(low = false) {
  const base = 46
  const wallTop = low ? base - 14 : base - 17
  return { base, wallTop, flueTop: Math.max(DOORSTEP_CLEAR + 2, wallTop - 7) }
}

function hut(pc, o) {
  const s = hutSpec(o.low)
  const lim = ceiling(o.low)
  const r = specRand('hut', o.variant)
  const material = materialOf(r, o.wall)
  const tone = Math.floor(r() * 3)
  const paint = paintOf(o.roofs, tone)
  // The deck out front, on short legs in the sand, with two steps up to it.
  box(pc, 3, s.base - 3, 28, s.base - 2, P.driftwood)
  pc.hline(3, 28, s.base - 3, P.driftwoodLight)
  for (const x of [4, 15, 27]) pc.vline(x, s.base - 1, s.base, P.driftwoodDark)
  pc.hline(11, 20, s.base - 1, P.driftwood)
  pc.hline(11, 20, s.base, P.driftwoodDark)
  wallOf(pc, 5, s.wallTop, 26, s.base - 4, 'clinker', o.rand, paint)
  // The double doors, standing open, with the inside of the hut showing between them: a shelf of
  // things across the back and a folded chair leaning in the corner, so the doorway reads as a
  // hut somebody uses rather than as a hole cut in the front.
  box(pc, 12, s.wallTop + 3, 19, s.base - 4, P.interior)
  if (o.lit) box(pc, 13, s.wallTop + 4, 18, s.base - 5, P.windowLit)
  pc.hline(12, 19, s.base - 9, P.driftwoodDark)
  pc.hline(12, 19, s.base - 10, P.driftwood)
  for (const [x, c] of [[13, P.harbourPaint[2]], [15, P.shellWhite], [17, P.harbourPaint[0]]]) {
    pc.px(x, s.base - 11, c)
    pc.px(x, s.base - 12, shade(c, -0.25))
  }
  pc.vline(18, s.base - 8, s.base - 4, o.accent)
  pc.vline(19, s.base - 7, s.base - 4, shade(o.accent, -0.3))
  for (const x of [9, 20]) {
    box(pc, x, s.wallTop + 3, x + 2, s.base - 4, o.accent)
    pc.vline(x, s.wallTop + 3, s.base - 4, shade(o.accent, 0.18))
    pc.px(x + 2, s.base - 8, P.brass)
  }
  // A number painted on the front, which every hut has.
  pc.vline(7, s.wallTop + 4, s.wallTop + 8, P.sailCloth)
  if (o.variant % 2) pc.hline(7, 8, s.wallTop + 4, P.sailCloth)
  paneOf(pc, 22, s.wallTop + 4, 4, 5, o.lit)
  // A bucket and a folded chair on the deck, and the kettle's flue out of the back.
  pc.hline(24, 26, s.base - 5, P.corrugatedLight)
  pc.hline(24, 26, s.base - 4, P.corrugatedDark)
  for (let y = s.flueTop; y <= s.wallTop + 2; y++) pc.px(7, y, (y & 1) ? P.seaIron : P.seaIronLight)
  if (!o.roof) return { x0: 4, x1: 27, top: s.wallTop }
  const top = roofOver(pc, 2, 29, s.wallTop - 1, 6, roofPaintOf(o.roofs, tone + 2), lim)
  awning(pc, 7, 24, Math.max(lim + 3, s.wallTop + 2), o.accent)
  pc.hline(6, 8, Math.max(lim, s.flueTop - 1), P.seaIronLight)
  return null
}

// ---------- chandlery: the shop that sells what a boat needs ----------

function chandlery(pc, o) {
  const r = specRand('chandlery', o.variant)
  const material = materialOf(r, o.wall)
  const tone = Math.floor(r() * 3)
  const base = 46
  const wallTop = o.low ? base - 22 : base - 26
  const lim = ceiling(o.low)
  const paint = paintOf(o.roofs, tone)
  wallOf(pc, 4, wallTop, 27, base, material, o.rand, paint)
  pc.hline(4, 27, base, P.seastoneDark)
  // The shopfront: a bay window with the stock in it, and the door beside it.
  const doorLeft = r() < 0.5
  const wx = doorLeft ? 13 : 4
  box(pc, wx, base - 14, wx + 14, base - 1, P.driftwoodDark)
  paneOf(pc, wx + 1, base - 13, 6, 9, o.lit)
  paneOf(pc, wx + 8, base - 13, 6, 9, o.lit)
  pc.hline(wx, wx + 14, base - 15, P.driftwood)
  doorOf(pc, doorLeft ? 6 : 24, base - 1, 5, 12, o.accent)
  // The fascia across the upper storey with an anchor painted on it, and the one window beside it:
  // a chandler says what it sells on the wall, where it can be read from the quay.
  const fx = doorLeft ? 4 : 16
  // Roof paint on the fascia, never the family's white: a white board on a limewashed wall was
  // there and unreadable.
  const sign = roofPaintOf(o.roofs, tone + 1)
  box(pc, fx, wallTop + 3, fx + 11, wallTop + 9, sign)
  pc.hline(fx, fx + 11, wallTop + 3, shade(sign, 0.2))
  pc.hline(fx, fx + 11, wallTop + 9, shade(sign, -0.3))
  const ax = fx + 5
  pc.vline(ax, wallTop + 4, wallTop + 8, P.sailCloth) // the anchor's shank
  pc.hline(ax - 2, ax + 2, wallTop + 5, P.sailCloth) // its stock
  pc.px(ax - 2, wallTop + 7, P.sailCloth) // and the arms of it
  pc.px(ax + 2, wallTop + 7, P.sailCloth)
  pc.px(ax - 3, wallTop + 6, P.sailClothShade)
  pc.px(ax + 3, wallTop + 6, P.sailClothShade)
  paneOf(pc, doorLeft ? 19 : 8, wallTop + 3, 6, 7, o.lit)
  // Stock out on the pavement: a barrel, a coil of rope and buoys hung up.
  const bx = doorLeft ? 2 : 28
  box(pc, bx, base - 7, bx + 2, base - 1, P.driftwood)
  pc.hline(bx, bx + 2, base - 7, P.driftwoodLight)
  pc.hline(bx, bx + 2, base - 4, P.seaIron)
  coilAt(pc, doorLeft ? 30 : 2, base - 2)
  if (!o.roof) return { x0: 3, x1: 28, top: wallTop }
  const top = roofOver(pc, 1, 30, wallTop - 1, 9, roofPaintOf(o.roofs, tone + 2), lim)
  awning(pc, wx - 1, wx + 15, base - 16, o.accent)
  return null
}

// ---------- netloft: where the nets and the gear are kept, up out of the wet ----------

function netloft(pc, o) {
  const r = specRand('netloft', o.variant)
  const material = materialOf(r, o.wall)
  const tone = Math.floor(r() * 3)
  const base = 46
  const floor = base - 8
  const wallTop = o.low ? base - 25 : base - 30
  const lim = ceiling(o.low)
  // Staddle posts, so the sea can go under it: the loft stands on them with its floor above.
  for (const x of [5, 15, 25]) {
    box(pc, x, floor, x + 2, base - 1, P.pitch)
    pc.vline(x, floor, base - 1, P.tarboardLight)
    pc.hline(x - 1, x + 3, base, P.seastoneDark)
  }
  box(pc, 3, floor - 1, 28, floor + 1, P.driftwood)
  pc.hline(3, 28, floor - 1, P.driftwoodLight)
  wallOf(pc, 4, wallTop, 27, floor - 2, material, o.rand, null)
  // The hoist door in the middle, open, under a pale lintel with the beam and the block over it.
  box(pc, 13, wallTop + 7, 18, floor - 2, P.interior)
  if (o.lit) box(pc, 14, wallTop + 8, 17, floor - 3, P.windowLit)
  box(pc, 12, wallTop + 5, 19, wallTop + 6, P.driftwoodLight)
  pc.hline(12, 19, wallTop + 6, P.driftwoodDark)
  // The gable board across the front, which is where a loft is painted and lettered.
  pc.hline(4, 27, wallTop + 3, P.driftwoodLight)
  pc.hline(4, 27, wallTop + 4, P.driftwood)
  paneOf(pc, 6, wallTop + 7, 5, 6, o.lit)
  paneOf(pc, 21, wallTop + 7, 5, 6, o.lit)
  // Nets hung over the rail to dry, down the front of it.
  for (let x = 4; x <= 27; x++) {
    if (((x + 1) % 3 + 3) % 3 === 0) continue
    pc.px(x, floor + 2, P.netTwine)
    pc.px(x, floor + 3, P.netTwineDark)
    if (x % 4 === 0) pc.px(x, floor + 4, P.netTwineDark)
  }
  pot(pc, 8, base - 1, 3, 4)
  if (!o.roof) return { x0: 3, x1: 28, top: wallTop }
  const top = roofOver(pc, 1, 30, wallTop - 1, 9, roofPaintOf(o.roofs, tone), lim)
  const beam = Math.max(lim + 1, wallTop - 3)
  pc.hline(13, 18, beam, P.driftwood)
  pc.hline(13, 18, beam + 1, P.driftwoodDark)
  pc.vline(16, beam + 2, beam + 4, P.rope)
  pc.px(16, beam + 5, P.seaIron)
  gullAt(pc, 6, Math.max(lim + 3, top), 1)
  return null
}

// ---------- lookout: the coastguard's watch, up where it can see ----------

function lookout(pc, o) {
  const r = specRand('lookout', o.variant)
  const material = materialOf(r, o.wall)
  const tone = Math.floor(r() * 3)
  const base = 58
  const watch = 16
  const paint = paintOf(o.roofs, tone)
  // The tower carries the watch room right up to the gallery it stands on: at anything less it
  // floated above the base with only the stair holding it up.
  wallOf(pc, 7, watch + 14, 24, base, material, o.rand, null)
  pc.hline(7, 24, base, P.seastoneDark)
  doorOf(pc, 13, base - 1, 6, 10, o.accent)
  paneOf(pc, 8, base - 22, 5, 6, o.lit)
  paneOf(pc, 19, base - 22, 5, 6, o.lit)
  // The stair up the side, and the gallery it lands on.
  for (let y = base - 5; y >= base - 24; y -= 3) pc.hline(3, 6, y, P.driftwood)
  pc.vline(3, base - 25, base - 2, P.driftwoodDark)
  box(pc, 4, watch + 12, 27, watch + 13, P.driftwood)
  pc.hline(4, 27, watch + 12, P.driftwoodLight)
  // The watch room: glazed on three sides, which is the whole point of it.
  wallOf(pc, 8, watch + 2, 23, watch + 11, 'clinker', o.rand, paint)
  paneOf(pc, 9, watch + 3, 6, 7, o.lit)
  paneOf(pc, 16, watch + 3, 6, 7, o.lit)
  // The railing round the gallery.
  for (let x = 4; x <= 27; x += 3) pc.vline(x, watch + 8, watch + 11, P.sailCloth)
  pc.hline(4, 27, watch + 8, P.sailCloth)
  pc.hline(4, 27, watch + 9, P.sailClothShade)
  if (!o.roof) return { x0: 6, x1: 25, top: watch + 2 }
  roofOver(pc, 6, 25, watch + 1, 5, roofPaintOf(o.roofs, tone + 1), 1)
  // The mast, and the signal flags on it: they blow one way and then the other.
  const mast = o.frame % 2 ? 1 : -1
  pc.vline(26, 3, watch + 11, P.sailCloth)
  pc.px(26, 3, P.brass)
  for (let i = 0; i < 3; i++) {
    const y = 5 + i * 4
    const c = paintOf(o.roofs, tone + i)
    pc.hline(26 + mast, 26 + mast * 4, y, c)
    pc.hline(26 + mast, 26 + mast * 3, y + 1, shade(c, -0.25))
  }
  gullAt(pc, 6, watch + 12, 1)
  return null
}

// ---------- boatshed: an open shed with a hull in it ----------

function boatshedSpec(low = false) {
  const base = 46
  const eave = low ? base - 22 : base - 26
  return { base, eave, kettleTop: Math.max(DOORSTEP_CLEAR + 2, base - 20) }
}

function boatshed(pc, o) {
  const s = boatshedSpec(o.low)
  const lim = ceiling(o.low)
  const r = specRand('boatshed', o.variant)
  const material = materialOf(r, o.wall)
  const tone = Math.floor(r() * 3)
  // The back and the sides; the front stands open to the slip.
  wallOf(pc, 2, s.eave, 29, s.base, material, o.rand, null)
  box(pc, 5, s.eave + 4, 24, s.base, P.interior)
  pc.hline(2, 29, s.base, P.seastoneDark)
  // The hull inside, up on its trestles, with the light of the work on it.
  hullAt(pc, 6, 23, s.base - 5, paintOf(o.roofs, tone), o.variant % 2 === 0)
  for (const x of [9, 20]) {
    pc.vline(x, s.base - 4, s.base - 1, P.driftwoodDark)
    pc.hline(x - 2, x + 2, s.base - 5, P.driftwood)
  }
  if (o.lit) {
    pc.hline(11, 18, s.eave + 5, P.lampGlow)
    pc.px(14, s.eave + 6, P.windowLitCore)
  }
  // The posts holding the front up, and the rail over them.
  for (const x of [4, 25]) {
    box(pc, x, s.eave + 3, x + 1, s.base - 1, P.driftwood)
    pc.vline(x, s.eave + 3, s.base - 1, P.driftwoodLight)
  }
  paneOf(pc, 26, s.eave + 5, 4, 5, o.lit)
  // The tar kettle outside, on its legs over a fire: the one thing alight in a boatyard.
  pc.ellipse(26, s.base - 4, 3, 2.5, P.seaIron)
  pc.hline(23, 29, s.base - 6, P.seaIronLight)
  for (const dx of [-2, 2]) pc.vline(26 + dx, s.base - 2, s.base, P.seaIron)
  for (let y = s.kettleTop; y <= s.base - 7; y += 2) pc.px(26, y, P.seaIronLight)
  coilAt(pc, 3, s.base - 1)
  if (!o.roof) return { x0: 2, x1: 29, top: s.eave }
  const top = roofOver(pc, 1, 30, s.eave - 1, 8, roofPaintOf(o.roofs, tone + 1), lim)
  // Sawdust and shavings under the shed door.
  for (let x = 6; x <= 23; x += 3) pc.px(x, s.base, P.driftwoodLight)
  return null
}

// ---------- pump: fresh water on the quay ----------

function pump(pc, o) {
  const r = specRand('pump', o.variant)
  const tone = Math.floor(r() * 3)
  const base = 46
  const top = o.low ? base - 22 : base - 27
  const lim = ceiling(o.low)
  // The trough, cut from one block of shore stone and never dry.
  box(pc, 4, base - 8, 21, base, P.seastone)
  pc.hline(4, 21, base - 8, P.seastoneLight)
  pc.hline(4, 21, base, P.seastoneDark)
  box(pc, 6, base - 7, 19, base - 4, P.tidePool)
  pc.hline(7, 18, base - 7, P.tidePoolLight)
  for (const x of [8, 16]) pc.px(x, base - 6, P.tidePoolLight)
  // The pump itself: a cast-iron column with a curved spout and a long handle.
  const stand = paintOf(o.roofs, tone)
  box(pc, 22, top + 6, 26, base - 1, stand)
  pc.vline(22, top + 6, base - 1, shade(stand, 0.2))
  pc.vline(26, top + 6, base - 1, shade(stand, -0.28))
  pc.hline(21, 27, top + 5, shade(stand, 0.2))
  pc.hline(21, 27, top + 6, shade(stand, -0.28))
  for (const y of [top + 12, base - 6]) pc.hline(22, 26, y, shade(stand, -0.28))
  pc.hline(19, 22, top + 10, P.seaIron)
  pc.px(19, top + 11, P.seaIronLight)
  pc.vline(18, top + 8, top + 9, P.brass) // the handle, up
  pc.hline(14, 18, top + 8, P.brass)
  pc.px(13, top + 9, P.brassDark)
  // A bucket under the spout, and a gull on the trough's end.
  box(pc, 16, base - 5, 20, base - 1, P.corrugated)
  pc.hline(16, 20, base - 5, P.corrugatedLight)
  pc.hline(16, 20, base - 3, P.corrugatedDark)
  pc.hline(15, 21, base - 6, P.seaIron)
  gullAt(pc, 8, base - 8, 1)
  if (!o.roof) return { x0: 4, x1: 27, top: top + 5 }
  // A little roof on two posts over the pump, so the water stays clean.
  for (const x of [20, 28]) {
    pc.vline(x, top + 4, base - 1, P.driftwood)
    pc.px(x, top + 4, P.driftwoodLight)
  }
  roofOver(pc, 18, 30, top + 3, 5, roofPaintOf(o.roofs, tone + 1), lim)
  shell(pc, 12, base - 10, o.variant)
  return null
}

// ---------- oysterbeds: trestles out on the wet sand ----------

function oysterbeds(pc, o) {
  const r = specRand('oysterbeds', o.variant)
  const tone = Math.floor(r() * 3)
  const base = 46
  const top = base - 16
  // Four rows of trestles with the bags of oysters laid along them, the wet sand between.
  for (let row = 0; row < 4; row++) {
    const y = base - row * 4
    pc.hline(1, 30, y - 3, P.seaGround[0][3])
    pc.hline(1, 30, y - 2, P.tidePool)
    pc.hline(1, 30, y - 1, P.driftwoodDark)
    pc.hline(1, 30, y, P.driftwood)
    for (let x = 2 + (row % 2) * 3; x <= 28; x += 6) {
      box(pc, x - 1, y - 4, x + 2, y - 2, row % 2 ? P.netTwineDark : P.pitch)
      pc.hline(x - 1, x + 2, y - 4, row % 2 ? P.netTwine : P.tarboardLight)
      pc.px(x, y - 3, P.shellShade)
    }
  }
  // The frame the baskets stack against, along the back.
  for (let x = 2; x <= 29; x += 5) {
    pc.vline(x, top + 2, base - 14, P.driftwood)
    pc.px(x, top + 2, P.driftwoodLight)
  }
  pc.hline(2, 29, top + 2, P.driftwoodDark)
  if (!o.roof) return { x0: 1, x1: 30, top: top + 2 }
  // The baskets on the frame, and the gulls that come for what is in them: the last thing here.
  for (let x = 3; x <= 27; x += 6) {
    box(pc, x, top, x + 4, top + 2, paintOf(o.roofs, tone))
    pc.hline(x, x + 4, top, shade(paintOf(o.roofs, tone), 0.2))
    pc.px(x + 2, top + 1, P.shellWhite)
  }
  gullAt(pc, 15, top, 1)
  gullAt(pc, 26, top, -1)
  return null
}

// ---------- daymark: a tower to steer by, and no light in it ----------

function daymark(pc, o) {
  const r = specRand('daymark', o.variant)
  const material = materialOf(r, o.wall)
  const tone = Math.floor(r() * 3)
  const base = 58
  const top = 8
  const band = paintOf(o.roofs, tone)
  // A tapering tower: its half-width goes from three at the top to eleven at the foot.
  const halfAt = (y) => 3 + Math.round(((y - top) / (base - top)) ** 0.85 * 8)
  for (let y = top; y <= base; y++) {
    const half = halfAt(y)
    box(pc, 16 - half, y, 15 + half, y, P.seastone)
  }
  // Its courses, and the bands of paint that make it a daymark rather than a chimney.
  for (let y = top; y <= base; y++) {
    const half = halfAt(y)
    const banded = Math.floor((y - top) / 9) % 2 === 1
    for (let x = 16 - half; x <= 15 + half; x++) {
      if (banded) pc.px(x, y, (y - top) % 9 === 0 ? shade(band, 0.2) : band)
      else if ((y - top) % 4 === 3) pc.px(x, y, material === 'limewash' ? P.limewashShade : P.seastoneDark)
      else if (material === 'limewash') pc.px(x, y, P.limewash)
    }
    pc.px(16 - half, y, banded ? shade(band, 0.2) : P.seastoneLight)
    pc.px(15 + half, y, banded ? shade(band, -0.28) : P.seastoneDark)
  }
  pc.hline(16 - halfAt(base), 15 + halfAt(base), base, P.seastoneDark)
  doorOf(pc, 13, base - 1, 6, 10, o.accent)
  paneOf(pc, 13, base - 20, 6, 7, o.lit)
  paneOf(pc, 14, base - 33, 4, 5, o.lit)
  if (!o.roof) return { x0: 2, x1: 29, top }
  // The topmark: a black ball on a short mast, which is how a daymark is read by day. It carries
  // no lamp on purpose — the light on this coast is the plot's own landmark, not a thread's house.
  pc.hline(11, 20, top - 1, P.seastoneLight)
  pc.hline(11, 20, top, P.seastoneDark)
  pc.vline(16, top - 6, top - 2, P.seaIron)
  pc.ellipse(16, top - 8, 3, 3, P.pitch)
  pc.px(15, top - 9, P.tarboardLight)
  return null
}

// ---------- sailloft: a glazed loft where the sails are cut ----------

function sailloft(pc, o) {
  const r = specRand('sailloft', o.variant)
  const tone = Math.floor(r() * 3)
  const base = 46
  const eave = o.low ? base - 18 : base - 23
  const lim = ceiling(o.low)
  // A plinth of shore stone, and glazing in an iron frame above it, as a sail loft is lit.
  box(pc, 3, base - 5, 28, base, P.seastone)
  pc.hline(3, 28, base - 5, P.seastoneLight)
  pc.hline(3, 28, base, P.seastoneDark)
  box(pc, 3, eave, 28, base - 6, P.glass)
  for (let y = eave; y <= base - 6; y++) for (let x = 3; x <= 28; x++) if ((x + y) % 5 === 0) pc.px(x, y, P.glassLight)
  for (let x = 3; x <= 28; x += 5) pc.vline(x, eave, base - 6, P.seaIron)
  for (let y = eave; y <= base - 6; y += 5) pc.hline(3, 28, y, P.seaIron)
  // The sails hanging inside, seen through the glass, and the bench they are cut on.
  for (let x = 5; x <= 26; x += 7) {
    box(pc, x, eave + 3, x + 4, base - 10, o.lit ? P.sailCloth : P.sailClothShade)
    pc.vline(x + 4, eave + 3, base - 10, P.sailClothShade)
    pc.px(x + 1, eave + 2, P.rope)
  }
  pc.hline(4, 27, base - 8, P.driftwood)
  pc.hline(4, 27, base - 7, P.driftwoodDark)
  if (o.lit) for (let x = 7; x <= 26; x += 6) pc.px(x, eave + 1, P.lampGlow)
  // The door, its top half glazed.
  box(pc, 13, base - 14, 18, base - 1, P.driftwoodDark)
  box(pc, 14, base - 13, 17, base - 8, o.lit ? P.windowLit : P.window)
  box(pc, 14, base - 7, 17, base - 1, o.accent)
  pc.px(17, base - 4, P.brass)
  if (!o.roof) return { x0: 2, x1: 29, top: eave }
  const top = roofOver(pc, 1, 30, eave - 1, 8, roofPaintOf(o.roofs, tone), lim)
  // A ridge light along the top, for cutting cloth by.
  for (let x = 10; x <= 21; x += 2) pc.px(x, Math.max(lim, top + 3), x % 6 ? P.glassLight : P.window)
  gullAt(pc, 5, Math.max(lim + 3, top), 1)
  return null
}

// ---------- fishstall: the day's catch, out on a trestle ----------

function fishstall(pc, o) {
  const r = specRand('fishstall', o.variant)
  const tone = Math.floor(r() * 3)
  const base = 46
  const eave = base - 21
  const lim = ceiling(o.low)
  for (const x of [6, 25]) {
    pc.vline(x, eave + 2, base - 1, P.driftwood)
    pc.vline(x + (x < 16 ? 1 : -1), eave + 2, base - 1, P.driftwoodDark)
    pc.hline(x - 1, x + 1, base, P.driftwoodDark)
  }
  // The slab, tilted towards the customer, with the catch laid out on crushed ice.
  box(pc, 4, base - 11, 27, base - 8, P.driftwoodLight)
  pc.hline(4, 27, base - 8, P.driftwoodDark)
  box(pc, 5, base - 14, 26, base - 12, P.tidePoolLight)
  for (let i = 0; i < 5; i++) {
    const x = 6 + i * 4
    pc.hline(x, x + 2, base - 13, i % 2 ? P.metal : P.gullGrey)
    pc.px(x + 3, base - 13, P.lampRed)
    pc.px(x, base - 14, P.metalDark)
  }
  // The scale hung off the corner, a crate below, and pots stacked under the trestle.
  pc.vline(24, base - 19, base - 17, P.brass)
  pc.hline(22, 26, base - 17, P.brassDark)
  pc.ellipse(24, base - 15, 2, 1.5, P.metal)
  box(pc, 8, base - 6, 14, base - 1, P.driftwood)
  pc.hline(8, 14, base - 6, P.driftwoodLight)
  pc.hline(8, 14, base - 4, P.driftwoodDark)
  pot(pc, 19, base - 1, 3, 4)
  if (!o.roof) return { x0: 4, x1: 27, top: eave + 2 }
  const top = roofOver(pc, 3, 28, eave + 1, 6, roofPaintOf(o.roofs, tone), lim)
  awning(pc, 4, 27, Math.max(lim + 2, eave + 1), o.accent)
  gullAt(pc, 28, Math.max(lim + 4, top + 5), -1)
  return null
}

// ---------- drawing one ----------

const KINDS = { quayhouse, hut, chandlery, netloft, lookout, boatshed, pump, oysterbeds, daymark, sailloft, fishstall }
/** Nothing to put up: these need no staging. */
const NO_STAGING = new Set(['pump', 'oysterbeds', 'fishstall'])

/**
 * @param {{ kind: string, stage: number, accent: string, variant: number, lit: boolean, frame?: number, wall?: number, roofs?: number, low?: boolean, wear?: number }} o
 */
export function drawSeaBuilding(o) {
  const kind = KINDS[o.kind] ? o.kind : 'hut'
  const variant = o.variant || 0
  const H = heightOf(kind)
  const pc = new PixelCanvas(BUILDING_W, H)
  const seed = variant * 6151 + 53
  if (o.stage <= 1) {
    site(pc, mulberry32(seed), o.stage, H - 48, variant)
    return pc.outline(P.outline)
  }
  const draw = KINDS[kind]
  const frameNo = o.frame || 0
  const opts = {
    rand: mulberry32(seed), accent: o.accent || P.harbourPaint[0], lit: Boolean(o.lit), roof: o.stage >= 3, frame: frameNo, variant,
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

// The parts the harbour's landmarks are built from too (see landmarks.js).
export { MATERIALS, box, buoyAt, coilAt, doorOf, gullAt, hullAt, paintOf, paneOf, ringAt, site, staging, wallOf }
