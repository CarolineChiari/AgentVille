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
  logboard: [160, 96],
  // Whatever else a room has in it (see `extra` in src/sim/interiors.js). None of it says anything
  // about the work: it is what says which room you are standing in.
  table: [32, 22],
  stool: [12, 16],
  crate: [24, 22],
  stove: [24, 40],
  plant: [22, 28],
  lamp: [14, 44],
  hanging: [28, 24],
  ladder: [14, 60],
  drawers: [30, 32],
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
  logboard: 1,
  table: 2, // a table, and one that slopes: a drawing board, a lectern
  stool: 1,
  crate: 3, // a crate, a chest, a stack of baskets
  stove: 4, // what it is (2) × whether it is burning
  plant: 3, // a plant in a pot, a jar of cuttings, a sapling
  lamp: 4, // what it is (2) × whether it is lit
  hanging: 3, // a picture, a drawing pinned up, a hanging
  ladder: 1,
  drawers: 2, // a chest of drawers, and a plan chest
}

/** Book cloth, in the order a spine's colour index picks them. */
const SPINES = [P.cloth[1], P.cloth[0], P.cloth[2], P.cloth[3], P.cloth[4], P.cloth[6], P.cloth[7], P.cloth[9]]

/**
 * @typedef {object} RoomMaterial  What one wall material is like on the inside.
 * @property {[string, string]} floor  what is underfoot, and the seams between its boards or flags
 * @property {[string, string]} wall   the wall itself, and whatever is coursed, framed or flecked on it
 * @property {'plank'|'flag'} floorPattern  boards laid left to right, or flags in courses
 * @property {'speck'|'board'|'brick'|'frame'} wallPattern
 */

/** What a plot's wall material lays underfoot and puts on the walls inside. */
const MATERIALS = [
  // plaster: pale boards under a limewashed wall
  { floor: [P.woodLight, P.wood], wall: [P.plaster, P.plasterShade], floorPattern: 'plank', wallPattern: 'speck' },
  // wood: warm boards, boarded walls
  { floor: [P.wood, P.woodDark], wall: [P.woodLight, P.wood], floorPattern: 'plank', wallPattern: 'board' },
  // stone: flagstones, and the same stone above
  { floor: [P.stone, P.stoneDark], wall: [P.stoneLight, P.stone], floorPattern: 'flag', wallPattern: 'speck' },
  // brick: a tiled floor under brick
  { floor: [P.brick, P.brickDark], wall: [P.mortar, P.brick], floorPattern: 'flag', wallPattern: 'brick' },
  // timber: dark boards under a framed wall
  { floor: [P.woodDark, P.trunk], wall: [P.plaster, P.woodDark], floorPattern: 'plank', wallPattern: 'frame' },
]
const materialOf = (materials, v) => materials[((v % materials.length) + materials.length) % materials.length]

/**
 * Floorboards run left to right, with a seam every few rows and a knot here and there; flags and
 * tiles are laid in courses instead. A theme's pack hands in its own materials — one per wall name
 * in its dims — so every theme's rooms are laid the same way out of its own stuff.
 *
 * @param {RoomMaterial[]} materials
 * @param {number} variant  the plot's wall material
 */
