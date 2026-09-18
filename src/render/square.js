// The arrival square: where every villager steps out of the portal and where they leave through
// it. Pure geometry and colour, in pixels of the square's own cell (0..191 each way), so it is
// tested under Node; the sprites and the renderer draw from it.
//
//   - the floor: running-bond paving inside a kerb, and round the portal's foot a raised round
//     dais, a step down from it all round, its top a mosaic of cobble rings, a ring of runes and a
//     gold star;
//   - the portal's opening, and the vortex that fills it;
//   - crystals floating over the obelisks round the dais, and the beams between them and the portal;
//   - bunting from the lampposts to the arch, and motes of light drifting up round it all.
import { CELL_TILES, GATE_TILE, SQUARE_GARDEN, SQUARE_LAMPS, SQUARE_OBELISKS, SQUARE_PROPS } from '../sim/constants.js'
import { lattice } from '../sim/noise.js'
import { PALETTE as P, hexToRgb } from './sprites/palette.js'

const T = 16
export const SIZE = CELL_TILES * T

/** The portal's arch: 64 px square, standing on the row below the walk-through point. */
export const ARCH_W = 64
export const ARCH_H = 64
/** The foot of the arch, in the square's pixels: the centre of the mosaic. */
export const CENTER = { x: GATE_TILE.x * T, y: (Math.floor(GATE_TILE.y) + 1) * T }

// Radii of the mosaic's rings, in px from CENTER.
const STAR = 14 // the gold star on its pale pad
const RUNES = 18 // the band of runes round it
const COURSES = 52 // rings of cobbles
const DAIS = 56 // coping stones round the dais's edge, from COURSES out to here
/**
 * The dais stands a step above the square. Seen from the front and above, its front face shows
 * under its southern edge, then the step's top round it all, then the step's own face: each is
 * a disc drawn a little lower than the one on it, so the back of the step barely shows and the
 * front shows in full.
 */
const DAIS_FACE = 5
const STEP = 7 // how far the step reaches out from under the dais
const STEP_FACE = 3
export const STEP_OUTER = DAIS + STEP
/** Cobble rings this wide; the mortar between them is their inside pixel. */
const COURSE = (COURSES - RUNES) / 6
/** A cobble is about this long round its ring. */
const COBBLE = 7
/** The kerb round the square's edge. */
const KERB = 4
/** How many dashes of runes run round the band, each a hashed pattern of strokes and gaps. */
const RUNE_SEGMENTS = 20

const TAU = Math.PI * 2

/** Is (px, py) a lit stroke of the rune band? The same test the floor and the glow share. */
function runeAt(d, a) {
  if (d < RUNES - 3.5 || d >= RUNES - 1.5) return false
  const t = ((a / TAU) * RUNE_SEGMENTS + RUNE_SEGMENTS) % RUNE_SEGMENTS
  const seg = Math.floor(t)
  const f = t - seg
  if (f < 0.12 || f > 0.88) return false // a gap between glyphs
  const bits = Math.floor(lattice(seg, 0, 77) * 16) | 1
  return Boolean(bits & (1 << Math.floor(((f - 0.12) / 0.76) * 4)))
}

/** The corner gardens' radius in px, from the square's corners. */
export const GARDEN = SQUARE_GARDEN * T
/** How far the top gardens' kerbs stand proud of the paving: their faces show below them. */
const GARDEN_FACE = 4
/** Flowers in a garden bed: in each 4×4 block, a bloom this often, in one of these. */
const BED_BLOOM = 0.34
const BED_COLOURS = [P.flower[0], P.flower[1], P.flower[3], P.flower[4], P.petalWhite, P.blossom]

/** Distance from the nearest corner of the square, and whether that corner is on the top edge. */
function fromCorner(px, py) {
  const cx = px + 0.5 < SIZE / 2 ? 0 : SIZE
  const cy = py + 0.5 < SIZE / 2 ? 0 : SIZE
  return { d: Math.hypot(px + 0.5 - cx, py + 0.5 - cy), top: cy === 0, cx, cy }
}

