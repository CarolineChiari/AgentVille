// What a room is made of: the floor and wall of one tile, and the furniture that stands on them.
// Everything here is drawn from the village's own palette, and everything a room shows about the
// work — a spine per file, a note per commit — is one small sprite repeated, so a busy session
// fills its shelves rather than needing a bigger picture.
import { PALETTE as P, shade } from './palette.js'
import { PixelCanvas } from './pixel.js'
import { mulberry32 } from '../../sim/rng.js'
import { WALLS } from '../../sim/style.js'

const T = 16

/** Every piece's size in pixels, so the renderer and the tests agree without measuring. */
export const INTERIOR_SIZE = {
  floor: [T, T],
  wall: [T, T],
  shelf: [32, 44],
  book: [3, 9],
  pinboard: [44, 28],
  note: [7, 7],
  window: [16, 20],
  desk: [32, 26],
  chair: [14, 20],
  bed: [32, 26],
  rug: [48, 28],
  door: [16, 26],
}
/** Variants each kind draws. A kind whose look follows the plot's wall material has one per material. */
export const INTERIOR_VARIANTS = {
  floor: WALLS.length,
  wall: WALLS.length,
  shelf: 1,
  book: 24, // a colour (8) × how well thumbed it is (3)
  pinboard: 1,
  note: 3,
  window: 2, // by day, and lit after dark
  desk: 2, // its monitor asleep, and awake
  chair: 1,
  bed: 2, // made, and slept in
  rug: 3,
  door: 1,
}

/** Book cloth, in the order a spine's colour index picks them. */
const SPINES = [P.cloth[1], P.cloth[0], P.cloth[2], P.cloth[3], P.cloth[4], P.cloth[6], P.cloth[7], P.cloth[9]]

/** What a plot's wall material lays underfoot and puts on the walls inside. */
const MATERIALS = [
  // plaster: pale boards under a limewashed wall
  { floor: [P.woodLight, P.wood], wall: [P.plaster, P.plasterShade], plank: true },
  // wood: warm boards, boarded walls
  { floor: [P.wood, P.woodDark], wall: [P.woodLight, P.wood], plank: true },
  // stone: flagstones, and the same stone above
  { floor: [P.stone, P.stoneDark], wall: [P.stoneLight, P.stone], plank: false },
  // brick: a tiled floor under brick
  { floor: [P.brick, P.brickDark], wall: [P.mortar, P.brick], plank: false },
  // timber: dark boards under a framed wall
  { floor: [P.woodDark, P.trunk], wall: [P.plaster, P.woodDark], plank: true },
]
const materialOf = (v) => MATERIALS[((v % MATERIALS.length) + MATERIALS.length) % MATERIALS.length]

/** Floorboards run left to right, with a seam every few rows and a knot here and there. */
function floor(variant) {
  const pc = new PixelCanvas(T, T)
  const m = materialOf(variant)
  const rand = mulberry32(variant * 101 + 7)
  pc.rect(0, 0, T, T, m.floor[0])
  if (m.plank) {
    for (let y = 3; y < T; y += 5) pc.hline(0, T - 1, y, m.floor[1])
    // One short butt joint per tile, so the boards don't read as one endless plank.
    const y = 3 + 5 * Math.floor(rand() * 3)
    pc.vline(Math.floor(rand() * (T - 2)) + 1, Math.max(0, y - 4), y - 1, m.floor[1])
  } else {
    // Flags and tiles: a grid, offset row by row.
    for (let y = 0; y < T; y += 8) {
      pc.hline(0, T - 1, y, m.floor[1])
      pc.vline(y === 0 ? 5 : 11, y, y + 7, m.floor[1])
    }
  }
  for (let i = 0; i < 2; i++) pc.px(Math.floor(rand() * T), Math.floor(rand() * T), shade(m.floor[1], -0.2))
  return pc
}

