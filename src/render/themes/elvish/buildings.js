// Elvish buildings: what each thread builds in a wood the elves keep, drawn the way the village's
// buildings are (src/render/sprites/buildings.js): the plot's wall material and roof family on
// them, its accent on the finials and banners, and a finished one aged by its wear.
//
// Contract (see ThemePack in ../index.js and the village's src/render/sprites/buildings.js):
// - A thread's building kind (KINDS in src/sim/building.js) maps to an elvish kind through `fitted`.
// - Every sprite is BUILDING_W (32) wide and heightOf() tall, its bottom row on the ground.
// - Down a courtyard's sides (`fitted(kind, variant, false)`) a building is 48 tall and draws
//   nothing above row DOORSTEP_CLEAR (9), outline included, at every stage: the villager at the
//   door of the house above stands there.
// - Stages 0 and 1 are the ground being made ready; 2 is the building without its roof
//   (`roof: false`) inside a trellis of lashed saplings; 3 is finished. Stage 3 is weathered by
//   `wear` exactly as the village's buildings are (see drawBuilding there).
// - `wall` indexes THEMES.elvish.dims.wall; `roofs` its roof families; `accent` is the plot's
//   colour, for finials, banners and awnings. Every colour from the palette.
//
// "Roof" here is whatever goes on last: a swept roof, a spire, a pavilion's canopy, the crown of
// a great tree. Weathering treats it as roof (see weathering.js), so it is kept to the tops of
// things; bodies are drawn the same with and without it.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { BUILDING_W, DOORSTEP_CLEAR } from '../../sprites/buildings.js'
import { lookFor, weather } from '../../sprites/weathering.js'
import { mulberry32, pick, rngFor } from '../../../sim/rng.js'
import { THEMES } from '../../../sim/themes.js'
import { KEPT } from '../../../sim/wear.js'

/** A thread's building, by its kind, in an elvish realm. */
export const ELF_KINDS = {
  house: 'talan', cottage: 'bower', shop: 'pavilion', barn: 'longhall', windmill: 'spire',
  workshop: 'forge', well: 'wellspring', farm: 'arbour', tower: 'mallorn', greenhouse: 'crystalhouse', stall: 'stand',
}
const TALL = { spire: 60, mallorn: 60 }
/** What a spire or a great tree is built as down the sides, where there is no room for its height. */
const STAND_INS = ['bower', 'pavilion', 'longhall', 'crystalhouse']
const MATERIALS = THEMES.elvish.dims.wall
/**
 * The roofs a plot's buildings share, by its `roofs`: three related colours each, as indices into
 * the palette's elfRoof (leaf green, moonlit silver, mallorn gold, twilight violet).
 */
const ROOF_FAMILIES = [[0, 4, 5], [1, 5, 3], [2, 6, 0], [3, 7, 1]]
/** The highest row anything may be drawn on, leaving the outline its row above. */
const ceiling = (low) => (low ? DOORSTEP_CLEAR + 1 : 1)

export function fitted(kind, variant, roomy) {
  const own = ELF_KINDS[kind] || 'bower'
  if (roomy) return { kind: own, low: false }
  if (TALL[own]) return { kind: STAND_INS[variant % STAND_INS.length], low: true }
  return { kind: own, low: true }
}

export function heightOf(kind) {
  return TALL[kind] || 48
}

/** A spring, a stand and a row of vines are low and cast a narrow shadow; a vine row casts none. */
export function shadowOf(kind) {
  if (kind === 'arbour') return 0
  return kind === 'wellspring' || kind === 'stand' ? 26 : 34
}

/** The banner on the spire's mast flies. */
export const buildingFrames = (kind, stage) => (kind === 'spire' && stage >= 3 ? 2 : 1)

/**
 * Where smoke leaves a finished building: the bower's smoke hole and the forge's stack. Everything
 * else is warmed by lanterns and has none.
 */
export function chimneyOf(kind, variant = 0, wall = 0, roofs = 0, low = false) {
  if (kind === 'bower') return { x: 22, y: bowerSpec(low).smokeY }
  if (kind === 'forge') return { x: 7, y: forgeSpec(low).stackTop }
  return null
}

// ---------- shared parts ----------

/** Each kind's shape comes from its own stream, apart from the one that scatters texture. */
const specRand = (kind, variant) => rngFor(`elf:${kind}:${variant}`)
const box = (pc, x0, y0, x1, y1, c) => pc.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, c)
/** One of the plot's roof family, turning through it by `i`. */
const roofOf = (roofs, i) => {
  const f = ROOF_FAMILIES[(roofs || 0) % ROOF_FAMILIES.length]
  return P.elfRoof[f[Math.abs(Math.floor(i)) % f.length]]
}
/** The material a building is built of: mostly its plot's, now and then another. */
const materialOf = (r, wall) => (r() < 0.7 ? MATERIALS[(wall || 0) % MATERIALS.length] : pick(r, MATERIALS))