export function drawRoomFloor(materials, variant) {
  const pc = new PixelCanvas(T, T)
  const m = materialOf(materials, variant)
  const rand = mulberry32(variant * 101 + 7)
  pc.rect(0, 0, T, T, m.floor[0])
  if (m.floorPattern === 'plank') {
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
export function drawRoomWall(materials, variant) {
  const pc = new PixelCanvas(T, T)
  const m = materialOf(materials, variant)
  pc.rect(0, 0, T, T, m.wall[0])
  if (m.wallPattern === 'brick') {
    // Brick, coursed and offset.
    for (let y = 0; y < T; y += 4) {
      for (let x = 0; x < T; x++) pc.px(x, y, m.wall[1])
      pc.vline((y / 4) % 2 ? 3 : 11, y + 1, y + 3, m.wall[1])
    }
  } else if (m.wallPattern === 'frame') {
    // Timber framing: one upright per tile, with a rail across the top.
    pc.rect(6, 0, 3, T, m.wall[1])
    pc.hline(0, T - 1, 0, m.wall[1])
  } else if (m.wallPattern === 'board') {
    for (let x = 2; x < T; x += 5) pc.vline(x, 0, T - 1, m.wall[1])
  } else {
    const rand = mulberry32(variant * 31 + 3)
    for (let i = 0; i < 6; i++) pc.px(Math.floor(rand() * T), Math.floor(rand() * T), m.wall[1])
  }
  return pc
}

const floor = (variant) => drawRoomFloor(MATERIALS, variant)
const wall = (variant) => drawRoomWall(MATERIALS, variant)

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

/**
 * The board the change log is written on: a big slate in a frame, hung across the back wall. It is
 * drawn empty — the renderer writes the log onto it, because text is text and not pixels.
 */
function logboard() {
  const [w, h] = INTERIOR_SIZE.logboard
  const pc = new PixelCanvas(w, h)
  pc.rect(0, 0, w, h, P.wood)
  pc.rect(1, 1, w - 2, h - 2, P.woodDark)
  pc.rect(3, 3, w - 6, h - 6, P.slate)
  // A wiped-clean sheen across the top of the slate, so it reads as a surface and not a hole.
  pc.rect(3, 3, w - 6, 2, shade(P.slate, 0.12))
  pc.hline(3, w - 4, h - 4, shade(P.slate, -0.15))
  // The rail it stands on, and a stick of chalk.
  pc.rect(2, h - 3, w - 4, 2, P.woodLight)
  pc.rect(w - 18, h - 4, 7, 2, P.white)
  return pc.outline(P.outline)
}

/** A line of shade laid only where the sprite already is, so a weave follows what it is woven round. */
function weave(pc, y, c) {
  for (let x = 0; x < pc.w; x++) if (pc.opaque(x, y)) pc.px(x, y, c)
}

/** A table to work at: flat, with the day's things left on it, or sloped like a drawing board. */
function table(variant) {
  const [w, h] = INTERIOR_SIZE.table
  const pc = new PixelCanvas(w, h)
  if (variant % 2) {
    // Sloped: the top tilts towards whoever stands at it, and the sheet on it tilts with it.
    const topAt = (x) => 12 - Math.round(((x - 2) / (w - 5)) * 8)
    for (let x = 2; x < w - 2; x++) {
      const y = topAt(x)
      pc.rect(x, y - 5, 1, 5, P.paper)
      pc.rect(x, y, 1, 3, P.wood)
      pc.px(x, y + 2, P.woodDark)
    }
    pc.rect(w / 2 - 2, 12, 4, h - 15, P.woodDark)
    pc.rect(w / 2 - 7, h - 3, 14, 3, P.wood)
    return pc.outline(P.outline)
  }
  pc.rect(0, 8, w, 3, P.wood)
  pc.hline(0, w - 1, 8, P.woodLight)
  pc.rect(2, 11, 3, h - 11, P.woodDark)
  pc.rect(w - 5, 11, 3, h - 11, P.woodDark)
  pc.rect(2, 15, w - 4, 2, shade(P.woodDark, -0.1)) // the rail between the legs
  pc.rect(4, 3, 9, 5, P.paper) // what was left on it
  pc.hline(5, 11, 5, P.dirtDark)
  pc.rect(19, 2, 7, 6, P.cloth[9])
  pc.rect(27, 4, 4, 4, P.white)
  return pc.outline(P.outline)
}

/** A stool, for anyone who pulls one up. */
function stool() {
  const [w, h] = INTERIOR_SIZE.stool
  const pc = new PixelCanvas(w, h)
  pc.rect(0, 4, w, 3, P.wood)
  pc.hline(0, w - 1, 4, P.woodLight)
  pc.rect(2, 7, 2, h - 7, P.woodDark)
  pc.rect(w - 4, 7, 2, h - 7, P.woodDark)
  pc.hline(2, w - 3, 11, P.woodDark)
  return pc.outline(P.outline)
}

/** Something stacked in the corner: a crate, a chest with its bands on, or baskets one in another. */
function crate(variant) {
  const [w, h] = INTERIOR_SIZE.crate
  const pc = new PixelCanvas(w, h)
  const kind = variant % 3
  if (kind === 1) {
    pc.rect(0, 6, w, h - 6, P.wood)
    pc.rect(1, 2, w - 2, 5, P.woodLight) // the lid
    pc.rect(0, 6, w, 2, P.woodDark)
    pc.rect(4, 2, 3, h - 2, P.metal) // the bands round it
    pc.rect(w - 7, 2, 3, h - 2, P.metal)
    pc.rect(w / 2 - 2, 7, 4, 3, P.inlay) // the clasp
    return pc.outline(P.outline)
  }
  if (kind === 2) {
    pc.ellipse(w / 2, h - 7, 11, 7, P.dirt)
    for (let y = h - 13; y < h; y += 3) weave(pc, y, P.dirtDark)
    pc.ellipse(w / 2, 6, 8, 5, P.woodLight)
    for (let y = 2; y < 11; y += 3) weave(pc, y, P.dirt)
    return pc.outline(P.outline)
  }
  // A slatted crate: boards with the dark of it showing between them, and a brace across.
  pc.rect(0, 2, w, h - 2, shade(P.woodDark, -0.25))
  for (let y = 3; y < h - 3; y += 5) pc.rect(0, y, w, 3, P.wood)
  pc.line(3, h - 5, w - 4, 6, P.woodLight)
  pc.rect(0, 2, w, 2, P.woodLight)
  pc.rect(0, h - 3, w, 3, P.woodDark)
  return pc.outline(P.outline)
}

/** What the room is heated or cooked on: a stove with its flue, or a pot over the fire. Lit, it burns. */
function stove(variant) {
  const [w, h] = INTERIOR_SIZE.stove
  const pc = new PixelCanvas(w, h)
  const lit = variant % 2 === 1
  if (variant >> 1 === 1) {
    // A pot on its legs. The fire is under it, which is the only part of it that ever changes.
    pc.ellipse(w / 2, 18, 10, 9, P.metalDark)
    pc.ellipse(w / 2, 12, 10, 3, shade(P.metalDark, 0.3)) // the rim
    pc.rect(2, 11, w - 4, 2, P.metal)
    pc.line(6, 25, 4, h - 4, P.metalDark)
    pc.line(w - 7, 25, w - 5, h - 4, P.metalDark)
    if (lit) {
      pc.rect(5, h - 9, w - 10, 6, P.flame)
      pc.rect(7, h - 7, w - 14, 4, P.flameTip)
      pc.rect(10, h - 6, 4, 3, P.flameCore)
    } else {
      pc.rect(5, h - 6, w - 10, 3, P.ash)
    }
    pc.rect(3, h - 3, w - 6, 3, lit ? P.ember : P.ash)
    return pc.outline(P.outline)
  }
  pc.rect(6, 0, 5, 12, P.metalDark) // the flue
  pc.rect(7, 0, 2, 12, P.metal)
  pc.rect(1, 12, w - 2, h - 15, P.metal)
  pc.rect(1, 12, w - 2, 3, P.metalDark) // the plate on top
  pc.rect(3, 20, w - 6, 10, P.metalDark) // the firebox
  if (lit) {
    pc.rect(5, 22, w - 10, 6, P.flame)
    pc.rect(8, 24, w - 16, 3, P.flameCore)
  }
  pc.rect(1, h - 3, w - 2, 3, P.metalDark) // the feet
  return pc.outline(P.outline)
}

/** Something growing, or cut and kept: a plant in its pot, a jar of cuttings, a sapling in a tub. */
function plant(variant) {
  const [w, h] = INTERIOR_SIZE.plant
  const pc = new PixelCanvas(w, h)
  const kind = variant % 3
  if (kind === 1) {
    pc.rect(6, 16, 10, 12, P.glass)
    pc.rect(6, 16, 10, 3, P.glassLight)
    for (const [x, top] of [[8, 5], [11, 2], [14, 7]]) {
      pc.vline(x, top, 19, P.reed)
      pc.px(x, top, P.moss)
      pc.px(x + 1, top + 3, P.leafLight)
    }
    pc.rect(5, h - 3, 12, 3, shade(P.glass, -0.3))
    return pc.outline(P.outline)
  }
  if (kind === 2) {
    pc.rect(4, 20, 14, 8, P.woodDark)
    pc.hline(4, 17, 20, P.woodLight)
    pc.vline(11, 9, 20, P.trunk)
    pc.ellipse(11, 9, 9, 7, P.leafDark)
    pc.ellipse(10, 8, 6, 5, P.leaf)
    pc.px(13, 5, P.leafLight)
    return pc.outline(P.outline)
  }
  pc.rect(5, 19, 12, 9, P.brick)
  pc.rect(4, 18, 14, 3, shade(P.brick, 0.2))
  pc.vline(11, 13, 19, P.trunk)
  pc.ellipse(11, 12, 8, 7, P.leaf)
  pc.ellipse(9, 10, 4, 4, P.leafLight)
  return pc.outline(P.outline)
}

/** A light left standing: a lamp under its shade, or a candle on a stand. Lit, it is burning. */
function lamp(variant) {
  const [w, h] = INTERIOR_SIZE.lamp
  const pc = new PixelCanvas(w, h)
  const lit = variant % 2 === 1
  if (variant >> 1 === 1) {
    pc.ellipse(7, h - 3, 5, 3, P.metalDark)
    pc.rect(6, 14, 2, h - 16, P.metalDark)
    pc.ellipse(7, 14, 5, 2, P.metal) // the pan the wax runs into
    pc.rect(5, 6, 4, 8, P.white)
    pc.px(7, 5, P.dirtDark) // the wick
    if (lit) {
      pc.rect(6, 1, 2, 4, P.candleFlame)
      pc.px(7, 0, P.flameCore)
      pc.px(6, 3, P.flameCore)
    }
    return pc.outline(P.outline)
  }
  pc.ellipse(7, h - 3, 6, 3, P.woodDark)
  pc.rect(6, 13, 2, h - 15, P.wood)
  for (let i = 0; i < 10; i++) {
    const half = 2 + Math.round(i * 0.45)
    pc.hline(7 - half, 6 + half, 3 + i, lit ? P.glitter : P.cloth[8])
  }
  // The rim of the shade, where the light shows first.
  pc.hline(1, 12, 13, lit ? P.lampGlow : shade(P.cloth[8], -0.3))
  return pc.outline(P.outline)
}

/** What hangs on the wall where the board doesn't: a picture, a drawing pinned up, a hanging. */
function hanging(variant) {
  const [w, h] = INTERIOR_SIZE.hanging
  const pc = new PixelCanvas(w, h)
  const kind = variant % 3
  if (kind === 1) {
    pc.rect(1, 1, w - 2, h - 2, P.paper)
    for (let y = 5; y < h - 4; y += 4) pc.hline(5, w - 6, y, shade(P.paper, -0.25))
    pc.rect(4, 7, 11, 9, shade(P.paper, -0.4)) // whatever is drawn on it
    pc.rect(6, 9, 7, 5, P.paper)
    pc.px(2, 1, P.pin)
    pc.px(w - 3, 1, P.pin)
    return pc.outline(P.outline)
  }
  if (kind === 2) {
    pc.rect(0, 0, w, 2, P.wood) // the pole it hangs from
    pc.rect(2, 2, w - 4, h - 6, P.cloth[4])
    pc.rect(4, 4, w - 8, h - 10, shade(P.cloth[4], -0.2))
    pc.rect(w / 2 - 3, 8, 6, 6, P.inlay)
    for (let x = 3; x < w - 3; x += 3) pc.vline(x, h - 4, h - 2, P.inlay) // the fringe
    return pc.outline(P.outline)
  }
  pc.rect(0, 0, w, h, P.woodDark)
  pc.rect(2, 2, w - 4, h - 4, P.glassLight)
  pc.rect(2, h - 9, w - 4, 7, P.leaf)
  pc.ellipse(9, h - 11, 4, 3, P.leafDark)
  pc.rect(2, 2, w - 4, 1, P.woodLight)
  return pc.outline(P.outline)
}

/** The way up, where a room has one above it. */
function ladder() {
  const [w, h] = INTERIOR_SIZE.ladder
  const pc = new PixelCanvas(w, h)
  pc.rect(1, 0, 3, h, P.wood)
  pc.rect(w - 4, 0, 3, h, P.wood)
  pc.vline(1, 0, h - 1, P.woodLight)
  pc.vline(w - 2, 0, h - 1, P.woodDark)
  for (let y = 5; y < h - 2; y += 8) {
    pc.rect(1, y, w - 2, 2, P.woodDark)
    pc.hline(1, w - 2, y, P.woodLight)
  }
  return pc.outline(P.outline)
}

/** Where what isn't on the shelves is kept: a chest of drawers, or a plan chest of shallow ones. */
function drawers(variant) {
  const [w, h] = INTERIOR_SIZE.drawers
  const pc = new PixelCanvas(w, h)
  if (variant % 2) {
    pc.rect(0, 0, w, h, P.woodDark)
    pc.rect(0, 0, w, 3, P.woodLight)
    for (let i = 0; i < 5; i++) {
      const y = 4 + i * 5
      pc.rect(2, y, w - 4, 4, P.wood)
      pc.rect(6, y + 1, w - 12, 2, P.metal) // one long handle each
    }
    pc.rect(0, h - 3, w, 3, shade(P.woodDark, -0.2))
    return pc.outline(P.outline)
  }
  pc.rect(0, 0, w, h, P.wood)
  pc.rect(0, 0, w, 2, P.woodLight)
  for (let i = 0; i < 3; i++) {
    const y = 4 + i * 9
    pc.rect(2, y, w - 4, 7, shade(P.woodDark, -0.1))
    pc.hline(2, w - 3, y, P.woodDark)
    pc.rect(w / 2 - 3, y + 3, 6, 2, P.inlay)
  }
  pc.rect(0, h - 3, w, 3, P.woodDark)
  return pc.outline(P.outline)
}

const DRAW = { floor, wall, shelf, book, pinboard, note, window, desk, chair, bed, rug, door, logboard, table, stool, crate, stove, plant, lamp, hanging, ladder, drawers }

/**
 * One piece of a room, by name. `interior.<kind>.<variant>`; what each variant means is in
 * INTERIOR_VARIANTS above.
 */
export function drawInterior(kind, variant = 0) {
  const fn = DRAW[kind]
  if (!fn) throw new Error(`No interior called "${kind}"`)
  return fn(Number(variant) || 0)
}
