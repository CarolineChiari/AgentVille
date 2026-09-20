// Halloween buildings: what each thread builds in a village on the last night of October, drawn
// the way the village's buildings are (src/render/sprites/buildings.js): the plot's wall material
// and roof family on them, its accent on the doors, awnings and bunting, a jack-o'-lantern on the
// step of every one, and a finished one aged by its wear.
//
// Contract (see ThemePack in ../index.js and the village's src/render/sprites/buildings.js):
// - A thread's building kind (KINDS in src/sim/building.js) maps to a Halloween kind through `fitted`.
// - Every sprite is BUILDING_W (32) wide and heightOf() tall, its bottom row on the ground.
// - Down a courtyard's sides (`fitted(kind, variant, false)`) a building is 48 tall and draws
//   nothing above row DOORSTEP_CLEAR (9), outline included, at every stage: the villager at the
//   door of the house above stands there.
// - Stages 0 and 1 are the ground being made ready; 2 is the building without its roof
//   (`roof: false`) inside a staging of rough poles; 3 is finished. Stage 3 is weathered by
//   `wear` exactly as the village's buildings are (see drawBuilding there).
// - `wall` indexes THEMES.halloween.dims.wall; `roofs` its roof families; `accent` is the plot's
//   colour, for doors, awnings and bunting. Every colour from the palette.
//
// Windows keep the village's glass colours and its warm lit yellow. That is not for want of a
// green one: the weathering pass finds windows by those exact colours (GLASS_COLORS in
// weathering.js), so a green pane would never crack, break or get boarded up as a house aged.
// The theme's green goes on what is not a window — a kiln, a cauldron, the gaps in boards.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { BUILDING_W, DOORSTEP_CLEAR } from '../../sprites/buildings.js'
import { lookFor, weather } from '../../sprites/weathering.js'
import { mulberry32, pick, rngFor } from '../../../sim/rng.js'
import { THEMES } from '../../../sim/themes.js'
import { KEPT } from '../../../sim/wear.js'

/** A thread's building, by its kind, on Halloween night. */
export const HALLOW_KINDS = {
  house: 'manor', cottage: 'hovel', shop: 'sweetshop', barn: 'haybarn', windmill: 'mill',
  workshop: 'carvery', well: 'wishwell', farm: 'patch', tower: 'hollowtree', greenhouse: 'glasshouse', stall: 'treatstall',
}
const TALL = { mill: 60, hollowtree: 60 }
/** What a mill or a great dead tree is built as down the sides, where there is no room for it. */
const STAND_INS = ['hovel', 'sweetshop', 'haybarn', 'glasshouse']
const MATERIALS = THEMES.halloween.dims.wall
/**
 * The roofs and paint a plot's buildings share, by its `roofs`: three related colours each, as
 * indices into the palette's hallowRoof (pumpkin, purple, poison green, bone, blood, midnight,
 * candy pink, moon yellow). One family per sub-theme, which is what tells the lanes apart.
 */
const ROOF_FAMILIES = [[0, 4, 7], [5, 1, 3], [3, 2, 5], [6, 0, 7], [1, 2, 0]]
/** The highest row anything may be drawn on, leaving the outline its row above. */
const ceiling = (low) => (low ? DOORSTEP_CLEAR + 1 : 1)

export function fitted(kind, variant, roomy) {
  const own = HALLOW_KINDS[kind] || 'hovel'
  if (roomy) return { kind: own, low: false }
  if (TALL[own]) return { kind: STAND_INS[variant % STAND_INS.length], low: true }
  return { kind: own, low: true }
}

export function heightOf(kind) {
  return TALL[kind] || 48
}

/** A well, a stall and a row of pumpkins are low; a row of pumpkins casts no shadow worth drawing. */
export function shadowOf(kind) {
  if (kind === 'patch') return 0
  return kind === 'wishwell' || kind === 'treatstall' ? 26 : 34
}

/** The mill's sails turn, slowly, though nothing is being ground. */
export const buildingFrames = (kind, stage) => (kind === 'mill' && stage >= 3 ? 2 : 1)

/**
 * Where smoke leaves a finished building: the manor's stack, the hovel's crooked chimney and the
 * carvery's flue. Nothing else in the village is lit at this hour.
 */
export function chimneyOf(kind, variant = 0, wall = 0, roofs = 0, low = false) {
  if (kind === 'manor') return { x: 25, y: manorSpec(low).stackTop }
  if (kind === 'hovel') return { x: 7, y: hovelSpec(low).stackTop }
  if (kind === 'carvery') return { x: 24, y: carverySpec(low).flueTop }
  return null
}

// ---------- shared parts ----------

/** Each kind's shape comes from its own stream, apart from the one that scatters texture. */
const specRand = (kind, variant) => rngFor(`hallow:${kind}:${variant}`)
const box = (pc, x0, y0, x1, y1, c) => pc.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, c)
/** One of the plot's roof family, turning through it by `i`. */
const roofOf = (roofs, i) => {
  const f = ROOF_FAMILIES[(roofs || 0) % ROOF_FAMILIES.length]
  return P.hallowRoof[f[Math.abs(Math.floor(i)) % f.length]]
}
/** The material a building is built of: mostly its plot's, now and then another. */
const materialOf = (r, wall) => (r() < 0.7 ? MATERIALS[(wall || 0) % MATERIALS.length] : pick(r, MATERIALS))

