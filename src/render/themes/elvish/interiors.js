// Inside an elvish house: a flet up in the branches, a scriptorium, a hall with the sky down one
// side (the rooms are in src/sim/interiors.js). What a room says about the work is the village's
// and says the same thing here; this draws what an elvish room is built from, and the three things
// in it nobody else would have.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { INTERIOR_SIZE, drawRoomFloor, drawRoomWall } from '../../sprites/interiors.js'

/**
 * What each wall material (dims.wall: livewood, birch, palestone, weave, crystal) is like inside.
 * @type {import('../../sprites/interiors.js').RoomMaterial[]}
 */
const MATERIALS = [
  // livewood: boards grown rather than cut, and the living bark above them
  { floor: [P.livewood, P.livewoodDark], wall: [P.livewoodLight, P.barkMoss], floorPattern: 'plank', wallPattern: 'board' },
  // birch: pale boards under white bark
  { floor: [P.birch, P.paleStoneDark], wall: [P.birch, P.birchMark], floorPattern: 'plank', wallPattern: 'speck' },
  // palestone: carved white stone, laid and standing
  { floor: [P.paleStone, P.paleStoneDark], wall: [P.paleStoneLight, P.carving], floorPattern: 'flag', wallPattern: 'frame' },
  // weave: withy underfoot, woven leaf panels above
  { floor: [P.withy, P.withyDark], wall: [P.weave, P.weaveDark], floorPattern: 'plank', wallPattern: 'board' },
  // crystal: pale paving, and glazing that keeps a little of the light in it
  { floor: [P.wayStone, P.waySeam], wall: [P.shard, P.shardDark], floorPattern: 'flag', wallPattern: 'speck' },
]

/** A tall arched window: leaves against the sky by day, stars and a lantern on the glass by night. */
function window(variant) {
  const [w, h] = INTERIOR_SIZE.window
  const pc = new PixelCanvas(w, h)
  const night = variant === 1
  pc.rect(1, 0, w - 2, h - 2, P.mithrilDark)
  // The arch: the glass narrows towards the top rather than being cut square off.
  for (let y = 2; y < h - 4; y++) {
    const inset = y < 6 ? 6 - y : 2
    pc.hline(1 + inset, w - 2 - inset, y, night ? P.window : P.glass)
  }
  if (night) {
    pc.px(6, 8, P.mithrilLight)
    pc.px(10, 5, P.mithrilLight)
    pc.px(4, 12, P.lanternGlow)
  } else {
    pc.rect(3, 9, 4, 3, P.leafLight) // a bough out there
    pc.rect(9, 12, 5, 2, P.leaf)
  }
  pc.vline(Math.floor(w / 2) - 1, 2, h - 5, P.mithril)
  pc.rect(0, h - 4, w, 3, P.mithrilLight) // the sill
  return pc.outline(P.outline)
}

/** A lantern on a stand, which is how elves light a room: a light hung, never a flame left loose. */
function lamp(variant) {
  const [w, h] = INTERIOR_SIZE.lamp
  const pc = new PixelCanvas(w, h)
  const lit = variant % 2 === 1
  const hanging = variant >> 1 === 1
  const top = hanging ? 3 : 6
  pc.ellipse(7, h - 3, 6, 3, P.mithrilDark) // the foot
  pc.rect(6, top + 12, 2, h - top - 14, P.mithril)
  if (hanging) {
    // A lantern swung from the crook of its stand.
    pc.hline(7, 11, top, P.mithril)
    pc.vline(11, top, top + 3, P.mithril)
    pc.rect(9, top + 3, 5, 8, lit ? P.lanternGlow : shade(P.mithrilDark, 0.1))
    pc.rect(9, top + 2, 5, 2, P.mithrilLight)
    pc.rect(9, top + 10, 5, 2, P.mithrilLight)
    if (lit) pc.rect(10, top + 5, 3, 4, P.glitter)
    return pc.outline(P.outline)
  }
  pc.rect(4, top, 7, 12, lit ? P.lanternGlow : shade(P.mithrilDark, 0.1))
  pc.rect(3, top - 1, 9, 2, P.mithrilLight)
  pc.rect(3, top + 11, 9, 2, P.mithrilLight)
  pc.vline(4, top, top + 11, P.mithril)
  pc.vline(10, top, top + 11, P.mithril)
  if (lit) pc.rect(6, top + 3, 3, 6, P.glitter)
  return pc.outline(P.outline)
}

/** A bower rather than a bed: a low frame of grown wood with leaves banked over it. */
function bed(variant) {
  const [w, h] = INTERIOR_SIZE.bed
  const pc = new PixelCanvas(w, h)
  pc.rect(0, 1, 4, h - 3, P.livewood) // the head of it, still growing
  pc.ellipse(2, 3, 4, 4, P.leafDark)
  pc.rect(4, 7, w - 5, h - 11, P.elfCloak[0])
  pc.rect(4, 7, w - 5, 3, shade(P.elfCloak[0], 0.25))
  pc.rect(5, 4, 8, 6, P.mithrilLight) // the pillow
  if (variant === 1) {
    for (let x = 13; x < w - 2; x++) pc.px(x, 6 + Math.round(Math.sin((x - 13) / 3) * 1.5), P.elfCloak[0])
    pc.rect(13, 7, w - 15, 2, shade(P.elfCloak[0], 0.35))
  }
  pc.rect(4, h - 4, w - 4, 3, P.livewoodDark)
  pc.rect(w - 4, 5, 3, h - 7, P.livewood)
  pc.px(w - 3, 4, P.leaf)
  return pc.outline(P.outline)
}

const DRAW = { floor: (v) => drawRoomFloor(MATERIALS, v), wall: (v) => drawRoomWall(MATERIALS, v), window, lamp, bed }

/** One piece of an elvish room, or null for the ones the village draws just as well. */
export const drawElfInterior = (kind, variant) => (DRAW[kind] ? DRAW[kind](variant) : null)
