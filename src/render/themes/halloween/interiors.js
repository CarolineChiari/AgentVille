// Inside a house on Halloween night: a witch's kitchen, an attic nobody has been up to in years,
// a crypt (the rooms are in src/sim/interiors.js). A room still says what it always says about the
// work — the board, the files, the commits — so what is drawn here is what the room is made of and
// the three things in it that give the night away.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { INTERIOR_SIZE, drawRoomFloor, drawRoomWall } from '../../sprites/interiors.js'

/**
 * What each wall material (dims.wall: clapboard, graystone, sootbrick, daub, scallop) is like
 * inside. @type {import('../../sprites/interiors.js').RoomMaterial[]}
 */
const MATERIALS = [
  // clapboard: bare boards the night has got into, boarded walls above
  { floor: [P.clapboardLight, P.clapboardDark], wall: [P.clapboard, P.clapboardDark], floorPattern: 'plank', wallPattern: 'board' },
  // graystone: churchyard granite, laid and standing
  { floor: [P.graveStone, P.graveStoneDark], wall: [P.graveStoneLight, P.graveStone], floorPattern: 'flag', wallPattern: 'speck' },
  // sootbrick: soot-dark tiles under old brick
  { floor: [P.sootBrick, P.sootBrickDark], wall: [P.sootMortar, P.sootBrick], floorPattern: 'flag', wallPattern: 'brick' },
  // daub: a hovel's crooked boards under pale plaster between black timbers
  { floor: [P.hovelBeam, P.clapboardDark], wall: [P.daub, P.hovelBeam], floorPattern: 'plank', wallPattern: 'frame' },
  // scallop: a manor's dark floor under panelling
  { floor: [P.scallop, P.scallopDark], wall: [P.scallopLight, P.scallopDark], floorPattern: 'plank', wallPattern: 'board' },
]

/** A cauldron on the boil, or the iron stove it stands beside. Lit, there is something in it. */
function stove(variant) {
  const [w, h] = INTERIOR_SIZE.stove
  const pc = new PixelCanvas(w, h)
  const lit = variant % 2 === 1
  if (variant >> 1 === 1) {
    // The cauldron, with whatever is in it going in the dark.
    pc.ellipse(w / 2, 18, 11, 9, P.ironBar)
    pc.ellipse(w / 2, 11, 11, 3, P.ironBarLight) // the rim
    if (lit) {
      pc.ellipse(w / 2, 11, 8, 2, P.poison)
      pc.px(9, 7, P.poison)
      pc.px(14, 5, P.poisonDeep)
    }
    pc.line(6, 25, 4, h - 4, P.ironBar)
    pc.line(w - 7, 25, w - 5, h - 4, P.ironBar)
    if (lit) {
      pc.rect(5, h - 8, w - 10, 5, P.flame)
      pc.rect(8, h - 7, w - 16, 3, P.poison)
    } else {
      pc.rect(5, h - 6, w - 10, 3, P.ash)
    }
    pc.rect(3, h - 3, w - 6, 3, lit ? P.ember : P.ash)
    return pc.outline(P.outline)
  }
  pc.rect(6, 0, 5, 12, P.ironBar) // the flue
  pc.rect(7, 0, 2, 12, P.ironBarLight)
  pc.rect(1, 12, w - 2, h - 15, P.ironBar)
  pc.rect(1, 12, w - 2, 3, P.ironBarLight)
  pc.rect(3, 20, w - 6, 10, shade(P.ironBar, -0.3))
  if (lit) {
    pc.rect(5, 22, w - 10, 6, P.poisonDeep)
    pc.rect(8, 24, w - 16, 3, P.poison)
  }
  pc.rect(1, h - 3, w - 2, 3, P.ironBar)
  return pc.outline(P.outline)
}

/** The light in a house like this: a lantern on an iron stand, or a candle stuck in its own wax. */
function lamp(variant) {
  const [w, h] = INTERIOR_SIZE.lamp
  const pc = new PixelCanvas(w, h)
  const lit = variant % 2 === 1
  if (variant >> 1 === 1) {
    pc.ellipse(7, h - 3, 5, 3, P.ironBar)
    pc.rect(6, 15, 2, h - 17, P.ironBar)
    pc.ellipse(7, 15, 5, 2, P.ironBarLight)
    pc.rect(5, 7, 4, 8, P.boneWhite) // the candle, and what has run down it
    pc.px(4, 12, P.boneShade)
    pc.px(9, 13, P.boneShade)
    pc.px(7, 6, P.crow)
    if (lit) {
      pc.rect(6, 2, 2, 4, P.candleFlame)
      pc.px(7, 1, P.jackCore)
      pc.px(6, 4, P.jackGlow)
    }
    return pc.outline(P.outline)
  }
  pc.ellipse(7, h - 3, 6, 3, P.ironBar)
  pc.rect(6, 14, 2, h - 16, P.ironBar)
  pc.vline(7, 3, 6, P.ironBar) // the hook it hangs off
  pc.hline(4, 10, 3, P.ironBar)
  pc.rect(3, 6, 9, 9, lit ? P.jackGlow : shade(P.ironBarLight, -0.1)) // the lantern's glass
  pc.rect(3, 5, 9, 2, P.ironBarLight)
  pc.rect(3, 14, 9, 2, P.ironBarLight)
  pc.vline(3, 6, 14, P.ironBar)
  pc.vline(11, 6, 14, P.ironBar)
  if (lit) pc.rect(6, 8, 3, 5, P.jackCore)
  return pc.outline(P.outline)
}

/** A bed in a house like this: a four-poster with the hangings gone to rags, and a web in the corner. */
function bed(variant) {
  const [w, h] = INTERIOR_SIZE.bed
  const pc = new PixelCanvas(w, h)
  pc.rect(0, 0, 4, h - 2, P.hovelBeam) // the posts
  pc.rect(w - 4, 0, 3, h - 4, P.hovelBeam)
  pc.rect(0, 0, w, 3, P.hovelBeam) // the tester across the top
  pc.rect(4, 3, 5, 5, P.cape[0]) // what is left of the hangings
  pc.rect(w - 9, 3, 4, 4, P.cape[0])
  pc.rect(4, 8, w - 5, h - 12, P.cape[1])
  pc.rect(4, 8, w - 5, 3, shade(P.cape[1], 0.2))
  pc.rect(5, 5, 8, 5, P.boneWhite) // the pillow
  if (variant === 1) {
    for (let x = 13; x < w - 2; x++) pc.px(x, 7 + Math.round(Math.sin((x - 13) / 3) * 1.5), P.cape[1])
    pc.rect(13, 8, w - 15, 2, shade(P.cape[1], 0.3))
  }
  pc.rect(4, h - 4, w - 4, 3, P.hovelBeam)
  // A web slung in the angle of the posts, because nobody has slept here in a while.
  pc.line(1, 3, 6, 3, P.web)
  pc.line(1, 3, 1, 8, P.web)
  pc.line(1, 8, 6, 3, P.webDim)
  return pc.outline(P.outline)
}

const DRAW = { floor: (v) => drawRoomFloor(MATERIALS, v), wall: (v) => drawRoomWall(MATERIALS, v), stove, lamp, bed }

/** One piece of a Halloween room, or null for the ones the village draws just as well. */
export const drawHallowInterior = (kind, variant) => (DRAW[kind] ? DRAW[kind](variant) : null)
