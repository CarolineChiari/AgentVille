// Inside a Christmas village's buildings: the market stall, the snug cottage, the toy workshop, the
// gingerbread kitchen and the carol nook (the rooms are in src/sim/interiors.js). A room still says
// what it always says about the work — the board, the files, the commits — so what is drawn here is
// what the room is made of and the few things in it that give the season away: the candle on the
// sill, the presents in their crate, the fire with its stocking, the little fir in the corner.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { INTERIOR_SIZE, drawRoomFloor, drawRoomWall } from '../../sprites/interiors.js'

/**
 * What each wall material (dims.wall: planks, logs, gingerbread, icing, stone) is like inside.
 * @type {import('../../sprites/interiors.js').RoomMaterial[]}
 */
const MATERIALS = [
  // planks: pine boards, as a market hut is knocked together
  { floor: [P.xmasPlankLight, P.xmasPlank], wall: [P.xmasPlank, P.xmasPlankDark], floorPattern: 'plank', wallPattern: 'board' },
  // logs: a cabin's floor and walls, banked with snow outside
  { floor: [P.xmasLogLight, P.xmasLog], wall: [P.xmasLog, P.xmasLogDark], floorPattern: 'plank', wallPattern: 'board' },
  // gingerbread: biscuit slabs under biscuit walls
  { floor: [P.xmasGingerLight, P.xmasGinger], wall: [P.xmasGinger, P.xmasGingerDark], floorPattern: 'flag', wallPattern: 'brick' },
  // icing: white icing over a pale floor
  { floor: [P.xmasIcing, P.xmasIcingDark], wall: [P.xmasIcing, P.xmasIcingDark], floorPattern: 'flag', wallPattern: 'speck' },
  // stone: grey flags under cold stone
  { floor: [P.xmasStoneLight, P.xmasStone], wall: [P.xmasStone, P.xmasStoneDark], floorPattern: 'flag', wallPattern: 'brick' },
]

/** A window: four panes in a cream frame, snow falling past it, a candle burning on the sill. */
function window(variant) {
  const [w, h] = INTERIOR_SIZE.window
  const pc = new PixelCanvas(w, h)
  const night = variant === 1
  pc.rect(1, 1, w - 2, h - 6, P.xmasPaint[4])
  pc.rect(3, 3, w - 6, h - 10, night ? P.window : P.glass)
  if (night) pc.px(4, 4, P.windowShine)
  else {
    // Snow outside, banked on the bottom of the panes.
    pc.rect(3, h - 11, w - 6, 3, P.xmasSnow)
    pc.px(5, 5, P.xmasSnow)
    pc.px(10, 7, P.xmasSnow)
    pc.px(13, 4, P.xmasSnow)
  }
  pc.vline(w / 2, 3, h - 8, P.xmasPaint[4])
  pc.hline(3, w - 4, (h - 6) / 2, P.xmasPaint[4])
  pc.rect(0, h - 5, w, 2, P.xmasLogDark) // the sill
  // The candle: a wax stub and a flame, with a sprig of holly at its foot.
  pc.rect(10, h - 8, 3, 3, P.xmasWax)
  pc.px(11, h - 9, P.flameTip)
  pc.px(11, h - 10, P.glowCandle)
  pc.px(8, h - 6, P.xmasFir)
  pc.px(9, h - 6, P.xmasHolly)
  pc.px(14, h - 6, P.xmasFir)
  return pc.outline(P.outline)
}

