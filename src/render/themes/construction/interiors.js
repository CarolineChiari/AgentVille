// Inside a site building: a cabin on blocks, a drawing office, a container fitted out (the rooms
// are in src/sim/interiors.js). Everything a room says about the work is the village's and says
// the same thing here — the board, a spine per file, a note per commit. What this draws is what
// the room is made of, and the few things in it that could only be on a site.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { INTERIOR_SIZE, drawRoomFloor, drawRoomWall } from '../../sprites/interiors.js'

/**
 * What each wall material (dims.wall in src/sim/themes.js: timber, brick, concrete, steel, glass)
 * is like on the inside. @type {import('../../sprites/interiors.js').RoomMaterial[]}
 */
const MATERIALS = [
  // timber: board sheathing underfoot, house-wrap with the maker's name printed across it
  { floor: [P.osb, P.osbFleck], wall: [P.houseWrap, P.wrapPrint], floorPattern: 'plank', wallPattern: 'board' },
  // brick: scaffold boards laid over the slab, brick left fair-faced above
  { floor: [P.plank, P.plankDark], wall: [P.mortar, P.brick], floorPattern: 'plank', wallPattern: 'brick' },
  // concrete: a power-floated slab, and the same poured wall above it
  { floor: [P.concrete, P.concreteDark], wall: [P.concreteLight, P.concrete], floorPattern: 'flag', wallPattern: 'speck' },
  // steel: chequer plate on the floor, ribbed sheet on the walls
  { floor: [P.steel, P.steelDark], wall: [P.steelLight, P.steel], floorPattern: 'flag', wallPattern: 'board' },
  // glass: a white deck under a framed curtain wall
  { floor: [P.cladWhite, P.concreteDark], wall: [P.cladWhite, P.steel], floorPattern: 'flag', wallPattern: 'frame' },
]

/** A camp bed: canvas slung on a folding frame, with a sleeping bag on it. */
function bed(variant) {
  const [w, h] = INTERIOR_SIZE.bed
  const pc = new PixelCanvas(w, h)
  pc.rect(2, 8, w - 4, 8, P.tarp) // the sleeping bag
  pc.rect(2, 8, w - 4, 2, shade(P.tarp, 0.25))
  pc.rect(3, 5, 7, 5, P.sack) // a folded jacket for a pillow
  if (variant === 1) {
    // Somebody in it: the bag is humped over them and pulled up.
    for (let x = 12; x < w - 3; x++) pc.px(x, 7 + Math.round(Math.sin((x - 12) / 3) * 1.5), P.tarp)
    pc.rect(12, 8, w - 15, 2, shade(P.tarp, 0.35))
  }
  pc.rect(1, 16, w - 2, 3, P.steel) // the frame
  pc.line(3, 19, 6, h - 1, P.steelDark)
  pc.line(9, 19, 6, h - 1, P.steelDark)
  pc.line(w - 4, 19, w - 7, h - 1, P.steelDark)
  pc.line(w - 10, 19, w - 7, h - 1, P.steelDark)
  return pc.outline(P.outline)
}

/** What gets stacked in a corner of a site: a pallet of blocks, a toolbox, tins of paint. */
function crate(variant) {
  const [w, h] = INTERIOR_SIZE.crate
  const pc = new PixelCanvas(w, h)
  const kind = variant % 3
  if (kind === 1) {
    // A toolbox: site red, with a lid and a handle.
    pc.rect(0, 8, w, h - 8, P.sitePaint[4])
    pc.rect(0, 8, w, 3, shade(P.sitePaint[4], 0.25))
    pc.rect(2, 5, w - 4, 4, P.sitePaint[5])
    pc.rect(w / 2 - 4, 2, 8, 3, P.steelDark) // the handle
    pc.rect(3, h - 4, w - 6, 2, P.steelDark)
    return pc.outline(P.outline)
  }
  if (kind === 2) {
    // Tins of paint, one on the other, the top one opened.
    pc.rect(2, h - 11, w - 4, 11, P.sitePaint[0])
    pc.rect(2, h - 11, w - 4, 2, shade(P.sitePaint[0], 0.3))
    pc.rect(4, h - 22, w - 8, 11, P.cladWhite)
    pc.rect(4, h - 22, w - 8, 2, P.metal)
    pc.rect(6, h - 20, w - 12, 4, P.sitePaint[6]) // what is in it, down the side of the tin
    return pc.outline(P.outline)
  }
  // Bags of something on a pallet, slumped the way a stack of them does.
  for (let i = 0; i < 3; i++) {
    const y = 3 + i * 6
    pc.rect(1 + (i % 2), y, w - 3, 6, P.sack)
    pc.hline(1 + (i % 2), w - 3 + (i % 2), y, shade(P.sack, 0.2))
    pc.hline(2 + (i % 2), w - 4 + (i % 2), y + 5, P.sackDark)
  }
  pc.rect(5, 5, w - 12, 3, P.sitePaint[6]) // what is printed on the top one
  pc.rect(0, h - 4, w, 2, P.plank) // the pallet
  pc.rect(0, h - 2, w, 2, P.plankDark)
  return pc.outline(P.outline)
}

/** The heater: a jet heater on the floor, roaring away when the room is lit. */
function stove(variant) {
  const [w, h] = INTERIOR_SIZE.stove
  const pc = new PixelCanvas(w, h)
  const lit = variant % 2 === 1
  if (variant >> 1 === 1) {
    // A brazier, which is what a site burns its offcuts in.
    pc.rect(3, 14, w - 6, h - 18, P.rust)
    for (let y = 17; y < h - 6; y += 4) pc.hline(3, w - 4, y, P.rustDark)
    if (lit) {
      pc.rect(6, 6, w - 12, 10, P.flame)
      pc.rect(8, 8, w - 16, 6, P.flameTip)
      pc.rect(10, 10, 4, 3, P.flameCore)
    } else {
      pc.rect(6, 12, w - 12, 3, P.ash)
    }
    pc.line(5, h - 5, 3, h - 1, P.rustDark)
    pc.line(w - 6, h - 5, w - 4, h - 1, P.rustDark)
    pc.rect(2, h - 3, w - 4, 3, lit ? P.ember : P.ash)
    return pc.outline(P.outline)
  }
  pc.rect(2, 12, w - 4, h - 18, P.sitePaint[2]) // the barrel of it
  pc.rect(2, 12, w - 4, 3, shade(P.sitePaint[2], 0.3))
  pc.rect(0, 14, 5, h - 22, P.steelDark) // the fan end
  pc.rect(w - 6, 16, 6, 8, P.steelDark) // the mouth
  if (lit) {
    pc.rect(w - 5, 18, 5, 4, P.flame)
    pc.rect(w - 3, 19, 3, 2, P.flameCore)
  }
  pc.rect(4, h - 6, w - 8, 3, P.steel) // the skids
  pc.rect(2, h - 3, w - 4, 3, P.rubber)
  return pc.outline(P.outline)
}

const DRAW = { floor: (v) => drawRoomFloor(MATERIALS, v), wall: (v) => drawRoomWall(MATERIALS, v), bed, crate, stove }

/** One piece of a site room, or null for the ones the village draws just as well. */
export const drawSiteInterior = (kind, variant) => (DRAW[kind] ? DRAW[kind](variant) : null)
