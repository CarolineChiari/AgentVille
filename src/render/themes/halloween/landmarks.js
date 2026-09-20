// The night's landmarks: what a plot's work has raised in the middle of its pumpkin patch, from a
// heap of lanterns to a belfry with the bats going out of it. Same contract as the village's
// (src/render/sprites/landmarks.js): 32 px wide, the same height per tier, bottom row on the
// ground, stages 0 to 3 as a building's (2 goes up inside the theme's staging), `lit` windows and
// lanterns after dark and `busy` while somebody on the plot is in. The plot's roof family goes on
// the roofs, its accent on doors, coats and bunting, and a tower is built of its wall material.
//
// None of them is one of the night's houses made bigger: a mill, a great dead tree and a crooked
// cottage are already what threads build here, so a landmark has to be the plot's own centrepiece.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { LANDMARK_HEIGHTS, LANDMARK_W } from '../../sprites/landmarks.js'
import { mulberry32 } from '../../../sim/rng.js'
import { MATERIALS, batAt, bough, box, deadTrunk, doorOf, jackAt, paneOf, roofOf, site, staging, steepRoof, wallOf, webCorner } from './buildings.js'

const TOP_TIER = LANDMARK_HEIGHTS.length - 1
const tierOf = (tier) => Math.max(0, Math.min(TOP_TIER, Math.floor(Number(tier) || 0)))

/** The same heights as the village's, so a plot's landmark stands as tall whichever theme it wears. */
export const heightOf = (tier) => LANDMARK_HEIGHTS[tierOf(tier)]
/** A heap of pumpkins casts none worth drawing; a scarecrow's pole is narrow. */
export const shadowOf = (tier) => [0, 16, 28, 30, 28, 30][tierOf(tier)]
/** The candle flickers in the lantern heap, and the bats go round the belfry. */
export const landmarkFrames = (tier, stage) => (stage >= 3 && (tierOf(tier) === 0 || tierOf(tier) === TOP_TIER) ? 2 : 1)

// ---------- parts ----------

/** Turned earth underfoot, with leaves blown across it. */
function mould(pc, H, rand, rx = 14.5) {
  pc.ellipse(16, H - 4, rx, 3.5, P.hallowGround[1][1])
  for (let i = 0; i < 10; i++) pc.px(3 + Math.floor(rand() * 26), H - 6 + Math.floor(rand() * 5), P.fallen[i % P.fallen.length])
}

/** A pumpkin sitting on the ground, centred on (cx, cy), `rx` by `ry`. */
function gourd(pc, cx, cy, rx, ry, skin = P.pumpkin) {
  pc.ellipse(cx, cy, rx, ry, skin)
  pc.ellipse(cx - rx * 0.35, cy - ry * 0.3, rx * 0.4, ry * 0.4, shade(skin, 0.2))
  for (const dx of [-1, 1]) pc.vline(cx + Math.round(dx * rx * 0.5), cy - ry + 1, cy + ry - 1, shade(skin, -0.22))
  pc.px(cx, cy - ry - 1, P.stalkDark)
  pc.px(cx + 1, cy - ry - 1, P.stalk)
}

/** A face cut into the pumpkin at (cx, cy): two eyes and a grin, alight when `bright`. */
function carve(pc, cx, cy, bright) {
  const c = bright ? P.jackGlow : P.interior
  pc.px(cx - 2, cy - 1, c)
  pc.px(cx + 2, cy - 1, c)
  pc.hline(cx - 2, cx + 2, cy + 1, c)
  pc.px(cx, cy + 1, bright ? P.jackCore : P.pumpkinDark)
  pc.px(cx - 1, cy, bright ? P.jackGlow : P.interior)
}

/** A crow perched at (x, y), facing `dir`. */
function crowAt(pc, x, y, dir) {
  pc.hline(x - 1, x + 1, y, P.crow)
  pc.px(x, y - 1, P.crow)
  pc.px(x + 2 * dir, y - 1, P.crowBeak)
  pc.px(x - dir, y + 1, P.crow)
}

/** A lantern hung from a bracket at (x, y), alight when the thread is. */
function hangJack(pc, x, y, lit) {
  pc.px(x, y, P.ironBar)
  pc.hline(x - 1, x + 1, y + 1, P.ironBarLight)
  box(pc, x - 2, y + 2, x + 2, y + 4, P.pumpkin)
  pc.px(x - 2, y + 2, P.pumpkinDark)
  pc.px(x + 2, y + 2, P.pumpkinDark)
  pc.px(x - 1, y + 3, lit ? P.jackGlow : P.interior)
  pc.px(x + 1, y + 3, lit ? P.jackGlow : P.interior)
  pc.hline(x - 1, x + 1, y + 4, lit ? P.jackCore : P.pumpkinDark)
}

