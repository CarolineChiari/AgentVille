// Inside a colony's buildings: the dome lounge, the ore bay, the grow lab, mission control and the
// research lab (the rooms are in src/sim/interiors.js). A room still says what it always says
// about the work — the board, the files, the commits — so what is drawn here is what the room is
// made of and the few things in it that give the colony away: the porthole, the sample crates,
// the grow rack, the fabricator.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { INTERIOR_SIZE, drawRoomFloor, drawRoomWall } from '../../sprites/interiors.js'

/**
 * What each wall material (dims.wall: hull, brick, plating, glass, greenhouse) is like inside.
 * @type {import('../../sprites/interiors.js').RoomMaterial[]}
 */
const MATERIALS = [
  // hull: pale deck plates under painted panels
  { floor: [P.spaceHullDark, P.spacePlateLight], wall: [P.spaceHull, P.spaceHullDark], floorPattern: 'flag', wallPattern: 'speck' },
  // brick: regolith flags under sintered brick
  { floor: [P.spaceGround[0][1], P.spaceGround[0][3]], wall: [P.spaceBrick, P.spaceBrickDark], floorPattern: 'flag', wallPattern: 'brick' },
  // plating: dark deck under steel plates
  { floor: [P.spacePlate, P.spacePlateDark], wall: [P.spacePlateLight, P.spacePlate], floorPattern: 'flag', wallPattern: 'brick' },
  // glass: pale flags under panes
  { floor: [P.spaceGlass, P.spaceGlassDark], wall: [P.spaceGlassLight, P.spaceGlass], floorPattern: 'flag', wallPattern: 'brick' },
  // greenhouse: grow-bay boards under green-lit panels
  { floor: [P.spaceGreenPanel, P.spaceGreenDark], wall: [P.spaceGreenGlow, P.spaceGreenPanel], floorPattern: 'plank', wallPattern: 'board' },
]

/** A porthole: a round frame onto the stars, or the red plain by day, a small console light below. */
function window(variant) {
  const [w, h] = INTERIOR_SIZE.window
  const pc = new PixelCanvas(w, h)
  const night = variant === 1
  pc.rect(1, 1, w - 2, h - 6, P.spaceHull)
  pc.rect(3, 3, w - 6, h - 10, night ? P.window : P.glass)
  if (night) {
    pc.px(4, 4, P.windowShine)
    pc.px(10, 6, P.windowShine)
  } else {
    // The plain past it by day: red regolith below the sky.
    pc.rect(3, h - 11, w - 6, 4, P.spaceGround[0][0])
    pc.hline(3, w - 4, h - 11, P.spaceGround[0][2])
    pc.px(5, h - 9, P.spaceGround[0][3])
    pc.px(10, h - 8, P.spaceGround[0][3])
  }
  pc.vline(w / 2, 3, h - 8, P.spaceHull)
  pc.hline(3, w - 4, (h - 6) / 2, P.spaceHull)
  pc.rect(0, h - 5, w, 2, P.spacePlateDark) // the sill
  // A little beacon on the sill: lit when the window is.
  pc.rect(9, h - 8, 6, 3, P.spacePlate)
  pc.hline(10, 13, h - 9, night ? P.spaceGlow : P.spacePaint[3])
  return pc.outline(P.outline)
}