/** A wall of one of the theme's five materials, x0..x1 by y0..y1. */
function wallOf(pc, x0, y0, x1, y1, material, rand) {
  if (material === 'clapboard') {
    // Weatherboard gone blue-violet in the moonlight, a shadow under every board.
    box(pc, x0, y0, x1, y1, P.clapboard)
    for (let y = y0 + 2; y <= y1; y += 3) {
      pc.hline(x0, x1, y, P.clapboardDark)
      if (y + 1 <= y1) pc.hline(x0, x1, y + 1, P.clapboardLight)
    }
    for (let i = 0; i < 5; i++) pc.px(x0 + Math.floor(rand() * (x1 - x0 + 1)), y0 + Math.floor(rand() * (y1 - y0 + 1)), P.clapboardDark)
  } else if (material === 'graystone') {
    // Churchyard granite, laid in courses with the joints staggered.
    box(pc, x0, y0, x1, y1, P.graveStone)
    for (let y = y0; y <= y1; y++) {
      const course = Math.floor((y - y0) / 4)
      for (let x = x0; x <= x1; x++) {
        if ((y - y0) % 4 === 3 || (x + course * 3) % 6 === 5) pc.px(x, y, P.graveStoneDark)
        else if ((y - y0) % 4 === 0) pc.px(x, y, P.graveStoneLight)
      }
    }
  } else if (material === 'sootbrick') {
    box(pc, x0, y0, x1, y1, P.sootBrick)
    for (let y = y0; y <= y1; y++) {
      const course = Math.floor((y - y0) / 3)
      for (let x = x0; x <= x1; x++) {
        if ((y - y0) % 3 === 2 || (x + course * 2) % 4 === 3) pc.px(x, y, P.sootMortar)
        else if ((x + y) % 7 === 0) pc.px(x, y, P.sootBrickDark)
      }
    }
    // Soot, running down from the eaves.
    for (let i = 0; i < 4; i++) {
      const x = x0 + Math.floor(rand() * (x1 - x0 + 1))
      pc.vline(x, y0, y0 + 2 + Math.floor(rand() * 5), P.sootBrickDark)
    }
  } else if (material === 'daub') {
    // Daub between crooked timbers, the timbers never quite upright.
    box(pc, x0, y0, x1, y1, P.daub)
    for (let x = x0 + 2; x <= x1 - 1; x += 7) {
      for (let y = y0; y <= y1; y++) pc.px(x + (((y - y0) >> 2) % 2), y, P.hovelBeam)
    }
    pc.hline(x0, x1, y0, P.hovelBeam)
    pc.hline(x0, x1, y1, P.hovelBeam)
    for (let i = 0; i < 6; i++) pc.px(x0 + 1 + Math.floor(rand() * (x1 - x0 - 1)), y0 + 1 + Math.floor(rand() * (y1 - y0 - 1)), P.daubShade)
  } else {
    // Fish-scale shingles, the thing that says gabled manor from across the village.
    box(pc, x0, y0, x1, y1, P.scallop)
    for (let y = y0; y <= y1; y++) {
      const band = Math.floor((y - y0) / 3)
      for (let x = x0; x <= x1; x++) {
        const s = (x + band * 2) % 4
        if ((y - y0) % 3 === 2) pc.px(x, y, s === 0 || s === 1 ? P.scallopDark : P.scallop)
        else if ((y - y0) % 3 === 0) pc.px(x, y, s === 2 ? P.scallopLight : P.scallop)
        if (s === 3) pc.px(x, y, P.scallopDark)
      }
    }
  }
}

/**
 * A steep gable over x0..x1, its eaves on `yBot` and its ridge `rise` rows above them, with a
 * deep bargeboard down each slope and a scalloped edge along it. Steep and overhanging is what
 * says this house at a glance from a distance; the village's shallower pitch read as a cottage.
 * @returns the highest row it drew
 */
function steepRoof(pc, x0, x1, yBot, rise, color, finial = null, limit = 0) {
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
    // The bargeboard: a scalloped lip hung under the eaves at the ends of the run.
    if (t > 0.78) pc.px(x, yBot + ((x & 1) ? 1 : 0), dark)
  }
  pc.hline(x0, x1, yBot, dark)
  const m = Math.round(mid)
  const ridge = Math.max(limit, yBot - rise)
  pc.hline(m - 1, m + 1, ridge, light)
  if (finial && ridge - 1 >= limit) {
    pc.vline(m, ridge - 2, ridge - 1, finial)
    return ridge - 2
  }
  return ridge
}

/** A sash window with its glazing bars, lit from within when the thread is. */
function paneOf(pc, x, y, w, h, lit) {
  const glass = lit ? P.windowLit : P.window
  box(pc, x, y, x + w - 1, y + h - 1, P.deadBarkDark)
  box(pc, x + 1, y + 1, x + w - 2, y + h - 2, glass)
  if (lit && w > 4 && h > 4) box(pc, x + 2, y + 2, x + w - 3, y + h - 3, P.windowLitCore)
  else if (!lit) pc.px(x + 1, y + 1, P.windowShine)
  const mx = Math.round(x + (w - 1) / 2)
  const my = Math.round(y + (h - 1) / 2)
  if (w >= 5) pc.vline(mx, y + 1, y + h - 2, P.deadBarkDark)
  if (h >= 5) pc.hline(x + 1, x + w - 2, my, P.deadBarkDark)
  pc.hline(x - 1, x + w, y + h - 1, P.deadBark) // the sill
}

/**
 * A window boarded over long ago, with something green alight behind the gaps. Drawn as boards
 * rather than as glass on purpose: the weathering pass boards windows up as a house ages, and a
 * window already boarded should not be boarded twice.
 */
function boardedPane(pc, x, y, w, h, lit) {
  box(pc, x, y, x + w - 1, y + h - 1, P.interior)
  for (let j = 1; j < h - 1; j += 2) pc.hline(x, x + w - 1, y + j, lit ? P.poison : P.interior)
  if (lit) for (let j = 1; j < h - 1; j += 2) pc.px(x + 1 + (j & 2), y + j, P.poisonDeep)
  // Two boards nailed across at an angle, and the frame round them.
  for (let i = 0; i < w; i++) {
    pc.px(x + i, y + 1 + Math.floor((i / Math.max(1, w - 1)) * (h - 3)), P.deadBark)
    pc.px(x + i, y + h - 2 - Math.floor((i / Math.max(1, w - 1)) * (h - 3)), P.deadBarkLight)
  }
  pc.hline(x - 1, x + w, y - 1, P.deadBarkDark)
  pc.hline(x - 1, x + w, y + h, P.deadBarkDark)
}

