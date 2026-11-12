// Inside a frontier town's buildings: the saloon, the bunkhouse, the assay office, the ticket office
// and the mission's cool room (the rooms are in src/sim/interiors.js). A room still says what it
// always says about the work — the board, the files, the commits — so what is drawn here is what
// the room is made of and the few things in it that give the frontier away: the window onto the
// desert, the potbelly stove, the oil lamp, the card table, the cactus in its pot.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { INTERIOR_SIZE, drawRoomFloor, drawRoomWall } from '../../sprites/interiors.js'

/**
 * What each wall material (dims.wall: clapboard, logs, adobe, barnwood, stone) is like inside.
 * @type {import('../../sprites/interiors.js').RoomMaterial[]}
 */
const MATERIALS = [
  // clapboard: pine boards under papered boards
  { floor: [P.wwTimberLight, P.wwTimber], wall: [P.wwPaper, P.wwBoneShade], floorPattern: 'plank', wallPattern: 'board' },
  // logs: dark boards between log walls
  { floor: [P.wwTimber, P.wwTimberDark], wall: [P.wwLog, P.wwLogDark], floorPattern: 'plank', wallPattern: 'board' },
  // adobe: clay tiles under whitewash
  { floor: [P.wwAdobe, P.wwAdobeDark], wall: [P.wwWhitewash, P.wwBoneShade], floorPattern: 'flag', wallPattern: 'speck' },
  // barnwood: packed earth under grey boards
  { floor: [P.wwLane, P.wwLaneDark], wall: [P.wwBarnwoodLight, P.wwBarnwood], floorPattern: 'flag', wallPattern: 'board' },
  // stone: flags under coursed stone
  { floor: [P.wwStoneDark, P.wwStone], wall: [P.wwStone, P.wwStoneDark], floorPattern: 'flag', wallPattern: 'brick' },
]

/** A sash window onto the desert: the mesa and the sand by day, the stars after dark. */
function window(variant) {
  const [w, h] = INTERIOR_SIZE.window
  const pc = new PixelCanvas(w, h)
  const night = variant === 1
  pc.rect(1, 1, w - 2, h - 6, P.wwTimber)
  pc.rect(3, 3, w - 6, h - 10, night ? P.window : P.glass)
  if (night) {
    pc.px(4, 4, P.windowShine)
    pc.px(10, 6, P.windowShine)
    pc.px(7, 8, P.windowShine)
  } else {
    // The mesa on the skyline, the sand in front of it.
    pc.rect(3, h - 11, w - 6, 4, P.wwGround[0][0])
    pc.rect(8, h - 13, 4, 2, P.wwGround[3][0])
    pc.hline(8, 11, h - 13, P.wwGround[3][2])
    pc.px(5, h - 9, P.wwCactus)
    pc.px(5, h - 10, P.wwCactus)
  }
  pc.vline(w / 2, 3, h - 8, P.wwTimber)
  pc.hline(3, w - 4, (h - 6) / 2, P.wwTimber)
  pc.rect(0, h - 5, w, 2, P.wwTimberDark) // the sill
  // A tin cup on the sill, the light caught in it after dark.
  pc.rect(10, h - 8, 3, 3, P.wwTin)
  pc.px(11, h - 8, night ? P.windowLit : P.wwTinLight)
  return pc.outline(P.outline)
}