/** A wall of one of the theme's five materials, x0..x1 by y0..y1. */
function wallOf(pc, x0, y0, x1, y1, material, rand) {
  if (material === 'livewood') {
    // Wood still growing: the grain runs up it, and moss finds the furrows.
    box(pc, x0, y0, x1, y1, P.livewood)
    for (let x = x0; x <= x1; x += 3) pc.vline(x, y0, y1, P.livewoodDark)
    for (let x = x0 + 1; x <= x1; x += 3) pc.vline(x, y0, y1, P.livewoodLight)
    for (let i = 0; i < 6; i++) pc.px(x0 + Math.floor(rand() * (x1 - x0 + 1)), y0 + Math.floor(rand() * (y1 - y0 + 1)), P.barkMoss)
  } else if (material === 'birch') {
    box(pc, x0, y0, x1, y1, P.birch)
    for (let y = y0 + 1; y <= y1; y += 4) for (let x = x0 + ((y - y0) % 8 < 4 ? 1 : 4); x <= x1; x += 6) pc.hline(x, x + 1, y, P.birchMark)
    pc.vline(x1, y0, y1, P.paleStoneDark)
  } else if (material === 'palestone') {
    // Carved ashlar: courses cut so fine that only their shadow shows.
    box(pc, x0, y0, x1, y1, P.paleStone)
    for (let y = y0; y <= y1; y += 4) {
      pc.hline(x0, x1, y, P.carving)
      pc.hline(x0, x1, y + 1, P.paleStoneLight)
    }
    for (let i = 0; i < 5; i++) pc.px(x0 + 1 + Math.floor(rand() * (x1 - x0 - 1)), y0 + 1 + Math.floor(rand() * (y1 - y0 - 1)), P.paleStoneDark)
  } else if (material === 'weave') {
    // Willow and leaf woven into panels, over and under every two pixels.
    box(pc, x0, y0, x1, y1, P.weave)
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (((x >> 1) + (y >> 1)) % 2) pc.px(x, y, P.weaveDark)
    for (let x = x0; x <= x1; x += 6) pc.vline(x, y0, y1, P.withyDark)
    pc.hline(x0, x1, y0, P.weaveLight)
  } else {
    // Crystal in a mithril net. The palette's glass colours are what weathering reads as glazing,
    // so a crystal wall loses a pane here and there as a glasshouse does, rather than being boarded.
    box(pc, x0, y0, x1, y1, P.glass)
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if ((x + y) % 5 === 0) pc.px(x, y, P.glassLight)
    for (let x = x0; x <= x1; x += 5) pc.vline(x, y0, y1, P.mithrilDark)
    for (let y = y0; y <= y1; y += 5) pc.hline(x0, x1, y, P.mithrilDark)
  }
}

/**
 * A swept roof over x0..x1, its eaves on `yBot` and its ridge `rise` rows above them: flat near
 * the ridge, steep at the ends, and the last columns turned up. A straight-sided roof at this
 * size read as the village's; the upturned eave is what says elf at a glance from a distance.
 * @returns the highest row it drew
 */
function sweptRoof(pc, x0, x1, yBot, rise, color, finial = null, limit = 0) {
  const mid = (x0 + x1) / 2
  const half = Math.max(1, (x1 - x0) / 2)
  const light = shade(color, 0.22)
  const dark = shade(color, -0.22)
  let top = yBot
  for (let x = x0; x <= x1; x++) {
    const t = Math.abs(x - mid) / half
    let y = yBot - rise + Math.round(t ** 1.35 * rise)
    if (t > 0.82) y -= 3 // the eave tips, turned up
    y = Math.max(limit, y)
    top = Math.min(top, y)
    pc.vline(x, y, yBot, color)
    pc.px(x, y, light)
    pc.px(x, yBot, dark)
  }
  const m = Math.round(mid)
  pc.hline(m - 1, m + 1, Math.max(limit, yBot - rise), light)
  if (finial && top - 1 >= limit) {
    pc.px(m, top - 1, finial)
    return top - 1
  }
  return top
}

/** An opening with a pointed head: a mithril frame, glass, and an arch over it. */
function leafPane(pc, x, y, w, h, lit) {
  const glass = lit ? P.windowLit : P.window
  box(pc, x, y + 1, x + w - 1, y + h - 1, P.mithrilDark)
  box(pc, x + 1, y + 2, x + w - 2, y + h - 2, glass)
  if (lit && w > 4 && h > 4) box(pc, x + 2, y + 3, x + w - 3, y + h - 3, P.windowLitCore)
  else if (!lit) pc.px(x + 1, y + 2, P.windowShine)
  const mid = Math.round(x + (w - 1) / 2)
  pc.hline(x + 1, x + w - 2, y, P.mithrilDark)
  pc.px(mid, y - 1, P.mithril)
  if (w >= 7) pc.vline(mid, y + 2, y + h - 2, P.mithrilDark)
}

/** A door under a pointed arch, its foot on `base`. */
function arched(pc, x, base, w, h, accent) {
  const mid = Math.round(x + (w - 1) / 2)
  box(pc, x, base - h + 1, x + w - 1, base, P.livewoodDark)
  box(pc, x + 1, base - h + 2, x + w - 2, base, P.livewood)
  for (let i = 0; i < 2; i++) pc.hline(x + 1 + i, x + w - 2 - i, base - h + 1 + i, P.livewoodDark)
  pc.px(mid, base - h, P.mithril)
  pc.px(x + w - 2, base - Math.floor(h / 2), accent) // the ring
  pc.vline(mid, base - h + 3, base - 1, P.livewoodDark)
}