/** The wall above the floor's back edge: the same material the outside is built from. */
function wall(variant) {
  const pc = new PixelCanvas(T, T)
  const m = materialOf(variant)
  pc.rect(0, 0, T, T, m.wall[0])
  if (variant % MATERIALS.length === 3) {
    // Brick, coursed and offset.
    for (let y = 0; y < T; y += 4) {
      for (let x = 0; x < T; x++) pc.px(x, y, m.wall[1])
      pc.vline((y / 4) % 2 ? 3 : 11, y + 1, y + 3, m.wall[1])
    }
  } else if (variant % MATERIALS.length === 4) {
    // Timber framing: one upright per tile, with a rail across the top.
    pc.rect(6, 0, 3, T, m.wall[1])
    pc.hline(0, T - 1, 0, m.wall[1])
  } else if (variant % MATERIALS.length === 1) {
    for (let x = 2; x < T; x += 5) pc.vline(x, 0, T - 1, m.wall[1])
  } else {
    const rand = mulberry32(variant * 31 + 3)
    for (let i = 0; i < 6; i++) pc.px(Math.floor(rand() * T), Math.floor(rand() * T), m.wall[1])
  }
  return pc
}

/** An empty bookcase. Its shelves are where the renderer stands the spines. */
function shelf() {
  const [w, h] = INTERIOR_SIZE.shelf
  const pc = new PixelCanvas(w, h)
  pc.rect(0, 0, w, h, P.wood)
  pc.rect(2, 2, w - 4, h - 4, shade(P.woodDark, -0.25))
  for (let i = 0; i < 3; i++) {
    const y = 2 + (i + 1) * 13
    pc.rect(1, y, w - 2, 2, P.woodDark)
    pc.hline(1, w - 2, y, P.woodLight)
  }
  pc.rect(0, h - 3, w, 3, P.woodDark)
  return pc.outline(P.outline)
}

/** One book: a spine as tall as the file has been worked over. */
function book(variant) {
  const [w, h] = INTERIOR_SIZE.book
  const pc = new PixelCanvas(w, h)
  const color = SPINES[Math.floor(variant / 3) % SPINES.length]
  const tall = variant % 3
  const top = h - (6 + tall)
  pc.rect(0, top, w, h - top, color)
  pc.vline(0, top, h - 1, shade(color, -0.3))
  // A gold band or two, so a well-thumbed book reads as an older one.
  for (let i = 0; i <= tall; i++) pc.hline(1, w - 1, top + 2 + i * 3, P.inlay)
  return pc
}

/** Cork, framed, waiting for notes. */
function pinboard() {
  const [w, h] = INTERIOR_SIZE.pinboard
  const pc = new PixelCanvas(w, h)
  pc.rect(0, 0, w, h, P.woodDark)
  pc.rect(2, 2, w - 4, h - 4, P.dirt)
  const rand = mulberry32(17)
  for (let i = 0; i < 30; i++) pc.px(2 + Math.floor(rand() * (w - 4)), 2 + Math.floor(rand() * (h - 4)), P.dirtDark)
  return pc.outline(P.outline)
}

/** A note pinned to the board: one commit. */
function note(variant) {
  const [w, h] = INTERIOR_SIZE.note
  const pc = new PixelCanvas(w, h)
  pc.rect(0, 0, w, h, P.paper)
  // Lines of writing, too small to read, which is the point.
  for (let y = 2; y < h - 1; y += 2) pc.hline(1, w - 2 - (variant % 2), y, P.dirtDark)
  pc.px(Math.floor(w / 2), 0, P.pin)
  return pc.outline(P.outline)
}

/** A window in the back wall: the real sky through it, or the night with the lamp on the glass. */
function window(variant) {
  const [w, h] = INTERIOR_SIZE.window
  const pc = new PixelCanvas(w, h)
  const night = variant === 1
  pc.rect(0, 0, w, h, P.wood)
  pc.rect(2, 2, w - 4, h - 6, night ? P.window : P.glass)
  if (!night) {
    pc.rect(2, 2, w - 4, 5, P.glassLight)
    pc.rect(3, h - 10, 4, 3, P.leaf) // a treetop out there
  } else {
    pc.rect(3, 3, 3, 3, P.windowShine)
  }
  pc.vline(Math.floor(w / 2) - 1, 2, h - 5, P.woodDark)
  pc.hline(2, w - 3, Math.floor(h / 2) - 2, P.woodDark)
  pc.rect(0, h - 4, w, 3, P.woodLight) // the sill
  return pc.outline(P.outline)
}

