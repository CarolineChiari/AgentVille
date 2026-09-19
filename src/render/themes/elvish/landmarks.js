// The realm's landmarks: what a plot's work has raised in the middle of its lantern grove, from a
// ring of glowing toadstools to a white tower with a star-crystal in its crown. Same contract as
// the village's (src/render/sprites/landmarks.js): 32 px wide, the same height per tier, bottom
// row on the ground, stages 0 to 3 as a building's (2 grows inside the realm's sapling trellis),
// `lit` windows and lanterns after dark and `busy` while somebody on the plot is in. The plot's
// roof family goes on the roofs, its accent on ribbons, doors and the banner, and a hall is built
// of the plot's own wall material.
//
// None of them is one of the realm's houses made bigger: a spring, a spire and a great tree are
// already what threads build here, and a landmark has to read as the plot's own centrepiece.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { LANDMARK_HEIGHTS, LANDMARK_W } from '../../sprites/landmarks.js'
import { mulberry32 } from '../../../sim/rng.js'
import { MATERIALS, arched, bough, box, hangLantern, leafPane, roofOf, site, sweptRoof, trellis, wallOf } from './buildings.js'

const TOP_TIER = LANDMARK_HEIGHTS.length - 1
const tierOf = (tier) => Math.max(0, Math.min(TOP_TIER, Math.floor(Number(tier) || 0)))

/** The same heights as the village's, so a plot's landmark stands as tall whichever theme it wears. */
export const heightOf = (tier) => LANDMARK_HEIGHTS[tierOf(tier)]
/** A ring of toadstools casts none worth drawing; a standing stone's is narrow. */
export const shadowOf = (tier) => [0, 18, 26, 30, 34, 26][tierOf(tier)]
/** Motes rise over the fairy ring while somebody is in, and the starwatch's banner flies. */
export const landmarkFrames = (tier, stage) => (stage >= 3 && (tierOf(tier) === 0 || tierOf(tier) === TOP_TIER) ? 2 : 1)

// ---------- parts ----------

/** Moss underfoot, speckled with fallen leaves. */
function moss(pc, H, rand, rx = 14.5) {
  pc.ellipse(16, H - 4, rx, 3.5, P.moss)
  for (let i = 0; i < 10; i++) pc.px(3 + Math.floor(rand() * 26), H - 6 + Math.floor(rand() * 5), P.leafDark)
}

/** A fern, its crown `h` rows above (x, base). */
function fern(pc, x, base, h = 7) {
  pc.line(x, base, x - 3, base - h + 2, P.fern)
  pc.line(x, base, x + 3, base - h + 1, P.fernDark)
  pc.line(x, base, x, base - h, P.fern)
  pc.px(x - 1, base - h + 3, P.fernDark)
  pc.px(x + 1, base - h + 2, P.fern)
}

/** A toadstool that glows faintly blue, its foot on (x, y); only a button while it is coming up. */
function toadstool(pc, x, y, grown) {
  if (!grown) {
    pc.px(x, y, P.glowCapStem)
    pc.px(x, y - 1, P.glowCap)
    return
  }
  pc.vline(x, y - 1, y, P.glowCapStem)
  pc.hline(x - 1, x + 1, y - 2, P.glowCap)
  pc.px(x, y - 3, P.glowCap)
  pc.px(x - 1, y - 2, shade(P.glowCap, 0.3))
}

/** A four-pointed star of crystal centred on (cx, cy), blazing while somebody is in. */
function star(pc, cx, cy, r, bright) {
  const c = bright ? P.runeGlow : P.shard
  pc.vline(cx, cy - r, cy + r, c)
  pc.hline(cx - r, cx + r, cy, c)
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pc.px(cx + dx, cy + dy, P.shardDark)
  pc.px(cx, cy, bright ? P.white : P.glassLight)
}