/** A lantern hung from a bracket at (x, y), alight when the thread is. */
function hangLantern(pc, x, y, lit) {
  pc.px(x, y, P.mithril)
  pc.hline(x - 1, x + 1, y + 1, P.mithrilDark)
  box(pc, x - 1, y + 2, x + 1, y + 4, lit ? P.lanternGlow : P.mithrilLight)
  pc.px(x, y + 3, lit ? P.white : P.mithrilDark)
  pc.hline(x - 1, x + 1, y + 5, P.mithrilDark)
}

/** A bough of leaves, `r` across, centred on (cx, cy). */
function bough(pc, cx, cy, rx, ry, dark, mid, light) {
  pc.ellipse(cx, cy, rx, ry, mid)
  pc.ellipse(cx, cy + ry * 0.35, rx * 0.92, ry * 0.7, dark)
  pc.ellipse(cx - rx * 0.28, cy - ry * 0.34, rx * 0.5, ry * 0.42, light)
}

/** A trunk from `top` down to `base`, x0..x1, its bark furrowed and mossy on one side. */
function trunk(pc, x0, x1, top, base) {
  box(pc, x0, top, x1, base, P.livewood)
  pc.vline(x0, top, base, P.livewoodLight)
  pc.vline(x1, top, base, P.livewoodDark)
  for (let y = top; y <= base; y++) {
    if ((y + x0) % 4 === 0) pc.px(x0 + 2, y, P.livewoodDark)
    if ((y + x0) % 5 === 0) pc.px(x1 - 1, y, P.barkMoss)
  }
  // Roots spreading where it meets the ground.
  for (const [dx, dy] of [[-2, 0], [-1, -1], [1, -1], [2, 0]]) {
    pc.px(x0 + dx, base + dy, P.livewoodDark)
    pc.px(x1 - dx, base + dy, P.livewood)
  }
}

/** A ladder of pegs up a trunk. */
function pegs(pc, x, y0, y1) {
  for (let y = y1; y >= y0; y -= 3) pc.hline(x, x + 1, y, P.livewoodLight)
}

/**
 * The trellis a building stands in while it is being grown: living saplings bent and lashed with
 * cord, an upright at each end (and one between on a wide run), lashings every few rows, and a
 * spray of leaves at the top of each. It is the theme's scaffolding: nothing is nailed here.
 */
const LASH = 8
function trellis(pc, x0, x1, top, base) {
  const posts = x1 - x0 > 18 ? [x0, Math.round((x0 + x1) / 2), x1] : [x0, x1]
  for (const x of posts) {
    pc.vline(x, top, base, P.vine)
    pc.px(x, top, P.vineLight)
    pc.px(x - 1, top + 1, P.leaf)
    pc.px(x + 1, top + 2, P.leafLight)
    pc.hline(x - 1, x + 1, base, P.livewoodDark)
  }
  for (let y = base - LASH; y >= top + 3; y -= LASH) {
    pc.hline(x0, x1, y, P.vine)
    pc.hline(x0, x1, y + 1, P.vineLight)
    for (let x = x0 + 2; x <= x1; x += 5) pc.px(x, y, P.leafDark)
  }
}

// ---------- the ground being made ready ----------

function site(pc, rand, stage, oy, variant) {
  const Y = (y) => y + oy
  pc.ellipse(16, Y(43), 15.5, 4.5, P.moss)
  for (let i = 0; i < 16; i++) pc.px(2 + Math.floor(rand() * 28), Y(40 + Math.floor(rand() * 7)), P.leafDark)
  const left = variant % 2 === 0
  if (stage === 0) {
    // The ground asked and answered: a ring of white stones round the spot, and a sapling set in
    // the middle of it. Nothing is dug here until the tree has taken.
    for (const [dx, dy] of [[-12, 2], [-8, 4], [0, 5], [8, 4], [12, 2], [-10, -1], [10, -1], [0, -2]]) {
      pc.hline(16 + dx - 1, 16 + dx + 1, Y(42 + dy), P.paleStone)
      pc.hline(16 + dx - 1, 16 + dx + 1, Y(43 + dy), P.paleStoneDark)
    }
    const sx = left ? 13 : 18
    pc.vline(sx, Y(34), Y(43), P.livewood)
    pc.px(sx, Y(34), P.livewoodLight)
    bough(pc, sx, Y(31), 4, 3.5, P.leafDark, P.leaf, P.leafLight)
    pc.hline(sx - 3, sx + 3, Y(43), P.livewoodDark)
    return
  }
  // The tree has taken: it is bent and lashed into the arch the walls will grow up, and the floor
  // is laid in pale stone with a line of runes cut round it.
  box(pc, 4, Y(40), 27, Y(43), P.paleStone)
  pc.hline(4, 27, Y(40), P.paleStoneLight)
  pc.hline(4, 27, Y(43), P.paleStoneDark)
  for (let x = 6; x <= 26; x += 4) pc.px(x, Y(42), P.rune)
  for (const x of [7, 24]) {
    pc.vline(x, Y(28), Y(40), P.vine)
    pc.px(x, Y(28), P.vineLight)
  }
  pc.hline(7, 24, Y(28), P.vine)
  pc.hline(7, 24, Y(29), P.vineLight)
  for (let x = 8; x <= 24; x += 3) pc.px(x, Y(28), P.leafDark)
  const bx = left ? 19 : 8
  // Cut stone waiting to be set, and a coil of cord on top of it.
  box(pc, bx, Y(36), bx + 6, Y(39), P.paleStone)
  pc.hline(bx, bx + 6, Y(36), P.paleStoneLight)
  pc.hline(bx, bx + 6, Y(38), P.carving)
  pc.hline(bx + 2, bx + 4, Y(35), P.vine)
}