/** A plank door with a ring on it and a wreath of bine above, its foot on `base`. */
function doorOf(pc, x, base, w, h, accent) {
  box(pc, x, base - h + 1, x + w - 1, base, P.deadBarkDark)
  box(pc, x + 1, base - h + 2, x + w - 2, base, accent)
  for (let i = x + 2; i <= x + w - 3; i += 2) pc.vline(i, base - h + 2, base - 1, shade(accent, -0.25))
  pc.hline(x + 1, x + w - 2, base - h + 2, shade(accent, 0.22))
  pc.px(x + w - 2, base - Math.floor(h / 2), P.ironBarLight) // the ring
  // A ring of bine hung on it, which is the wreath anybody puts up tonight.
  const mx = Math.round(x + (w - 1) / 2)
  pc.hline(mx - 1, mx + 1, base - h + 4, P.bine)
  pc.px(mx - 2, base - h + 5, P.bine)
  pc.px(mx + 2, base - h + 5, P.bine)
  pc.px(mx, base - h + 6, P.stalk)
}

/** A jack-o'-lantern set down at (x, y), its face alight when the thread is. */
function jackAt(pc, x, y, lit) {
  const glow = lit ? P.jackGlow : P.pumpkinDark
  pc.hline(x - 1, x + 1, y - 2, P.pumpkin)
  box(pc, x - 2, y - 1, x + 2, y, P.pumpkin)
  pc.px(x - 2, y - 1, P.pumpkinDark)
  pc.px(x + 2, y - 1, P.pumpkinDark)
  pc.hline(x - 1, x + 1, y + 1, P.pumpkinDark)
  pc.px(x - 1, y - 1, P.pumpkinLight)
  pc.px(x, y - 3, P.stalkDark)
  pc.px(x - 1, y - 1, glow)
  pc.px(x + 1, y - 1, glow)
  pc.hline(x - 1, x + 1, y, glow)
  if (lit) pc.px(x, y, P.jackCore)
}

/** A cobweb spun into a corner: `sx` and `sy` say which way it faces. */
function webCorner(pc, x, y, sx, sy) {
  for (let i = 1; i <= 5; i++) pc.px(x + sx * i, y + sy * (6 - i), P.webDim)
  for (const r of [3, 5]) for (let i = 0; i <= r; i++) pc.px(x + sx * i, y + sy * (r - i), P.web)
}

/** A bat in the air at (x, y), wings out. */
function batAt(pc, x, y) {
  pc.px(x, y, P.batWing)
  pc.hline(x - 2, x - 1, y - 1, P.batWing)
  pc.hline(x + 1, x + 2, y - 1, P.batWing)
  pc.px(x - 3, y, P.batWingLight)
  pc.px(x + 3, y, P.batWingLight)
}

/** A bare trunk from `top` down to `base`, x0..x1, its bark deep-furrowed. */
function deadTrunk(pc, x0, x1, top, base) {
  box(pc, x0, top, x1, base, P.deadBark)
  pc.vline(x0, top, base, P.deadBarkLight)
  pc.vline(x1, top, base, P.deadBarkDark)
  for (let y = top; y <= base; y++) {
    if ((y + x0) % 4 === 0) pc.px(x0 + 2, y, P.deadBarkDark)
    if ((y + x0) % 5 === 0) pc.px(x1 - 1, y, P.deadBarkLight)
  }
  for (const [dx, dy] of [[-2, 0], [-1, -1], [1, -1], [2, 0]]) {
    pc.px(x0 + dx, base + dy, P.deadBarkDark)
    pc.px(x1 - dx, base + dy, P.deadBark)
  }
}

/**
 * A bare bough from (x, y), reaching `len` in the direction (dx, dy), with two twigs off it. It
 * thins as it goes: `thick` is how many pixels across it starts, and the last third is a twig.
 * `lean` is how far from upright it reaches: 0 climbs steeply, 1 goes out at a diagonal, 2 reaches
 * out almost level. A crown of boughs all at 0 read as a row of spikes rather than as a tree.
 */
function bough(pc, x, y, len, dx, dy, thick = 1, lean = 0) {
  let cx = x
  let cy = y
  for (let i = 0; i < len; i++) {
    cx += lean >= 1 || i % 2 ? dx : 0
    cy += lean >= 2 && i % 2 ? 0 : dy
    const w = i > len - 4 ? 1 : Math.max(1, thick - Math.floor((i / len) * thick))
    for (let k = 0; k < w; k++) pc.px(cx + k * (dx || 1), cy, i > len - 3 ? P.deadBarkDark : P.deadBark)
    if (w > 1) pc.px(cx, cy, P.deadBarkLight)
    if (i === Math.floor(len / 2)) {
      pc.px(cx - dx, cy - 1, P.deadBark)
      pc.px(cx - dx * 2, cy - 2, P.deadBarkDark)
    }
  }
  return { x: cx, y: cy }
}

/**
 * The staging a building sits in while it is going up: rough poles lashed with rope, a lift or
 * two of boards, and the webs that get into everything by this time of year. It is the theme's
 * scaffolding — old timber and string, nothing galvanised.
 */
const LIFT = 8
function staging(pc, x0, x1, top, base) {
  const posts = x1 - x0 > 18 ? [x0, Math.round((x0 + x1) / 2), x1] : [x0, x1]
  for (const x of posts) {
    pc.vline(x, top, base, P.deadBark)
    pc.px(x, top, P.deadBarkLight)
    pc.hline(x - 1, x + 1, base, P.deadBarkDark)
  }
  for (let y = base - LIFT; y >= top + 3; y -= LIFT) {
    pc.hline(x0, x1, y, P.deadBarkLight)
    pc.hline(x0, x1, y + 1, P.deadBark)
    for (let x = x0 + 2; x <= x1; x += 5) pc.px(x, y, P.straw)
  }
  webCorner(pc, x0 + 1, top + 1, 1, 1)
}

// ---------- the ground being made ready ----------