// ---------- the tiers ----------

/** Where the bats are, frame by frame, round the belfry. */
const BATS = [
  [[5, 12], [26, 8], [9, 4], [22, 17]],
  [[7, 8], [24, 13], [12, 3], [20, 20]],
]

const TIERS = [
  function lanternHeap(pc, o) {
    const g = o.H - 3
    mould(pc, o.H, o.rand, 12)
    // Three across the bottom, two on top and the carved one on the summit.
    gourd(pc, 7, g - 3, 5, 3.5)
    gourd(pc, 25, g - 3, 5, 3.5)
    gourd(pc, 16, g - 2, 5.5, 4, P.gourd)
    gourd(pc, 11, g - 9, 4.5, 3.5)
    gourd(pc, 21, g - 9, 4, 3, P.gourd)
    const cut = o.roof
    gourd(pc, 16, g - 15, 5, 4)
    if (cut) carve(pc, 16, g - 15, o.busy || o.lit)
    // The candle's light spilling onto the pumpkin below it, and a flicker between the frames.
    if (cut && (o.busy || o.lit)) {
      pc.px(16 + (o.frame % 2 ? 1 : -1), g - 18, P.candleFlame)
      pc.px(14 + (o.frame % 2 ? 4 : 0), g - 11, P.jackGlow)
    }
    for (let i = 0; i < 5; i++) pc.px(3 + i * 6, g + 1 + (i % 2), P.bine)
    return cut ? null : { x0: 2, x1: 29, top: g - 19 }
  },

  function scarecrow(pc, o) {
    const base = o.H - 2
    mould(pc, o.H, o.rand)
    // The pole, and the cross-arm lashed to it.
    box(pc, 15, base - 30, 17, base - 1, P.deadBark)
    pc.vline(15, base - 30, base - 1, P.deadBarkLight)
    pc.vline(17, base - 30, base - 1, P.deadBarkDark)
    // The coat, in the plot's colour, hung on the cross-arm rather than over it: the arm is drawn
    // after it, so what a scarecrow is reads before the colour does.
    box(pc, 9, base - 22, 23, base - 9, o.accent)
    pc.vline(22, base - 22, base - 9, shade(o.accent, -0.28))
    pc.hline(9, 23, base - 22, shade(o.accent, 0.2))
    // A patched, ragged hem, and the straw coming out from under it.
    for (let x = 9; x <= 23; x++) if ((x * 3) % 5 < 2) pc.px(x, base - 8, shade(o.accent, -0.28))
    for (let x = 10; x <= 22; x += 3) pc.vline(x, base - 8, base - 5, P.straw)
    for (const [x, y] of [[12, base - 19], [19, base - 14], [11, base - 12]]) {
      pc.hline(x, x + 2, y, shade(o.accent, -0.28))
      pc.hline(x, x + 2, y + 1, shade(o.accent, 0.2))
    }
    pc.hline(4, 28, base - 24, P.deadBark)
    pc.hline(4, 28, base - 23, P.deadBarkDark)
    // Straw hands out of the sleeves at both ends of the arm.
    for (const x of [4, 27]) {
      pc.hline(x, x + 1, base - 25, P.straw)
      pc.hline(x, x + 1, base - 22, P.strawDark)
      pc.px(x + (x < 16 ? 0 : 1), base - 21, P.straw)
    }
    // A cord tied round its middle, with a lantern's worth of colour at the knot.
    pc.hline(10, 22, base - 16, P.straw)
    pc.hline(10, 22, base - 15, P.strawDark)
    pc.px(16, base - 16, o.lit ? P.jackGlow : P.strawDark)
    if (!o.roof) return { x0: 3, x1: 28, top: base - 31 }
    // The head goes on last: a pumpkin with a face, and a hat that has been rained on.
    gourd(pc, 16, base - 28, 6, 4.5)
    carve(pc, 16, base - 28, o.lit || o.busy)
    box(pc, 12, base - 34, 20, base - 33, P.felt)
    pc.hline(8, 24, base - 32, P.felt)
    pc.hline(9, 23, base - 31, shade(P.felt, -0.3))
    pc.hline(13, 19, base - 33, P.feltBand)
    pc.px(13, base - 35, P.feltLight)
    crowAt(pc, 6, base - 24, 1)
    crowAt(pc, 26, base - 24, -1)
    return null
  },

  function lychGate(pc, o) {
    const base = o.H - 2
    const eave = base - 26
    // Two pairs of posts, a sill between them, and the gate itself.
    for (const x of [3, 26]) {
      box(pc, x, eave + 3, x + 2, base, P.deadBark)
      pc.vline(x, eave + 3, base, P.deadBarkLight)
      pc.vline(x + 2, eave + 3, base, P.deadBarkDark)
      pc.hline(x - 1, x + 3, base, P.graveStoneDark)
    }
    box(pc, 6, base - 13, 25, base - 12, P.deadBark)
    box(pc, 6, base - 1, 25, base, P.graveStone)
    // The gate, barred and left on the latch.
    box(pc, 7, base - 12, 24, base - 2, o.accent)
    for (let x = 8; x <= 24; x += 3) pc.vline(x, base - 12, base - 2, shade(o.accent, -0.3))
    pc.line(7, base - 2, 24, base - 12, shade(o.accent, 0.2))
    pc.px(24, base - 7, P.ironBarLight)
    // A bench each side, where a coffin used to rest: this is what a lych-gate is for.
    for (const x of [4, 22]) {
      box(pc, x, base - 8, x + 5, base - 7, P.deadBarkLight)
      pc.vline(x + 1, base - 6, base - 1, P.deadBarkDark)
    }
    box(pc, 8, eave + 3, 23, eave + 4, P.deadBarkDark)
    hangJack(pc, 16, eave + 5, o.lit)
    webCorner(pc, 6, eave + 5, 1, 1)
    webCorner(pc, 25, eave + 5, -1, 1)
    if (!o.roof) return { x0: 2, x1: 29, top: eave + 3 }
    steepRoof(pc, 0, 31, eave + 2, 11, roofOf(o.roofs, o.variant), P.ironBarLight, 1)
    return null
  },

  function gnarledOak(pc, o) {
    const base = o.H - 2
    mould(pc, o.H, o.rand)
    deadTrunk(pc, 11, 20, 24, base)
    // The bole swells where it meets the ground, so an oak reads as an oak and not as a post.
    for (let y = base - 8; y <= base; y++) {
      const half = 5 + Math.round(((y - (base - 8)) / 8) * 4)
      box(pc, 16 - half, y, 15 + half, y, P.deadBark)
      pc.px(16 - half, y, P.deadBarkLight)
      pc.px(15 + half, y, P.deadBarkDark)
      if (y % 3 === 0) pc.px(13, y, P.deadBarkDark)
    }
    // The roots, and a hollow at the foot with something in it.
    for (const [x, y] of [[5, base], [24, base], [7, base - 1]]) {
      pc.hline(x, x + 2, y, P.deadBarkDark)
      pc.px(x + 1, y - 1, P.deadBark)
    }
    pc.ellipse(15, base - 7, 2, 2.5, P.interior)
    if (o.busy) pc.px(15, base - 7, P.poison)
    if (!o.roof) return { x0: 4, x1: 27, top: 22 }
    // The boughs, reaching out over the whole plot.
    const ends = []
    for (const [x, y, len, dx, dy, w, lean] of [
      [11, 26, 9, -1, -1, 3, 2], [20, 28, 9, 1, -1, 3, 2],
      [12, 22, 9, -1, -1, 2, 1], [19, 20, 9, 1, -1, 2, 1], [16, 24, 11, 0, -1, 2, 0],
    ]) {
      ends.push(bough(pc, x, y, len, dx, dy, w, lean))
    }
    // Lanterns hung where the boughs come down low enough to reach.
    hangJack(pc, ends[0].x, ends[0].y + 2, o.lit)
    hangJack(pc, ends[1].x, ends[1].y + 2, o.lit)
    // The rope swing, which is what this tree is really for. The rope is husk rather than straw:
    // in straw it was brighter than the tree and read as a pole standing beside it.
    pc.vline(6, 18, base - 7, P.huskDark)
    pc.hline(4, 8, base - 6, P.deadBark)
    pc.hline(4, 8, base - 5, P.deadBarkDark)
    crowAt(pc, 24, 10, -1)
    crowAt(pc, 10, 7, 1)
    // The last of the leaves, in the plot's colour, still hanging on.
    const color = roofOf(o.roofs, o.variant)
    for (let i = 0; i < 26; i++) {
      const x = 2 + Math.floor(o.rand() * 28)
      const y = 4 + Math.floor(o.rand() * 18)
      if (pc.opaque(x, y + 1) && !pc.opaque(x, y)) pc.px(x, y, i % 3 ? color : shade(color, -0.25))
    }
    batAt(pc, 27, 5)
    return null
  },

  function witchsTower(pc, o) {
    const base = o.H - 2
    const capY = 18
    // A round tower that has settled: each course a pixel off the one below it.
    for (let y = capY; y <= base; y++) {
      const t = (y - capY) / (base - capY)
      const half = Math.round(5 + t * 5)
      const lean = Math.round((1 - t) * 2)
      wallOf(pc, 15 - half + lean, y, 14 + half + lean, y, o.material, o.rand)
    }
    pc.hline(4, 27, base, P.graveStoneDark)
    doorOf(pc, 13, base - 1, 6, 10, o.accent)
    paneOf(pc, 13, base - 22, 6, 6, o.lit)
    // The window the light comes out of, which is not a candle.
    box(pc, 13, capY + 6, 18, capY + 11, P.ironBar)
    box(pc, 14, capY + 7, 17, capY + 10, o.busy || o.lit ? P.poison : P.interior)
    if (o.busy || o.lit) pc.px(15, capY + 8, P.boneWhite)
    // The cauldron at the foot, and a broom left leaning on the wall.
    pc.ellipse(7, base - 3, 4, 3, P.ironBar)
    pc.hline(3, 11, base - 5, P.ironBarLight)
    pc.hline(4, 10, base - 6, o.lit ? P.poison : P.ironBar)
    if (o.lit) pc.px(6, base - 7, P.poison)
    pc.vline(25, base - 14, base - 5, P.deadBark)
    box(pc, 24, base - 5, 26, base - 1, P.straw)
    jackAt(pc, 21, base - 1, o.lit)
    if (!o.roof) return { x0: 3, x1: 28, top: capY }
    const color = roofOf(o.roofs, o.variant)
    // The cap: a long cone with a kink in it, as a hat has.
    for (let i = 0; i < 15; i++) {
      const half = Math.max(0, 7 - Math.round(i * 0.5))
      const lean = Math.round((i / 14) ** 2 * 5)
      pc.hline(15 - half + lean, 14 + half + lean, capY - 1 - i, i % 3 === 0 ? shade(color, 0.2) : color)
    }
    pc.hline(6, 25, capY, shade(color, -0.28))
    pc.px(21, capY - 16, P.ironBarLight)
    batAt(pc, 5, 8)
    return null
  },

  function belfry(pc, o) {
    const base = o.H - 2
    const stage = 20
    // The tower, its foot spread, built of the plot's own stone.
    wallOf(pc, 9, stage, 22, base, o.material, o.rand)
    wallOf(pc, 6, base - 10, 25, base, o.material, o.rand)
    pc.hline(6, 25, base, P.graveStoneDark)
    doorOf(pc, 13, base - 1, 6, 12, o.accent)
    jackAt(pc, 9, base - 1, o.lit)
    jackAt(pc, 23, base - 1, o.lit)
    paneOf(pc, 13, base - 26, 6, 8, o.lit)
    // The clock, stopped at midnight, as it would be.
    pc.ellipse(16, stage + 14, 5, 5, P.boneWhite)
    pc.ellipse(16, stage + 14, 4, 4, P.boneShade)
    pc.ellipse(16, stage + 14, 3, 3, P.boneWhite)
    pc.vline(16, stage + 11, stage + 14, P.ironBar)
    pc.px(16, stage + 14, P.ironBar)
    for (const [dx, dy] of [[0, -4], [4, 0], [0, 4], [-4, 0]]) pc.px(16 + dx, stage + 14 + dy, P.ironBar)
    if (!o.roof) return { x0: 5, x1: 26, top: stage }
    // The bell stage above it: louvred openings with the bell hanging in the dark behind them.
    box(pc, 8, stage - 12, 23, stage - 1, P.graveStone)
    pc.hline(8, 23, stage - 12, P.graveStoneLight)
    pc.hline(8, 23, stage - 1, P.graveStoneDark)
    for (const x of [10, 18]) {
      box(pc, x, stage - 10, x + 4, stage - 3, P.interior)
      for (let y = stage - 10; y <= stage - 3; y += 2) pc.hline(x, x + 4, y, P.deadBark)
    }
    // The bell itself, seen between the louvres.
    for (const [w, y] of [[1, -9], [2, -8], [3, -7], [3, -6], [3, -5]]) pc.hline(16 - w, 15 + w, stage + y, o.busy ? P.crowBeak : P.ironBarLight)
    pc.hline(13, 18, stage - 4, P.ironBar)
    const color = roofOf(o.roofs, o.variant)
    const top = steepRoof(pc, 4, 27, stage - 13, 12, color, P.ironBarLight, 1)
    // The weathervane on the ridge, and the bats out of the louvres, which is what moves.
    pc.hline(14, 18, Math.max(1, top - 1), P.ironBar)
    for (const [x, y] of BATS[o.frame % 2]) batAt(pc, x, y)
    return null
  },
]