/** A corner garden's bed: grass, flowers, and petals fallen from its blossom tree. */
function bedPixel(px, py) {
  const bx = px >> 2
  const by = py >> 2
  if (lattice(bx, by, 71) < BED_BLOOM) {
    // A bloom: a plus shape round a spot in its block, a lighter heart.
    const ox = (bx << 2) + 1 + Math.floor(lattice(bx, by, 73) * 2)
    const oy = (by << 2) + 1 + Math.floor(lattice(bx, by, 74) * 2)
    const c = BED_COLOURS[Math.floor(lattice(bx, by, 72) * BED_COLOURS.length)]
    if (px === ox && py === oy) return c === P.petalWhite ? P.pollen : P.petalWhite
    if (Math.abs(px - ox) + Math.abs(py - oy) === 1) return c
    if (px === ox && py === oy + 2) return P.leafDark
  }
  const g = P.yardTones[0]
  const h = lattice(px, py, 75)
  if (h < 0.04) return P.blossomLight // a fallen petal
  if (h < 0.2) return g[1]
  if (h > 0.9) return g[2]
  return g[0]
}

/** The colour of the square's floor at (px, py), in the square's own pixels. */
export function squarePixel(px, py) {
  // A garden in each corner: a raised bed with a stone kerb, its face showing under the top two.
  const corner = fromCorner(px, py)
  if (corner.d < GARDEN) {
    if (corner.d >= GARDEN - 1) return P.stoneDark
    if (corner.d >= GARDEN - 3) return P.stoneLight
    return bedPixel(px, py)
  }
  if (corner.top) {
    const lifted = Math.hypot(px + 0.5 - corner.cx, py + 0.5 - GARDEN_FACE - corner.cy)
    if (lifted < GARDEN) return lifted >= GARDEN - 1 || (px + py) % 5 === 0 ? P.stoneDark : P.stone
  }
  // The kerb round the square: long slabs, lit along their inner edge.
  const edge = Math.min(px, py, SIZE - 1 - px, SIZE - 1 - py)
  if (edge < KERB) {
    const along = edge === px || edge === SIZE - 1 - px ? py : px
    if (along % 12 === 0) return P.stoneDark
    if (edge === KERB - 1) return P.plazaDark
    return edge === 0 ? P.stoneDark : P.stone
  }
  const dx = px + 0.5 - CENTER.x
  const dy = py + 0.5 - CENTER.y
  const d = Math.hypot(dx, dy)
  const a = Math.atan2(dy, dx)
  if (d < STAR) {
    // An eight-pointed star, points alternately gold and portal-blue, on a pale pad.
    const t = ((a / TAU) * 8 + 8.5) % 1
    const e = Math.abs(t - 0.5) * 2 // 0 along a point, 1 between two
    const reach = STAR - 1 - (STAR - 6) * e // a star polygon: points at 13 px, notches at 5
    if (d < 2) return P.portalDeep
    if (d < reach) {
      const point = Math.round(((a / TAU) * 8 + 8) % 8) % 2
      const lit = t > 0.5 // one side of each point catches the light
      return point ? (lit ? P.portal : P.portalDeep) : lit ? P.inlay : P.sandstoneDark
    }
    return d > STAR - 1 ? P.plazaDark : P.plazaLight
  }
  if (d < RUNES) {
    if (d >= RUNES - 1) return P.plazaDark
    return runeAt(d, a) ? P.rune : P.cobbleSlateDark
  }
  if (d < COURSES) {
    const course = Math.floor((d - RUNES) / COURSE)
    if (d - RUNES - course * COURSE < 1) return P.plazaDark
    // Cobbles round the ring, staggered from the ring inside it.
    const r = RUNES + (course + 0.5) * COURSE
    const n = Math.max(8, Math.round((TAU * r) / COBBLE))
    const s = ((a / TAU + 1) * n + (course % 2) * 0.5) % n
    if (s % 1 < 1 / COBBLE) return P.plazaDark
    const warm = course % 2 === 0
    const h = lattice(Math.floor(s), course, 13)
    if (h < 0.12) return warm ? P.sandstoneDark : P.cobbleSlateDark
    if (h > 0.9) return warm ? P.plazaLight : P.plaza
    return warm ? P.sandstone : P.cobbleSlate
  }
  if (d < DAIS) {
    // Coping: long curved stones, lit on the top, with a dark lip where they drop away.
    if (d >= DAIS - 1) return P.stoneDark
    const joint = ((a / TAU + 1) * 40) % 1 < 0.06
    if (joint) return P.stoneDark
    return d < COURSES + 1 ? P.stoneLight : P.stone
  }
  // Below the dais's southern edge, its face; then the step, drawn a face lower; then the step's face.
  const south = (r) => (Math.abs(dx) < r ? CENTER.y + Math.sqrt(r * r - dx * dx) : -Infinity)
  const below = py + 0.5 - south(DAIS)
  if (below >= 0 && below < DAIS_FACE) {
    if (below < 1) return P.stoneLight
    if (below >= DAIS_FACE - 1) return P.stoneDark
    return (px + (below > 2.5 ? 3 : 0)) % 6 === 0 ? P.stoneDark : P.stone
  }
  const ds = Math.hypot(dx, dy - DAIS_FACE)
  if (ds < STEP_OUTER) {
    if (ds >= STEP_OUTER - 1) return P.stoneLight
    return ((Math.atan2(dy - DAIS_FACE, dx) / TAU + 1) * 52) % 1 < 0.05 ? P.plazaDark : P.stoneLight
  }
  const stepBelow = py + 0.5 - DAIS_FACE - south(STEP_OUTER)
  if (stepBelow >= 0 && stepBelow < STEP_FACE) return stepBelow < 1 ? P.stone : P.stoneDark
  // The dais's shadow on the paving just south of it.
  if (stepBelow >= STEP_FACE && stepBelow < STEP_FACE + 2) return P.plazaDark
  // Running-bond paving: courses 4 px high, stones 4 px long, joints staggered course to course.
  const row = py >> 2
  const off = row % 2 ? 2 : 0
  if ((py & 3) === 3) return P.plazaDark
  if ((px + 4 - off) % 4 === 0) return P.plazaDark
  const stone = lattice((px + 4 - off) >> 2, row, 5)
  // Moss creeps in dapples over the odd stone; a whole stone of it read as a green tile.
  if (stone < 0.02 && (px + py) % 2 === 0) return P.moss
  if (stone < 0.06) return P.plazaLight
  if (stone > 0.96) return P.stoneLight
  if ((px + 4 - off) % 4 === 1 && (py & 3) === 0) return P.plazaLight
  return P.plaza
}