function site(pc, rand, stage, oy, variant) {
  const Y = (y) => y + oy
  pc.ellipse(16, Y(43), 15.5, 4.5, P.hallowGround[1][1])
  for (let i = 0; i < 14; i++) pc.px(2 + Math.floor(rand() * 28), Y(40 + Math.floor(rand() * 7)), P.fallen[i % P.fallen.length])
  const left = variant % 2 === 0
  if (stage === 0) {
    // The plot marked out the way anything is marked out tonight: a ring of little pumpkins, and
    // a lantern on a stake where the door will be.
    for (const [dx, dy] of [[-12, 2], [-8, 4], [0, 5], [8, 4], [12, 2], [-10, -1], [10, -1], [0, -2]]) {
      pc.hline(16 + dx - 1, 16 + dx + 1, Y(42 + dy), P.pumpkin)
      pc.px(16 + dx, Y(41 + dy), P.pumpkinDark)
    }
    const sx = left ? 12 : 19
    pc.vline(sx, Y(33), Y(43), P.deadBark)
    pc.px(sx, Y(33), P.deadBarkLight)
    jackAt(pc, sx, Y(32), false)
    return
  }
  // The frame up: posts and a sill plate of black timber, a ladder against it, and a barrow of
  // pumpkins waiting to be set out.
  box(pc, 4, Y(40), 27, Y(43), P.deadBarkDark)
  pc.hline(4, 27, Y(40), P.deadBark)
  for (const x of [7, 24]) {
    pc.vline(x, Y(28), Y(40), P.deadBark)
    pc.px(x, Y(28), P.deadBarkLight)
  }
  pc.hline(7, 24, Y(28), P.deadBark)
  pc.hline(7, 24, Y(29), P.deadBarkDark)
  for (let x = 9; x <= 22; x += 4) pc.vline(x, Y(30), Y(39), P.deadBarkDark)
  const bx = left ? 19 : 7
  pc.hline(bx, bx + 7, Y(38), P.deadBark)
  box(pc, bx, Y(35), bx + 7, Y(37), P.straw)
  for (let i = 0; i < 3; i++) pc.hline(bx + 1 + i * 3, bx + 2 + i * 3, Y(34), P.pumpkin)
  pc.hline(bx + 2, bx + 5, Y(39), P.ironBar)
  webCorner(pc, 7, Y(30), 1, 1)
}

// ---------- manor: a tall gabled house that has seen better nights ----------

function manorSpec(low = false) {
  const base = 46
  const wallTop = low ? base - 22 : base - 27
  return { base, wallTop, stackTop: Math.max(DOORSTEP_CLEAR + 1, wallTop - 11) }
}

function manor(pc, o) {
  const s = manorSpec(o.low)
  const lim = ceiling(o.low)
  const r = specRand('manor', o.variant)
  const material = materialOf(r, o.wall)
  const tone = Math.floor(r() * 3)
  const doorLeft = r() < 0.5
  const boarded = r() < 0.55
  wallOf(pc, 5, s.wallTop, 26, s.base, material, o.rand)
  pc.hline(5, 26, s.base, P.graveStoneDark)
  // A porch across the front, on turned posts, with the steps up to it.
  const porch = s.base - 13
  for (const x of [4, 15, 27]) {
    pc.vline(x, porch + 1, s.base - 2, P.deadBark)
    pc.px(x, porch + 1, P.deadBarkLight)
  }
  pc.hline(3, 28, porch, P.deadBarkLight)
  pc.hline(3, 28, porch + 1, P.deadBarkDark)
  pc.hline(4, 27, s.base - 1, P.deadBark)
  const doorX = doorLeft ? 7 : 20
  doorOf(pc, doorX, s.base - 2, 6, 11, o.accent)
  jackAt(pc, doorLeft ? 16 : 13, s.base - 2, o.lit)
  // The windows: boarded on some, still glazed on others.
  const wx = doorLeft ? 17 : 8
  if (boarded) boardedPane(pc, wx, s.base - 11, 7, 7, o.lit)
  else paneOf(pc, wx, s.base - 11, 7, 7, o.lit)
  paneOf(pc, 7, s.wallTop + 3, 7, 8, o.lit)
  paneOf(pc, 18, s.wallTop + 3, 7, 8, o.lit)
  webCorner(pc, 5, s.wallTop + 1, 1, 1)
  webCorner(pc, 26, s.wallTop + 1, -1, 1)
  if (!o.roof) return { x0: 3, x1: 28, top: s.wallTop }
  const color = roofOf(o.roofs, tone)
  const top = steepRoof(pc, 1, 30, s.wallTop - 1, 14, color, P.ironBarLight, lim)
  // The gable window in the peak, and the stack going up beside it.
  paneOf(pc, 14, Math.max(lim + 1, top + 6), 4, 4, o.lit)
  for (let y = s.stackTop; y <= s.wallTop; y += 3) {
    pc.hline(23, 27, y, P.sootBrick)
    pc.hline(23, 27, y + 1, P.sootBrickDark)
    pc.hline(23, 27, y + 2, P.sootMortar)
  }
  pc.hline(22, 28, s.stackTop, P.sootMortar)
  batAt(pc, 6, Math.max(lim + 2, top + 3))
  return null
}

// ---------- hovel: a crooked cottage with a cauldron at the door ----------

function hovelSpec(low = false) {
  const base = 46
  const wallTop = low ? base - 13 : base - 16
  return { base, wallTop, stackTop: Math.max(DOORSTEP_CLEAR + 2, wallTop - 9) }
}