/** A garland of vine across x0..x1 on row y, with the plot's flowers in it. */
function garland(pc, x0, x1, y, accent) {
  for (let x = x0; x <= x1; x++) pc.px(x, y + (Math.abs(x - (x0 + x1) / 2) < (x1 - x0) / 4 ? 1 : 0), P.vine)
  for (let x = x0 + 2; x <= x1 - 1; x += 4) pc.px(x, y + (Math.abs(x - (x0 + x1) / 2) < (x1 - x0) / 4 ? 1 : 0), accent)
}

// ---------- the tiers ----------

const MOTES = [
  [[8, 9], [21, 12], [26, 7], [14, 15]],
  [[11, 12], [23, 8], [6, 7], [18, 15]],
]

const TIERS = [
  function fairyRing(pc, o) {
    const g = o.H - 4
    moss(pc, o.H, o.rand)
    const caps = []
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + 0.2
      caps.push([Math.round(16 + Math.cos(a) * 10), Math.round(g - 1 + Math.sin(a) * 3), Math.sin(a)])
    }
    const grown = o.stage >= 3
    caps.filter((c) => c[2] <= 0).forEach(([x, y]) => toadstool(pc, x, y, grown))
    // The stone in the middle of the ring, a rune cut in it.
    pc.ellipse(16, g - 2, 3.2, 2, P.paleStone)
    pc.hline(14, 18, g - 3, P.paleStoneLight)
    pc.px(16, g - 2, o.busy ? P.runeGlow : P.rune)
    caps.filter((c) => c[2] > 0).forEach(([x, y]) => toadstool(pc, x, y, grown))
    if (!o.roof || !o.busy) return null
    for (const [x, dy] of MOTES[o.frame % 2]) {
      pc.px(x, g - dy, P.runeGlow)
      if (x % 2) pc.px(x, g - dy - 1, P.glowCap)
    }
    return null
  },

  function moonstone(pc, o) {
    const base = o.H - 2
    const top = base - 30
    moss(pc, o.H, o.rand)
    fern(pc, 6, base - 1)
    fern(pc, 26, base - 1, 6)
    // The stone, its head rounded, set in a footing.
    box(pc, 11, top, 20, base - 3, P.paleStone)
    pc.vline(11, top, base - 3, P.paleStoneLight)
    pc.vline(20, top, base - 3, P.paleStoneDark)
    for (const [x, y] of [[11, top], [12, top], [19, top], [20, top], [11, top + 1], [20, top + 1]]) pc.clearPx(x, y)
    pc.hline(13, 18, top, P.paleStoneLight)
    box(pc, 8, base - 3, 23, base, P.paleStoneDark)
    pc.hline(8, 23, base - 3, P.paleStone)
    for (let y = top + 13; y < base - 5; y += 3) pc.px(15 + ((y >> 1) & 1), y, o.lit ? P.runeGlow : P.rune)
    if (!o.roof) return { x0: 7, x1: 24, top }
    // The crescent cut near its head, with a crystal set in its hollow.
    for (const [x, y] of [[14, top + 3], [13, top + 4], [13, top + 5], [13, top + 6], [14, top + 7], [15, top + 8], [15, top + 3]]) pc.px(x, y, P.carving)
    box(pc, 16, top + 4, 17, top + 6, o.lit || o.busy ? P.runeGlow : P.shard)
    pc.px(16, top + 4, P.glassLight)
    garland(pc, 10, 21, top + 11, o.accent)
    return null
  },

  function starShrine(pc, o) {
    const base = o.H - 2
    const top = base - 28
    // Two steps up to it.
    box(pc, 3, base - 2, 28, base, P.paleStone)
    pc.hline(3, 28, base - 2, P.paleStoneLight)
    pc.hline(3, 28, base, P.paleStoneDark)
    box(pc, 6, base - 5, 25, base - 3, P.paleStone)
    pc.hline(6, 25, base - 5, P.paleStoneLight)
    // Its two pillars, a vine climbing each with the plot's flowers on it.
    for (const x of [7, 22]) {
      box(pc, x, top, x + 2, base - 6, P.paleStone)
      pc.vline(x, top, base - 6, P.paleStoneLight)
      pc.vline(x + 2, top, base - 6, P.paleStoneDark)
      pc.hline(x - 1, x + 3, top, P.paleStoneLight)
      for (let y = base - 7; y > top + 2; y -= 2) pc.px(x + ((y >> 1) % 2 ? -1 : 3), y, P.vine)
      for (let y = base - 9; y > top + 4; y -= 6) pc.px(x + 3, y, o.accent)
    }
    if (!o.roof) return { x0: 4, x1: 27, top }
    // A lintel across them, a swept roof over it, and the star hung from it.
    box(pc, 5, top - 2, 26, top - 1, P.paleStone)
    pc.hline(5, 26, top - 2, P.paleStoneLight)
    for (let x = 7; x <= 24; x += 3) pc.px(x, top - 1, P.rune)
    sweptRoof(pc, 2, 29, top - 3, 10, roofOf(o.roofs, o.variant), P.mithrilLight, 1)
    pc.vline(16, top, top + 3, P.mithril)
    star(pc, 16, top + 8, 4, o.lit || o.busy)
    return null
  },

  function silverTree(pc, o) {
    const base = o.H - 2
    moss(pc, o.H, o.rand)
    // A ring of runestones round its roots, the far ones first.
    const stone = (x, y) => {
      box(pc, x, y - 3, x + 2, y, P.runestone)
      pc.px(x, y - 3, P.runestoneLight)
      pc.px(x + 2, y, P.runestoneDark)
      pc.px(x + 1, y - 1, o.busy ? P.runeGlow : P.rune)
    }
    stone(6, base - 3)
    stone(23, base - 3)
    // Its trunk, silver-barked, and its boughs reaching out.
    box(pc, 13, 20, 18, base - 1, P.birch)
    pc.vline(13, 20, base - 1, P.mithrilLight)
    pc.vline(18, 20, base - 1, P.paleStoneDark)
    for (let y = 22; y < base - 1; y += 4) pc.hline(14 + (y % 3), 15 + (y % 3), y, P.birchMark)
    for (const [dx, dy] of [[-2, 0], [-1, -1], [7, 0], [6, -1]]) pc.px(13 + dx, base - 1 + dy, P.paleStoneDark)
    pc.line(13, 30, 5, 22, P.birch)
    pc.line(13, 31, 5, 23, P.paleStoneDark)
    pc.line(18, 28, 27, 20, P.birch)
    pc.line(18, 29, 27, 21, P.paleStoneDark)
    // Ribbons in the plot's colour tied round it.
    pc.hline(13, 18, 38, o.accent)
    pc.vline(12, 39, 41, o.accent)
    pc.vline(19, 39, 40, shade(o.accent, -0.2))
    stone(3, base)
    stone(26, base)
    if (!o.roof) return { x0: 2, x1: 29, top: 12 }
    // The crown: silver leaves with gold among them.
    bough(pc, 16, 13, 14, 9, P.mithrilDark, P.mithril, P.mithrilLight)
    bough(pc, 5, 20, 6, 4, P.mithrilDark, P.mithril, P.mithrilLight)
    bough(pc, 27, 18, 5, 4, P.mithrilDark, P.mithril, P.mithrilLight)
    // Leaves, in clumps: without them a silver crown read as a cloud.
    for (let i = 0; i < 46; i++) {
      const x = 2 + Math.floor(o.rand() * 27)
      const y = 5 + Math.floor(o.rand() * 18)
      if (pc.opaque(x, y) && pc.opaque(x + 1, y)) pc.hline(x, x + 1, y, i % 3 ? P.mithrilDark : P.paleStoneDark)
    }
    for (let i = 0; i < 14; i++) {
      const x = 3 + Math.floor(o.rand() * 26)
      const y = 6 + Math.floor(o.rand() * 16)
      if (pc.opaque(x, y)) pc.px(x, y, P.gilt)
    }
    hangLantern(pc, 6, 24, o.lit)
    hangLantern(pc, 25, 22, o.lit)
    return null
  },

  function crystalHall(pc, o) {
    const base = o.H - 2
    const wallTop = base - 24
    wallOf(pc, 3, wallTop, 28, base, o.material, o.rand)
    pc.hline(3, 28, base, P.carving)
    // Slender pinnacles at its ends, mithril-tipped.
    for (const x of [1, 28]) {
      box(pc, x, wallTop - 6, x + 2, base, P.paleStone)
      pc.vline(x, wallTop - 6, base, P.paleStoneLight)
      pc.vline(x + 2, wallTop - 6, base, P.paleStoneDark)
      pc.px(x + 1, wallTop - 7, P.mithrilLight)
    }
    for (let x = 5; x <= 26; x += 3) pc.px(x, wallTop + 2, P.rune)
    leafPane(pc, 5, wallTop + 5, 6, 10, o.lit)
    leafPane(pc, 21, wallTop + 5, 6, 10, o.lit)
    arched(pc, 13, base - 1, 6, 12, o.accent)
    hangLantern(pc, 12, base - 18, o.lit)
    hangLantern(pc, 19, base - 18, o.lit)
    if (!o.roof) return { x0: 0, x1: 31, top: wallTop - 7 }
    sweptRoof(pc, 0, 31, wallTop - 1, 9, roofOf(o.roofs, o.variant), null, 1)
    // A dome of crystal on the ridge, ribbed in mithril, lit from inside while somebody is in.
    const db = wallTop - 8
    for (let y = db - 10; y <= db; y++) {
      const half = Math.round(7 * Math.sqrt(Math.max(0, 1 - ((db - y) / 10) ** 2)))
      if (half < 1) continue
      pc.hline(16 - half, 15 + half, y, P.glass)
      pc.px(16 - half, y, P.mithrilDark)
      pc.px(15 + half, y, P.mithrilDark)
    }
    pc.vline(15, db - 9, db, P.mithrilDark)
    pc.line(12, db, 14, db - 8, P.mithrilDark)
    pc.line(19, db, 17, db - 8, P.mithrilDark)
    for (const [x, y] of [[11, db - 3], [13, db - 6], [18, db - 4]]) pc.px(x, y, o.busy ? P.runeGlow : P.glassLight)
    pc.hline(8, 23, db, P.mithril)
    pc.vline(15, db - 14, db - 10, P.mithril)
    pc.px(15, db - 15, P.mithrilLight)
    return null
  },

  function starwatch(pc, o) {
    const base = o.H - 2
    const shaftTop = 22
    // The white tower, its foot spread, and the living tree wound up it.
    wallOf(pc, 10, shaftTop, 21, base, 'palestone', o.rand)
    wallOf(pc, 7, base - 8, 24, base, 'palestone', o.rand)
    pc.hline(7, 24, base, P.carving)
    arched(pc, 13, base - 1, 6, 11, o.accent)
    leafPane(pc, 13, 32, 6, 6, o.lit)
    leafPane(pc, 13, 45, 6, 6, o.lit)
    box(pc, 4, 42, 5, base, P.livewood)
    pc.vline(4, 42, base, P.livewoodLight)
    pc.line(5, 42, 25, 33, P.livewood)
    pc.line(5, 43, 25, 34, P.livewoodDark)
    box(pc, 25, 26, 26, 34, P.livewood)
    pc.vline(26, 26, 34, P.livewoodDark)
    for (const [dx, dy] of [[-1, 0], [2, 0], [-2, -1]]) pc.px(4 + dx, base + dy, P.livewoodDark)
    bough(pc, 4, 40, 4, 3, P.leafDark, P.leaf, P.leafLight)
    bough(pc, 27, 24, 4, 3, P.leafDark, P.leaf, P.leafLight)
    if (!o.roof) return { x0: 3, x1: 28, top: shaftTop }
    // The lantern chamber at its top, open to the sky, and the star-crystal it keeps.
    for (const x of [10, 21]) pc.vline(x, shaftTop - 9, shaftTop - 1, P.mithril)
    pc.hline(9, 22, shaftTop - 1, P.paleStoneDark)
    const bright = o.lit || o.busy
    ;[1, 3, 5, 5, 3, 1].forEach((w, i) => pc.hline(16 - Math.ceil(w / 2), 15 + Math.floor(w / 2) + (w > 1 ? 1 : 0), shaftTop - 8 + i, bright ? P.runeGlow : P.shard))
    pc.px(o.frame % 2 ? 17 : 15, shaftTop - 6, P.white)
    const color = roofOf(o.roofs, o.variant)
    sweptRoof(pc, 6, 25, shaftTop - 10, 6, color, null, 1)
    // The mast and the plot's banner, which is what moves between the frames.
    pc.vline(16, 1, shaftTop - 16, P.mithril)
    pc.px(16, 1, P.mithrilLight)
    const swing = o.frame % 2
    for (let i = 0; i < 5; i++) pc.vline(17 + i, 2 + (swing ? i % 2 : Math.floor(i / 2)), 5 + (swing ? Math.floor(i / 2) : i % 2), o.accent)
    return null
  },
]

