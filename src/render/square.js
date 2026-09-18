// The arrival square: where every villager steps out of the portal and where they leave through
// it. Pure geometry and colour, in pixels of the square's own cell (0..191 each way), so it is
// tested under Node; the sprites and the renderer draw from it.
//
//   - the floor: running-bond paving inside a kerb, and round the portal's foot a mosaic of
//     cobble rings, a ring of runes and a gold star;
//   - the portal's opening, and the shimmering veil that fills it;
//   - bunting from the lampposts to the arch.
import { CELL_TILES, GATE_TILE, SQUARE_LAMPS } from '../sim/constants.js'
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
const BORDER = 56 // a dark kerb round the whole mosaic
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

/** The colour of the square's floor at (px, py), in the square's own pixels. */
export function squarePixel(px, py) {
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
  if (d < BORDER) return d < BORDER - 1 ? P.stoneDark : P.plazaDark
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

/**
 * The portal's opening, row by row, in the arch sprite's pixels: [y, x0, x1], a pixel inside the
 * stone and its outline all round, so the veil drawn in it never shows past the arch.
 */
export function portalOpening() {
  const rows = []
  for (let y = 0; y < ARCH_H; y++) {
    let x0 = PILLAR + 1
    let x1 = ARCH_W - PILLAR - 2
    if (y < ARCH_RISE) {
      const dy = ARCH_RISE - y - 0.5
      if (dy >= ARCH_INNER - 1) continue
      const w = Math.sqrt((ARCH_INNER - 1) ** 2 - dy * dy)
      x0 = Math.max(x0, Math.ceil(ARCH_W / 2 - w))
      x1 = Math.min(x1, Math.floor(ARCH_W / 2 - 1 + w))
    }
    if (x1 >= x0) rows.push([y, x0, x1])
  }
  return rows
}

const rgb = (hex) => {
  const { r, g, b } = hexToRgb(hex)
  return [r, g, b]
}
const DEEP = rgb(P.portalDeep)
const MID = rgb(P.portal)
const CORE = rgb(P.portalCore)
const mix = (a, b, t) => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t))

/**
 * The veil in the portal at arch-sprite pixel (x, y), time `t` in seconds: [r, g, b, alpha 0..1].
 * Bands of light rise through it, it pools brighter at the ground, a few specks glint, and
 * `flare` (0..1, somebody arriving or leaving) floods it with light.
 */
export function veilColor(x, y, t, flare = 0) {
  const u = (x - ARCH_W / 2) / (ARCH_W / 2 - PILLAR) // -1 at one pillar, 1 at the other
  const band = 0.5 + 0.5 * Math.sin(y * 0.42 + t * 3.1 + Math.sin(x * 0.33 + t * 1.3) * 1.6)
  const swirl = 0.5 + 0.5 * Math.sin((x + y) * 0.21 - t * 2.2)
  const ground = Math.max(0, (y - ARCH_H + 14) / 14) // the bottom rows pool light
  let light = 0.25 + 0.45 * band * swirl + 0.3 * ground
  let alpha = 0.3 + 0.25 * band + 0.2 * ground - 0.15 * u * u
  const speck = lattice(x, y * 131 + Math.floor(t * 5), 97) > 0.992
  if (speck) {
    light = 1
    alpha = 0.95
  }
  // A flare brightens the veil without whiting it out: the bands still show through at its height.
  light = Math.min(1, light + flare * 0.35)
  alpha = Math.min(0.9, alpha + flare * 0.3)
  const c = light < 0.6 ? mix(DEEP, MID, light / 0.6) : mix(MID, CORE, (light - 0.6) / 0.4)
  return [...c, Math.max(0.05, alpha)]
}

// ---------- bunting ----------

/** How far a string of bunting sags at its middle, as a share of its length. */
const SAG = 0.12
/** A pennant every this many px along a string. */
const PENNANT_GAP = 6

/** Where a lamppost's lantern is, for the bunting to hang from: [px, py] in the square's pixels. */
export const lampTop = ([lx, ly]) => [lx * T + T / 2, (ly + 1) * T - 26]
/** The arch's keystone, where the strings meet. */
export const archTop = () => [CENTER.x, CENTER.y - ARCH_H + 2]

/**
 * The strings of bunting: along the top and bottom edges between the lampposts, and from the two
 * top lampposts to the arch's keystone. Each is a list of [px, py] a pixel apart, sagging.
 */
export function buntingStrings() {
  const [tl, tr, bl, br] = SQUARE_LAMPS.map(lampTop)
  const top = archTop()
  return [[tl, tr], [bl, br], [tl, top], [tr, top]].map(([a, b]) => {
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