function hovel(pc, o) {
  const s = hovelSpec(o.low)
  const lim = ceiling(o.low)
  const r = specRand('hovel', o.variant)
  const material = materialOf(r, o.wall)
  const tone = Math.floor(r() * 3)
  const doorLeft = r() < 0.5
  wallOf(pc, 5, s.wallTop, 26, s.base, material, o.rand)
  pc.hline(5, 26, s.base, P.deadBarkDark)
  const doorX = doorLeft ? 7 : 20
  doorOf(pc, doorX, s.base - 1, 5, 10, o.accent)
  paneOf(pc, doorLeft ? 15 : 9, s.wallTop + 3, 6, 6, o.lit)
  // The chimney, leaning with the rest of it.
  for (let y = s.stackTop; y <= s.wallTop + 5; y += 2) {
    pc.hline(5 + ((y >> 1) & 1), 9 + ((y >> 1) & 1), y, P.graveStone)
    pc.hline(5 + ((y >> 1) & 1), 9 + ((y >> 1) & 1), y + 1, P.graveStoneDark)
  }
  // A cauldron on the boil beside the door, which is the one green light here.
  const cx = doorLeft ? 17 : 12
  pc.ellipse(cx, s.base - 3, 4, 3, P.ironBar)
  pc.hline(cx - 4, cx + 4, s.base - 5, P.ironBarLight)
  pc.hline(cx - 3, cx + 3, s.base - 6, o.lit ? P.poison : P.ironBar)
  if (o.lit) {
    pc.px(cx - 1, s.base - 7, P.poison)
    pc.px(cx + 2, s.base - 8, P.poisonDeep)
  }
  for (const dx of [-3, 3]) pc.vline(cx + dx, s.base - 1, s.base, P.ironBar)
  // A broom stood against the wall, where a broom lives.
  const bx = doorLeft ? 25 : 6
  pc.vline(bx, s.base - 12, s.base - 4, P.deadBark)
  box(pc, bx - 1, s.base - 4, bx + 1, s.base - 1, P.straw)
  pc.px(bx, s.base - 1, P.strawDark)
  if (!o.roof) return { x0: 4, x1: 27, top: s.wallTop }
  const top = steepRoof(pc, 2, 29, s.wallTop - 1, 12, roofOf(o.roofs, tone), null, lim)
  // The chimney again over the roof, so it reads as going through it.
  for (let y = s.stackTop; y <= s.wallTop; y += 2) {
    pc.hline(5, 9, y, P.graveStone)
    pc.hline(5, 9, y + 1, P.graveStoneDark)
  }
  pc.hline(4, 10, s.stackTop, P.graveStoneLight)
  webCorner(pc, 27, Math.max(lim + 1, top + 4), -1, 1)
  return null
}

// ---------- sweetshop: the one shop still open tonight ----------

function sweetshop(pc, o) {
  const r = specRand('sweetshop', o.variant)
  const material = materialOf(r, o.wall)
  const tone = Math.floor(r() * 3)
  const base = 46
  const eave = o.low ? base - 20 : base - 26
  const lim = ceiling(o.low)
  wallOf(pc, 3, eave + 2, 28, base, material, o.rand)
  pc.hline(3, 28, base, P.graveStoneDark)
  // The shop window, and the jars in it.
  box(pc, 5, base - 15, 26, base - 3, P.deadBarkDark)
  box(pc, 6, base - 14, 25, base - 4, o.lit ? P.windowLit : P.window)
  if (!o.lit) pc.hline(7, 12, base - 13, P.windowShine)
  for (let i = 0; i < 5; i++) {
    const x = 8 + i * 4
    box(pc, x, base - 11, x + 2, base - 8, [P.candyRed, P.candyGreen, P.hallowRoof[1], P.pumpkin, P.wrapper][i])
    pc.hline(x, x + 2, base - 12, P.boneWhite)
  }
  pc.hline(6, 25, base - 7, P.deadBark)
  for (let x = 6; x <= 25; x += 3) pc.px(x, base - 6, P.hallowRoof[7])
  // The awning: the plot's colour, with a scalloped edge.
  for (let x = 2; x <= 29; x++) {
    pc.px(x, base - 17, (x & 1) ? o.accent : shade(o.accent, -0.2))
    pc.px(x, base - 16, (x & 3) === 2 ? shade(o.accent, 0.2) : o.accent)
    if ((x & 3) === 0) pc.px(x, base - 15, shade(o.accent, -0.3))
  }
  jackAt(pc, 4, base - 1, o.lit)
  jackAt(pc, 28, base - 1, o.lit)
  paneOf(pc, 6, eave + 4, 6, 6, o.lit)
  paneOf(pc, 20, eave + 4, 6, 6, o.lit)
  if (!o.roof) return { x0: 2, x1: 29, top: eave + 2 }
  steepRoof(pc, 0, 31, eave + 1, 10, roofOf(o.roofs, tone), null, lim)
  // Bunting strung along the parapet, which is what a shop does tonight.
  for (let x = 2; x <= 29; x += 3) {
    pc.px(x, eave + 2, P.ironBar)
    pc.hline(x, x + 1, eave + 3, (x >> 1) % 2 ? P.pumpkin : P.hallowRoof[1])
    pc.px(x, eave + 4, P.felt)
  }
  return null
}

// ---------- haybarn: a black barn with the loft full ----------

function haybarn(pc, o) {
  const r = specRand('haybarn', o.variant)
  const material = materialOf(r, o.wall)
  const tone = Math.floor(r() * 3)
  const base = 46
  const wallTop = o.low ? base - 16 : base - 22
  const lim = ceiling(o.low)
  wallOf(pc, 2, wallTop, 29, base, material, o.rand)
  pc.hline(2, 29, base, P.deadBarkDark)
  // The big doors, crossed with braces and left ajar.
  box(pc, 10, base - 15, 21, base, P.deadBark)
  box(pc, 11, base - 14, 20, base, o.accent)
  pc.line(11, base - 1, 20, base - 14, shade(o.accent, -0.3))
  pc.line(11, base - 14, 20, base - 1, shade(o.accent, -0.3))
  pc.vline(15, base - 14, base, P.deadBarkDark)
  pc.vline(16, base - 14, base, P.deadBarkDark)
  box(pc, 16, base - 12, 19, base - 1, P.interior)
  if (o.lit) {
    pc.vline(17, base - 11, base - 2, P.windowLit)
    pc.vline(18, base - 10, base - 3, P.lampGlow)
  }
  // The loft opening, hay hanging out of it.
  box(pc, 12, wallTop + 2, 19, wallTop + 8, P.interior)
  for (let x = 12; x <= 19; x++) pc.vline(x, wallTop + 6, wallTop + 8 + ((x & 1) ? 1 : 0), (x & 1) ? P.straw : P.strawDark)
  pc.hline(11, 20, wallTop + 1, P.deadBark)
  pc.hline(11, 20, wallTop + 9, P.deadBarkLight)
  paneOf(pc, 4, base - 13, 5, 5, o.lit)
  paneOf(pc, 23, base - 13, 5, 5, o.lit)
  jackAt(pc, 7, base - 1, o.lit)
  jackAt(pc, 25, base - 1, o.lit)
  if (!o.roof) return { x0: 1, x1: 30, top: wallTop }
  const color = roofOf(o.roofs, tone)
  const top = steepRoof(pc, 0, 31, wallTop - 1, 12, color, null, lim)
  // The hoist beam out of the gable, with a rope and a hook on it.
  const beam = Math.max(lim + 2, top + 5)
  pc.hline(13, 19, beam, P.deadBark)
  pc.vline(16, beam + 1, beam + 4, P.straw)
  pc.px(16, beam + 5, P.ironBarLight)
  return null
}