/** Every lit stroke of the rune ring, as [px, py, angle], for the glow that runs round it. */
export function runePixels() {
  const out = []
  for (let py = CENTER.y - RUNES; py <= CENTER.y + RUNES; py++) {
    for (let px = CENTER.x - RUNES; px <= CENTER.x + RUNES; px++) {
      const dx = px + 0.5 - CENTER.x
      const dy = py + 0.5 - CENTER.y
      const d = Math.hypot(dx, dy)
      const a = Math.atan2(dy, dx)
      if (runeAt(d, a)) out.push([px, py, a])
    }
  }
  return out
}

// ---------- the portal ----------

/** The arch's round top: its centre, and the radius of its inner edge. */
export const ARCH_RISE = 32
export const ARCH_INNER = 23.5
/** Pillars fill the arch's first and last 8 columns; the gap between them is the way through. */
export const PILLAR = 8
/** The arch's thickness, seen on the inner faces of its pillars and under its curve. */
export const SOFFIT = 3

/**
 * The portal's opening, row by row, in the arch sprite's pixels: [y, x0, x1], a pixel inside the
 * stone and its outline all round, so the vortex drawn in it never shows past the arch.
 */
export function portalOpening() {
  const rows = []
  const inner = ARCH_INNER - SOFFIT - 1
  for (let y = 0; y < ARCH_H; y++) {
    let x0 = PILLAR + SOFFIT + 1
    let x1 = ARCH_W - PILLAR - SOFFIT - 2
    if (y < ARCH_RISE) {
      const dy = ARCH_RISE - y - 0.5
      if (dy >= inner) continue
      const w = Math.sqrt(inner ** 2 - dy * dy)
      x0 = Math.max(x0, Math.ceil(ARCH_W / 2 - w))
      x1 = Math.min(x1, Math.floor(ARCH_W / 2 - 1 + w))
    }
    if (x1 >= x0) rows.push([y, x0, x1])
  }
  return rows
}