/** What stands about a bay: a crate of ore samples, a gas cylinder, a stack of bins. */
function crate(variant) {
  const [w, h] = INTERIOR_SIZE.crate
  const pc = new PixelCanvas(w, h)
  const kind = variant % 3
  if (kind === 0) {
    // A sample crate, heaped with violet ore and a cut crystal.
    pc.rect(0, 12, w, h - 12, P.spacePlate)
    for (const y of [12, 17]) pc.hline(0, w - 1, y, P.spacePlateLight)
    pc.vline(0, 12, h - 1, P.spacePlateDark)
    pc.vline(w - 1, 12, h - 1, P.spacePlateDark)
    for (const [x, c] of [[6, P.spaceOre], [17, P.spaceOreLight], [11, P.spacePaint[2]]]) {
      pc.ellipse(x, 9, 5, 4, c)
      pc.vline(x, 5, 12, shade(c, -0.3))
      pc.px(x - 2, 7, shade(c, 0.35))
    }
    return pc.outline(P.outline)
  }
  if (kind === 1) {
    // Two gas cylinders strapped together, valves on top.
    for (const [x, c] of [[3, P.spacePaint[0]], [13, P.spaceHull]]) {
      pc.rect(x, 5, 8, h - 5, c)
      pc.vline(x, 5, h - 1, shade(c, 0.25))
      pc.vline(x + 7, 5, h - 1, shade(c, -0.3))
      pc.rect(x + 2, 1, 4, 4, P.spacePlate)
      pc.hline(x, x + 7, 10, P.spaceHazard)
    }
    pc.hline(3, 20, 16, P.spacePlateDark)
    return pc.outline(P.outline)
  }
  // A stack of supply bins, a hazard stripe across the top one.
  pc.rect(0, 11, w, h - 11, P.spacePaint[1])
  pc.rect(2, 2, w - 6, 9, P.spacePaint[5])
  for (const y of [11, 16]) pc.hline(0, w - 1, y, shade(P.spacePaint[1], -0.3))
  for (let x = 2; x < w - 4; x++) pc.px(x, 5, x % 4 < 2 ? P.spaceHazard : P.spacePlateDark)
  pc.vline(w - 1, 11, h - 1, shade(P.spacePaint[1], -0.3))
  pc.hline(2, w - 5, 2, P.spaceHullLight)
  return pc.outline(P.outline)
}

/**
 * A fabricator, or the life-support cabinet beside it. Lit, there is a glow in its window; the
 * tall variant is the cabinet, with a bank of indicator lights.
 */
function stove(variant) {
  const [w, h] = INTERIOR_SIZE.stove
  const pc = new PixelCanvas(w, h)
  const lit = variant % 2 === 1
  if (variant >> 1 === 1) {
    // The cabinet: a steel case with a screen and a column of lights, a vent pipe up the side.
    pc.rect(2, 6, w - 4, h - 9, P.spacePlate)
    pc.vline(2, 6, h - 4, P.spacePlateLight)
    pc.vline(w - 3, 6, h - 4, P.spacePlateDark)
    pc.rect(5, 10, w - 10, 10, lit ? P.spaceGreenGlow : P.spaceBedDark)
    if (lit) pc.hline(7, w - 8, 14, P.spaceGreenPanel)
    for (let i = 0; i < 4; i++) pc.px(w - 6, 24 + i * 3, lit && i % 2 === 0 ? P.spaceGreenGlow : i === 3 ? P.spacePaint[3] : P.spacePlateDark)
    pc.rect(5, 24, 8, 7, P.spacePlateDark)
    pc.rect(w - 6, 0, 3, 8, P.spacePlateLight)
    pc.rect(0, h - 3, w, 3, P.spacePlateDark)
    return pc.outline(P.outline)
  }
  // The fabricator: a boxy printer with a hot nozzle and a part half built inside.
  pc.rect(6, 0, 5, 10, P.spacePlate)
  pc.rect(7, 0, 2, 10, P.spacePlateLight)
  pc.rect(1, 10, w - 2, h - 13, P.spaceHull)
  pc.rect(1, 10, w - 2, 3, P.spaceHullLight)
  pc.rect(3, 16, w - 6, 14, P.spacePlateDark)
  if (lit) {
    pc.rect(5, 18, w - 10, 10, P.spacePaint[1])
    pc.rect(8, 21, w - 16, 5, P.flameTip)
  } else {
    pc.rect(9, 24, 6, 4, P.spacePlate)
  }
  pc.rect(1, h - 3, w - 2, 3, P.spacePlate)
  return pc.outline(P.outline)
}

