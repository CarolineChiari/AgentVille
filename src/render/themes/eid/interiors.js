// Inside a festival village's buildings: the tiled courtyard, the souk stall, the sweets kitchen and
// the garden pavilion (the rooms are in src/sim/interiors.js). A room still says what it always says
// about the work — the board, the files, the commits — so what is drawn here is what the room is
// made of and the few things in it that give the season away: the lantern on the sill, the dates in
// their basket, the oven.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { INTERIOR_SIZE, drawRoomFloor, drawRoomWall } from '../../sprites/interiors.js'

/**
 * What each wall material (dims.wall: whitewash, sandstone, tilework, clay, screen) is like
 * inside. @type {import('../../sprites/interiors.js').RoomMaterial[]}
 */
const MATERIALS = [
  // whitewash: terracotta pavers under white plaster
  { floor: [P.eidGround[2][0], P.eidGround[2][1]], wall: [P.eidWhitewash, P.eidWhitewashDark], floorPattern: 'flag', wallPattern: 'speck' },
  // sandstone: pale flags under sandstone blocks
  { floor: [P.eidSandstoneLight, P.eidSandstone], wall: [P.eidSandstone, P.eidSandstoneDark], floorPattern: 'flag', wallPattern: 'brick' },
  // tilework: blue mosaic under glazed tile
  { floor: [P.glazeBlue, P.glazeBlueDark], wall: [P.glazeBlue, P.glazeBlueDark], floorPattern: 'flag', wallPattern: 'brick' },
  // clay: beaten clay under clay walls
  { floor: [P.clayLight, P.clay], wall: [P.clay, P.clayDark], floorPattern: 'flag', wallPattern: 'speck' },
  // screen: plank floor under carved wooden screens
  { floor: [P.barnTimberLight, P.barnTimber], wall: [P.barnTimber, P.barnTimberDark], floorPattern: 'plank', wallPattern: 'board' },
]

/** A window: four panes in a cream frame, a lantern lit on the sill. */
function window(variant) {
  const [w, h] = INTERIOR_SIZE.window
  const pc = new PixelCanvas(w, h)
  const night = variant === 1
  pc.rect(1, 1, w - 2, h - 6, P.eidPaint[4])
  pc.rect(3, 3, w - 6, h - 10, night ? P.window : P.glass)
  if (night) pc.px(4, 4, P.windowShine)
  else {
    // The palms past it by day: green below the sky.
    pc.rect(3, h - 11, w - 6, 4, P.palmGreen)
    pc.hline(3, w - 4, h - 11, P.palmGreenDark)
    pc.px(5, h - 9, P.palmGreenDark)
    pc.px(10, h - 8, P.palmGreenDark)
  }
  pc.vline(w / 2, 3, h - 8, P.eidPaint[4])
  pc.hline(3, w - 4, (h - 6) / 2, P.eidPaint[4])
  pc.rect(0, h - 5, w, 2, P.barnTimberDark) // the sill
  // The lantern: brass cap and foot, a lit candle between.
  pc.rect(9, h - 8, 7, 3, P.eidPaint[1])
  pc.hline(10, 14, h - 9, P.eidBrassLight)
  pc.hline(9, 15, h - 6, P.eidBrassDark)
  pc.px(12, h - 8, P.glowCandle)
  return pc.outline(P.outline)
}

/** What stands about a harvest room: a crate of lanterns, a basket of dates, a sack of rice. */
function crate(variant) {
  const [w, h] = INTERIOR_SIZE.crate
  const pc = new PixelCanvas(w, h)
  const kind = variant % 3
  if (kind === 0) {
    // A crate heaped with lanterns.
    pc.rect(0, 12, w, h - 12, P.barnTimber)
    for (const y of [12, 17]) pc.hline(0, w - 1, y, P.barnTimberLight)
    pc.vline(0, 12, h - 1, P.barnTimberDark)
    pc.vline(w - 1, 12, h - 1, P.barnTimberDark)
    for (const [x, c] of [[6, P.eidPaint[1]], [17, P.eidPaint[3]], [11, P.eidPaint[0]]]) {
      pc.ellipse(x, 9, 5, 4, c)
      pc.vline(x, 5, 12, shade(c, -0.3))
      pc.px(x - 2, 7, shade(c, 0.35))
      pc.px(x, 4, P.eidBrassDark)
    }
    return pc.outline(P.outline)
  }
  if (kind === 1) {
    // A sack of rice, tied at the neck and slumped against itself, cobs showing over the top.
    pc.ellipse(w / 2, h - 8, 9, 8, P.linenShade)
    pc.ellipse(w / 2 - 2, h - 10, 5, 5, P.linen)
    pc.rect(w / 2 - 2, 1, 4, 5, P.linenShade)
    pc.hline(w / 2 - 3, w / 2 + 2, 5, P.barnTimberDark)
    pc.rect(w / 2 - 3, h - 11, 6, 3, P.eidPaint[1])
    pc.vline(w / 2 - 2, 0, 3, P.sugarDust)
    pc.vline(w / 2 + 1, 0, 3, P.linen)
    return pc.outline(P.outline)
  }
  // A basket of dates, just bought.
  pc.rect(0, 8, w, h - 8, P.clay)
  for (const y of [11, 15, 19]) pc.hline(0, w - 1, y, P.clayDark)
  for (let x = 0; x < w; x += 4) pc.vline(x, 8, h - 1, P.clayDark)
  for (let x = 2; x < w - 2; x += 4) {
    const c = x % 8 === 2 ? P.dateBrown : P.honey
    pc.ellipse(x + 1.5, 6, 2, 2, c)
    pc.px(x + 1, 5, shade(c, 0.3))
  }
  return pc.outline(P.outline)
}