/**
 * The vortex's eye: in the middle of the part of the opening you can see, below the name board,
 * and the radius its spiral is measured in.
 */
const EYE = { x: ARCH_W / 2, y: 43, r: ARCH_W / 2 - PILLAR - SOFFIT - 1 }

let edges = null
/**
 * How far each pixel of the opening is from the stone round it, in px (1 right beside it), keyed
 * y * ARCH_W + x. The vortex's bright seam and its darkening towards the sides follow this, so they
 * follow the opening's own shape: measured from an oval instead, the vortex came out balloon-shaped.
 */
function edgeDistances() {
  if (edges) return edges
  const inside = new Set()
  for (const [y, x0, x1] of portalOpening()) for (let x = x0; x <= x1; x++) inside.add(y * ARCH_W + x)
  edges = new Map()
  const R = 8
  for (const k of inside) {
    const x = k % ARCH_W
    const y = Math.floor(k / ARCH_W)
    let best = R
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        // Below the arch is the ground, not stone: the vortex runs right down to it.
        if (y + dy >= ARCH_H) continue
        if (!inside.has((y + dy) * ARCH_W + x + dx)) best = Math.min(best, Math.hypot(dx, dy))
      }
    }
    edges.set(k, best)
  }
  return edges
}

const rgb = (hex) => {
  const { r, g, b } = hexToRgb(hex)
  return [r, g, b]
}
const ABYSS = rgb(P.portalAbyss)
const DEEP = rgb(P.portalDeep)
const MID = rgb(P.portal)
const CORE = rgb(P.portalCore)
const mix = (a, b, t) => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t))
/** Dark to bright through the vortex's four colours. */
function ramp(light) {
  if (light < 0.3) return mix(ABYSS, DEEP, light / 0.3)
  if (light < 0.65) return mix(DEEP, MID, (light - 0.3) / 0.35)
  return mix(MID, CORE, Math.min(1, (light - 0.65) / 0.35))
}

/**
 * The vortex in the portal at arch-sprite pixel (x, y), time `t` in seconds: [r, g, b, alpha 0..1].
 * Three arms of light wheel round a bright eye, fading into the deep towards the stone; a seam of
 * light runs round its edge, and a star glints now and then. `flare` (0..1, somebody arriving or
 * leaving) spins it faster and floods it from the eye out.
 */
export function veilColor(x, y, t, flare = 0) {
  const edge = edgeDistances().get(y * ARCH_W + x) ?? 1
  const dx = (x + 0.5 - EYE.x) / EYE.r
  const dy = (y + 0.5 - EYE.y) / EYE.r
  const r = Math.hypot(dx, dy)
  const th = Math.atan2(dy, dx)
  const spin = t * (1.4 + flare * 2.6)
  const arms = 0.5 + 0.5 * Math.sin(3 * th + 6 * r - spin * 2.2)
  const eye = Math.exp(-r * r * 3.2)
  const inward = Math.min(1, edge / 7) // the arms fade into the deep near the stone
  let light = 0.1 + 0.6 * eye + 0.42 * arms * (0.3 + 0.7 * Math.min(1, r)) * inward
  // Nearly opaque: see-through, the floor's star showed in it like glass. A villager arriving
  // behind it is a ghost until it steps out.
  let alpha = 0.95 + 0.05 * eye
  if (edge <= 1.5) {
    // The seam where the vortex meets the stone, a pulse of light running round it.
    light = Math.max(light, 0.68 + 0.22 * Math.sin(th * 5 - t * 4))
    alpha = 1
  } else if (edge <= 2.5) {
    light = Math.max(light, 0.42)
    alpha = Math.max(alpha, 0.92)
  }
  if (lattice(x, y * 131 + Math.floor(t * 4), 97) > 0.996) {
    light = 1
    alpha = 1
  }
  light = Math.min(1, light + flare * 0.4 * (1 - 0.5 * Math.min(1, r)))
  alpha = Math.min(1, alpha + flare * 0.1)
  return [...ramp(light), alpha]
}

/** Rows of light the portal spills onto the floor in front of it. */
export const SPILL = 8