// ---------- mill: bare sail frames turning over nothing ----------

function mill(pc, o) {
  const r = specRand('mill', o.variant)
  const material = materialOf(r, o.wall)
  const tone = Math.floor(r() * 3)
  const base = 58
  // The tower stops well short of the top: the sails have to turn clear above the cap, or a mill
  // is only a tower with a pointed hat on it.
  const capY = 26
  for (let y = capY; y <= base; y++) {
    const t = (y - capY) / (base - capY)
    const half = Math.round(6 + t * 5)
    wallOf(pc, 16 - half, y, 15 + half, y, material, o.rand)
  }
  pc.hline(4, 27, base, P.graveStoneDark)
  doorOf(pc, 13, base - 1, 6, 11, o.accent)
  jackAt(pc, 9, base - 1, o.lit)
  for (const y of [capY + 6, capY + 18]) paneOf(pc, 13, y, 6, 6, o.lit)
  if (!o.roof) return { x0: 3, x1: 28, top: capY }
  const color = roofOf(o.roofs, tone)
  // The cap, and the stock the sails turn on.
  for (let i = 0; i < 7; i++) {
    const half = Math.max(1, 8 - i)
    pc.hline(16 - half, 15 + half, capY - 1 - i, i % 3 === 0 ? shade(color, 0.2) : color)
  }
  pc.hline(6, 25, capY, shade(color, -0.26))
  pc.vline(16, capY - 12, capY - 8, P.deadBarkDark)
  // Four sails, bare frames with the canvas long gone, an eighth of a turn between the frames.
  const turn = o.frame % 2
  const cy = capY - 12
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + (turn ? Math.PI / 4 : 0)
    const dx = Math.cos(a)
    const dy = Math.sin(a)
    for (let i = 2; i <= 13; i++) {
      const sx = Math.round(16 + dx * i)
      const sy = Math.round(cy + dy * i)
      pc.px(sx, sy, i > 11 ? P.deadBarkDark : P.deadBark)
      // The laths across each whip, which is what says sail rather than stick.
      if (i % 3 === 1 && i < 12) {
        pc.px(Math.round(sx - dy * 2), Math.round(sy + dx * 2), P.deadBarkDark)
        pc.px(Math.round(sx - dy), Math.round(sy + dx), P.deadBarkLight)
      }
    }
  }
  pc.px(16, cy, P.ironBarLight)
  batAt(pc, turn ? 3 : 29, 34)
  return null
}

// ---------- carvery: the shed where the lanterns get their faces ----------

function carverySpec(low = false) {
  const base = 46
  const wallTop = low ? base - 15 : base - 18
  return { base, wallTop, flueTop: Math.max(DOORSTEP_CLEAR + 1, wallTop - 10) }
}

function carvery(pc, o) {
  const s = carverySpec(o.low)
  const lim = ceiling(o.low)
  const r = specRand('carvery', o.variant)
  const material = materialOf(r, o.wall)
  const tone = Math.floor(r() * 3)
  wallOf(pc, 4, s.wallTop, 27, s.base, material, o.rand)
  pc.hline(4, 27, s.base, P.deadBarkDark)
  // The shed stands open to the yard: the bench, the pumpkins on it and the knife left in one.
  box(pc, 13, s.base - 12, 26, s.base - 1, P.interior)
  pc.hline(13, 26, s.base - 12, P.deadBark)
  box(pc, 14, s.base - 5, 25, s.base - 3, P.deadBarkLight)
  pc.hline(14, 25, s.base - 3, P.deadBarkDark)
  for (const [x, w] of [[16, 2], [21, 3]]) {
    pc.ellipse(x, s.base - 7, w, 2, P.pumpkin)
    pc.px(x - 1, s.base - 8, P.pumpkinLight)
    pc.px(x, s.base - 9, P.stalkDark)
  }
  pc.line(24, s.base - 9, 25, s.base - 6, P.ironBarLight)
  // The kiln at the back, where the green light comes from.
  box(pc, 14, s.base - 11, 17, s.base - 9, o.lit ? P.poison : P.ironBar)
  if (o.lit) pc.px(15, s.base - 10, P.boneWhite)
  doorOf(pc, 6, s.base - 1, 5, 10, o.accent)
  paneOf(pc, 6, s.wallTop + 3, 5, 5, o.lit)
  jackAt(pc, 11, s.base - 1, o.lit)
  // The flue out of the back corner.
  for (let y = s.flueTop; y <= s.wallTop + 4; y += 2) pc.hline(23, 25, y, (y & 2) ? P.ironBar : P.ironBarLight)
  if (!o.roof) return { x0: 3, x1: 28, top: s.wallTop }
  steepRoof(pc, 2, 29, s.wallTop - 1, 9, roofOf(o.roofs, tone), null, lim)
  for (let y = s.flueTop; y <= s.wallTop; y += 2) pc.hline(23, 25, y, (y & 2) ? P.ironBar : P.ironBarLight)
  pc.hline(22, 26, s.flueTop, P.ironBarLight)
  return null
}

// ---------- wishwell: a well nobody draws from after dark ----------