/** A lantern heap's ground made ready: turned earth, a ring of bine, and nothing set out yet. */
function bareMound(pc, H, rand) {
  mould(pc, H, rand, 12)
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2
    const x = Math.round(16 + Math.cos(a) * 10)
    const y = Math.round(H - 5 + Math.sin(a) * 3)
    pc.hline(x - 1, x, y, P.bine)
    pc.px(x, y + 1, P.stalkDark)
  }
}

/** @param {{ tier: number, stage: number, variant?: number, accent?: string, wall?: number, roofs?: number, lit?: boolean, busy?: boolean, frame?: number }} o */
export function drawHallowLandmark(o) {
  const tier = tierOf(o.tier)
  const H = LANDMARK_HEIGHTS[tier]
  const pc = new PixelCanvas(LANDMARK_W, H)
  const variant = o.variant || 0
  const rand = mulberry32(variant * 5003 + tier * 211 + 19)
  // A heap of lanterns is only set out; everything else is put up on a marked-out plot.
  if (tier === 0 && o.stage === 0) {
    bareMound(pc, H, rand)
    return pc.outline(P.outline)
  }
  if (tier > 0 && o.stage <= 1) {
    site(pc, rand, o.stage, H - 48, variant)
    return pc.outline(P.outline)
  }
  const opts = {
    H, rand, variant, stage: o.stage, frame: o.frame || 0, roof: o.stage >= 3, lit: Boolean(o.lit), busy: Boolean(o.busy),
    accent: o.accent || P.hallowRoof[0], roofs: o.roofs || 0, material: MATERIALS[(o.wall || 0) % MATERIALS.length],
  }
  const up = TIERS[tier](pc, opts)
  if (o.stage === 2 && up) staging(pc, up.x0, up.x1, Math.max(1, up.top), H - 2)
  return pc.outline(P.outline)
}