/** What stands about a room: a crate of goods, a saddle on its stand, a stack of sacks. */
function crate(variant) {
  const [w, h] = INTERIOR_SIZE.crate
  const pc = new PixelCanvas(w, h)
  const kind = variant % 3
  if (kind === 0) {
    // A crate of goods, nailed shut, stencilled on its side.
    pc.rect(1, 6, w - 2, h - 6, P.wwTimber)
    pc.hline(1, w - 2, 6, P.wwTimberLight)
    pc.line(1, h - 1, w - 2, 7, P.wwTimberDark)
    pc.vline(w - 2, 7, h - 1, P.wwTimberDark)
    pc.rect(7, 11, 10, 3, P.wwPaper)
    return pc.outline(P.outline)
  }
  if (kind === 1) {
    // A saddle thrown over a sawhorse.
    pc.line(4, h - 1, 8, 12, P.wwTimber)
    pc.line(19, h - 1, 15, 12, P.wwTimber)
    pc.hline(6, 17, 12, P.wwTimberLight)
    pc.ellipse(12, 9, 9, 4, P.wwLeather)
    pc.hline(5, 18, 7, shade(P.wwLeather, 0.2))
    pc.rect(15, 3, 3, 4, P.wwLeatherDark) // the horn
    pc.vline(8, 12, 18, P.wwLeatherDark) // the stirrup strap
    pc.hline(7, 9, 19, P.wwIronLight)
    return pc.outline(P.outline)
  }
  // A stack of flour sacks, tied at the neck.
  for (const [x, y] of [[1, 10], [12, 10], [6, 2]]) {
    pc.ellipse(x + 5, y + 5, 5, 5, P.wwPaper)
    pc.hline(x + 2, x + 8, y + 9, P.wwBoneShade)
    pc.px(x + 5, y, P.wwTimberDark)
    pc.px(x + 4, y + 5, P.wwPaint[0])
  }
  return pc.outline(P.outline)
}

/**
 * A potbelly stove with its pipe up through the roof, or a range with a coffee pot on it. Lit,
 * there is fire behind the grate.
 */
function stove(variant) {
  const [w, h] = INTERIOR_SIZE.stove
  const pc = new PixelCanvas(w, h)
  const lit = variant % 2 === 1
  if (variant >> 1 === 1) {
    // The range: a black box on legs, two lids on top and a coffee pot on one.
    pc.rect(9, 0, 4, 14, P.wwIron)
    pc.rect(2, 14, w - 4, h - 20, P.wwIron)
    pc.hline(2, w - 3, 14, P.wwIronLight)
    pc.rect(5, 22, w - 10, 6, lit ? P.flameTip : P.wwBedDeep)
    pc.vline(3, h - 6, h - 1, P.wwIron)
    pc.vline(w - 4, h - 6, h - 1, P.wwIron)
    pc.rect(14, 8, 6, 6, P.wwTin)
    pc.hline(14, 19, 8, P.wwTinLight)
    pc.px(20, 10, P.wwTinDark)
    return pc.outline(P.outline)
  }
  // The potbelly: a round black belly on a little base, its pipe going up.
  pc.rect(10, 0, 4, 12, P.wwIron)
  pc.vline(10, 0, 11, P.wwIronLight)
  pc.rect(7, 12, 10, 4, P.wwIron)
  pc.ellipse(12, 25, 9, 9, P.wwIron)
  pc.ellipse(10, 22, 4, 4, P.wwIronLight)
  pc.ellipse(12, 25, 7, 7, P.wwIron)
  pc.rect(8, 23, 8, 5, lit ? P.flameTip : P.wwBedDeep)
  if (lit) pc.hline(9, 14, 24, P.windowLitCore)
  pc.rect(4, h - 6, w - 8, 3, P.wwIron)
  pc.vline(5, h - 3, h - 1, P.wwIron)
  pc.vline(w - 6, h - 3, h - 1, P.wwIron)
  return pc.outline(P.outline)
}

/** An oil lamp on a tall stand, or a lantern hung off a peg. */
function lamp(variant) {
  const [w, h] = INTERIOR_SIZE.lamp
  const pc = new PixelCanvas(w, h)
  const lit = variant % 2 === 1
  const hung = variant >> 1 === 1
  const top = hung ? 6 : h - 22
  pc.ellipse(7, h - 3, 6, 3, P.wwTimberDark)
  if (hung) {
    pc.rect(2, 3, 2, h - 5, P.wwTimber)
    pc.hline(2, 8, 3, P.wwTimberLight)
    pc.vline(8, 3, top, P.wwIron)
  } else {
    pc.vline(7, top + 12, h - 4, P.wwTimber)
    pc.hline(4, 10, h - 4, P.wwTimberDark)
  }
  pc.hline(5, 9, top + 1, P.wwIron)
  pc.rect(4, top + 2, 7, 8, lit ? P.windowLit : P.glass)
  if (lit) pc.rect(6, top + 4, 3, 4, P.windowLitCore)
  pc.rect(3, top + 10, 9, 2, P.wwGold)
  pc.px(7, top, P.wwIron)
  return pc.outline(P.outline)
}