// ---------- talan: a home built into a living tree ----------

function talanSpec(variant, wall = 0, low = false) {
  const r = specRand('talan', variant)
  const material = materialOf(r, wall)
  const base = 46
  const deckY = low ? base - 7 : base - 16
  const wallTop = deckY - 13
  const doorLeft = r() < 0.5
  const balcony = r() < 0.6
  const tone = Math.floor(r() * 3)
  return { material, base, deckY, wallTop, doorLeft, balcony, tone, low }
}

function talan(pc, o) {
  const s = talanSpec(o.variant, o.wall, o.low)
  const lim = ceiling(o.low)
  // The tree the house is built on, up through the middle of it and out of the roof above.
  trunk(pc, 13, 18, s.wallTop - 2, s.base)
  pegs(pc, 11, s.deckY + 2, s.base - 2)
  // The deck: boards out over the boughs, on brackets, with a rail round it.
  box(pc, 3, s.deckY, 28, s.deckY + 2, P.livewood)
  pc.hline(3, 28, s.deckY, P.livewoodLight)
  pc.hline(3, 28, s.deckY + 2, P.livewoodDark)
  for (const x of [5, 26]) pc.line(x, s.deckY + 3, x + (x < 16 ? 3 : -3), s.deckY + 7, P.livewoodDark)
  pc.hline(3, 28, s.deckY + 3, P.shadow)
  if (s.balcony) for (let x = 4; x <= 27; x += 3) pc.vline(x, s.deckY - 3, s.deckY - 1, P.mithrilDark)
  // The house on the deck.
  wallOf(pc, 5, s.wallTop, 26, s.deckY - 1, s.material, o.rand)
  const doorX = s.doorLeft ? 7 : 20
  arched(pc, doorX, s.deckY - 1, 5, 9, o.accent)
  leafPane(pc, s.doorLeft ? 15 : 9, s.wallTop + 3, 8, 6, o.lit)
  hangLantern(pc, s.doorLeft ? 14 : 19, s.deckY - 10, o.lit)
  if (!o.roof) return { x0: 4, x1: 27, top: s.wallTop }
  const top = sweptRoof(pc, 2, 29, s.wallTop - 1, 11, roofOf(o.roofs, s.tone), P.mithrilLight, lim)
  // The tree carries on out of the roof, its crown over the whole thing. Its centre is kept a
  // full radius below the ceiling, or a crown drawn down the side of a courtyard would spill
  // onto the doorstep of the house above.
  bough(pc, 16, Math.max(lim + 6, top + 2), 11, 5, P.leafDark, P.leaf, P.leafLight)
  bough(pc, 6, Math.max(lim + 5, top + 6), 6, 4, P.leafDark, P.leaf, P.leafLight)
  return null
}

// ---------- bower: a small woven house under its own canopy ----------

function bowerSpec(low = false) {
  const base = 46
  const wallTop = low ? base - 13 : base - 16
  // The smoke hole sits on the roof's slope above the hearth, which is the right-hand wall.
  return { base, wallTop, smokeY: Math.max(DOORSTEP_CLEAR + 2, wallTop - 8) }
}

function bower(pc, o) {
  const s = bowerSpec(o.low)
  const lim = ceiling(o.low)
  const r = specRand('bower', o.variant)
  const material = materialOf(r, o.wall)
  const tone = Math.floor(r() * 3)
  const doorLeft = r() < 0.5
  wallOf(pc, 4, s.wallTop, 27, s.base, material, o.rand)
  pc.hline(4, 27, s.base, P.livewoodDark)
  const doorX = doorLeft ? 6 : 21
  arched(pc, doorX, s.base - 1, 5, 10, o.accent)
  leafPane(pc, doorLeft ? 14 : 8, s.wallTop + 4, 6, 6, o.lit)
  leafPane(pc, doorLeft ? 21 : 15, s.wallTop + 4, 5, 5, o.lit)
  hangLantern(pc, doorLeft ? 12 : 19, s.base - 12, o.lit)
  // A stack of round stones at the gable end, where the hearth is.
  for (let y = s.wallTop; y <= s.base - 2; y += 2) {
    pc.hline(21, 24, y, P.runestone)
    pc.hline(21, 24, y + 1, P.runestoneDark)
  }
  if (!o.roof) return { x0: 3, x1: 28, top: s.wallTop }
  const top = sweptRoof(pc, 1, 30, s.wallTop - 1, 12, roofOf(o.roofs, tone), P.mithrilLight, lim)
  // The smoke hole, ringed in stone, and a bough leaning over the roof.
  pc.hline(21, 23, s.smokeY, P.runestone)
  pc.hline(21, 23, s.smokeY + 1, P.runestoneDark)
  bough(pc, 6, Math.max(lim + 5, top + 2), 6, 4, P.leafDark, P.leaf, P.leafLight)
  return null
}

