// Inside a Labor Day village's buildings: the meeting hall, the picnic shelter, the carpenter's shop
// and the bakehouse (the rooms are in src/sim/interiors.js). A room still says what it always says
// about the work — the board, the files, the commits — so what is drawn here is what the room is
// made of and the few things in it that give the day away: plain pennants at the window, flour
// sacks and lumber in their crates, a loaf on a gingham cloth.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { INTERIOR_SIZE, drawRoomFloor, drawRoomWall } from '../../sprites/interiors.js'

/**
 * What each wall material (dims.wall: brick, clapboard, planks, plaster, sheet) is like inside.
 * @type {import('../../sprites/interiors.js').RoomMaterial[]}
 */
const MATERIALS = [
  // brick: quarry tiles under painted brick
  { floor: [P.brick, P.brickDark], wall: [P.laborCream, P.laborCreamDark], floorPattern: 'flag', wallPattern: 'brick' },
  // clapboard: scrubbed pine under cream-painted boards
  { floor: [P.barnTimberLight, P.barnTimber], wall: [P.laborCream, P.laborCreamDark], floorPattern: 'plank', wallPattern: 'board' },
  // planks: bare timber, a floor of sawdust-grey boards
  { floor: [P.barnTimber, P.barnTimberDark], wall: [P.barnTimberLight, P.barnTimber], floorPattern: 'plank', wallPattern: 'board' },
  // plaster: flagstones under warm bakery plaster
  { floor: [P.fieldstoneLight, P.fieldstoneDark], wall: [P.laborPlaster, P.laborPlasterDark], floorPattern: 'flag', wallPattern: 'speck' },
  // sheet: timber boards under corrugated steel
  { floor: [P.barnTimberLight, P.oakBrown], wall: [P.laborSheet, P.laborSheetDark], floorPattern: 'plank', wallPattern: 'board' },
]

/** A window: four panes in a cream frame, plain pennants strung across the sky by day, a loaf cooling on the sill. */
function window(variant) {
  const [w, h] = INTERIOR_SIZE.window
  const pc = new PixelCanvas(w, h)
  const night = variant === 1
  pc.rect(1, 1, w - 2, h - 6, P.laborPaint[4])
  pc.rect(3, 3, w - 6, h - 10, night ? P.window : P.glass)
  if (night) pc.px(4, 4, P.windowShine)
  else {
    pc.hline(3, w - 4, h - 11, P.laborBanner[4])
    for (let x = 4; x < w - 4; x += 3) {
      const c = P.laborBanner[((x - 4) / 3) % 4]
      pc.hline(x, x + 1, h - 10, c)
      pc.px(x, h - 9, c)
    }
  }
  pc.vline(w / 2, 3, h - 8, P.laborPaint[4])
  pc.hline(3, w - 4, (h - 6) / 2, P.laborPaint[4])
  pc.rect(0, h - 5, w, 2, P.barnTimberDark) // the sill
  // The loaf: a crust, a score across it.
  pc.rect(9, h - 8, 7, 3, P.crust)
  pc.hline(10, 14, h - 9, P.crustLight)
  pc.hline(9, 15, h - 6, P.crustDark)
  pc.px(12, h - 8, P.crustDark)
  return pc.outline(P.outline)
}

/** What stands about the room: a crate of lumber, a sack of flour, a basket of produce. */
function crate(variant) {
  const [w, h] = INTERIOR_SIZE.crate
  const pc = new PixelCanvas(w, h)
  const kind = variant % 3
  if (kind === 0) {
    // A crate of lumber offcuts, a mallet laid across the top.
    pc.rect(0, 12, w, h - 12, P.barnTimber)
    for (const y of [12, 17]) pc.hline(0, w - 1, y, P.barnTimberLight)
    pc.vline(0, 12, h - 1, P.barnTimberDark)
    pc.vline(w - 1, 12, h - 1, P.barnTimberDark)
    for (const [x, y] of [[3, 6], [9, 4], [15, 7]]) {
      pc.rect(x, y, 5, 7, P.barnTimberLight)
      pc.vline(x + 4, y, y + 6, P.barnTimberDark)
      pc.px(x + 1, y + 2, P.hayDark)
    }
    pc.rect(5, 2, 9, 2, P.barnTimberDark)
    pc.rect(13, 0, 4, 4, P.laborSteel)
    return pc.outline(P.outline)
  }
  if (kind === 1) {
    // A sack of flour, tied at the neck and slumped against itself, a plain stripe round its belly.
    pc.ellipse(w / 2, h - 8, 9, 8, P.linenShade)
    pc.ellipse(w / 2 - 2, h - 10, 5, 5, P.linen)
    pc.rect(w / 2 - 2, 1, 4, 5, P.linenShade)
    pc.hline(w / 2 - 3, w / 2 + 2, 5, P.barnTimberDark)
    pc.rect(w / 2 - 3, h - 11, 6, 3, P.laborBanner[0])
    pc.vline(w / 2 - 2, 0, 3, P.laborBanner[3])
    pc.vline(w / 2 + 1, 0, 3, P.laborBanner[4])
    return pc.outline(P.outline)
  }
  // A basket of produce from the farm stand: apples, a squash, a bunch of wheat.
  pc.rect(0, 8, w, h - 8, P.hay)
  for (const y of [11, 15, 19]) pc.hline(0, w - 1, y, P.hayDark)
  for (let x = 0; x < w; x += 4) pc.vline(x, 8, h - 1, P.hayDark)
  for (let x = 2; x < w - 2; x += 4) {
    const c = x % 8 === 2 ? P.apple : P.squash
    pc.ellipse(x + 1.5, 6, 2, 2, c)
    pc.px(x + 1, 5, shade(c, 0.3))
  }
  pc.vline(w - 5, 0, 5, P.hayLight)
  pc.vline(w - 4, 1, 5, P.hay)
  return pc.outline(P.outline)
}

