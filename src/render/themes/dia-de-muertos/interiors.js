// Inside a village keeping the Day of the Dead: the ofrenda room, the flower stall, the panadería
// and the caretaker's lodge (the rooms are in src/sim/interiors.js). A room still says what it
// always says about the work — the board, the files, the commits — so what is drawn here is what
// the room is made of and the few things in it that give the season away: the candle on the sill,
// the altar table with its photographs, the oven with the pan de muerto.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { INTERIOR_SIZE, drawRoomFloor, drawRoomWall } from '../../sprites/interiors.js'

/**
 * What each wall material (dims.wall: pinkwash, bluewash, adobe, talavera, cantera) is like
 * inside. @type {import('../../sprites/interiors.js').RoomMaterial[]}
 */
const MATERIALS = [
  // pinkwash: terracotta tile under rosa mexicano plaster
  { floor: [P.muertosGround[2][0], P.muertosGround[2][1]], wall: [P.muertosPink, P.muertosPinkDark], floorPattern: 'flag', wallPattern: 'speck' },
  // bluewash: cantera flags under añil plaster
  { floor: [P.muertosGround[0][0], P.muertosGround[0][1]], wall: [P.muertosBlue, P.muertosBlueDark], floorPattern: 'flag', wallPattern: 'speck' },
  // adobe: beaten earth under adobe brick
  { floor: [P.muertosAdobeLight, P.muertosAdobe], wall: [P.muertosAdobe, P.muertosAdobeDark], floorPattern: 'flag', wallPattern: 'brick' },
  // talavera: plank floor under a wainscot of Talavera tile
  { floor: [P.barnTimberLight, P.barnTimber], wall: [P.talavera, P.talaveraBlue], floorPattern: 'plank', wallPattern: 'brick' },
  // cantera: stone flags under stone blocks
  { floor: [P.canteraLight, P.cantera], wall: [P.cantera, P.canteraDark], floorPattern: 'flag', wallPattern: 'brick' },
]

/** A candle on row y at column x, two rows of wax and its flame. */
function candle(pc, x, y) {
  pc.vline(x, y - 1, y, P.candleWax)
  pc.px(x, y - 2, P.flameTip)
}

/** A window: four panes in a cream frame, a candle and a jar of marigolds on the sill. */
function window(variant) {
  const [w, h] = INTERIOR_SIZE.window
  const pc = new PixelCanvas(w, h)
  const night = variant === 1
  pc.rect(1, 1, w - 2, h - 6, P.muertosPaint[5])
  pc.rect(3, 3, w - 6, h - 10, night ? P.window : P.glass)
  if (night) pc.px(4, 4, P.windowShine)
  else {
    // The street past it by day: a string of papel picado across the glass.
    for (let x = 3; x <= w - 4; x++) if (x % 3 !== 2) pc.px(x, 5, [P.muertosPaint[0], P.muertosPaint[2], P.muertosPaint[4]][Math.floor(x / 3) % 3])
  }
  pc.vline(w / 2, 3, h - 8, P.muertosPaint[5])
  pc.hline(3, w - 4, (h - 6) / 2, P.muertosPaint[5])
  pc.rect(0, h - 5, w, 2, P.barnTimberDark) // the sill
  candle(pc, 4, h - 6)
  candle(pc, 6, h - 6)
  // A jar of cempasúchil.
  pc.rect(10, h - 8, 4, 3, P.talavera)
  pc.px(11, h - 7, P.talaveraBlue)
  for (const [x, y] of [[10, h - 10], [12, h - 11], [13, h - 9]]) {
    pc.px(x, y, P.marigold)
    pc.px(x + 1, y, P.marigoldLight)
    pc.px(x, y + 1, P.marigoldDeep)
  }
  return pc.outline(P.outline)
}