// ---------- pavilion: an open hall to trade under ----------

function pavilion(pc, o) {
  const r = specRand('pavilion', o.variant)
  const material = materialOf(r, o.wall)
  const tone = Math.floor(r() * 3)
  const base = 46
  const eave = o.low ? base - 18 : base - 24
  const lim = ceiling(o.low)
  // A low back wall, and slender posts holding the canopy up along the front.
  wallOf(pc, 4, eave + 4, 27, base - 1, material, o.rand)
  pc.hline(4, 27, base, P.paleStoneDark)
  for (const x of [4, 15, 27]) {
    pc.vline(x, eave + 1, base - 1, P.livewood)
    pc.vline(x + (x === 27 ? -1 : 1), eave + 1, base - 1, P.livewoodDark)
    pc.hline(x - 1, x + 1, base, P.paleStone)
  }
  // The counter, and what is laid out on it.
  box(pc, 6, base - 9, 25, base - 7, P.livewoodLight)
  pc.hline(6, 25, base - 7, P.livewoodDark)
  for (let i = 0; i < 5; i++) {
    const x = 8 + i * 4
    pc.hline(x, x + 1, base - 10, [P.briarBloom, P.acorn, P.shard, P.weaveLight, P.petalFall][i])
    pc.px(x, base - 11, [P.leaf, P.trunk, P.shardDark, P.weave, P.petalFallDark][i])
  }
  leafPane(pc, 8, eave + 6, 6, 5, o.lit)
  leafPane(pc, 19, eave + 6, 6, 5, o.lit)
  hangLantern(pc, 10, eave + 2, o.lit)
  hangLantern(pc, 21, eave + 2, o.lit)
  if (!o.roof) return { x0: 3, x1: 28, top: eave }
  sweptRoof(pc, 0, 31, eave, 12, roofOf(o.roofs, tone), o.accent, lim)
  // A valance of cloth along the eaves, in the plot's colour.
  for (let x = 1; x <= 30; x += 2) pc.px(x, eave + 1, o.accent)
  return null
}

// ---------- longhall: a carved hall for a whole household ----------

function longhall(pc, o) {
  const r = specRand('longhall', o.variant)
  const material = materialOf(r, o.wall)
  const tone = Math.floor(r() * 3)
  const base = 46
  const wallTop = o.low ? base - 14 : base - 19
  const lim = ceiling(o.low)
  wallOf(pc, 2, wallTop, 29, base, material, o.rand)
  pc.hline(2, 29, base, P.carving)
  // A carved doorway in the middle, with a band of runes over it.
  arched(pc, 13, base - 1, 6, 12, o.accent)
  for (let x = 4; x <= 27; x += 3) pc.px(x, wallTop + 2, P.rune)
  pc.hline(2, 29, wallTop + 1, P.carving)
  for (const x of [4, 22]) leafPane(pc, x, wallTop + 5, 6, 6, o.lit)
  hangLantern(pc, 11, base - 15, o.lit)
  hangLantern(pc, 21, base - 15, o.lit)
  if (!o.roof) return { x0: 1, x1: 30, top: wallTop }
  const color = roofOf(o.roofs, tone)
  const top = sweptRoof(pc, 0, 31, wallTop - 1, 10, color, P.mithrilLight, lim)
  // A carved leaf on each of the turned-up eaves, where a hall of any standing has one.
  for (const x of [1, 30]) pc.px(x, Math.max(lim, wallTop - 5), P.mithrilLight)
  return top && null
}

// ---------- spire: a tall slender tower with a banner on it ----------

function spire(pc, o) {
  const r = specRand('spire', o.variant)
  const material = materialOf(r, o.wall)
  const tone = Math.floor(r() * 3)
  const base = 58
  // The shaft starts low enough that the cone and the mast above it both fit in 60 rows.
  const shaftTop = 24
  wallOf(pc, 10, shaftTop, 21, base, material, o.rand)
  // The foot spreads, so a tower this thin does not look pushed into the ground.
  wallOf(pc, 7, base - 7, 24, base, material, o.rand)
  pc.hline(7, 24, base, P.carving)
  arched(pc, 13, base - 1, 6, 10, o.accent)
  for (const y of [28, 36]) leafPane(pc, 12, y, 8, 6, o.lit)
  // A gallery, out on brackets, above the door.
  const gallery = 46
  box(pc, 7, gallery, 24, gallery + 1, P.livewood)
  pc.hline(7, 24, gallery, P.livewoodLight)
  for (let x = 8; x <= 24; x += 3) pc.vline(x, gallery - 3, gallery - 1, P.mithrilDark)
  hangLantern(pc, 9, gallery + 2, o.lit)
  hangLantern(pc, 22, gallery + 2, o.lit)
  if (!o.roof) return { x0: 6, x1: 25, top: shaftTop }
  const color = roofOf(o.roofs, tone)
  // A swept eave over the shaft, and the spire itself tapering to a point above it.
  sweptRoof(pc, 4, 27, shaftTop - 1, 6, color)
  for (let i = 0; i < 10; i++) {
    const half = Math.max(0, 5 - Math.round(i * 0.55))
    pc.hline(15 - half, 16 + half, shaftTop - 8 - i, i % 3 === 0 ? shade(color, 0.22) : color)
  }
  // The mast and the banner on it, which is what moves between the two frames.
  pc.vline(16, 2, shaftTop - 17, P.mithril)
  pc.px(16, 2, P.mithrilLight)
  const swing = o.frame % 2
  for (let i = 0; i < 5; i++) {
    const x = 17 + i
    pc.vline(x, 3 + (swing ? i % 2 : Math.floor(i / 2)), 6 + (swing ? Math.floor(i / 2) : i % 2), o.accent)
  }
  return null
}

