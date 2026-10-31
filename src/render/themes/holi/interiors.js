// Inside a Holi village's buildings: the colour room, the bonfire hall, the garland workshop and
// the courtyard room (the rooms are in src/sim/interiors.js). A room still says what it always
// says about the work (the board, the files, the commits), so what is drawn here is what the room
// is made of and the few things in it that give the day away: gulal in bowls, garlands, a pichkari.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { INTERIOR_SIZE, drawRoomFloor, drawRoomWall } from '../../sprites/interiors.js'

/**
 * What each wall material (dims.wall: whitewash, pinkwash, yellowwash, bluewash, sandstone) is
 * like inside. @type {import('../../sprites/interiors.js').RoomMaterial[]}
 */
const MATERIALS = [
  // whitewash: terracotta flags under lime-white walls
  { floor: [P.matkaLight, P.matka], wall: [P.holiWhite, P.holiWhiteDark], floorPattern: 'flag', wallPattern: 'speck' },
  // pinkwash: pale stone underfoot, pink walls
  { floor: [P.holiGround[0][2], P.holiGround[0][1]], wall: [P.holiPink, P.holiPinkDark], floorPattern: 'flag', wallPattern: 'speck' },
  // yellowwash: swept plank under yellow walls
  { floor: [P.barnTimberLight, P.barnTimber], wall: [P.holiYellow, P.holiYellowDark], floorPattern: 'plank', wallPattern: 'speck' },
  // bluewash: dark flags under blue walls
  { floor: [P.holiGround[3][0], P.holiGround[3][1]], wall: [P.holiBlue, P.holiBlueDark], floorPattern: 'flag', wallPattern: 'speck' },
  // sandstone: flags underfoot, dressed blocks standing
  { floor: [P.holiSandstoneLight, P.holiSandstoneDark], wall: [P.holiSandstone, P.holiSandstoneDark], floorPattern: 'flag', wallPattern: 'brick' },
]

/** A window: four panes in a white frame, a garland of marigold hung across the top. */
function window(variant) {
  const [w, h] = INTERIOR_SIZE.window
  const pc = new PixelCanvas(w, h)
  const night = variant === 1
  pc.rect(1, 1, w - 2, h - 6, P.holiPaint[4])
  pc.rect(3, 3, w - 6, h - 10, night ? P.window : P.glass)
  if (night) pc.px(4, 4, P.windowShine)
  else {
    // The street past it by day: a wall splashed with colour below the sky.
    pc.rect(3, h - 11, w - 6, 4, P.holiPink)
    pc.hline(3, w - 4, h - 11, P.holiPinkLight)
    pc.px(5, h - 9, P.holiGulal[3])
    pc.px(10, h - 8, P.holiGulal[1])
  }
  pc.vline(w / 2, 3, h - 8, P.holiPaint[4])
  pc.hline(3, w - 4, (h - 6) / 2, P.holiPaint[4])
  pc.rect(0, h - 5, w, 2, P.matkaDark) // the sill
  // The garland across the top, sagging in the middle.
  for (let x = 1; x < w - 1; x++) {
    const y = 1 + Math.round(Math.sin(((x - 1) / (w - 3)) * Math.PI) * 2)
    pc.px(x, y, x & 1 ? P.marigold : P.marigoldLight)
    if (x % 3 === 0) pc.px(x, y + 1, P.marigoldDark)
  }
  // A bowl of gulal on the sill.
  pc.rect(9, h - 8, 7, 3, P.matka)
  pc.hline(10, 14, h - 9, P.holiGulal[0])
  pc.hline(9, 15, h - 6, P.matkaDark)
  return pc.outline(P.outline)
}

/** What stands about a Holi room: a crate of gulal pots, a basket of marigolds, folded cloths. */
function crate(variant) {
  const [w, h] = INTERIOR_SIZE.crate
  const pc = new PixelCanvas(w, h)
  const kind = variant % 3
  if (kind === 0) {
    // A crate with pots of gulal in it, a different colour each.
    pc.rect(0, 12, w, h - 12, P.barnTimber)
    for (const y of [12, 17]) pc.hline(0, w - 1, y, P.barnTimberLight)
    pc.vline(0, 12, h - 1, P.barnTimberDark)
    pc.vline(w - 1, 12, h - 1, P.barnTimberDark)
    ;[6, 11, 17].forEach((x, i) => {
      pc.ellipse(x, 10, 3.5, 3, P.matka)
      pc.hline(x - 2, x + 2, 8, P.holiGulal[(i * 2) % 6])
      pc.px(x - 2, 10, P.matkaLight)
    })
    return pc.outline(P.outline)
  }
  if (kind === 1) {
    // A basket heaped with marigolds.
    pc.rect(0, 8, w, h - 8, P.bamboo)
    for (const y of [11, 15, 19]) pc.hline(0, w - 1, y, P.bambooDark)
    for (let x = 0; x < w; x += 4) pc.vline(x, 8, h - 1, P.bambooDark)
    for (let x = 2; x < w - 2; x += 4) {
      pc.ellipse(x + 1.5, 6, 2.2, 2, x % 8 === 2 ? P.marigold : P.marigoldLight)
      pc.px(x + 1, 5, P.marigoldDark)
    }
    return pc.outline(P.outline)
  }
  // Folded white cloths, stacked, each splashed with a different colour.
  for (let i = 0; i < 4; i++) {
    const y = h - 5 - i * 4
    pc.rect(2, y, w - 4, 4, P.holiWhite)
    pc.hline(2, w - 3, y, P.holiWhiteLight)
    pc.hline(2, w - 3, y + 3, P.holiWhiteDark)
    pc.rect(4 + i * 4, y + 1, 3, 2, P.holiGulal[i])
  }
  return pc.outline(P.outline)
}