/** A fairy ring's ground made ready: moss and a ring of white pebbles, nothing come up yet. */
function pebbleRing(pc, H, rand) {
  moss(pc, H, rand)
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2
    const x = Math.round(16 + Math.cos(a) * 10)
    const y = Math.round(H - 5 + Math.sin(a) * 3)
    pc.hline(x - 1, x, y, P.paleStone)
    pc.px(x, y + 1, P.paleStoneDark)
  }
}

/** @param {{ tier: number, stage: number, variant?: number, accent?: string, wall?: number, roofs?: number, lit?: boolean, busy?: boolean, frame?: number }} o */
export function drawElfLandmark(o) {
  const tier = tierOf(o.tier)
  const H = LANDMARK_HEIGHTS[tier]
  const pc = new PixelCanvas(LANDMARK_W, H)
  const variant = o.variant || 0
  const rand = mulberry32(variant * 5003 + tier * 211 + 13)
  // A fairy ring comes up where it's asked; everything else is grown from a sapling in a ring of stones.
  if (tier === 0 && o.stage === 0) {
    pebbleRing(pc, H, rand)
    return pc.outline(P.outline)
  }
  if (tier > 0 && o.stage <= 1) {
    site(pc, rand, o.stage, H - 48, variant)
    return pc.outline(P.outline)
  }
  const opts = {
    H, rand, variant, stage: o.stage, frame: o.frame || 0, roof: o.stage >= 3, lit: Boolean(o.lit), busy: Boolean(o.busy),
    accent: o.accent || P.elfRoof[0], roofs: o.roofs || 0, material: MATERIALS[(o.wall || 0) % MATERIALS.length],
  }
  const grown = TIERS[tier](pc, opts)
  if (o.stage === 2 && grown) trellis(pc, grown.x0, grown.x1, Math.max(1, grown.top), H - 2)
  return pc.outline(P.outline)
}

