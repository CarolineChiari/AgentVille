// Inside a harbour building: a net loft over the quay, a boat cabin, the room under the light (the
// rooms are in src/sim/interiors.js). What a room says about the work is the village's and says the
// same thing here; this is what a harbour room is built from, and the few things in it that have
// been in the sea.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { INTERIOR_SIZE, drawRoomFloor, drawRoomWall } from '../../sprites/interiors.js'

/**
 * What each wall material (dims.wall: clinker, limewash, tarboard, seastone, corrugated) is like
 * inside. @type {import('../../sprites/interiors.js').RoomMaterial[]}
 */
const MATERIALS = [
  // clinker: driftwood boards under lapped planking
  { floor: [P.driftwood, P.driftwoodDark], wall: [P.clinker, P.clinkerDark], floorPattern: 'plank', wallPattern: 'board' },
  // limewash: pale boards under lime over rubble stone
  { floor: [P.driftwoodLight, P.driftwoodDark], wall: [P.limewash, P.limewashShade], floorPattern: 'plank', wallPattern: 'speck' },
  // tarboard: dark boards, and boarding tarred black above them
  { floor: [P.driftwoodDark, P.pitch], wall: [P.tarboard, P.tarboardLight], floorPattern: 'plank', wallPattern: 'board' },
  // seastone: quay cobbles underfoot, shore stone standing
  { floor: [P.quayCobble, P.quaySeam], wall: [P.seastoneLight, P.seastone], floorPattern: 'flag', wallPattern: 'speck' },
  // corrugated: a boat shed — a boarded deck under galvanised sheet
  { floor: [P.driftwood, P.seastoneDark], wall: [P.corrugated, P.corrugatedDark], floorPattern: 'flag', wallPattern: 'board' },
]

/** A porthole: brass, bolted through the planking, with the water past it. */
function window(variant) {
  const [w, h] = INTERIOR_SIZE.window
  const pc = new PixelCanvas(w, h)
  const night = variant === 1
  pc.ellipse(w / 2, 9, 7, 8, P.brass)
  pc.ellipse(w / 2, 9, 5, 6, night ? P.window : P.tidePool)
  if (night) {
    pc.px(6, 6, P.windowShine)
    pc.px(9, 11, P.lens)
  } else {
    pc.ellipse(w / 2, 6, 4, 2, P.tidePoolLight) // the sky above the water line
    pc.px(6, 11, P.waterGlint)
  }
  // The bolts round the rim, and the hinge it swings on.
  for (const [x, y] of [[2, 4], [13, 4], [2, 14], [13, 14], [8, 0]]) pc.px(x, y, P.brassDark)
  pc.rect(0, h - 4, w, 3, P.driftwoodDark) // the ledge under it
  return pc.outline(P.outline)
}

/** What stands about a harbour room: lobster pots, a barrel, a net float in a basket. */
function crate(variant) {
  const [w, h] = INTERIOR_SIZE.crate
  const pc = new PixelCanvas(w, h)
  const kind = variant % 3
  if (kind === 1) {
    // A barrel, hooped.
    pc.rect(2, 3, w - 4, h - 4, P.driftwood)
    pc.rect(1, 6, w - 2, h - 10, P.driftwood)
    for (let x = 3; x < w - 3; x += 4) pc.vline(x, 3, h - 2, P.driftwoodDark)
    pc.rect(1, 6, w - 2, 2, P.seaIron)
    pc.rect(1, h - 7, w - 2, 2, P.seaIron)
    pc.rect(3, 2, w - 6, 2, P.driftwoodLight)
    return pc.outline(P.outline)
  }
  if (kind === 2) {
    // Two pots, one on the other, with the netting over their hoops.
    for (const top of [h - 10, h - 20]) {
      pc.rect(2, top + 3, w - 4, 7, P.rope)
      for (let x = 4; x < w - 3; x += 3) pc.vline(x, top + 3, top + 9, P.ropeDark)
      pc.ellipse(w / 2, top + 3, 10, 3, P.netTwine)
      pc.hline(3, w - 4, top + 3, P.netTwineDark)
    }
    return pc.outline(P.outline)
  }
  // A fish box, salt-bleached.
  pc.rect(0, 4, w, h - 4, P.sailClothShade)
  pc.rect(2, 6, w - 4, h - 9, shade(P.sailClothShade, -0.2))
  pc.rect(0, 4, w, 2, P.sailCloth)
  pc.rect(0, h - 3, w, 3, P.driftwoodDark)
  pc.rect(w / 2 - 4, 8, 8, 5, P.harbourPaint[0]) // the boat's number on the side
  return pc.outline(P.outline)
}

/** A hurricane lamp: standing on its own foot, or hung off the crook of a stand, as one is at sea. */
function lamp(variant) {
  const [w, h] = INTERIOR_SIZE.lamp
  const pc = new PixelCanvas(w, h)
  const lit = variant % 2 === 1
  const hung = variant >> 1 === 1
  const top = hung ? 5 : 8
  pc.ellipse(7, h - 3, 6, 3, P.driftwoodDark) // the foot, whichever it is
  if (hung) {
    pc.rect(2, 4, 2, h - 6, P.seaIron) // the post, with the lamp swung off the crook of it
    pc.hline(3, 7, 4, P.seaIron)
    pc.vline(7, 4, top, P.seaIron)
  } else {
    pc.rect(6, top + 14, 2, h - top - 16, P.driftwood)
  }
  pc.rect(3, top + 2, 9, 10, lit ? P.lens : shade(P.glass, -0.2)) // the glass
  if (lit) pc.rect(5, top + 4, 5, 6, P.lensCore)
  pc.rect(2, top, 11, 3, P.brass) // the cap and the base of it
  pc.rect(2, top + 11, 11, 3, P.brass)
  pc.vline(2, top, top + 13, P.brassDark)
  pc.vline(12, top, top + 13, P.brassDark)
  return pc.outline(P.outline)
}

const DRAW = { floor: (v) => drawRoomFloor(MATERIALS, v), wall: (v) => drawRoomWall(MATERIALS, v), window, crate, lamp }

/** One piece of a harbour room, or null for the ones the village draws just as well. */
export const drawSeaInterior = (kind, variant) => (DRAW[kind] ? DRAW[kind](variant) : null)