// ---------- forge: the smith's, under a stone stack ----------

function forgeSpec(low = false) {
  const base = 46
  const wallTop = low ? base - 15 : base - 18
  return { base, wallTop, stackTop: Math.max(DOORSTEP_CLEAR + 1, wallTop - 12) }
}

function forge(pc, o) {
  const s = forgeSpec(o.low)
  const lim = ceiling(o.low)
  const r = specRand('forge', o.variant)
  const material = materialOf(r, o.wall)
  const tone = Math.floor(r() * 3)
  wallOf(pc, 4, s.wallTop, 27, s.base, material, o.rand)
  pc.hline(4, 27, s.base, P.carving)
  // The forge mouth, open to the yard: coals, and the light they throw.
  box(pc, 16, s.base - 9, 25, s.base - 1, P.interior)
  pc.hline(16, 25, s.base - 9, P.runestoneDark)
  box(pc, 18, s.base - 4, 23, s.base - 2, o.lit ? P.lanternGlow : P.rust)
  pc.hline(19, 22, s.base - 5, o.lit ? P.white : P.rustDark)
  arched(pc, 6, s.base - 1, 5, 10, o.accent)
  leafPane(pc, 11, s.wallTop + 4, 5, 5, o.lit)
  // The stack: stone laid in courses, out of the roof and above it.
  for (let y = s.stackTop; y <= s.wallTop + 6; y += 2) {
    pc.hline(5, 9, y, P.runestone)
    pc.hline(5, 9, y + 1, P.runestoneDark)
  }
  pc.hline(4, 10, s.stackTop, P.runestoneLight)
  // The anvil, out in front where the work is done.
  box(pc, 13, s.base - 4, 16, s.base - 3, P.metalDark)
  pc.hline(12, 17, s.base - 5, P.metal)
  pc.hline(13, 16, s.base - 2, P.livewoodDark)
  if (!o.roof) return { x0: 3, x1: 28, top: s.wallTop }
  sweptRoof(pc, 2, 29, s.wallTop - 1, 9, roofOf(o.roofs, tone), null, lim)
  // The stack is drawn again over the roof, so it reads as going through it.
  for (let y = s.stackTop; y <= s.wallTop; y += 2) {
    pc.hline(5, 9, y, P.runestone)
    pc.hline(5, 9, y + 1, P.runestoneDark)
  }
  pc.hline(4, 10, s.stackTop, P.runestoneLight)
  return null
}

// ---------- wellspring: a spring under a carved arch ----------

function wellspring(pc, o) {
  const r = specRand('wellspring', o.variant)
  const tone = Math.floor(r() * 3)
  const base = 46
  const top = o.low ? base - 20 : base - 24
  const lim = ceiling(o.low)
  // The basin, cut from one stone and wide enough to sit on the edge of.
  box(pc, 4, base - 7, 27, base, P.paleStone)
  pc.hline(4, 27, base - 7, P.paleStoneLight)
  pc.hline(4, 27, base, P.paleStoneDark)
  for (let x = 6; x <= 25; x += 3) pc.px(x, base - 3, P.carving)
  box(pc, 7, base - 6, 24, base - 3, P.water)
  pc.hline(7, 24, base - 6, P.waterLight)
  // Where the fall lands: rings going out from it.
  for (const [x, y] of [[12, base - 5], [19, base - 4], [9, base - 4]]) pc.hline(x, x + 2, y, P.waterGlint)
  // Two heavy piers and the arch they carry.
  for (const x of [5, 22]) {
    box(pc, x, top + 5, x + 4, base - 8, P.paleStone)
    pc.vline(x, top + 5, base - 8, P.paleStoneLight)
    pc.vline(x + 4, top + 5, base - 8, P.paleStoneDark)
    for (let y = top + 8; y < base - 9; y += 4) pc.hline(x, x + 4, y, P.carving)
  }
  for (let i = 0; i < 6; i++) {
    pc.hline(5 + i, 26 - i, top + 5 - i, i ? P.paleStone : P.paleStoneLight)
    if (i === 5) pc.hline(10, 21, top, P.paleStoneDark)
  }
  for (let x = 8; x <= 23; x += 3) pc.px(x, top + 4, P.rune)
  // The spring falling from under the arch into the basin: three columns of it, broken by light.
  for (let y = top + 6; y < base - 6; y++) {
    pc.px(15, y, y % 3 ? P.water : P.waterLight)
    pc.px(16, y, y % 4 ? P.waterLight : P.waterGlint)
    pc.px(17, y, y % 3 === 1 ? P.waterDeep : P.water)
  }
  hangLantern(pc, 3, base - 18, o.lit)
  if (!o.roof) return { x0: 4, x1: 27, top: top + 4 }
  sweptRoof(pc, 2, 29, top + 3, 8, roofOf(o.roofs, tone), P.mithrilLight, lim)
  return null
}