/** The room's table: cards dealt out and a coffee pot, or a slope-topped ledger desk. */
function table(variant) {
  const [w, h] = INTERIOR_SIZE.table
  const pc = new PixelCanvas(w, h)
  const slope = variant === 1
  pc.rect(0, 6, w, 4, P.wwTimberLight)
  pc.rect(0, 10, w, 3, P.wwTimber)
  pc.hline(0, w - 1, 13, P.wwTimberDark)
  pc.rect(2, 13, 2, h - 13, P.wwTimberDark)
  pc.rect(w - 4, 13, 2, h - 13, P.wwTimberDark)
  if (slope) {
    // A ledger open on the slope.
    pc.rect(6, 2, 16, 4, P.wwPaper)
    pc.vline(14, 2, 5, P.wwBoneShade)
    for (let x = 7; x < 21; x += 2) pc.px(x, 3, P.wwTimberDark)
    return pc.outline(P.outline)
  }
  // Cards dealt round, a stack of chips and a coffee pot.
  for (const x of [4, 9, 15]) pc.rect(x, 4, 3, 2, P.wwPaper)
  pc.px(5, 4, P.wwPaint[0])
  for (let i = 0; i < 3; i++) pc.hline(20, 22, 5 - i, [P.wwPaint[0], P.wwPaint[4], P.wwBone][i])
  pc.rect(25, 1, 4, 5, P.wwTin)
  pc.hline(25, 28, 1, P.wwTinLight)
  pc.px(29, 3, P.wwTinDark)
  return pc.outline(P.outline)
}

/** A cactus in a pot: a barrel in an olla, a prickly pear in a tin, a saguaro in a tub. */
function plant(variant) {
  const [w, h] = INTERIOR_SIZE.plant
  const pc = new PixelCanvas(w, h)
  const kind = variant % 3
  const pot = [P.wwAdobe, P.wwTin, P.wwTimber][kind]
  pc.rect(6, h - 10, 10, 10, pot)
  pc.hline(5, 16, h - 10, shade(pot, 0.2))
  pc.vline(15, h - 9, h - 1, shade(pot, -0.25))
  if (kind === 0) {
    pc.ellipse(11, h - 15, 5, 5, P.wwCactus)
    for (let x = 8; x <= 14; x += 2) pc.vline(x, h - 19, h - 11, P.wwCactusDark)
    pc.hline(9, 13, h - 20, P.wwBloom)
  } else if (kind === 1) {
    pc.ellipse(10, h - 15, 4, 3.5, P.wwCactus)
    pc.ellipse(14, h - 20, 3, 3, P.wwCactusLight)
    pc.ellipse(7, h - 21, 2.5, 2.5, P.wwCactusDark)
    pc.px(14, h - 24, P.wwBloom)
    pc.px(7, h - 24, P.wwBloom)
  } else {
    pc.rect(9, 4, 5, h - 14, P.wwCactus)
    pc.vline(9, 4, h - 11, P.wwCactusLight)
    pc.vline(13, 4, h - 11, P.wwCactusDark)
    pc.rect(4, 10, 3, 6, P.wwCactus)
    pc.hline(4, 9, 15, P.wwCactus)
    pc.rect(16, 7, 3, 6, P.wwCactusDark)
    pc.hline(13, 18, 12, P.wwCactusDark)
  }
  return pc.outline(P.outline)
}

const DRAW = { floor: (v) => drawRoomFloor(MATERIALS, v), wall: (v) => drawRoomWall(MATERIALS, v), window, crate, stove, lamp, table, plant }

/** One piece of a frontier room, or null for the ones the village draws just as well. */
export const drawWestInterior = (kind, variant) => (DRAW[kind] ? DRAW[kind](variant) : null)