/**
 * The light spilling from the portal onto the ground in front of it, `row` rows below the arch's
 * foot, at arch-sprite column x: [r, g, b, alpha], or null past its reach. A half-oval pool a
 * little wider than the doorway, brightest at the threshold, its rim dithered so it fades out
 * rather than stopping at a hard edge; it flickers with the vortex, and a flare throws it further.
 */
export function spillColor(x, row, t, flare = 0) {
  const [, x0, x1] = portalOpening().at(-1)
  const cx = (x0 + x1 + 1) / 2
  const hw = ((x1 - x0 + 1) / 2) * 1.25
  const e = ((x + 0.5 - cx) / hw) ** 2 + ((row + 0.5) / SPILL) ** 2
  if (e >= 1) return null
  const flicker = 0.85 + 0.15 * Math.sin(t * 5 + x * 0.7)
  const a = (0.55 + 0.3 * flare) * (1 - e) ** 1.2 * flicker
  if (a < 0.03 || (a < 0.14 && (x + row) % 2)) return null
  return [...ramp(0.62 + 0.3 * flare), a]
}

/**
 * Motes of light in the vortex, in arch-sprite pixels: [x, y, alpha]. Drawn in along the arms
 * toward the eye while all is quiet; hurled out from it while somebody steps through.
 */
export function vortexMotes(t, flare, n = 10) {
  const out = []
  for (let k = 0; k < n; k++) {
    const phase = lattice(k, 1, 63)
    const life = (t * 0.32 + phase) % 1
    const r = flare > 0.3 ? life : 1 - life
    const th = lattice(k, 2, 64) * TAU + (flare > 0.3 ? -1 : 1) * life * 4.5
    out.push([Math.round(EYE.x + Math.cos(th) * r * EYE.r * 0.95), Math.round(EYE.y + Math.sin(th) * r * EYE.r * 1.1), Math.sin(life * Math.PI)])
  }
  return out
}

// ---------- crystals ----------

/** An obelisk's sprite is this tall; its crystal floats this far over it, bobbing this much. */
export const OBELISK_H = 30
const FLOAT = 7
const BOB = 2

/** Where obelisk `i`'s crystal is at time `t`, its centre in the square's pixels. */
export function crystalAt(i, t) {
  const [lx, ly] = SQUARE_OBELISKS[i]
  const bob = Math.round(Math.sin(t * 1.6 + i * 1.9) * BOB)
  return [lx * T + T / 2, (ly + 1) * T - OBELISK_H - FLOAT + bob]
}

/** The gem in the arch's keystone, where the crystals' beams meet. */
export const gemAt = () => [CENTER.x, CENTER.y - ARCH_H + 5]

/** The pixels of a straight beam from `a` to `b`, both ends included. */
export function beam(a, b) {
  const [x0, y0] = a
  const [x1, y1] = b
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))
  const out = []
  for (let i = 0; i <= n; i++) out.push([Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n)])
  return out
}

// ---------- motes ----------

/**
 * Motes of light drifting up round the dais: [px, py, alpha] in the square's pixels. A few by day,
 * more and brighter at night (`night` 0..1).
 */
export function motes(t, night, n = 16) {
  const out = []
  for (let k = 0; k < n; k++) {
    const phase = lattice(k, 3, 65)
    const life = (t * 0.11 + phase) % 1
    const cycle = Math.floor(t * 0.11 + phase)
    const x = CENTER.x + (lattice(k, cycle, 66) - 0.5) * 150 + Math.sin(t * 0.9 + k) * 4
    const y = CENTER.y + 44 - life * 110
    const a = Math.sin(life * Math.PI) * (k < n / 3 ? 0.55 : night) * (0.45 + 0.55 * night)
    if (a > 0.04) out.push([Math.round(x), Math.round(y), a])
  }
  return out
}

// ---------- bunting ----------

/** How far a string of bunting sags at its middle, as a share of its length. */
const SAG = 0.12
/** A pennant every this many px along a string. */
const PENNANT_GAP = 6

/** Where a lamppost's lantern is, for the bunting to hang from: [px, py] in the square's pixels. */
export const lampTop = ([lx, ly]) => [lx * T + T / 2, (ly + 1) * T - 26]
/** The arch's keystone. */
export const archTop = () => [CENTER.x, CENTER.y - ARCH_H + 2]
/**
 * Where a string of bunting is tied to the arch: on its shoulder, 45° down either side of the
 * keystone, so the keystone and its gem stay clear (the crystals' beams meet there).
 */