/**
 * A brick oven, or the range beside it. Lit, there is a glow at its mouth; the tall variant is a
 * cast-iron range with a loaf on top.
 */
function stove(variant) {
  const [w, h] = INTERIOR_SIZE.stove
  const pc = new PixelCanvas(w, h)
  const lit = variant % 2 === 1
  if (variant >> 1 === 1) {
    // The brick oven: a domed mouth in a brick face, a baker's peel leaning at its side.
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
  // A loaf cooling on top of the range.
  pc.rect(13, 9, 7, 3, P.crust)
  pc.hline(14, 18, 8, P.crustLight)
  pc.hline(13, 19, 11, P.crustDark)
  pc.rect(1, h - 3, w - 2, 3, P.farmIron)
  return pc.outline(P.outline)
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
  pc.rect(3, top, 10, 3, P.laborPaint[5])
  pc.rect(3, top + 12, 10, 3, P.laborPaint[5])
  pc.vline(3, top + 3, top + 11, P.farmIron)
  pc.vline(12, top + 3, top + 11, P.farmIron)
  pc.px(8, top - 1, P.farmIron)
  return pc.outline(P.outline)
}

/** The room's table, laid with a gingham cloth, a loaf on it and a pail of lemonade at the end. */
function table() {
  const [w, h] = INTERIOR_SIZE.table
  const pc = new PixelCanvas(w, h)
  pc.rect(0, 6, w, 4, P.laborGingham)
  pc.rect(0, 10, w, 4, P.laborGinghamDark)
  for (let x = 0; x < w; x += 4) pc.rect(x, 6, 2, 4, P.laborBanner[4])
  for (let x = 1; x < w; x += 2) pc.px(x, 14, P.laborGinghamDark)
  pc.rect(2, 14, 2, h - 14, P.barnTimberDark)
  pc.rect(w - 4, 14, 2, h - 14, P.barnTimberDark)
  pc.rect(6, 3, 8, 3, P.crust)
  pc.hline(7, 12, 2, P.crustLight)
  pc.hline(6, 13, 5, P.crustDark)
  pc.rect(21, 2, 5, 4, P.laborSteel)
  pc.hline(21, 25, 2, P.laborBanner[4])
  pc.hline(21, 25, 5, P.laborSteelDark)
  return pc.outline(P.outline)
}

/** A plant: a crock of tools, a jar of paintbrushes, a sheaf of wheat. */
function plant(variant) {
  const [w, h] = INTERIOR_SIZE.plant
  const pc = new PixelCanvas(w, h)
  const kind = variant % 3
  pc.rect(6, h - 10, 10, 10, P.laborPaint[7])
  pc.hline(5, 16, h - 10, shade(P.laborPaint[7], 0.2))
  if (kind === 0) {
    // A crock of tools, handles up: a hammer, a screwdriver, a wooden spoon.
    for (const [dx, c] of [[-3, P.barnTimber], [0, P.laborBanner[1]], [3, P.barnTimberLight]]) {
      pc.line(11, h - 10, 11 + dx * 2, 4, c)
      pc.rect(10 + dx * 2, 2, 3, 3, dx ? c : P.laborSteel)
    }
  } else if (kind === 1) {
    // A jar of brushes, bristles up in four plain colours.
    for (let i = 0; i < 4; i++) {
      pc.vline(8 + i * 2, 4, h - 11, P.barnTimberLight)
      pc.rect(7 + i * 2, 1, 3, 4, P.laborBanner[i])
    }
  } else {
    // A sheaf of wheat bound with a band.
    for (const dx of [-4, -2, 0, 2, 4]) {
      pc.line(11, h - 10, 11 + dx, 4, P.hayDark)
      pc.rect(10 + dx, 1, 2, 4, P.hayLight)
    }
    pc.hline(8, 14, h - 14, P.laborBanner[1])
  }
  return pc.outline(P.outline)
}

const DRAW = { floor: (v) => drawRoomFloor(MATERIALS, v), wall: (v) => drawRoomWall(MATERIALS, v), window, crate, stove, lamp, table, plant }

/** One piece of a room, or null for the ones the village draws just as well. */
export const drawLaborInterior = (kind, variant) => (DRAW[kind] ? DRAW[kind](variant) : null)