/** What stands about: a crate of marigold bunches, a sack of sugar, a basket of pan de muerto. */
function crate(variant) {
  const [w, h] = INTERIOR_SIZE.crate
  const pc = new PixelCanvas(w, h)
  const kind = variant % 3
  if (kind === 0) {
    // A crate heaped with cempasúchil, cut for the graves.
    pc.rect(0, 12, w, h - 12, P.barnTimber)
    for (const y of [12, 17]) pc.hline(0, w - 1, y, P.barnTimberLight)
    pc.vline(0, 12, h - 1, P.barnTimberDark)
    pc.vline(w - 1, 12, h - 1, P.barnTimberDark)
    for (let x = 2; x < w - 2; x += 4) {
      for (const dy of [0, 4]) {
        pc.ellipse(x + 1.5, 6 + dy - (x % 8 === 2 ? 2 : 0), 2.2, 2.2, dy ? P.marigoldDeep : P.marigold)
        pc.px(x + 1, 5 + dy - (x % 8 === 2 ? 2 : 0), P.marigoldLight)
      }
    }
    return pc.outline(P.outline)
  }
  if (kind === 1) {
    // A sack of sugar for the skulls, tied at the neck and slumped against itself.
    pc.ellipse(w / 2, h - 8, 9, 8, P.linenShade)
    pc.ellipse(w / 2 - 2, h - 10, 5, 5, P.linen)
    pc.rect(w / 2 - 2, 1, 4, 5, P.linenShade)
    pc.hline(w / 2 - 3, w / 2 + 2, 5, P.barnTimberDark)
    pc.rect(w / 2 - 3, h - 11, 6, 3, P.muertosPaint[0])
    pc.vline(w / 2 - 2, 0, 3, P.sugarDust)
    pc.vline(w / 2 + 1, 0, 3, P.linen)
    return pc.outline(P.outline)
  }
  // A basket of pan de muerto, just baked.
  pc.rect(0, 8, w, h - 8, P.muertosAdobe)
  for (const y of [11, 15, 19]) pc.hline(0, w - 1, y, P.muertosAdobeDark)
  for (let x = 0; x < w; x += 4) pc.vline(x, 8, h - 1, P.muertosAdobeDark)
  for (let x = 1; x < w - 4; x += 6) {
    pc.ellipse(x + 2.5, 6, 3, 2.5, P.panMuerto)
    pc.hline(x + 1, x + 4, 5, P.panMuertoDark)
    pc.px(x + 2, 4, P.sugarDust)
  }
  return pc.outline(P.outline)
}

/**
 * A brick oven, or the range beside it. Lit, there is a glow at its mouth; the oven has loaves
 * of pan de muerto on its shelf.
 */