/** The desk the session works at, its monitor asleep or awake. */
function desk(variant) {
  const [w, h] = INTERIOR_SIZE.desk
  const pc = new PixelCanvas(w, h)
  const on = variant === 1
  // Screen
  pc.rect(7, 1, 18, 12, P.metalDark)
  pc.rect(8, 2, 16, 10, on ? P.windowLit : P.window)
  if (on) {
    pc.rect(9, 3, 14, 8, P.windowLitCore)
    for (let y = 4; y < 11; y += 2) pc.hline(10, 10 + Math.floor(((y * 7) % 11) + 2), y, P.metalDark)
  }
  pc.rect(14, 13, 4, 2, P.metalDark)
  pc.rect(11, 15, 10, 2, P.metal)
  // Top and legs
  pc.rect(0, 17, w, 3, P.wood)
  pc.hline(0, w - 1, 17, P.woodLight)
  pc.rect(1, 20, 3, h - 20, P.woodDark)
  pc.rect(w - 4, 20, 3, h - 20, P.woodDark)
  // A keyboard, and a mug that is always there
  pc.rect(9, 15, 12, 2, P.metalDark)
  pc.rect(24, 13, 5, 4, P.white)
  pc.px(29, 14, P.white)
  return pc.outline(P.outline)
}

function chair() {
  const [w, h] = INTERIOR_SIZE.chair
  const pc = new PixelCanvas(w, h)
  pc.rect(2, 0, w - 4, 9, P.wood)
  pc.rect(4, 2, w - 8, 5, shade(P.woodDark, -0.2))
  pc.rect(0, 9, w, 3, P.woodLight)
  pc.rect(1, 12, 2, h - 12, P.woodDark)
  pc.rect(w - 3, 12, 2, h - 12, P.woodDark)
  return pc.outline(P.outline)
}

/** The bed: made, or with somebody in it. */
function bed(variant) {
  const [w, h] = INTERIOR_SIZE.bed
  const pc = new PixelCanvas(w, h)
  pc.rect(0, 2, 4, h - 4, P.wood) // headboard
  pc.rect(0, 0, 4, 3, P.woodLight)
  pc.rect(4, 6, w - 5, h - 10, P.cloth[0])
  pc.rect(4, 6, w - 5, 3, shade(P.cloth[0], 0.2))
  pc.rect(5, 3, 8, 6, P.white) // pillow
  if (variant === 1) {
    // Slept in: the covers are humped over whoever is under them.
    for (let x = 13; x < w - 2; x++) pc.px(x, 5 + Math.round(Math.sin((x - 13) / 3) * 1.5), P.cloth[0])
    pc.rect(13, 6, w - 15, 2, shade(P.cloth[0], 0.25))
  }
  pc.rect(4, h - 4, w - 4, 3, P.woodDark)
  pc.rect(w - 4, 4, 3, h - 6, P.wood)
  return pc.outline(P.outline)
}

/** A rug, so the middle of the floor is not bare. */
function rug(variant) {
  const [w, h] = INTERIOR_SIZE.rug
  const pc = new PixelCanvas(w, h)
  const base = [P.cloth[3], P.cloth[6], P.cloth[5]][variant % 3]
  pc.ellipse(w / 2, h / 2, w / 2 - 1, h / 2 - 1, base)
  pc.ellipse(w / 2, h / 2, w / 2 - 4, h / 2 - 3, shade(base, 0.2))
  pc.ellipse(w / 2, h / 2, w / 2 - 9, h / 2 - 6, base)
  pc.ellipse(w / 2, h / 2, w / 2 - 14, h / 2 - 9, shade(base, -0.2))
  return pc
}

/** The way out, in the front wall. */
function door() {
  const [w, h] = INTERIOR_SIZE.door
  const pc = new PixelCanvas(w, h)
  pc.rect(0, 0, w, h, P.woodDark)
  pc.rect(2, 2, w - 4, h - 3, P.door)
  for (let x = 4; x < w - 3; x += 4) pc.vline(x, 3, h - 3, shade(P.door, -0.2))
  pc.px(w - 5, Math.floor(h / 2), P.inlay) // the handle
  return pc.outline(P.outline)
}

const DRAW = { floor, wall, shelf, book, pinboard, note, window, desk, chair, bed, rug, door }

/**
 * One piece of a room, by name. `interior.<kind>.<variant>`; what each variant means is in
 * INTERIOR_VARIANTS above.
 */
export function drawInterior(kind, variant = 0) {
  const fn = DRAW[kind]
  if (!fn) throw new Error(`No interior called "${kind}"`)
  return fn(Number(variant) || 0)
}