/** A floodlight: on a tripod of its own, or hung off the arm of a post. */
function lamp(variant) {
  const [w, h] = INTERIOR_SIZE.lamp
  const pc = new PixelCanvas(w, h)
  const lit = variant % 2 === 1
  const hung = variant >> 1 === 1
  const top = hung ? 6 : h - 18
  pc.ellipse(7, h - 3, 6, 3, P.spacePlateDark)
  if (hung) {
    pc.rect(2, 3, 2, h - 5, P.spacePlate)
    pc.hline(2, 8, 3, P.spacePlateLight)
    pc.vline(8, 3, top, P.spacePlateDark)
  } else {
    pc.vline(7, top + 12, h - 4, P.spacePlate)
    pc.line(7, top + 14, 3, h - 3, P.spacePlateDark)
    pc.line(7, top + 14, 11, h - 3, P.spacePlateDark)
  }
  pc.rect(3, top + 2, 9, 11, P.spacePlate)
  pc.rect(4, top + 3, 7, 9, lit ? P.windowLit : P.glass)
  if (lit) pc.rect(6, top + 5, 3, 5, P.windowLitCore)
  pc.hline(3, 11, top + 2, P.spacePlateLight)
  pc.px(7, top, P.spacePlateDark)
  return pc.outline(P.outline)
}

/** The room's bench: a lab top with a sample tray, a microscope and a screen. */
function table(variant) {
  const [w, h] = INTERIOR_SIZE.table
  const pc = new PixelCanvas(w, h)
  pc.rect(0, 6, w, 4, P.spaceHullLight)
  pc.rect(0, 10, w, 4, P.spaceHullDark)
  pc.hline(0, w - 1, 14, P.spacePlate)
  pc.rect(2, 14, 2, h - 14, P.spacePlateDark)
  pc.rect(w - 4, 14, 2, h - 14, P.spacePlateDark)
  // A tray of samples
  pc.rect(5, 3, 9, 3, P.spacePlate)
  for (const [x, c] of [[6, P.spaceOreLight], [9, P.spacePaint[2]], [12, P.spacePaint[1]]]) pc.rect(x, 2, 2, 2, c)
  // A microscope
  pc.rect(22, 1, 3, 5, P.spacePlateLight)
  pc.hline(21, 26, 5, P.spacePlateDark)
  pc.px(26, 2, P.spaceGlassLight)
  return pc.outline(P.outline)
}

/** A plant: a hydroponic tray of seedlings, a jar of cuttings, a shrub in a tub. */
function plant(variant) {
  const [w, h] = INTERIOR_SIZE.plant
  const pc = new PixelCanvas(w, h)
  const kind = variant % 3
  if (kind === 0) {
    // The grow tray: a trough of water on legs, seedlings in a row, a lamp bar over them.
    pc.rect(2, h - 10, 18, 6, P.spacePlate)
    pc.hline(2, 19, h - 10, P.spacePlateLight)
    pc.rect(3, h - 9, 16, 2, P.water)
    pc.vline(3, h - 4, h - 1, P.spacePlateDark)
    pc.vline(18, h - 4, h - 1, P.spacePlateDark)
    for (let x = 5; x < 18; x += 4) {
      pc.vline(x, h - 14, h - 10, P.spaceLeafDark)
      pc.px(x - 1, h - 14, P.spaceLeaf)
      pc.px(x + 1, h - 15, P.spaceLeaf)
    }
    pc.hline(3, 18, 3, P.spacePlateLight)
    pc.hline(4, 17, 4, P.spaceGreenGlow)
    return pc.outline(P.outline)
  }
  pc.rect(6, h - 10, 10, 10, kind === 1 ? P.spaceGlass : P.spacePaint[5])
  pc.hline(5, 16, h - 10, shade(kind === 1 ? P.spaceGlassLight : P.spacePaint[5], 0.2))
  if (kind === 1) {
    for (let i = 0; i < 5; i++) pc.line(11, h - 10, 6 + i * 2, 8 + (i % 2) * 3, i % 2 ? P.spaceLeaf : P.spaceLeafDark)
  } else {
    pc.ellipse(11, h - 14, 7, 5, P.spaceLeafDark)
    pc.ellipse(10, h - 15, 5, 3, P.spaceLeaf)
    for (const [x, y] of [[7, 11], [14, 12], [11, 8]]) pc.px(x, y, P.spacePaint[3])
  }
  return pc.outline(P.outline)
}

const DRAW = { floor: (v) => drawRoomFloor(MATERIALS, v), wall: (v) => drawRoomWall(MATERIALS, v), window, crate, stove, lamp, table, plant }

/** One piece of a colony room, or null for the ones the village draws just as well. */
export const drawSpaceInterior = (kind, variant) => (DRAW[kind] ? DRAW[kind](variant) : null)