function stove(variant) {
  const [w, h] = INTERIOR_SIZE.stove
  const pc = new PixelCanvas(w, h)
  const lit = variant % 2 === 1
  if (variant >> 1 === 1) {
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
  pc.rect(6, 0, 5, 12, P.muertosIron) // the flue
  pc.rect(7, 0, 2, 12, P.muertosIronLight)
  pc.rect(1, 12, w - 2, h - 15, P.muertosIron)
  pc.rect(1, 12, w - 2, 3, P.muertosIronLight)
  pc.rect(3, 20, w - 6, 10, shade(P.muertosIron, -0.3))
  if (lit) {
    pc.rect(5, 22, w - 10, 6, P.ember)
    pc.rect(8, 24, w - 16, 3, P.flame)
  }
  // A loaf cooling on top.
  pc.ellipse(16, 10, 3.5, 2, P.panMuerto)
  pc.hline(14, 18, 9, P.panMuertoDark)
  pc.px(16, 8, P.sugarDust)
  pc.rect(1, h - 3, w - 2, 3, P.muertosIron)
  return pc.outline(P.outline)
}

/** A farol, a pierced tin lantern: standing on its own foot, or hung off the crook of a post. */
function lamp(variant) {
  const [w, h] = INTERIOR_SIZE.lamp
  const pc = new PixelCanvas(w, h)
  const lit = variant % 2 === 1
  const hung = variant >> 1 === 1
  const top = hung ? 6 : h - 18
  pc.ellipse(7, h - 3, 6, 3, P.barnTimberDark)
  if (hung) {
    pc.rect(2, 3, 2, h - 5, P.barnTimber)
    pc.hline(2, 8, 3, P.muertosIron)
    pc.vline(8, 3, top, P.muertosIron)
  }
  pc.rect(4, top + 3, 8, 9, lit ? P.windowLit : P.glass)
  if (lit) pc.rect(6, top + 5, 4, 5, P.windowLitCore)
  pc.rect(3, top, 10, 3, P.headstoneLight)
  pc.rect(3, top + 12, 10, 3, P.headstoneLight)
  for (let x = 4; x <= 11; x += 2) pc.px(x, top + 1, P.headstoneDark)
  pc.vline(3, top + 3, top + 11, P.headstoneDark)
  pc.vline(12, top + 3, top + 11, P.headstoneDark)
  pc.px(8, top - 1, P.muertosIron)
  return pc.outline(P.outline)
}

/** The ofrenda table: a cloth to the floor, photographs, candles, a skull and a loaf on it. */
function table(variant) {
  const [w, h] = INTERIOR_SIZE.table
  const pc = new PixelCanvas(w, h)
  const cloth = [P.muertosPaint[3], P.muertosPaint[0]][variant % 2]
  pc.rect(0, 6, w, 4, P.muertosPaint[5])
  pc.rect(0, 10, w, 4, cloth)
  for (let x = 0; x < w; x += 2) pc.px(x, 14, cloth)
  pc.rect(2, 14, 2, h - 14, P.barnTimberDark)
  pc.rect(w - 4, 14, 2, h - 14, P.barnTimberDark)
  // A photograph in its frame, a sugar skull, candles and a loaf.
  pc.rect(4, 0, 5, 6, P.barnTimberDark)
  pc.rect(5, 1, 3, 4, P.sugarSkullShade)
  pc.px(6, 2, P.linen)
  pc.rect(11, 3, 4, 3, P.sugarSkull)
  pc.px(11, 4, P.muertosIron)
  pc.px(14, 4, P.muertosIron)
  pc.px(12, 3, P.muertosPaint[2])
  candle(pc, 17, 5)
  candle(pc, 19, 5)
  pc.ellipse(24, 4, 3, 2, P.panMuerto)
  pc.px(24, 2, P.sugarDust)
  return pc.outline(P.outline)
}

/** A plant: a pot of cempasúchil, a jar of magenta cockscomb, a veladora among leaves. */
function plant(variant) {
  const [w, h] = INTERIOR_SIZE.plant
  const pc = new PixelCanvas(w, h)
  const kind = variant % 3
  pc.rect(6, h - 10, 10, 10, P.diyaClay)
  pc.hline(5, 16, h - 10, P.diyaClayLight)
  if (kind === 0) {
    for (const dx of [-3, 0, 3]) pc.line(11, h - 10, 11 + dx, 6, P.palmGreenDark)
    for (const [x, y] of [[8, 5], [11, 3], [14, 5], [10, 7], [13, 8]]) {
      pc.ellipse(x + 0.5, y + 0.5, 2, 2, (x + y) % 2 ? P.marigold : P.marigoldDeep)
      pc.px(x, y, P.marigoldLight)
    }
  } else if (kind === 1) {
    pc.vline(11, 6, h - 10, P.palmGreenDark)
    for (const [x, y] of [[9, 4], [12, 3], [10, 7], [13, 6]]) pc.ellipse(x + 0.5, y + 0.5, 2, 2.5, [P.muertosPaint[0], shade(P.muertosPaint[0], -0.25)][(x + y) & 1])
  } else {
    for (const dx of [-4, 4]) pc.line(11, h - 10, 11 + dx, 5, P.palmGreen)
    pc.rect(9, 3, 4, 7, P.muertosPaint[3])
    pc.vline(9, 3, 9, P.white)
    pc.px(11, 2, P.flameTip)
  }
  return pc.outline(P.outline)
}

const DRAW = { floor: (v) => drawRoomFloor(MATERIALS, v), wall: (v) => drawRoomWall(MATERIALS, v), window, crate, stove, lamp, table, plant }

/** One piece of a Día de los Muertos room, or null for the ones the village draws just as well. */
export const drawMuertosInterior = (kind, variant) => (DRAW[kind] ? DRAW[kind](variant) : null)