/** What stands about a room: a crate of baubles, a sack of presents, a basket of gingerbread. */
function crate(variant) {
  const [w, h] = INTERIOR_SIZE.crate
  const pc = new PixelCanvas(w, h)
  const kind = variant % 3
  if (kind === 0) {
    // A crate heaped with baubles.
    pc.rect(0, 12, w, h - 12, P.xmasPlank)
    for (const y of [12, 17]) pc.hline(0, w - 1, y, P.xmasPlankLight)
    pc.vline(0, 12, h - 1, P.xmasPlankDark)
    pc.vline(w - 1, 12, h - 1, P.xmasPlankDark)
    for (const [x, c] of [[6, P.xmasHolly], [17, P.xmasBulbBlue], [11, P.xmasTinsel]]) {
      pc.ellipse(x, 9, 5, 4, c)
      pc.px(x - 2, 7, shade(c, 0.4))
      pc.px(x, 4, P.xmasTinsel)
    }
    return pc.outline(P.outline)
  }
  if (kind === 1) {
    // A sack of presents, tied at the neck with a ribbon, a parcel peeping over the top.
    pc.ellipse(w / 2, h - 8, 9, 8, P.xmasPaint[0])
    pc.ellipse(w / 2 - 2, h - 10, 5, 5, shade(P.xmasPaint[0], 0.25))
    pc.rect(w / 2 - 2, 1, 4, 5, P.xmasPaint[1])
    pc.hline(w / 2 - 3, w / 2 + 2, 5, P.xmasTinsel)
    pc.rect(w / 2 - 3, h - 11, 6, 3, P.xmasTinsel)
    pc.vline(w / 2 - 2, 0, 3, P.xmasPaint[2])
    return pc.outline(P.outline)
  }
  // A basket of gingerbread, iced.
  pc.rect(0, 8, w, h - 8, P.xmasPlank)
  for (const y of [11, 15, 19]) pc.hline(0, w - 1, y, P.xmasPlankDark)
  for (let x = 0; x < w; x += 4) pc.vline(x, 8, h - 1, P.xmasPlankDark)
  for (let x = 2; x < w - 2; x += 4) {
    pc.ellipse(x + 1.5, 6, 2, 2, P.xmasGinger)
    pc.px(x + 1, 5, P.xmasIcing)
    pc.px(x + 2, 6, P.xmasCandyRed)
  }
  return pc.outline(P.outline)
}

/**
 * A brick oven, or the hearth beside it. Lit, there is a glow at its mouth; the tall variant is a
 * cast-iron stove with a tray of gingerbread on top.
 */
function stove(variant) {
  const [w, h] = INTERIOR_SIZE.stove
  const pc = new PixelCanvas(w, h)
  const lit = variant % 2 === 1
  if (variant >> 1 === 1) {
    // The brick oven: a domed mouth in a brick face, a peel leaning at its side.
    pc.rect(1, 6, w - 2, h - 9, P.brick)
    for (let y = 8; y < h - 4; y += 4) pc.hline(1, w - 2, y, P.brickDark)
    pc.rect(6, 14, w - 12, h - 20, lit ? P.flame : P.interior)
    pc.rect(8, 17, w - 16, h - 25, lit ? P.flameTip : P.ash)
    if (lit) pc.rect(10, 19, w - 20, 3, P.flameCore)
    pc.hline(5, w - 6, 13, P.brickDark)
    pc.rect(0, h - 3, w, 3, P.brickDark)
    pc.rect(9, 0, 6, 8, P.brick)
    pc.hline(8, 15, 0, P.brickDark)
    return pc.outline(P.outline)
  }
  pc.rect(6, 0, 5, 12, P.farmIron) // the flue
  pc.rect(7, 0, 2, 12, P.farmIronLight)
  pc.rect(1, 12, w - 2, h - 15, P.farmIron)
  pc.rect(1, 12, w - 2, 3, P.farmIronLight)
  pc.rect(3, 20, w - 6, 10, shade(P.farmIron, -0.3))
  if (lit) {
    pc.rect(5, 22, w - 10, 6, P.ember)
    pc.rect(8, 24, w - 16, 3, P.flame)
  }
  gingerOnTop(pc, 12)
  pc.rect(1, h - 3, w - 2, 3, P.farmIron)
  return pc.outline(P.outline)
}

/** A tray of gingerbread set on top of the stove. */
function gingerOnTop(pc, y) {
  pc.rect(13, y - 3, 7, 3, P.xmasGinger)
  pc.hline(14, 18, y - 4, P.xmasIcing)
  pc.hline(13, 19, y - 1, P.xmasGingerDark)
  pc.px(15, y - 2, P.xmasCandyRed)
}