/**
 * A clay range. Lit, there is a glow at its mouth; the tall variant is a clay oven with a domed
 * mouth, a tray of gulal on top.
 */
function stove(variant) {
  const [w, h] = INTERIOR_SIZE.stove
  const pc = new PixelCanvas(w, h)
  const lit = variant % 2 === 1
  if (variant >> 1 === 1) {
    // The clay oven: a domed mouth in a mud-plastered face.
    pc.rect(1, 6, w - 2, h - 9, P.matka)
    for (let y = 8; y < h - 4; y += 4) pc.hline(1, w - 2, y, P.matkaDark)
    pc.rect(6, 14, w - 12, h - 20, lit ? P.flame : P.interior)
    pc.rect(8, 17, w - 16, h - 25, lit ? P.flameTip : P.ash)
    if (lit) pc.rect(10, 19, w - 20, 3, P.flameCore)
    pc.hline(5, w - 6, 13, P.matkaDark)
    pc.rect(0, h - 3, w, 3, P.matkaDark)
    pc.rect(9, 0, 6, 8, P.matka)
    pc.hline(8, 15, 0, P.matkaDark)
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
  // A tray of gulal on top.
  pc.rect(12, 9, 8, 3, P.brassDark)
  pc.hline(13, 18, 8, P.holiGulal[2])
  pc.px(15, 7, shade(P.holiGulal[2], 0.3))
  pc.rect(1, h - 3, w - 2, 3, P.farmIron)
  return pc.outline(P.outline)
}

/** A brass lantern: standing on its own foot, or hung off the crook of a post. */
function lamp(variant) {
  const [w, h] = INTERIOR_SIZE.lamp
  const pc = new PixelCanvas(w, h)
  const lit = variant % 2 === 1
  const hung = variant >> 1 === 1
  const top = hung ? 6 : h - 18
  pc.ellipse(7, h - 3, 6, 3, P.matkaDark)
  if (hung) {
    pc.rect(2, 3, 2, h - 5, P.bamboo)
    pc.hline(2, 8, 3, P.brassDark)
    pc.vline(8, 3, top, P.brassDark)
  }
  pc.rect(4, top + 3, 8, 9, lit ? P.windowLit : P.glass)
  if (lit) pc.rect(6, top + 5, 4, 5, P.windowLitCore)
  pc.rect(3, top, 10, 3, P.brass)
  pc.rect(3, top + 12, 10, 3, P.brass)
  pc.vline(3, top + 3, top + 11, P.brassDark)
  pc.vline(12, top + 3, top + 11, P.brassDark)
  pc.px(8, top - 1, P.brassDark)
  return pc.outline(P.outline)
}

/** The room's low table, laid with a white cloth and a thali of gulal cones on it. */
function table(variant) {
  const [w, h] = INTERIOR_SIZE.table
  const pc = new PixelCanvas(w, h)
  pc.rect(0, 6, w, 4, P.holiWhite)
  pc.rect(0, 10, w, 4, P.holiWhiteDark)
  for (let x = 0; x < w; x += 2) pc.px(x, 14, P.holiWhiteDark)
  pc.rect(2, 14, 2, h - 14, P.barnTimberDark)
  pc.rect(w - 4, 14, 2, h - 14, P.barnTimberDark)
  pc.hline(5, 26, 5, P.brassDark)
  ;[8, 14, 20].forEach((x, i) => {
    pc.hline(x - 1, x + 1, 4, P.holiGulal[(i + variant) % 6])
    pc.px(x, 3, shade(P.holiGulal[(i + variant) % 6], 0.3))
  })
  return pc.outline(P.outline)
}

/** A plant: marigolds in a clay pot, a rose bush, a pot of bamboo. */
function plant(variant) {
  const [w, h] = INTERIOR_SIZE.plant
  const pc = new PixelCanvas(w, h)
  const kind = variant % 3
  pc.rect(6, h - 10, 10, 10, P.matka)
  pc.hline(5, 16, h - 10, P.matkaLight)
  pc.hline(6, 15, h - 1, P.matkaDark)
  if (kind === 0) {
    for (const [x, y] of [[8, 9], [13, 8], [10, 4], [12, 12], [7, 14], [15, 14]]) {
      pc.ellipse(x + 0.5, y + 0.5, 2, 2, [P.marigold, P.marigoldLight][(x + y) & 1])
      pc.px(x, y, P.marigoldDark)
    }
  } else if (kind === 1) {
    pc.vline(11, 6, h - 10, P.vegLeafDark)
    for (const [x, y] of [[8, 8], [14, 7], [10, 4], [12, 11], [7, 13]]) pc.ellipse(x + 0.5, y + 0.5, 2, 2, P.roseRed)
    pc.px(9, 11, P.vegLeaf)
    pc.px(13, 14, P.vegLeaf)
  } else {
    for (const dx of [-3, 0, 3]) pc.line(11, h - 10, 11 + dx, 3, dx ? P.bamboo : P.bambooLight)
    for (const dx of [-3, 3]) pc.px(11 + dx, 2, P.vegLeaf)
  }
  return pc.outline(P.outline)
}

const DRAW = { floor: (v) => drawRoomFloor(MATERIALS, v), wall: (v) => drawRoomWall(MATERIALS, v), window, crate, stove, lamp, table, plant }

/** One piece of a Holi room, or null for the ones the village draws just as well. */
export const drawHoliInterior = (kind, variant) => (DRAW[kind] ? DRAW[kind](variant) : null)