export const archShoulder = (side) => [
  Math.round(CENTER.x + side * (ARCH_W / 2) * Math.SQRT1_2),
  Math.round(CENTER.y - ARCH_H + ARCH_RISE - (ARCH_W / 2) * Math.SQRT1_2),
]

/**
 * The strings of bunting: along the bottom edge between the lampposts, and from the two top
 * lampposts to the arch's shoulders. Each is a list of [px, py] a pixel apart, sagging. None runs
 * along the top edge: it cut straight across the fountain and the carts.
 */
export function buntingStrings() {
  const [tl, tr, bl, br] = SQUARE_LAMPS.map(lampTop)
  return [[bl, br], [tl, archShoulder(-1)], [tr, archShoulder(1)]].map(([a, b]) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    const n = Math.ceil(len)
    const pts = []
    for (let i = 0; i <= n; i++) {
      const t = i / n
      pts.push([Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t + 4 * SAG * len * t * (1 - t))])
    }
    return pts
  })
}

/** Pennants along each string: [px, py, colour index]; they hang from the string's pixel. */
export function pennants() {
  const out = []
  buntingStrings().forEach((pts, s) => {
    for (let i = PENNANT_GAP / 2; i < pts.length - 2; i += PENNANT_GAP) out.push([...pts[Math.floor(i)], (s * 3 + i / PENNANT_GAP) | 0])
  })
  return out
}

/** Fairy lights strung along the bunting, between the pennants: [px, py, k]. */
export function fairyLights() {
  const out = []
  buntingStrings().forEach((pts) => {
    for (let i = PENNANT_GAP; i < pts.length - 2; i += PENNANT_GAP) out.push([...pts[i], out.length])
  })
  return out
}

// ---------- arrivals ----------

/** Sparkles rising off the pad while somebody comes or goes: [px, py, alpha], at most `n`. */
export function arrivalSparkles(t, flare, n = 14) {
  const out = []
  const count = Math.round(n * flare)
  for (let k = 0; k < count; k++) {
    const phase = lattice(k, 0, 61)
    const life = (t * 0.9 + phase) % 1
    const cycle = Math.floor(t * 0.9 + phase)
    const x = CENTER.x + (lattice(k, cycle, 62) - 0.5) * 44
    const y = CENTER.y - 4 - life * 46
    out.push([Math.round(x), Math.round(y), flare * Math.sin(life * Math.PI)])
  }
  return out
}

// ---------- blossom ----------

/** The blossom trees of the square's gardens: where each one's crown is, in the square's pixels. */
export function blossomCrowns() {
  return SQUARE_PROPS.filter(([sprite, v]) => sprite === 'tree' && v >= 6).map(([, , lx, ly]) => [lx * T + T / 2, (ly + 1) * T - 22])
}

/** Petals drifting down from the blossom trees: [px, py, alpha, light?], a few per tree. */
export function petals(t, per = 4) {
  const out = []
  blossomCrowns().forEach(([cx, cy], i) => {
    for (let k = 0; k < per; k++) {
      const phase = lattice(i, k, 81)
      const life = (t * 0.16 + phase) % 1
      const cycle = Math.floor(t * 0.16 + phase)
      const x = cx + (lattice(i * 7 + k, cycle, 82) - 0.5) * 20 + life * 16 + Math.sin(t * 2 + k) * 3
      const y = cy + life * 34
      out.push([Math.round(x), Math.round(y), Math.sin(life * Math.PI), k % 2 === 0])
    }
  })
  return out
}

// ---------- pigeons ----------

/** Tiles of the square that something stands on, "x,y", from the layout. */
const TAKEN = new Set([
  ...SQUARE_LAMPS, ...SQUARE_OBELISKS,
  ...SQUARE_PROPS.flatMap(([, , lx, ly, more = []]) => [[lx, ly], ...more.map(([dx, dy]) => [lx + dx, ly + dy])]),
  [4, 6], [5, 6], [6, 6], [7, 6], [2, 6], [9, 6], // the arch, its opening and the planters
].map(([x, y]) => `${x},${y}`))