/** A lantern with a candle in it: standing on its own foot, or hung off the crook of a post. */
function lamp(variant) {
  const [w, h] = INTERIOR_SIZE.lamp
  const pc = new PixelCanvas(w, h)
  const lit = variant % 2 === 1
  const hung = variant >> 1 === 1
  const top = hung ? 6 : h - 18
  pc.ellipse(7, h - 3, 6, 3, P.xmasLogDark)
  if (hung) {
    pc.rect(2, 3, 2, h - 5, P.xmasLog)
    pc.hline(2, 8, 3, P.farmIron)
    pc.vline(8, 3, top, P.farmIron)
  }
  pc.rect(4, top + 3, 8, 9, lit ? P.windowLit : P.glass)
  if (lit) pc.rect(6, top + 5, 4, 5, P.windowLitCore)
  pc.rect(3, top, 10, 3, P.xmasPaint[0])
  pc.rect(3, top + 12, 10, 3, P.xmasPaint[0])
  pc.vline(3, top + 3, top + 11, P.farmIron)
  pc.vline(12, top + 3, top + 11, P.farmIron)
  pc.px(8, top - 1, P.xmasFir)
  pc.px(7, top - 1, P.xmasHolly)
  return pc.outline(P.outline)
}

/** The room's table, laid with a red cloth, a plate of gingerbread and a candle. */
function table(variant) {
  const [w, h] = INTERIOR_SIZE.table
  const pc = new PixelCanvas(w, h)
  pc.rect(0, 6, w, 4, P.xmasPaint[0])
  pc.rect(0, 10, w, 4, shade(P.xmasPaint[0], -0.3))
  for (let x = 0; x < w; x += 2) pc.px(x, 14, shade(P.xmasPaint[0], -0.3))
  pc.hline(0, w - 1, 6, P.xmasIcing)
  pc.rect(2, 14, 2, h - 14, P.xmasLogDark)
  pc.rect(w - 4, 14, 2, h - 14, P.xmasLogDark)
  pc.rect(6, 3, 8, 3, P.xmasGinger)
  pc.hline(7, 12, 2, P.xmasIcing)
  pc.hline(6, 13, 5, P.xmasGingerDark)
  pc.rect(22, 2, 3, 4, P.xmasWax)
  pc.px(23, 1, P.glowCandle)
  return pc.outline(P.outline)
}

/** A plant: a small fir in a pot, a bowl of holly, a poinsettia in bloom. */
function plant(variant) {
  const [w, h] = INTERIOR_SIZE.plant
  const pc = new PixelCanvas(w, h)
  const kind = variant % 3
  pc.rect(6, h - 10, 10, 10, P.xmasPaint[5])
  pc.hline(5, 16, h - 10, shade(P.xmasPaint[5], 0.2))
  if (kind === 0) {
    // The little tree: three tiers of fir, a gold star, a few baubles.
    pc.rect(10, h - 14, 2, 4, P.xmasLog)
    for (const [y, half] of [[h - 14, 6], [h - 19, 4], [h - 23, 2]]) {
      for (let i = 0; i < 4; i++) pc.hline(11 - Math.min(half, half - 3 + i), 10 + Math.min(half, half - 3 + i), y - i + 3, i % 2 ? P.xmasFirLight : P.xmasFir)
    }
    pc.px(11, 3, P.xmasBulbYellow)
    pc.px(8, h - 15, P.xmasHolly)
    pc.px(14, h - 18, P.xmasBulbBlue)
  } else if (kind === 1) {
    // A bowl of holly: leaves and berries.
    for (let i = 0; i < 7; i++) pc.px(6 + ((i * 5) % 10), 6 + ((i * 3) % 8), [P.xmasFir, P.xmasHolly, P.xmasFirLight][i % 3])
  } else {
    // A poinsettia: red bracts round a yellow heart.
    pc.vline(11, 6, h - 10, P.xmasFirDark)
    for (const [x, y] of [[8, 7], [14, 6], [10, 3], [12, 9], [7, 11], [15, 12]]) pc.ellipse(x + 0.5, y + 0.5, 2, 2, [P.xmasHolly, P.xmasCandyRed][(x + y) & 1])
    pc.px(11, 7, P.xmasBulbYellow)
  }
  return pc.outline(P.outline)
}

const DRAW = { floor: (v) => drawRoomFloor(MATERIALS, v), wall: (v) => drawRoomWall(MATERIALS, v), window, crate, stove, lamp, table, plant }

/** One piece of a Christmas room, or null for the ones the village draws just as well. */
export const drawChristmasInterior = (kind, variant) => (DRAW[kind] ? DRAW[kind](variant) : null)
