// Inside a New Year's Eve building: the rooftop lounge, the clock room, the ballroom and the cabin
// nook (the rooms are in src/sim/interiors.js). A room still says what it always says about the
// work — the board, the files, the commits — so what is drawn here is what the room is made of and
// the few things in it that give the night away: fireworks in the window, gifts in their crate,
// a table set with flutes, a string of lights on the lamp.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { INTERIOR_SIZE, drawRoomFloor, drawRoomWall } from '../../sprites/interiors.js'

const BULBS = P.nyeBulb

/**
 * What each wall material (dims.wall: midnight, stucco, nightbrick, marble, logs) is like inside.
 * @type {import('../../sprites/interiors.js').RoomMaterial[]}
 */
const MATERIALS = [
  // midnight: a violet dance-floor boards under midnight-blue plaster
  { floor: [P.nyeGround[2][1], P.nyeGround[2][3]], wall: [P.nyePlaster, P.nyePlasterDark], floorPattern: 'plank', wallPattern: 'speck' },
  // stucco: pale boards under champagne stucco
  { floor: [P.plank, P.plankDark], wall: [P.nyeStucco, P.nyeStuccoDark], floorPattern: 'plank', wallPattern: 'board' },
  // nightbrick: slate flags under soot-dark brick
  { floor: [P.nyeLane, P.nyeLaneDark], wall: [P.sootBrick, P.sootBrickDark], floorPattern: 'flag', wallPattern: 'brick' },
  // marble: marble flags, and panelled marble standing
  { floor: [P.nyeMarble, P.nyeMarbleDark], wall: [P.nyeMarbleLight, P.nyeMarbleDark], floorPattern: 'flag', wallPattern: 'frame' },
  // logs: plank floor between round-log walls
  { floor: [P.barnTimberLight, P.oakBrown], wall: [P.barnTimber, P.barnTimberDark], floorPattern: 'plank', wallPattern: 'board' },
]

/** A window: four panes in a champagne frame, and a firework going off beyond it at night. */
function window(variant) {
  const [w, h] = INTERIOR_SIZE.window
  const pc = new PixelCanvas(w, h)
  const night = variant === 1
  pc.rect(1, 1, w - 2, h - 6, P.nyePaint[4])
  pc.rect(3, 3, w - 6, h - 10, night ? P.window : P.glass)
  if (night) {
    pc.px(4, 4, P.windowShine)
    // A firework: a few sparks round a point in the dark.
    for (const [x, y, c] of [[8, 6, P.nyeSpark[0]], [6, 6, BULBS[0]], [10, 6, BULBS[1]], [8, 4, BULBS[2]], [8, 8, BULBS[0]], [6, 8, BULBS[3]], [10, 4, BULBS[1]]]) pc.px(x, y, c)
  } else {
    // The street past it at dusk: a few rooftops against the sky, one with lights on.
    pc.rect(3, h - 12, w - 6, 5, P.nyePlaster)
    pc.hline(3, w - 4, h - 12, P.nyePlasterLight)
    pc.px(5, h - 10, P.windowLit)
    pc.px(10, h - 9, BULBS[1])
  }
  pc.vline(w / 2, 3, h - 8, P.nyePaint[4])
  pc.hline(3, w - 4, (h - 6) / 2, P.nyePaint[4])
  pc.rect(0, h - 5, w, 2, P.nyeStuccoDark) // the sill
  // A string of lights along the sill.
  for (let x = 2; x < w - 2; x += 3) pc.px(x, h - 6, BULBS[(x / 3 | 0) % BULBS.length])
  return pc.outline(P.outline)
}

/** What stands about a party room: a crate of gifts, a case of poppers, a net of balloons. */
function crate(variant) {
  const [w, h] = INTERIOR_SIZE.crate
  const pc = new PixelCanvas(w, h)
  const kind = variant % 3
  if (kind === 0) {
    // Gift boxes heaped in a crate.
    pc.rect(0, 12, w, h - 12, P.barnTimber)
    for (const y of [12, 17]) pc.hline(0, w - 1, y, P.barnTimberLight)
    pc.vline(0, 12, h - 1, P.barnTimberDark)
    pc.vline(w - 1, 12, h - 1, P.barnTimberDark)
    for (const [x, c] of [[2, P.nyePaint[0]], [9, P.nyePaint[2]], [15, P.nyePaint[3]]]) {
      pc.rect(x, 4, 7, 8, c)
      pc.hline(x, x + 6, 4, shade(c, 0.25))
      pc.vline(x + 3, 4, 11, P.gilt)
      pc.hline(x, x + 6, 7, P.gilt)
    }
    return pc.outline(P.outline)
  }
  if (kind === 1) {
    // A bundle of balloons tied to a weight, bobbing at the top of their strings.
    pc.rect(8, h - 6, 8, 6, P.nyeWandDark)
    pc.hline(8, 15, h - 6, P.nyeWand)
    for (const [x, y, c] of [[6, 5, P.nyePaint[0]], [12, 3, P.nyePaint[1]], [18, 6, P.nyePaint[2]], [10, 9, P.nyePaint[3]]]) {
      pc.ellipse(x, y, 4, 5, c)
      pc.px(x - 2, y - 2, P.nyeSpark[0])
      pc.line(x, y + 5, 12, h - 6, P.nyeFuse)
    }
    return pc.outline(P.outline)
  }
  // A case of party poppers, the cones pointing up out of it.
  pc.rect(0, 11, w, h - 11, P.nyePaint[6])
  pc.hline(0, w - 1, 11, P.nyePaint[7])
  pc.rect(2, 14, w - 4, 3, P.gilt)
  for (const [x, c] of [[3, P.nyePaint[0]], [8, P.nyePaint[1]], [13, P.nyePaint[2]], [18, P.nyePaint[5]]]) {
    pc.line(x + 1, 11, x + 1, 5, c)
    pc.line(x, 11, x + 1, 5, c)
    pc.line(x + 2, 11, x + 1, 5, c)
    pc.px(x + 1, 4, P.nyeSpark[0])
  }
  return pc.outline(P.outline)
}