function wishwell(pc, o) {
  const r = specRand('wishwell', o.variant)
  const tone = Math.floor(r() * 3)
  const base = 46
  const top = o.low ? base - 20 : base - 25
  const lim = ceiling(o.low)
  // The kerb, built of the churchyard's own stone.
  box(pc, 6, base - 8, 25, base, P.graveStone)
  pc.hline(6, 25, base - 8, P.graveStoneLight)
  pc.hline(6, 25, base, P.graveStoneDark)
  for (let y = base - 6; y < base; y += 3) pc.hline(6, 25, y, P.graveStoneDark)
  box(pc, 9, base - 7, 22, base - 3, P.interior)
  // The mist coming up out of it, which is the only thing down there now.
  for (const [x, y] of [[11, base - 9], [16, base - 11], [20, base - 10], [14, base - 13]]) {
    pc.hline(x, x + 2, y, P.webDim)
    pc.px(x + 1, y - 1, P.web)
  }
  // Two posts, the windlass between them, and the bucket hanging off it.
  for (const x of [7, 23]) {
    box(pc, x, top + 4, x + 1, base - 9, P.deadBark)
    pc.vline(x, top + 4, base - 9, P.deadBarkLight)
  }
  box(pc, 8, top + 5, 23, top + 7, P.deadBarkDark)
  pc.hline(8, 23, top + 5, P.deadBark)
  pc.vline(16, top + 8, base - 14, P.ironBar)
  box(pc, 14, base - 13, 18, base - 10, P.deadBark)
  pc.hline(14, 18, base - 13, P.deadBarkLight)
  jackAt(pc, 4, base - 1, o.lit)
  jackAt(pc, 27, base - 1, o.lit)
  webCorner(pc, 8, top + 8, 1, 1)
  if (!o.roof) return { x0: 6, x1: 25, top: top + 4 }
  steepRoof(pc, 4, 27, top + 3, 9, roofOf(o.roofs, tone), P.ironBarLight, lim)
  return null
}

// ---------- patch: rows of pumpkins under a low frame ----------

function patch(pc, o) {
  const r = specRand('patch', o.variant)
  const tone = Math.floor(r() * 3)
  const base = 46
  const top = base - 16
  // Four beds of bine, edged in board, the dark earth showing between the rows.
  for (let row = 0; row < 4; row++) {
    const y = base - row * 4
    pc.hline(1, 30, y - 3, P.soil)
    pc.hline(1, 30, y - 2, P.soil)
    pc.hline(1, 30, y - 1, P.deadBarkDark)
    pc.hline(1, 30, y, P.deadBark)
    for (let x = 2 + (row % 2) * 3; x <= 28; x += 6) {
      pc.ellipse(x, y - 3, 2.5, 1.8, row % 2 ? P.pumpkin : P.gourd)
      pc.px(x - 1, y - 4, row % 2 ? P.pumpkinLight : P.boneWhite)
      pc.px(x, y - 5, P.stalkDark)
      pc.px(x + 2, y - 2, P.bine)
    }
  }
  // The frame the bine is trained over, along the back.
  for (let x = 2; x <= 29; x += 5) {
    pc.vline(x, top + 2, base - 14, P.deadBark)
    pc.px(x, top + 2, P.deadBarkLight)
  }
  pc.hline(2, 29, top + 2, P.deadBarkDark)
  if (!o.roof) return { x0: 1, x1: 30, top: top + 2 }
  // The bine over the frame and what has ripened on it: this is what goes on last here.
  for (let x = 1; x <= 30; x++) {
    pc.px(x, top, (x % 3) ? P.bine : P.stalkDark)
    pc.px(x, top + 1, (x % 4) ? P.stalk : P.bine)
  }
  for (let x = 4; x <= 28; x += 6) {
    pc.hline(x, x + 1, top + 2, roofOf(o.roofs, tone))
    pc.px(x, top + 3, shade(roofOf(o.roofs, tone), -0.3))
  }
  return null
}

// ---------- hollowtree: a home in a great dead tree ----------

function hollowtree(pc, o) {
  const r = specRand('hollowtree', o.variant)
  const tone = Math.floor(r() * 3)
  const base = 58
  const color = roofOf(o.roofs, tone)
  deadTrunk(pc, 9, 22, 14, base)
  // The trunk swells at the foot, where the door is cut into it.
  for (let y = base - 10; y <= base; y++) {
    const half = 7 + Math.round(((y - (base - 10)) / 10) * 4)
    box(pc, 16 - half, y, 15 + half, y, P.deadBark)
    pc.px(16 - half, y, P.deadBarkLight)
    pc.px(15 + half, y, P.deadBarkDark)
  }
  doorOf(pc, 13, base - 1, 6, 10, o.accent)
  // A knothole with something awake in it, and a window higher up.
  pc.ellipse(11, base - 16, 2.5, 3, P.interior)
  if (o.lit) {
    pc.px(11, base - 16, P.poison)
    pc.px(10, base - 17, P.poisonDeep)
  }
  paneOf(pc, 17, base - 20, 5, 6, o.lit)
  paneOf(pc, 13, 22, 6, 6, o.lit)
  jackAt(pc, 5, base - 1, o.lit)
  jackAt(pc, 27, base - 1, o.lit)
  // A ladder of pegs up one side.
  for (let y = base - 14; y >= 26; y -= 4) pc.hline(7, 8, y, P.deadBarkLight)
  if (!o.roof) return { x0: 2, x1: 29, top: 14 }
  // The crown: bare boughs reaching out over the plot, and a crow or two sitting in them.
  for (const [x, y, len, dx, dy, w, lean] of [
    [10, 22, 9, -1, -1, 3, 2], [21, 24, 9, 1, -1, 3, 2],
    [11, 17, 8, -1, -1, 2, 1], [20, 16, 8, 1, -1, 2, 1],
    [14, 14, 7, -1, -1, 2, 0], [17, 14, 7, 1, -1, 2, 0],
  ]) {
    const end = bough(pc, x, y, len, dx, dy, w, lean)
    pc.px(end.x, end.y - 1, shade(color, -0.2))
  }
  for (const [x, y] of [[5, 16], [26, 19]]) {
    pc.hline(x - 1, x + 1, y, P.crow)
    pc.px(x, y - 1, P.crow)
    pc.px(x + 2, y - 1, P.crowBeak)
  }
  // What is left of the leaves, in the plot's colour, caught in the top boughs.
  for (let i = 0; i < 18; i++) {
    const x = 3 + Math.floor(o.rand() * 26)
    const y = 6 + Math.floor(o.rand() * 12)
    if (pc.opaque(x, y + 1)) pc.px(x, y, i % 3 ? color : shade(color, -0.25))
  }
  batAt(pc, 24, 6)
  return null
}