// ---------- arbour: vines and herbs under a low frame ----------

function arbour(pc, o) {
  const r = specRand('arbour', o.variant)
  const tone = Math.floor(r() * 3)
  const base = 46
  const top = base - 16
  // Four beds of herbs and vines, edged in pale stone, the dark earth showing between the rows.
  for (let row = 0; row < 4; row++) {
    const y = base - row * 4
    pc.hline(1, 30, y - 3, P.soil)
    pc.hline(1, 30, y - 2, P.soil)
    pc.hline(1, 30, y - 1, P.paleStoneDark)
    pc.hline(1, 30, y, P.paleStone)
    for (let x = 2 + (row % 2); x <= 29; x += 3) {
      pc.vline(x, y - 4, y - 2, row % 2 ? P.vine : P.cropDark)
      pc.px(x + 1, y - 3, row % 2 ? P.vineLight : P.crop)
      pc.px(x - 1, y - 2, row % 2 ? P.leaf : P.crop)
    }
  }
  // The frame the vines are trained up, along the back.
  for (let x = 2; x <= 29; x += 5) {
    pc.vline(x, top + 2, base - 14, P.livewood)
    pc.px(x, top + 2, P.livewoodLight)
  }
  pc.hline(2, 29, top + 2, P.livewoodDark)
  if (!o.roof) return { x0: 1, x1: 30, top: top + 2 }
  // The vines over the frame, and the fruit on them: this is what goes on last here.
  for (let x = 1; x <= 30; x++) {
    pc.px(x, top, (x % 3) ? P.leaf : P.leafDark)
    pc.px(x, top + 1, (x % 4) ? P.leafLight : P.leaf)
  }
  for (let x = 4; x <= 28; x += 6) pc.px(x, top + 2, roofOf(o.roofs, tone))
  return null
}

// ---------- mallorn: a great tree with homes in its crown ----------

function mallorn(pc, o) {
  const r = specRand('mallorn', o.variant)
  const tone = Math.floor(r() * 3)
  const base = 58
  const color = roofOf(o.roofs, tone)
  trunk(pc, 12, 19, 10, base)
  pegs(pc, 10, 24, base - 2)
  // Two flets out on the boughs, one either side, and a stair between them.
  for (const [x0, x1, y] of [[2, 12, 34], [19, 29, 24]]) {
    box(pc, x0, y, x1, y + 1, P.livewood)
    pc.hline(x0, x1, y, P.livewoodLight)
    wallOf(pc, x0 + 1, y - 9, x1 - 1, y - 1, MATERIALS[(o.wall || 0) % MATERIALS.length], o.rand)
    leafPane(pc, x0 + 3, y - 7, 5, 5, o.lit)
    hangLantern(pc, x1 - 2, y + 2, o.lit) // hung under the flet, where a lantern hangs on a tree
  }
  if (!o.roof) return { x0: 1, x1: 30, top: 14 }
  for (const [x0, x1, y] of [[2, 12, 34], [19, 29, 24]]) sweptRoof(pc, x0, x1, y - 10, 6, shade(color, 0.12), P.mithrilLight)
  // The crown: three boughs of the tree's own colour over everything.
  bough(pc, 16, 10, 15, 7, shade(color, -0.25), color, shade(color, 0.25))
  bough(pc, 7, 20, 7, 4, shade(color, -0.25), color, shade(color, 0.25))
  bough(pc, 25, 14, 7, 4, shade(color, -0.25), color, shade(color, 0.25))
  return null
}

// ---------- crystalhouse: a growing house glazed in crystal ----------

