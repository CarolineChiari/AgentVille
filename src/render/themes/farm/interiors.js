// Inside a farm building: the farmhouse kitchen, the hay loft, the potting shed (the rooms are in
// src/sim/interiors.js). What a room says about the work is the village's and says the same thing
// here; this is what a farm room is built from, and the few things in it that came in off the land.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { INTERIOR_SIZE, drawRoomFloor, drawRoomWall } from '../../sprites/interiors.js'

/**
 * What each wall material (dims.wall: barnboard, weatherboard, fieldstone, whitewash, tin) is like
 * inside. @type {import('../../sprites/interiors.js').RoomMaterial[]}
 */
const MATERIALS = [
  // barnboard: a boarded floor under painted boards
  { floor: [P.barnTimber, P.barnTimberDark], wall: [P.farmPaint[0], shade(P.farmPaint[0], -0.26)], floorPattern: 'plank', wallPattern: 'board' },
  // weatherboard: pale boards under silvered ones
  { floor: [P.barnTimberLight, P.barnTimber], wall: [P.weatherboardLight, P.weatherboard], floorPattern: 'plank', wallPattern: 'board' },
  // fieldstone: stone flags underfoot, fieldstone standing
  { floor: [P.fieldstoneLight, P.fieldstoneDark], wall: [P.fieldstone, P.fieldstoneDark], floorPattern: 'flag', wallPattern: 'speck' },
  // whitewash: a quarry-tiled kitchen floor under whitewashed walls
  { floor: [P.brick, P.brickDark], wall: [P.whitewash, P.whitewashShade], floorPattern: 'flag', wallPattern: 'speck' },
  // tin: a concrete floor in a tin shed, the sheets ribbed
  { floor: [P.stone, P.stoneDark], wall: [P.tinLight, P.tinDark], floorPattern: 'flag', wallPattern: 'board' },
]

/** A farm window: four panes in a painted frame, a sill with a pot of geraniums on it. */
function window(variant) {
  const [w, h] = INTERIOR_SIZE.window
  const pc = new PixelCanvas(w, h)
  const night = variant === 1
  pc.rect(1, 1, w - 2, h - 6, P.farmPaint[4])
  pc.rect(3, 3, w - 6, h - 10, night ? P.window : P.glass)
  if (night) pc.px(4, 4, P.windowShine)
  else {
    // The fields past it by day: green below the sky.
    pc.rect(3, h - 11, w - 6, 4, P.vegLeafLight)
    pc.hline(3, w - 4, h - 11, P.vegLeaf)
  }
  pc.vline(w / 2, 3, h - 8, P.farmPaint[4])
  pc.hline(3, w - 4, (h - 6) / 2, P.farmPaint[4])
  pc.rect(0, h - 5, w, 2, P.barnTimberDark) // the sill
  pc.rect(10, h - 9, 4, 4, P.henBrown) // a pot on it
  pc.px(11, h - 10, P.henComb)
  pc.px(12, h - 11, P.henComb)
  pc.px(13, h - 10, P.vegLeaf)
  return pc.outline(P.outline)
}

/** What stands about a farm room: a bale of hay, a sack of grain, a crate of apples. */
function crate(variant) {
  const [w, h] = INTERIOR_SIZE.crate
  const pc = new PixelCanvas(w, h)
  const kind = variant % 3
  if (kind === 0) {
    // A bale, its two strings round it and stalks sticking out.
    pc.rect(1, 5, w - 2, h - 5, P.hay)
    pc.rect(1, 5, w - 2, 2, P.hayLight)
    pc.rect(1, h - 2, w - 2, 2, P.hayDark)
    for (const x of [6, w - 7]) pc.vline(x, 5, h - 1, P.hayDark)
    for (let x = 3; x < w - 2; x += 4) pc.px(x, 4, P.hayLight)
    return pc.outline(P.outline)
  }
  if (kind === 1) {
    // A sack of grain, tied at the neck and slumped against itself.
    pc.ellipse(w / 2, h - 8, 9, 8, P.whitewashShade)
    pc.ellipse(w / 2 - 2, h - 10, 5, 5, P.whitewash)
    pc.rect(w / 2 - 2, 1, 4, 5, P.whitewashShade)
    pc.hline(w / 2 - 3, w / 2 + 2, 5, P.barnTimberDark)
    pc.rect(w / 2 - 3, h - 11, 6, 3, P.farmPaint[0]) // the mill's mark on it
    return pc.outline(P.outline)
  }
  // A crate of apples, just picked.
  pc.rect(0, 7, w, h - 7, P.barnTimber)
  for (const y of [7, 13, 19]) pc.hline(0, w - 1, y, P.barnTimberLight)
  pc.vline(0, 7, h - 1, P.barnTimberDark)
  pc.vline(w - 1, 7, h - 1, P.barnTimberDark)
  for (let x = 2; x < w - 2; x += 4) {
    const c = x % 8 === 2 ? P.apple : P.appleGreen
    pc.ellipse(x + 1.5, 5, 2, 2, c)
    pc.px(x + 1, 4, shade(c, 0.3))
  }
  return pc.outline(P.outline)
}

/** A hurricane lantern: standing on its own foot, or hung off the crook of a post. */
function lamp(variant) {
  const [w, h] = INTERIOR_SIZE.lamp
  const pc = new PixelCanvas(w, h)
  const lit = variant % 2 === 1
  const hung = variant >> 1 === 1
  const top = hung ? 6 : h - 18
  pc.ellipse(7, h - 3, 6, 3, P.barnTimberDark) // the foot, whichever it is
  if (hung) {
    pc.rect(2, 3, 2, h - 5, P.barnTimber)
    pc.hline(2, 8, 3, P.farmIron)
    pc.vline(8, 3, top, P.farmIron)
  }
  pc.rect(4, top + 3, 8, 9, lit ? P.windowLit : P.glass) // the glass
  if (lit) pc.rect(6, top + 5, 4, 5, P.windowLitCore)
  pc.rect(3, top, 10, 3, P.farmPaint[1]) // the painted cap and base of it
  pc.rect(3, top + 12, 10, 3, P.farmPaint[1])
  pc.vline(3, top + 3, top + 11, P.farmIron)
  pc.vline(12, top + 3, top + 11, P.farmIron)
  pc.px(8, top - 1, P.farmIron)
  return pc.outline(P.outline)
}

const DRAW = { floor: (v) => drawRoomFloor(MATERIALS, v), wall: (v) => drawRoomWall(MATERIALS, v), window, crate, lamp }

/** One piece of a farm room, or null for the ones the village draws just as well. */
export const drawFarmInterior = (kind, variant) => (DRAW[kind] ? DRAW[kind](variant) : null)