// ---------- glasshouse: a conservatory gone to gourds ----------

function glasshouse(pc, o) {
  const r = specRand('glasshouse', o.variant)
  const tone = Math.floor(r() * 3)
  const base = 46
  const eave = o.low ? base - 17 : base - 22
  const lim = ceiling(o.low)
  // A low plinth of sooty brick, and glazing in an iron net above it.
  box(pc, 3, base - 4, 28, base, P.sootBrick)
  pc.hline(3, 28, base - 4, P.sootMortar)
  pc.hline(3, 28, base, P.sootBrickDark)
  box(pc, 3, eave, 28, base - 5, P.glass)
  for (let y = eave; y <= base - 5; y++) for (let x = 3; x <= 28; x++) if ((x + y) % 5 === 0) pc.px(x, y, P.glassLight)
  for (let x = 3; x <= 28; x += 5) pc.vline(x, eave, base - 5, P.ironBar)
  for (let y = eave; y <= base - 5; y += 5) pc.hline(3, 28, y, P.ironBar)
  // What is growing in there, seen through the glass.
  for (let x = 5; x <= 27; x += 5) {
    pc.ellipse(x, base - 8, 2, 1.5, o.lit ? P.pumpkin : P.pumpkinDark)
    pc.vline(x + 2, base - 12, base - 9, P.bine)
    pc.px(x + 3, base - 12, P.stalk)
  }
  if (o.lit) for (let x = 7; x <= 26; x += 7) pc.px(x, eave + 3, P.jackGlow)
  // The door, its glass long gone.
  box(pc, 13, base - 13, 18, base - 1, P.ironBar)
  box(pc, 14, base - 12, 17, base - 1, o.lit ? P.windowLit : P.interior)
  pc.vline(16, base - 12, base - 1, P.ironBar)
  if (!o.roof) return { x0: 2, x1: 29, top: eave }
  const top = steepRoof(pc, 1, 30, eave - 1, 10, roofOf(o.roofs, tone), P.ironBarLight, lim)
  // A ridge light of glass along the top, with a pane or two missing already.
  for (let x = 10; x <= 21; x += 2) pc.px(x, Math.max(lim, top + 4), x % 6 ? P.glassLight : P.interior)
  webCorner(pc, 3, eave + 1, 1, 1)
  return null
}

// ---------- treatstall: a trestle set out for whoever comes by ----------

function treatstall(pc, o) {
  const r = specRand('treatstall', o.variant)
  const tone = Math.floor(r() * 3)
  const base = 46
  const eave = base - 20
  const lim = ceiling(o.low)
  for (const x of [6, 25]) {
    pc.vline(x, eave + 1, base - 1, P.deadBark)
    pc.vline(x + (x < 16 ? 1 : -1), eave + 1, base - 1, P.deadBarkDark)
    pc.hline(x - 1, x + 1, base, P.deadBarkDark)
  }
  // The board, and the bowls of sweets on it.
  box(pc, 5, base - 10, 26, base - 8, P.deadBarkLight)
  pc.hline(5, 26, base - 8, P.deadBarkDark)
  for (let i = 0; i < 4; i++) {
    const x = 7 + i * 5
    box(pc, x, base - 13, x + 3, base - 11, P.ironBar)
    pc.hline(x, x + 3, base - 13, P.ironBarLight)
    pc.hline(x, x + 3, base - 14, [P.candyRed, P.candyGreen, P.hallowRoof[7], P.wrapper][i])
  }
  // A crate of spares under it, and a lantern on the corner.
  box(pc, 8, base - 5, 13, base - 1, P.deadBark)
  pc.hline(8, 13, base - 5, P.deadBarkLight)
  jackAt(pc, 21, base - 1, o.lit)
  if (!o.roof) return { x0: 5, x1: 26, top: eave + 1 }
  const top = steepRoof(pc, 3, 28, eave, 8, roofOf(o.roofs, tone), null, lim)
  // Paper bats hung along the front of the awning, which is what a stall does tonight.
  for (let x = 5; x <= 27; x += 6) batAt(pc, x, Math.max(lim + 2, top + 6))
  for (let x = 4; x <= 27; x += 2) pc.px(x, Math.max(lim, top + 3), x % 4 ? o.accent : P.felt)
  return null
}

// ---------- drawing one ----------

const KINDS = { manor, hovel, sweetshop, haybarn, mill, carvery, wishwell, patch, hollowtree, glasshouse, treatstall }
/** Nothing to put up: these need no staging. */
const NO_STAGING = new Set(['wishwell', 'patch', 'treatstall'])

/**
 * @param {{ kind: string, stage: number, accent: string, variant: number, lit: boolean, frame?: number, wall?: number, roofs?: number, low?: boolean, wear?: number }} o
 */
export function drawHallowBuilding(o) {
  const kind = KINDS[o.kind] ? o.kind : 'hovel'
  const variant = o.variant || 0
  const H = heightOf(kind)
  const pc = new PixelCanvas(BUILDING_W, H)
  const seed = variant * 6151 + 41
  if (o.stage <= 1) {
    site(pc, mulberry32(seed), o.stage, H - 48, variant)
    return pc.outline(P.outline)
  }
  const draw = KINDS[kind]
  const frameNo = o.frame || 0
  const opts = {
    rand: mulberry32(seed), accent: o.accent || P.hallowRoof[0], lit: Boolean(o.lit), roof: o.stage >= 3, frame: frameNo, variant,
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

// The parts the night's landmarks are built from too (see landmarks.js).
export { MATERIALS, batAt, bough, box, deadTrunk, doorOf, jackAt, paneOf, roofOf, site, staging, steepRoof, wallOf, webCorner }