function crystalhouse(pc, o) {
  const r = specRand('crystalhouse', o.variant)
  const tone = Math.floor(r() * 3)
  const base = 46
  const eave = o.low ? base - 17 : base - 22
  const lim = ceiling(o.low)
  // A low plinth of pale stone, and crystal in a mithril net above it.
  box(pc, 3, base - 4, 28, base, P.paleStone)
  pc.hline(3, 28, base - 4, P.paleStoneLight)
  pc.hline(3, 28, base, P.paleStoneDark)
  wallOf(pc, 3, eave, 28, base - 5, 'crystal', o.rand)
  // What is growing inside, seen through the glass.
  for (let x = 5; x <= 27; x += 4) {
    pc.vline(x, base - 10, base - 6, o.lit ? P.crop : P.cropDark)
    pc.px(x - 1, base - 10, P.leaf)
    pc.px(x + 1, base - 9, P.leafDark)
  }
  if (o.lit) for (let x = 6; x <= 26; x += 7) pc.px(x, eave + 3, P.lanternGlow)
  // The door: two leaves of crystal in a mithril frame.
  box(pc, 13, base - 12, 18, base - 1, P.mithrilDark)
  box(pc, 14, base - 11, 17, base - 1, o.lit ? P.windowLit : P.glass)
  pc.vline(16, base - 11, base - 1, P.mithrilDark)
  if (!o.roof) return { x0: 2, x1: 29, top: eave }
  const top = sweptRoof(pc, 1, 30, eave - 1, 9, roofOf(o.roofs, tone), P.mithrilLight, lim)
  // A ridge light of crystal along the top, so the sun gets in from above too.
  for (let x = 10; x <= 21; x += 2) pc.px(x, Math.max(lim, top + 3), P.glassLight)
  return null
}

// ---------- stand: a small stand under a leaf awning ----------

function stand(pc, o) {
  const r = specRand('stand', o.variant)
  const tone = Math.floor(r() * 3)
  const base = 46
  const eave = base - 20
  const lim = ceiling(o.low)
  for (const x of [6, 25]) {
    pc.vline(x, eave + 1, base - 1, P.livewood)
    pc.vline(x + (x < 16 ? 1 : -1), eave + 1, base - 1, P.livewoodDark)
    pc.hline(x - 1, x + 1, base, P.paleStoneDark)
  }
  // The board, and the baskets on and under it.
  box(pc, 5, base - 10, 26, base - 8, P.livewoodLight)
  pc.hline(5, 26, base - 8, P.livewoodDark)
  for (let i = 0; i < 4; i++) {
    const x = 7 + i * 5
    box(pc, x, base - 13, x + 3, base - 11, P.weave)
    pc.hline(x, x + 3, base - 13, P.weaveLight)
    pc.hline(x, x + 3, base - 14, [P.briarBloom, P.fruit, P.acorn, P.shard][i])
  }
  box(pc, 8, base - 4, 12, base - 1, P.weaveDark)
  pc.hline(8, 12, base - 4, P.weave)
  hangLantern(pc, 16, eave + 3, o.lit)
  if (!o.roof) return { x0: 5, x1: 26, top: eave + 1 }
  const top = sweptRoof(pc, 3, 28, eave, 8, roofOf(o.roofs, tone), o.accent, lim)
  // Leaves laid over the awning, which is what keeps the sun off a stand like this.
  for (let x = 4; x <= 27; x += 2) pc.px(x, Math.max(lim, top + 3), x % 4 ? P.leaf : P.leafDark)
  return null
}

// ---------- drawing one ----------

const KINDS = { talan, bower, pavilion, longhall, spire, forge, wellspring, arbour, mallorn, crystalhouse, stand }
/** Nothing to grow up: these need no trellis. */
const NO_TRELLIS = new Set(['wellspring', 'arbour', 'stand'])

/**
 * @param {{ kind: string, stage: number, accent: string, variant: number, lit: boolean, frame?: number, wall?: number, roofs?: number, low?: boolean, wear?: number }} o
 */
export function drawElfBuilding(o) {
  const kind = KINDS[o.kind] ? o.kind : 'bower'
  const variant = o.variant || 0
  const H = heightOf(kind)
  const pc = new PixelCanvas(BUILDING_W, H)
  const seed = variant * 6151 + 29
  if (o.stage <= 1) {
    site(pc, mulberry32(seed), o.stage, H - 48, variant)
    return pc.outline(P.outline)
  }
  const draw = KINDS[kind]
  const frameNo = o.frame || 0
  const opts = {
    rand: mulberry32(seed), accent: o.accent || P.elfRoof[0], lit: Boolean(o.lit), roof: o.stage >= 3, frame: frameNo, variant,
    wall: o.wall || 0, roofs: o.roofs || 0, low: Boolean(o.low),
  }
  const sc = draw(pc, opts)
  if (o.stage === 2 && !NO_TRELLIS.has(kind) && sc) {
    trellis(pc, sc.x0, sc.x1, Math.max(ceiling(opts.low), sc.top), H - 2)
  }
  const look = o.stage >= 3 ? lookFor(o.wear ?? KEPT) : null
  if (look) {
    // As the village's: roof told from walls by the building drawn without it, whatever moves
    // between frames left alone, every drawing given the same texture stream as the first.
    const again = (roof, f) => {
      const other = new PixelCanvas(BUILDING_W, H)
      draw(other, { ...opts, rand: mulberry32(seed), roof, frame: f })
      return other
    }
    const frames = buildingFrames(kind, o.stage)
    const others = []
    for (let f = 0; f < frames; f++) if (f !== frameNo % frames) others.push(again(true, f))
    weather(pc, again(false, 0), look, variant, others)
  }
  return pc.outline(P.outline)
}

// The parts the realm's landmarks are grown from too (see landmarks.js).
export { box, roofOf, MATERIALS, wallOf, sweptRoof, leafPane, arched, hangLantern, bough, trunk, trellis, site }