/** A string-light lamp: a pole wound with lights on its own foot, or one hung off a hook. Lit, it glows. */
function lamp(variant) {
  const [w, h] = INTERIOR_SIZE.lamp
  const pc = new PixelCanvas(w, h)
  const lit = variant % 2 === 1
  const hung = variant >> 1 === 1
  const top = hung ? 6 : 4
  pc.ellipse(7, h - 3, 6, 3, P.nyeWandDark)
  pc.vline(7, top, h - 4, P.nyeWand)
  if (hung) {
    pc.hline(7, 12, top, P.nyeWand)
    pc.vline(12, top, top + 3, P.nyeWand)
  }
  // The lights wound down the pole, a bulb every third row alternating sides.
  for (let y = top + 2, i = 0; y < h - 5; y += 3, i++) {
    const x = i % 2 ? 9 : 5
    const c = BULBS[i % BULBS.length]
    pc.px(x, y, lit ? c : P.nyeWire)
    if (lit) {
      pc.px(x + (i % 2 ? 1 : -1), y, shade(c, 0.35))
      pc.px(x, y - 1, shade(c, 0.35))
    }
  }
  pc.px(7, top - 1, lit ? P.nyeSpark[1] : P.nyeWire)
  return pc.outline(P.outline)
}

/** The room's table, laid with a champagne cloth, two flutes and a cake. */
function table(variant) {
  const [w, h] = INTERIOR_SIZE.table
  const pc = new PixelCanvas(w, h)
  pc.rect(0, 6, w, 4, P.nyePaint[4])
  pc.rect(0, 10, w, 4, P.nyeStuccoDark)
  for (let x = 0; x < w; x += 2) pc.px(x, 14, P.nyeStuccoDark)
  pc.rect(2, 14, 2, h - 14, P.nyeWandDark)
  pc.rect(w - 4, 14, 2, h - 14, P.nyeWandDark)
  // Two flutes and a little cake with a sparkler in it.
  for (const x of [4, 8]) {
    pc.rect(x, 1, 2, 4, P.nyeMarble)
    pc.px(x, 2, P.nyePaint[1])
    pc.px(x, 5, P.nyeMarbleDark)
  }
  pc.rect(19, 3, 8, 3, P.nyePaint[0])
  pc.hline(19, 26, 3, P.nyePaint[4])
  pc.vline(23, 0, 2, P.nyeWand)
  pc.px(23, 0, P.nyeSpark[1])
  return pc.outline(P.outline)
}

/** A plant: streamers in a pot, a jar of confetti, a branch hung with lights. */
function plant(variant) {
  const [w, h] = INTERIOR_SIZE.plant
  const pc = new PixelCanvas(w, h)
  const kind = variant % 3
  pc.rect(6, h - 10, 10, 10, P.nyePaint[6])
  pc.hline(5, 16, h - 10, shade(P.nyePaint[6], 0.25))
  if (kind === 0) {
    for (const dx of [-3, 0, 3]) pc.line(11, h - 10, 11 + dx * 2, 4, BULBS[(dx + 3) % BULBS.length])
    for (const dx of [-3, 3]) pc.px(11 + dx * 2, 3, P.nyeSpark[1])
  } else if (kind === 1) {
    for (let i = 0; i < 9; i++) pc.px(6 + ((i * 5) % 10), 5 + ((i * 3) % 9), BULBS[i % BULBS.length])
  } else {
    pc.vline(11, 6, h - 10, P.barnTimberDark)
    pc.line(11, 9, 6, 5, P.barnTimberDark)
    pc.line(11, 12, 16, 8, P.barnTimberDark)
    for (const [x, y] of [[6, 5], [16, 8], [11, 6], [8, 9], [14, 12], [8, 13]]) pc.ellipse(x + 0.5, y + 0.5, 1.5, 1.5, BULBS[(x + y) % BULBS.length])
  }
  return pc.outline(P.outline)
}

const DRAW = { floor: (v) => drawRoomFloor(MATERIALS, v), wall: (v) => drawRoomWall(MATERIALS, v), window, crate, lamp, table, plant }

/** One piece of a party room, or null for the ones the village draws just as well. */
export const drawPartyInterior = (kind, variant) => (DRAW[kind] ? DRAW[kind](variant) : null)