// ---------- what a landmark brings with it ----------

/**
 * The night's take on what a plot's landmark brings (propsOf in src/sim/shape.js), the same sizes
 * as the village's: an iron post with a lantern on its crook for its lamp, a weathered bench with
 * a pumpkin left on the end of it, a barrel of corn stalks and a tub of gourds for its planters,
 * and two posts hung with bunting and lanterns for its gateway. Null for any other static, which
 * the village draws.
 */
export function drawHallowProp(sprite, variant, p = {}) {
  if (sprite === 'yardlamp') {
    const pc = new PixelCanvas(12, 30)
    box(pc, 2, 26, 8, 29, P.graveStone)
    pc.hline(2, 8, 26, P.graveStoneLight)
    pc.vline(8, 26, 29, P.graveStoneDark)
    box(pc, 4, 5, 5, 25, P.ironBar)
    pc.vline(4, 5, 25, P.ironBarLight)
    for (const y of [12, 20]) pc.px(5, y, P.rust)
    // The crook, and the lantern hung off the end of it.
    pc.hline(5, 8, 3, P.ironBarLight)
    pc.hline(5, 8, 4, P.ironBar)
    pc.px(9, 5, P.ironBar)
    pc.px(3, 3, P.web)
    pc.px(3, 4, P.webDim)
    pc.px(9, 6, P.ironBar)
    box(pc, 7, 7, 11, 11, P.pumpkin)
    pc.px(7, 7, P.pumpkinDark)
    pc.px(11, 7, P.pumpkinDark)
    pc.px(9, 6, P.stalkDark)
    pc.px(8, 9, p.lit ? P.jackGlow : P.interior)
    pc.px(10, 9, p.lit ? P.jackGlow : P.interior)
    pc.hline(8, 10, 10, p.lit ? P.jackGlow : P.interior)
    if (p.lit) pc.px(9, 10, P.jackCore)
    return pc.outline(P.outline)
  }
  if (sprite === 'yardbench') {
    // As the village's bench, two tiles long along the fence: its back on the west side.
    const pc = new PixelCanvas(14, 32)
    box(pc, 1, 1, 3, 29, P.deadBark)
    pc.vline(1, 1, 29, P.deadBarkLight)
    for (let y = 4; y < 29; y += 5) pc.hline(1, 3, y, P.deadBarkDark)
    box(pc, 4, 3, 10, 28, P.deadBark)
    pc.vline(4, 3, 28, P.deadBarkLight)
    pc.vline(7, 3, 28, P.deadBarkDark)
    pc.vline(10, 3, 28, P.deadBarkDark)
    for (const y of [2, 28]) {
      pc.hline(0, 11, y, P.deadBarkDark)
      pc.px(11, y + 1, P.deadBarkDark)
    }
    box(pc, 1, 30, 2, 31, P.graveStoneDark)
    box(pc, 9, 30, 10, 31, P.graveStoneDark)
    // A pumpkin left on one end of it, and a web under the other.
    pc.ellipse(7, 6, 3, 2.5, P.pumpkin)
    pc.px(6, 5, P.pumpkinLight)
    pc.px(7, 3, P.stalkDark)
    webCorner(pc, 4, 24, 1, 1)
    return pc.outline(P.outline)
  }
  if (sprite === 'yardplanter') {
    const pc = new PixelCanvas(16, 20)
    // A barrel, hooped in iron.
    box(pc, 3, 10, 12, 19, P.deadBark)
    pc.vline(3, 10, 19, P.deadBarkLight)
    pc.vline(12, 10, 19, P.deadBarkDark)
    for (let x = 5; x <= 11; x += 3) pc.vline(x, 10, 19, P.deadBarkDark)
    for (const y of [12, 17]) pc.hline(3, 12, y, P.ironBar)
    pc.hline(3, 12, 10, P.deadBarkLight)
    if (variant % 2 === 0) {
      // Corn stalks, cut and stood in it.
      for (const [x, h] of [[4, 8], [6, 10], [8, 11], [10, 9], [11, 7]]) {
        pc.vline(x, 10 - h, 10, (x & 1) ? P.husk : P.huskDark)
        pc.px(x + 1, 12 - h, P.straw)
      }
      pc.px(3, 4, P.husk)
    } else {
      // Gourds heaped in it, with toadstools come up round the foot.
      pc.ellipse(6, 8, 3, 2.5, P.pumpkin)
      pc.ellipse(10, 9, 2.5, 2, P.gourd)
      pc.px(5, 7, P.pumpkinLight)
      pc.px(6, 5, P.stalkDark)
      for (const x of [1, 14]) {
        pc.hline(x - 1, x + 1, 18, P.mushroom[0])
        pc.px(x, 19, P.boneWhite)
      }
    }
    return pc.outline(P.outline)
  }
  if (sprite === 'gateway') {
    // Two posts with a beam across them, hung with bunting and a lantern either side. Open
    // underneath: a gateway is walked through.
    const pc = new PixelCanvas(32, 30)
    for (const x of [2, 27]) {
      box(pc, x, 6, x + 2, 29, P.deadBark)
      pc.vline(x, 6, 29, P.deadBarkLight)
      pc.vline(x + 2, 6, 29, P.deadBarkDark)
      pc.hline(x - 1, x + 3, 29, P.graveStoneDark)
    }
    box(pc, 1, 3, 30, 5, P.deadBark)
    pc.hline(1, 30, 3, P.deadBarkLight)
    pc.hline(1, 30, 5, P.deadBarkDark)
    // Bunting along the beam, orange and black turn and turn about.
    for (let x = 3; x <= 28; x += 3) {
      pc.hline(x, x + 1, 6, (x >> 1) % 2 ? P.pumpkin : P.felt)
      pc.px(x, 7, (x >> 1) % 2 ? P.pumpkinDark : P.feltLight)
    }
    for (const x of [7, 24]) hangJack(pc, x, 8, false)
    webCorner(pc, 5, 7, 1, 1)
    webCorner(pc, 26, 7, -1, 1)
    batAt(pc, 16, 9)
    return pc.outline(P.outline)
  }
  return null
}