/**
 * A brick oven, or the range beside it. Lit, there is a glow at its mouth; the tall variant is a
 * cast-iron range with a tray of sweets on top.
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
  sweetsOnTop(pc, 12)
  pc.rect(1, h - 3, w - 2, 3, P.farmIron)
  return pc.outline(P.outline)
}

/** A tray of sweets set on top of the range. */
function sweetsOnTop(pc, y) {
  pc.rect(13, y - 3, 7, 3, P.eidBrassLight)
  pc.hline(14, 18, y - 4, P.sugarDust)
  pc.hline(13, 19, y - 1, P.eidBrassDark)
}

/** A hurricane lantern: standing on its own foot, or hung off the crook of a post. */
function lamp(variant) {
  const [w, h] = INTERIOR_SIZE.lamp
  const pc = new PixelCanvas(w, h)
  const lit = variant % 2 === 1
  const hung = variant >> 1 === 1
  const top = hung ? 6 : h - 18
  pc.ellipse(7, h - 3, 6, 3, P.barnTimberDark)
  if (hung) {
    pc.rect(2, 3, 2, h - 5, P.barnTimber)
    pc.hline(2, 8, 3, P.farmIron)
    pc.vline(8, 3, top, P.farmIron)
  }
  pc.rect(4, top + 3, 8, 9, lit ? P.windowLit : P.glass)
  if (lit) pc.rect(6, top + 5, 4, 5, P.windowLitCore)
  pc.rect(3, top, 10, 3, P.eidPaint[5])
  pc.rect(3, top + 12, 10, 3, P.eidPaint[5])
  pc.vline(3, top + 3, top + 11, P.farmIron)
  pc.vline(12, top + 3, top + 11, P.farmIron)
  pc.px(8, top - 1, P.farmIron)
  return pc.outline(P.outline)
}

/** The room's table, laid with a linen cloth, a dish of sweets and a lantern. */
function table(variant) {
  const [w, h] = INTERIOR_SIZE.table
  const pc = new PixelCanvas(w, h)
  pc.rect(0, 6, w, 4, P.linen)
  pc.rect(0, 10, w, 4, P.linenShade)
  for (let x = 0; x < w; x += 2) pc.px(x, 14, P.linenShade)
  pc.rect(2, 14, 2, h - 14, P.barnTimberDark)
  pc.rect(w - 4, 14, 2, h - 14, P.barnTimberDark)
  pc.rect(6, 3, 8, 3, P.eidBrassLight)
  pc.hline(7, 12, 2, P.sugarDust)
  pc.hline(6, 13, 5, P.eidBrassDark)
  pc.ellipse(23.5, 4, 3, 2, P.eidPaint[1])
  pc.px(23, 1, P.eidBrassDark)
  return pc.outline(P.outline)
}

/** A plant: a young palm in a pot, a jar of petals, a rose in bloom. */
function plant(variant) {
  const [w, h] = INTERIOR_SIZE.plant
  const pc = new PixelCanvas(w, h)
  const kind = variant % 3
  pc.rect(6, h - 10, 10, 10, P.eidPaint[5])
  pc.hline(5, 16, h - 10, shade(P.eidPaint[5], 0.2))
  if (kind === 0) {
    for (const dx of [-3, 0, 3]) pc.line(11, h - 10, 11 + dx * 2, 4, dx ? P.palmGreen : P.palmGreenDark)
    for (const dx of [-3, 3]) pc.px(11 + dx * 2, 3, P.palmGreen)
  } else if (kind === 1) {
    for (let i = 0; i < 7; i++) pc.px(6 + ((i * 5) % 10), 6 + ((i * 3) % 8), [P.eidPaint[3], P.eidBrassLight, P.sugarDust][i % 3])
  } else {
    pc.vline(11, 6, h - 10, P.barnTimberDark)
    for (const [x, y] of [[8, 7], [14, 6], [10, 3], [12, 9], [7, 11], [15, 12]]) pc.ellipse(x + 0.5, y + 0.5, 2, 2, [P.eidPaint[3], P.honey][(x + y) & 1])
  }
  return pc.outline(P.outline)
}

const DRAW = { floor: (v) => drawRoomFloor(MATERIALS, v), wall: (v) => drawRoomWall(MATERIALS, v), window, crate, stove, lamp, table, plant }

/** One piece of an Eid room, or null for the ones the village draws just as well. */
export const drawEidInterior = (kind, variant) => (DRAW[kind] ? DRAW[kind](variant) : null)