/** Can a pigeon stand at (px, py)? Anywhere on open paving or the dais, but not in the portal. */
export function pigeonCanStand(px, py) {
  if (px < KERB + 2 || py < KERB + 2 || px > SIZE - KERB - 3 || py > SIZE - KERB - 3) return false
  if (fromCorner(px, py).d < GARDEN + 3) return false
  if (TAKEN.has(`${Math.floor(px / T)},${Math.floor(py / T)}`)) return false
  if (Math.hypot(px - CENTER.x, py - CENTER.y) < STAR + 10) return false
  return !(py < CENTER.y && Math.abs(px - CENTER.x) < ARCH_W / 2 && py > CENTER.y - ARCH_H)
}

/** How near a villager may come, in px, before a pigeon takes off; and how fast they go. */
const SPOOK = 18
const WALK = 9
const FLY = 70
const FLIGHT = 1.1

/** A handful of pigeons on the open paving in front of the portal. */
export function makePigeons(n, rand) {
  const out = []
  for (let tries = 0; out.length < n && tries < 500; tries++) {
    const x = KERB + rand() * (SIZE - 2 * KERB)
    const y = CENTER.y + 20 + rand() * (SIZE - CENTER.y - 30)
    if (pigeonCanStand(x, y)) out.push({ x, y, tx: x, ty: y, mode: 'peck', timer: rand() * 3, face: rand() < 0.5 ? -1 : 1, air: 0, peck: false })
  }
  return out
}

/** Somewhere a pigeon can land, `reach` px or so from (x, y), preferring the direction (dx, dy). */
function landing(x, y, dx, dy, reach, rand) {
  for (let i = 0; i < 30; i++) {
    const a = Math.atan2(dy, dx) + (rand() - 0.5) * (1 + i * 0.2)
    const r = reach * (0.6 + rand() * 0.6)
    const tx = x + Math.cos(a) * r
    const ty = y + Math.sin(a) * r
    if (pigeonCanStand(tx, ty)) return [tx, ty]
  }
  return [x, y]
}

/**
 * One step of the pigeons: they peck, wander a few steps, and take off from anybody who comes too
 * close, landing a little way off. `walkers` are [px, py] in the square's pixels.
 */
export function stepPigeons(birds, dt, walkers, rand) {
  for (const b of birds) {
    const near = walkers.find(([wx, wy]) => Math.hypot(wx - b.x, wy - b.y) < SPOOK)
    if (near && b.mode !== 'fly') {
      const [tx, ty] = landing(b.x, b.y, b.x - near[0], b.y - near[1], 44, rand)
      Object.assign(b, { mode: 'fly', tx, ty, timer: FLIGHT })
    }
    const dx = b.tx - b.x
    const dy = b.ty - b.y
    const dist = Math.hypot(dx, dy)
    if (b.mode === 'fly') {
      b.timer -= dt
      const step = Math.min(dist, FLY * dt)
      if (dist > 0.01) {
        b.x += (dx / dist) * step
        b.y += (dy / dist) * step
        if (Math.abs(dx) > 0.5) b.face = Math.sign(dx)
      }
      // Up, and down again as it comes in to land.
      b.air = Math.min(10, Math.max(0, dist / 3)) * Math.min(1, b.timer * 3 + 0.2)
      if (dist < 1 && b.timer <= 0) Object.assign(b, { mode: 'peck', air: 0, timer: 1 + rand() * 3 })
    } else if (b.mode === 'walk') {
      const step = Math.min(dist, WALK * dt)
      if (dist > 0.01) {
        b.x += (dx / dist) * step
        b.y += (dy / dist) * step
        if (Math.abs(dx) > 0.3) b.face = Math.sign(dx)
      }
      if (dist < 0.5) Object.assign(b, { mode: 'peck', timer: 1 + rand() * 4 })
    } else {
      b.timer -= dt
      b.peck = Math.sin(b.timer * 9) > 0.3
      if (b.timer <= 0) {
        const [tx, ty] = landing(b.x, b.y, rand() - 0.5, rand() - 0.5, 12, rand)
        Object.assign(b, { mode: 'walk', tx, ty, peck: false })
      }
    }
  }
  return birds
}