// ---------- what a landmark brings with it ----------

/**
 * The realm's take on what a plot's landmark brings (propsOf in src/sim/shape.js), the same sizes
 * as the village's: a lantern on a crook for its lamp, a stone seat with a woven back for its
 * bench, carved urns of fern and glowing toadstools for its planters, and two saplings grown
 * together into an arch for its gateway. Null for any other static, which the village draws.
 */
export function drawElfProp(sprite, variant, p = {}) {
  if (sprite === 'yardlamp') {
    const pc = new PixelCanvas(12, 30)
    box(pc, 2, 26, 8, 29, P.paleStone)
    pc.hline(2, 8, 26, P.paleStoneLight)
    pc.vline(8, 26, 29, P.paleStoneDark)
    box(pc, 4, 5, 5, 25, P.livewood)
    pc.vline(4, 5, 25, P.livewoodLight)
    for (const y of [11, 19]) pc.px(5, y, P.barkMoss)
    // The crook, a sprig still growing from it, and the lantern hung from its end.
    pc.hline(5, 8, 3, P.livewoodLight)
    pc.hline(5, 8, 4, P.livewood)
    pc.px(9, 5, P.livewood)
    pc.px(3, 3, P.leafLight)
    pc.px(3, 4, P.leaf)
    pc.hline(8, 10, 7, P.mithrilDark)
    box(pc, 8, 8, 10, 10, p.lit ? P.lanternGlow : P.mithrilLight)
    pc.px(9, 9, p.lit ? P.white : P.mithrilDark)
    pc.hline(8, 10, 11, P.mithrilDark)
    pc.px(9, 12, P.mithril)
    pc.px(9, 6, P.mithril)
    return pc.outline(P.outline)
  }
  if (sprite === 'yardbench') {
    // As the village's bench, two tiles long along the fence: its back on the west side.
    const pc = new PixelCanvas(14, 32)
    box(pc, 1, 1, 3, 29, P.livewood)
    pc.vline(1, 1, 29, P.livewoodLight)
    for (let y = 3; y < 29; y += 4) pc.hline(1, 3, y, P.vine)
    for (const y of [6, 18]) pc.px(0, y, P.leaf)
    box(pc, 4, 3, 10, 28, P.paleStone)
    pc.vline(4, 3, 28, P.paleStoneLight)
    pc.vline(10, 3, 28, P.paleStoneDark)
    for (let y = 8; y < 26; y += 6) pc.px(7, y, P.carving)
    for (const y of [2, 28]) {
      pc.hline(0, 11, y, P.paleStoneDark)
      pc.px(11, y + 1, P.paleStoneDark)
    }
    box(pc, 1, 30, 2, 31, P.paleStoneDark)
    box(pc, 9, 30, 10, 31, P.paleStoneDark)
    return pc.outline(P.outline)
  }
  if (sprite === 'yardplanter') {
    const pc = new PixelCanvas(16, 20)
    // A carved urn on a foot.
    ;[6, 6, 5, 5, 4, 4, 3].forEach((half, i) => {
      const y = 11 + i
      pc.hline(8 - half, 7 + half, y, P.paleStone)
      pc.px(8 - half, y, P.paleStoneLight)
      pc.px(7 + half, y, P.paleStoneDark)
    })
    pc.hline(1, 14, 11, P.paleStoneLight)
    pc.hline(4, 11, 14, P.carving)
    box(pc, 5, 18, 10, 19, P.paleStoneDark)
    pc.hline(5, 10, 18, P.paleStone)
    if (variant % 2 === 0) {
      for (const [x, h, c] of [[4, 6, P.fernDark], [6, 9, P.fern], [8, 10, P.fern], [10, 8, P.fernDark], [12, 6, P.fern]]) pc.line(8, 11, x, 11 - h, c)
      pc.px(3, 6, P.fern)
      pc.px(13, 5, P.fernDark)
    } else {
      pc.ellipse(8, 10, 6, 2.5, P.moss)
      for (const x of [4, 8, 12]) toadstool(pc, x, 9, true)
      pc.px(6, 8, P.petalFall)
      pc.px(10, 8, P.petalFall)
    }
    return pc.outline(P.outline)
  }
  if (sprite === 'gateway') {
    // Two saplings grown up either side of the gap and bent together over it. Open underneath.
    const pc = new PixelCanvas(32, 30)
    for (let y = 29; y >= 4; y--) {
      const inward = Math.round(((29 - y) / 25) ** 2.5 * 11)
      for (const x of [3 + inward, 27 - inward]) {
        pc.hline(x, x + 1, y, P.livewood)
        pc.px(x, y, P.livewoodLight)
      }
    }
    for (const [x, y] of [[2, 29], [5, 29], [26, 29], [29, 29]]) pc.px(x, y, P.livewoodDark)
    for (let y = 8; y <= 20; y += 4) {
      const inward = Math.round(((29 - y) / 25) ** 2.5 * 11)
      pc.px(2 + inward, y, P.leaf)
      pc.px(29 - inward, y + 1, P.leafLight)
    }
    bough(pc, 16, 4, 8, 3, P.leafDark, P.leaf, P.leafLight)
    for (const x of [11, 16, 21]) pc.px(x, 3, P.petalFall)
    for (const x of [9, 22]) hangLantern(pc, x, 9, false)
    return pc.outline(P.outline)
  }
  return null
}
