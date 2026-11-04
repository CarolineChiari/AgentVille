// Christmas buildings: what each thread builds in a village in the snow, drawn the way the village's
// buildings are (src/render/sprites/buildings.js): the plot's wall material and paint family on
// them, its accent on the doors and awnings, and a finished one weathered by its wear.
//
// Contract (see ThemePack in ../index.js and the village's src/render/sprites/buildings.js):
// - A thread's building kind (KINDS in src/sim/building.js) maps to a Christmas kind through `fitted`.
// - Every sprite is BUILDING_W (32) wide and 48 tall, its bottom row on the ground. Down a
//   courtyard's sides (`fitted(kind, variant, false)`) nothing is drawn above row DOORSTEP_CLEAR
//   (9), outline included, at every stage: the villager at the door of the house above stands there.
// - Stages 0 and 1 are the ground being made ready; 2 is the building without its roof
//   (`roof: false`) inside a staging of poles and ladders; 3 is finished. Stage 3 is weathered by
//   `wear` exactly as the village's buildings are (see drawBuilding there).
// - `wall` indexes THEMES.christmas.dims.wall; `roofs` its paint families; `accent` is the
//   plot's colour, for doors and awnings. Every colour from the palette.
//
// Windows keep the village's glass colours and its warm lit yellow: the weathering pass finds
// windows by those exact colours (GLASS_COLORS in weathering.js). The candle on a sill is drawn
// under the window, so it never touches the glass.
//
// The framing parts (a window, a door, a pitched roof, the poles of the staging) are the farm's
// own: a village in the snow is built by the same carpenters. What is drawn here is the season on them.
//
// Left out on purpose: the figures of a nativity. The chapel has a lit star over its door and a
// bare stable beside it, and no figures, which would be only a few pixels each.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { BUILDING_W, DOORSTEP_CLEAR, drawGradeTrim } from '../../sprites/buildings.js'
import { lookFor, weather } from '../../sprites/weathering.js'
import { mulberry32, pick, rngFor } from '../../../sim/rng.js'
import { THEMES } from '../../../sim/themes.js'
import { KEPT } from '../../../sim/wear.js'
import { box, doorOf, paneOf, roofOver, staging } from '../farm/buildings.js'

/** A thread's building, by its kind, in a village in the snow. */
export const XMAS_KINDS = {
  house: 'cottage', cottage: 'cottage', shop: 'stall', barn: 'workshop', windmill: 'workshop',
  workshop: 'workshop', well: 'tree', farm: 'workshop', tower: 'chapel', greenhouse: 'stall', stall: 'stall',
}
const MATERIALS = THEMES.christmas.dims.wall
/**
 * The paint a plot's buildings share, by its `roofs`: three related colours each, as indices into
 * the palette's xmasPaint (red, pine, gold, candy pink, cream, gingerbread, midnight, frost). One
 * family per sub-theme, which is what tells one street from the next.
 */
const PAINT_FAMILIES = [[0, 1, 4], [1, 0, 4], [2, 0, 4], [3, 5, 4]]
/** The cream every trim, sill and window frame is painted. */
const TRIM = P.xmasPaint[4]
const HEIGHT = 48
/** The highest row anything may be drawn on, leaving the outline its row above. */
const ceiling = (low) => (low ? DOORSTEP_CLEAR + 1 : 1)

export function fitted(kind, variant, roomy) {
  return { kind: XMAS_KINDS[kind] || 'cottage', low: !roomy }
}

export const heightOf = () => HEIGHT

/** A tree and a market stall stand as wide as their plot; the rest a little narrower. */
export function shadowOf(kind) {
  return kind === 'tree' ? 30 : 34
}

/** Nothing here moves: the smoke does that. */
export const buildingFrames = () => 1

/** Where smoke leaves a finished building: the cottage's and the workshop's stacks, the stall's stove. */
export function chimneyOf(kind, variant = 0, wall = 0, roofs = 0, low = false) {
  if (kind === 'cottage') return { x: 25, y: cottageSpec(low).stackTop }
  if (kind === 'workshop') return { x: 24, y: workshopSpec(low).stackTop }
  if (kind === 'stall') return { x: 24, y: stallSpec(low).stackTop }
  return null
}

// ---------- shared parts ----------

const specRand = (kind, variant) => rngFor(`xmas:${kind}:${variant}`)
/** A roof's or an awning's paint: the first two of the family; the cream is for trim. */
const roofPaintOf = (roofs, i) => {
  const f = PAINT_FAMILIES[(roofs || 0) % PAINT_FAMILIES.length]
  return P.xmasPaint[f[Math.abs(Math.floor(i)) % 2]]
}
const materialOf = (r, wall) => (r() < 0.7 ? MATERIALS[(wall || 0) % MATERIALS.length] : pick(r, MATERIALS))
const BULBS = [P.xmasHolly, P.xmasBulbYellow, P.xmasBulbBlue, P.xmasCandyGreen]

/** A wall of one of the theme's five materials, x0..x1 by y0..y1. */
function wallOf(pc, x0, y0, x1, y1, material, rand) {
  if (material === 'planks') {
    // Upright pine boards, a seam every fourth column, a knot or two.
    box(pc, x0, y0, x1, y1, P.xmasPlank)
    for (let x = x0; x <= x1; x++) {
      if ((x - x0) % 4 === 3) pc.vline(x, y0, y1, P.xmasPlankDark)
      else if ((x - x0) % 4 === 0) pc.vline(x, y0, y1, P.xmasPlankLight)
    }
    for (let i = 0; i < 4; i++) pc.px(x0 + 1 + Math.floor(rand() * (x1 - x0 - 1)), y0 + 2 + Math.floor(rand() * (y1 - y0 - 3)), P.xmasPlankDark)
  } else if (material === 'logs') {
    // Round logs laid in courses, each lit along its top and shaded below, the ends showing.
    box(pc, x0, y0, x1, y1, P.xmasLog)
    for (let y = y0; y <= y1; y++) {
      const row = (y - y0) % 4
      if (row === 0) pc.hline(x0, x1, y, P.xmasLogLight)
      else if (row === 3) pc.hline(x0, x1, y, P.xmasLogDark)
    }
    for (let y = y0 + 1; y <= y1; y += 4) {
      pc.px(x0, y, P.xmasLogLight)
      pc.px(x1, y + 1, P.xmasLogDark)
    }
  } else if (material === 'gingerbread') {
    // Biscuit, with a line of icing piped along the top in loops and gumdrops pressed into it.
    box(pc, x0, y0, x1, y1, P.xmasGinger)
    pc.hline(x0, x1, y1 - 1, P.xmasGingerDark)
    pc.vline(x0, y0, y1, P.xmasGingerLight)
    for (let x = x0; x <= x1; x++) pc.px(x, y0 + (x % 3 === 0 ? 1 : 0), P.xmasIcing)
    for (let i = 0; i < 6; i++) {
      pc.px(x0 + 2 + Math.floor(rand() * (x1 - x0 - 3)), y0 + 4 + Math.floor(rand() * Math.max(1, y1 - y0 - 6)), [P.xmasCandyRed, P.xmasGumdrop, P.xmasCandyGreen][i % 3])
    }
  } else if (material === 'icing') {
    // White icing, smooth, with a blue shadow along the bottom and sugar sprinkles.
    box(pc, x0, y0, x1, y1, P.xmasIcing)
    pc.hline(x0, x1, y1 - 1, P.xmasIcingDark)
    pc.hline(x0, x1, y1 - 2, P.xmasIcingDark)
    pc.vline(x1, y0, y1, P.xmasIcingDark)
    for (let i = 0; i < 8; i++) pc.px(x0 + Math.floor(rand() * (x1 - x0 + 1)), y0 + 1 + Math.floor(rand() * (y1 - y0 - 3)), [P.xmasCandyRed, P.xmasMint, P.xmasPaint[3]][i % 3])
  } else {
    // Cold stone in even courses, each block lit along its top.
    box(pc, x0, y0, x1, y1, P.xmasStone)
    for (let y = y0; y <= y1; y++) {
      const row = y - y0
      const off = (Math.floor(row / 4) % 2) * 4
      for (let x = x0; x <= x1; x++) {
        const u = (x - x0 + off) % 8
        if (row % 4 === 3 || u === 7) pc.px(x, y, P.xmasStoneDark)
        else if (row % 4 === 0) pc.px(x, y, P.xmasStoneLight)
      }
    }
  }
  // Snow banked against the foot of every wall.
  for (let x = x0; x <= x1; x++) {
    pc.px(x, y1, P.xmasSnow)
    if (x % 3 !== 1) pc.px(x, y1 - 1, P.xmasSnowShade)
  }
}

/** Snow lying on a roof: down each column from the roof's top edge, two or three rows deep. */
function snowRoof(pc, x0, x1, lim, yBot) {
  for (let x = x0; x <= x1; x++) {
    for (let y = lim; y < yBot - 1; y++) {
      if (!pc.opaque(x, y)) continue
      pc.px(x, y, P.xmasSnow)
      pc.px(x, y + 1, P.xmasSnow)
      if (x % 3 !== 0) pc.px(x, y + 2, P.xmasSnowShade)
      break
    }
  }
  // A clump on each eave, where it slid.
  pc.px(x0, yBot, P.xmasSnow)
  pc.px(x1, yBot, P.xmasSnow)
  pc.px(x0 + 1, yBot, P.xmasSnow)
  pc.px(x1 - 1, yBot, P.xmasSnow)
}

/** A string of bulbs along row y from x0 to x1, one in every other column, sagging a pixel in the middle. */
function lightsAlong(pc, x0, x1, y) {
  for (let x = x0; x <= x1; x += 2) {
    const sag = Math.abs(x - (x0 + x1) / 2) < (x1 - x0) / 4 ? 1 : 0
    pc.px(x, y + sag, BULBS[((x - x0) >> 1) % BULBS.length])
  }
}

/** A wreath at (cx, cy), five across: fir with a red bow at its foot. */
function wreathAt(pc, cx, cy) {
  const ring = [[-1, -2], [0, -2], [1, -2], [-2, -1], [2, -1], [-2, 0], [2, 0], [-2, 1], [2, 1], [-1, 2], [1, 2]]
  ring.forEach(([dx, dy], i) => pc.px(cx + dx, cy + dy, i % 2 ? P.xmasFirLight : P.xmasFir))
  pc.px(cx, cy + 2, P.xmasHolly)
  pc.px(cx - 2, cy - 1, P.xmasHolly)
}

/** A candle on a sill under a window at (x, y), the sill's row: wax and a flame. */
function candleAt(pc, x, y) {
  pc.px(x, y - 1, P.xmasWax)
  pc.px(x, y - 2, P.flameTip)
}

/** A fir at (cx, y), its foot on row y, `h` rows tall: tiers of green under snow, lights in it. */
function firAt(pc, cx, y, h = 14) {
  const tiers = Math.max(2, Math.floor(h / 4))
  for (let t = 0; t < tiers; t++) {
    const ty = y - 2 - t * Math.floor((h - 3) / tiers)
    const half = Math.max(1, Math.round(((tiers - t) / tiers) * Math.min(5, h / 3)))
    for (let i = 0; i <= 3; i++) {
      const w = Math.min(half, Math.round((half * (i + 1)) / 4 + 0.5))
      pc.hline(cx - w, cx + w, ty - 3 + i, i % 2 ? P.xmasFir : P.xmasFirLight)
    }
    pc.hline(cx - half, cx + half, ty, P.xmasFirDark)
    pc.px(cx - half, ty - 1, P.xmasSnow)
    pc.px(cx - 1, ty - 3, P.xmasSnow)
  }
  pc.vline(cx, y - 1, y, P.xmasLogDark)
  pc.px(cx, y - h + 1, P.xmasBulbYellow)
  pc.px(cx + 1, y - Math.floor(h / 2), P.xmasHolly)
  pc.px(cx - 1, y - 4, P.xmasBulbBlue)
}

/** A wrapped present at x..x+w-1, its foot on row y: paper, a ribbon up the middle and across. */
function giftAt(pc, x, y, w, h, paper, ribbonC) {
  box(pc, x, y - h + 1, x + w - 1, y, paper)
  pc.hline(x, x + w - 1, y, shade(paper, -0.3))
  pc.vline(x, y - h + 1, y - 1, shade(paper, 0.25))
  const cx = x + Math.floor(w / 2)
  pc.vline(cx, y - h + 1, y, ribbonC)
  pc.hline(x, x + w - 1, y - Math.floor(h / 2), ribbonC)
  pc.px(cx - 1, y - h, ribbonC)
  pc.px(cx + 1, y - h, ribbonC)
}

/** A five-pointed gold star at (cx, cy), lit: three rows high, a point in the middle on top. */
function starAt(pc, cx, cy) {
  pc.px(cx, cy - 2, P.xmasBulbYellow)
  pc.hline(cx - 1, cx + 1, cy - 1, P.xmasBulbYellow)
  pc.hline(cx - 2, cx + 2, cy, P.xmasTinsel)
  pc.px(cx - 1, cy + 1, P.xmasTinsel)
  pc.px(cx + 1, cy + 1, P.xmasTinsel)
  pc.px(cx, cy, P.glowCandle)
}

// ---------- the ground being made ready ----------

function site(pc, rand, stage, oy, variant) {
  const Y = (y) => y + oy
  const [, shadeC, light, deep] = P.xmasGround[0]
  pc.ellipse(16, Y(43), 15.5, 4.5, shadeC)
  pc.ellipse(15, Y(42), 12, 2.8, P.xmasSnow)
  for (let i = 0; i < 12; i++) pc.px(2 + Math.floor(rand() * 28), Y(40 + Math.floor(rand() * 7)), i % 2 ? light : deep)
  // Baubles and tinsel scattered, whatever the ground.
  for (let i = 0; i < 8; i++) pc.px(2 + Math.floor(rand() * 28), Y(39 + Math.floor(rand() * 8)), [P.xmasHolly, P.xmasTinsel, P.xmasBulbBlue][i % 3])
  const left = variant % 2 === 0
  if (stage === 0) {
    // Cleared and marked out: stakes with a string of lights between them, a fir at one end and a
    // present or two waiting to be set down.
    for (const dx of [-13, -6, 0, 6, 13]) {
      pc.vline(16 + dx, Y(37), Y(43), P.xmasLog)
      pc.px(16 + dx, Y(37), P.xmasSnow)
    }
    lightsAlong(pc, 4, 28, Y(38))
    firAt(pc, left ? 26 : 5, Y(44), 12)
    giftAt(pc, left ? 8 : 20, Y(44), 5, 4, P.xmasPaint[0], P.xmasTinsel)
    giftAt(pc, left ? 14 : 15, Y(45), 4, 3, P.xmasPaint[6], P.xmasIcing)
    return
  }
  // The frame up: a sill on the ground, corner posts and a wall plate, studs between them, a
  // ladder against it and the boards stacked at its foot.
  box(pc, 4, Y(41), 27, Y(43), P.xmasLogDark)
  pc.hline(4, 27, Y(41), P.xmasLog)
  for (const x of [7, 24]) {
    box(pc, x, Y(27), x + 1, Y(41), P.xmasLog)
    pc.vline(x, Y(27), Y(41), P.xmasLogLight)
  }
  pc.hline(6, 26, Y(26), P.xmasLogLight)
  pc.hline(6, 26, Y(27), P.xmasLogDark)
  pc.hline(5, 28, Y(25), P.xmasSnow)
  for (let x = 11; x <= 21; x += 5) pc.vline(x, Y(28), Y(40), P.xmasLogDark)
  pc.line(8, Y(40), 23, Y(28), P.xmasLog)
  const lx = left ? 2 : 29
  const dx = left ? 1 : -1
  pc.line(lx, Y(43), lx + dx * 5, Y(24), P.xmasLogLight)
  pc.line(lx + dx, Y(43), lx + dx * 6, Y(24), P.xmasLog)
  for (let i = 0; i < 6; i++) {
    const t = i / 6
    pc.hline(lx + Math.round(dx * t * 5), lx + Math.round(dx * (1 + t * 5)), Y(42 - i * 3), P.xmasLogDark)
  }
  giftAt(pc, left ? 14 : 6, Y(44), 6, 4, P.xmasPaint[1], P.xmasTinsel)
  firAt(pc, left ? 26 : 5, Y(45), 8)
}

// ---------- cottage: deep snow on the roof, a candle in every window, a wreath on the door ----------

function cottageSpec(low = false) {
  const base = 46
  const wallTop = low ? base - 22 : base - 27
  return { base, wallTop, stackTop: Math.max(DOORSTEP_CLEAR + 1, wallTop - 12) }
}

function cottage(pc, o) {
  const s = cottageSpec(o.low)
  const lim = ceiling(o.low)
  const r = specRand('cottage', o.variant)
  const material = materialOf(r, o.wall)
  const tone = Math.floor(r() * 3)
  const doorLeft = r() < 0.5
  wallOf(pc, 4, s.wallTop, 27, s.base, material, o.rand)
  const dx = doorLeft ? 7 : 19
  doorOf(pc, dx, s.base - 1, 6, 11, o.accent)
  wreathAt(pc, dx + 3, s.base - 7)
  // Windows up and down, a candle on the sill of the one beside the door.
  const wx = doorLeft ? 18 : 6
  paneOf(pc, wx, s.base - 11, 7, 7, o.lit)
  candleAt(pc, wx + 3, s.base - 3)
  pc.px(wx + 2, s.base - 3, P.xmasFir)
  pc.px(wx + 4, s.base - 3, P.xmasHolly)
  paneOf(pc, 6, s.wallTop + 3, 6, 7, o.lit)
  paneOf(pc, 20, s.wallTop + 3, 6, 7, o.lit)
  // A little fir at the far end of the wall, and a lantern-bright lamp on the step.
  firAt(pc, doorLeft ? 29 : 2, s.base, 12)
  if (!o.roof) return { x0: 3, x1: 28, top: s.wallTop }
  const color = roofPaintOf(o.roofs, tone)
  const top = roofOver(pc, 1, 30, s.wallTop - 1, 11, color, lim)
  snowRoof(pc, 1, 30, lim, s.wallTop - 1)
  lightsAlong(pc, 3, 28, s.wallTop)
  // The stack at the gable end, of fieldstone, a cap of snow on it.
  for (let y = s.stackTop; y <= s.wallTop - 6; y++) {
    pc.hline(23, 27, y, (y - s.stackTop) % 3 === 2 ? P.fieldstoneDark : P.fieldstone)
    pc.px(23, y, P.fieldstoneLight)
  }
  pc.hline(22, 28, s.stackTop, P.xmasSnow)
  pc.hline(23, 27, s.stackTop + 1, P.xmasSnowShade)
  if (!o.low) paneOf(pc, 14, top + 6, 5, 4, o.lit)
  return null
}

// ---------- stall: a market hut with a striped awning, mugs of mulled wine and gingerbread on the counter ----------

function stallSpec(low = false) {
  const base = 46
  const wallTop = low ? base - 22 : base - 26
  return { base, wallTop, stackTop: Math.max(DOORSTEP_CLEAR + 1, wallTop - 10) }
}

function stall(pc, o) {
  const s = stallSpec(o.low)
  const lim = ceiling(o.low)
  const r = specRand('stall', o.variant)
  const material = r() < 0.7 ? 'planks' : materialOf(r, o.wall)
  const tone = Math.floor(r() * 3)
  const left = r() < 0.5
  wallOf(pc, 4, s.wallTop, 27, s.base, material, o.rand)
  // The open front of the stall: a dark hatch over a counter, lit from within when somebody is in.
  const wx = left ? 5 : 11
  const hatchTop = s.base - 15
  box(pc, wx, hatchTop, wx + 15, s.base - 7, o.lit ? P.windowLit : P.interior)
  if (o.lit) box(pc, wx + 2, hatchTop + 2, wx + 13, s.base - 9, P.windowLitCore)
  pc.hline(wx - 1, wx + 16, hatchTop - 1, P.xmasLogDark)
  pc.vline(wx - 1, hatchTop, s.base - 7, TRIM)
  pc.vline(wx + 16, hatchTop, s.base - 7, TRIM)
  // The counter, boarded at the front, with what is sold on it.
  box(pc, wx - 2, s.base - 7, wx + 17, s.base - 5, P.xmasPlankLight)
  pc.hline(wx - 2, wx + 17, s.base - 5, P.xmasPlankDark)
  // Mugs of mulled wine with a wisp of steam, and gingerbread hearts between.
  for (const [i, x] of [wx, wx + 4, wx + 11].entries()) {
    pc.rect(x, s.base - 10, 3, 3, i === 1 ? P.xmasPaint[4] : P.xmasHolly)
    pc.px(x + 3, s.base - 9, P.xmasIcing)
    pc.px(x + 1, s.base - 11, P.xmasSnowShade)
  }
  pc.hline(wx + 7, wx + 9, s.base - 8, P.xmasGinger)
  pc.px(wx + 7, s.base - 9, P.xmasGinger)
  pc.px(wx + 9, s.base - 9, P.xmasGinger)
  pc.px(wx + 8, s.base - 8, P.xmasCandyRed)
  // A small door at the other end, a wreath on it.
  const dx = left ? 23 : 5
  doorOf(pc, dx, s.base - 1, 4, 10, o.accent)
  wreathAt(pc, dx + 2, s.base - 6)
  if (!o.roof) return { x0: 3, x1: 28, top: s.wallTop }
  // The stove's flue at the back of the roof.
  for (let y = s.stackTop; y <= s.wallTop - 5; y++) {
    pc.hline(23, 26, y, (y - s.stackTop) % 3 === 2 ? P.farmIron : P.farmIronLight)
    pc.px(23, y, P.farmIron)
  }
  pc.hline(22, 27, s.stackTop, P.xmasSnow)
  roofOver(pc, 1, 30, s.wallTop - 1, 9, roofPaintOf(o.roofs, tone), lim)
  snowRoof(pc, 1, 30, lim, s.wallTop - 1)
  for (let y = s.stackTop; y <= s.wallTop - 8; y++) {
    pc.hline(23, 26, y, (y - s.stackTop) % 3 === 2 ? P.farmIron : P.farmIronLight)
    pc.px(23, y, P.farmIron)
  }
  pc.hline(22, 27, s.stackTop, P.xmasSnow)
  // The awning over the hatch, striped in the plot's colour and cream, fringed with snow.
  for (let x = wx - 2; x <= wx + 17; x++) {
    const c = ((x >> 1) & 1) ? o.accent : TRIM
    pc.px(x, hatchTop - 3, c)
    pc.px(x, hatchTop - 2, shade(c, -0.15))
    pc.px(x, hatchTop - 1, x % 2 ? shade(c, -0.3) : P.interior)
  }
  pc.hline(wx - 2, wx + 17, hatchTop - 4, P.xmasSnow)
  lightsAlong(pc, wx - 2, wx + 17, hatchTop - 5)
  return null
}

// ---------- workshop: toys in the loft, doors thrown open, a sleigh waiting outside ----------

function workshopSpec(low = false) {
  const base = 46
  const wallTop = low ? base - 20 : base - 24
  return { base, wallTop, stackTop: Math.max(DOORSTEP_CLEAR + 1, wallTop - 10) }
}

function workshop(pc, o) {
  const s = workshopSpec(o.low)
  const r = specRand('workshop', o.variant)
  const tone = Math.floor(r() * 3)
  const material = r() < 0.6 ? 'planks' : materialOf(r, o.wall)
  const lim = ceiling(o.low)
  const base = s.base
  const eave = s.wallTop
  const sleighLeft = r() < 0.5
  wallOf(pc, 3, eave, 28, base, material, o.rand)
  // The big doors, trimmed in cream with a cross brace on each leaf, the room lit behind them.
  const dy = base - 15
  const bx = sleighLeft ? 14 : 5
  box(pc, bx, dy, bx + 13, base - 1, P.xmasLogDark)
  for (const [x0, x1] of [[bx, bx + 6], [bx + 7, bx + 13]]) {
    pc.hline(x0, x1, dy, TRIM)
    pc.vline(x0, dy, base - 1, TRIM)
    pc.vline(x1, dy, base - 1, TRIM)
    pc.line(x0, dy, x1, base - 1, TRIM)
    pc.line(x1, dy, x0, base - 1, TRIM)
  }
  pc.vline(bx + 6, dy + 1, base - 2, o.lit ? P.windowLit : P.interior)
  pc.vline(bx + 7, dy + 1, base - 2, o.lit ? P.windowLitCore : P.interior)
  // A wreath over the doors and a window in the loft.
  wreathAt(pc, bx + 7, dy - 3)
  paneOf(pc, bx + 5, eave + 2, 5, 4, o.lit)
  // A pile of presents stacked beside the doors, and the sleigh on the other side: a red body on
  // gold runners with a sack in it.
  const px = sleighLeft ? 24 : 2
  giftAt(pc, px, base, 4, 4, P.xmasPaint[1], P.xmasTinsel)
  giftAt(pc, px + 1, base - 4, 3, 3, P.xmasPaint[6], P.xmasHolly)
  const sx = sleighLeft ? 3 : 20
  pc.hline(sx, sx + 8, base, P.xmasTinsel)
  pc.px(sx - 1, base - 1, P.xmasTinsel)
  pc.px(sx - 1, base - 2, P.xmasTinsel)
  pc.rect(sx + 1, base - 4, 8, 3, P.xmasPaint[0])
  pc.hline(sx + 1, sx + 8, base - 4, shade(P.xmasPaint[0], 0.3))
  pc.vline(sx + 8, base - 6, base - 4, P.xmasPaint[0])
  pc.rect(sx + 2, base - 7, 4, 3, P.xmasPaint[2])
  pc.px(sx + 3, base - 8, P.xmasHolly)
  if (!o.roof) return { x0: 2, x1: 29, top: eave }
  const top = roofOver(pc, 1, 30, eave - 1, o.low ? 10 : 13, roofPaintOf(o.roofs, tone), lim)
  snowRoof(pc, 1, 30, lim, eave - 1)
  lightsAlong(pc, 3, 28, eave)
  // The chimney, brick, at the back of the roof, capped with snow.
  for (let y = s.stackTop; y <= eave - 6; y++) {
    pc.hline(23, 26, y, (y - s.stackTop) % 3 === 2 ? P.brickDark : P.brick)
    pc.px(23, y, P.brickDark)
  }
  pc.hline(22, 27, s.stackTop, P.xmasSnow)
  // A big gold star at the ridge, where there is room.
  if (top - 4 >= lim) starAt(pc, 16, top - 2)
  return null
}

// ---------- chapel: a small church with a lit star over its door, a stable at its side ----------

function chapelSpec(low = false) {
  const base = 46
  const wallTop = low ? base - 22 : base - 24
  return { base, wallTop }
}

function chapel(pc, o) {
  const s = chapelSpec(o.low)
  const lim = ceiling(o.low)
  const r = specRand('chapel', o.variant)
  const material = r() < 0.6 ? 'stone' : materialOf(r, o.wall)
  const tone = Math.floor(r() * 3)
  const base = s.base
  wallOf(pc, 3, s.wallTop, 28, base, material, o.rand)
  // The arched door, under a lit round window, a candle in the tall windows on each side.
  const dc = 16
  box(pc, dc - 3, base - 12, dc + 3, base - 1, o.accent)
  pc.hline(dc - 2, dc + 2, base - 13, o.accent)
  pc.hline(dc - 1, dc + 1, base - 14, o.accent)
  pc.vline(dc, base - 12, base - 1, shade(o.accent, -0.3))
  pc.px(dc - 2, base - 6, P.xmasTinsel)
  pc.px(dc + 2, base - 6, P.xmasTinsel)
  pc.hline(dc - 4, dc + 4, base, P.xmasStoneLight)
  wreathAt(pc, dc, base - 17)
  paneOf(pc, 6, base - 17, 5, 9, o.lit)
  paneOf(pc, 21, base - 17, 5, 9, o.lit)
  candleAt(pc, 8, base - 8)
  candleAt(pc, 23, base - 8)
  // The stable beside it: two posts, a thatched lean-to and a manger. No figures.
  if (!o.low) {
    pc.vline(1, base - 10, base, P.xmasLog)
    pc.rect(1, base - 11, 3, 2, P.hay)
    pc.hline(0, 4, base - 11, P.hayDark)
    pc.px(1, base - 12, P.xmasSnow)
    pc.hline(0, 4, base - 12, P.xmasSnow)
    pc.rect(1, base - 3, 3, 2, P.xmasPlank)
    pc.hline(1, 3, base - 4, P.hay)
  }
  if (!o.roof) return { x0: 2, x1: 29, top: s.wallTop }
  const top = roofOver(pc, 1, 30, s.wallTop - 1, o.low ? 9 : 12, roofPaintOf(o.roofs, tone), lim)
  snowRoof(pc, 1, 30, lim, s.wallTop - 1)
  // A tower for the bell on the right of the roof and a lit star at its tip, if there is room.
  if (!o.low && top - 8 >= lim) {
    box(pc, 14, top - 6, 18, top + 2, P.xmasStoneLight)
    pc.vline(18, top - 6, top + 2, P.xmasStone)
    pc.hline(13, 19, top - 7, P.xmasSnow)
    pc.px(16, top - 4, P.xmasTinsel)
    pc.px(16, top - 3, P.xmasTinsel)
  }
  if (!o.low && top - 12 >= lim) starAt(pc, 16, top - 10)
  else if (top - 4 >= lim) starAt(pc, 16, top - 2)
  return null
}

// ---------- tree: the great fir in the square, hung with lights, presents at its foot ----------

function tree(pc, o) {
  const base = 46
  const lim = ceiling(o.low)
  const r = specRand('tree', o.variant)
  const top = Math.max(lim + 3, base - 32)
  const cx = 16
  // A trunk, then tiers of fir, each wider than the last.
  pc.rect(cx - 1, base - 4, 3, 4, P.xmasLogDark)
  pc.vline(cx - 1, base - 4, base - 1, P.xmasLog)
  const tiers = 5
  const span = base - 4 - top
  for (let t = 0; t < tiers; t++) {
    const y0 = top + Math.floor((t * span) / tiers)
    const y1 = top + Math.floor(((t + 1) * span) / tiers) + 3
    const half = 3 + t * 2
    for (let y = y0; y <= Math.min(y1, base - 4); y++) {
      const w = Math.max(1, Math.round((half * (y - y0 + 1)) / (y1 - y0 + 1)))
      pc.hline(cx - w, cx + w, y, (y - y0) % 2 ? P.xmasFir : P.xmasFirLight)
      pc.px(cx + w, y, P.xmasFirDark)
    }
    pc.hline(cx - half, cx + half, Math.min(y1, base - 4), P.xmasFirDark)
    pc.px(cx - half, Math.min(y1, base - 4) - 1, P.xmasSnow)
    pc.px(cx + half - 2, y0 + 2, P.xmasSnow)
  }
  if (!o.roof) return null
  // Baubles and a string of lights spiralling down it; a star on top.
  for (let i = 0; i < 16; i++) {
    const y = top + 5 + Math.floor((i * (span - 6)) / 16)
    const w = Math.max(1, Math.round(((y - top) / span) * 12))
    const x = cx + Math.round(Math.sin(i * 1.9 + r()) * (w - 1))
    pc.px(x, y, i % 4 === 0 ? P.xmasBulbYellow : BULBS[i % BULBS.length])
  }
  for (let y = top + 6; y < base - 6; y += 3) pc.px(cx + ((y >> 1) % 2 ? 2 : -2), y, P.xmasTinsel)
  if (o.lit) {
    // Alight when somebody is in: a halo round the star.
    pc.px(cx - 2, top - 1, P.glowCandle)
    pc.px(cx + 2, top - 1, P.glowCandle)
  }
  starAt(pc, cx, top - 1 < lim + 2 ? top : top - 1)
  // Presents heaped round the foot, in the plot's accent among them.
  giftAt(pc, 2, base, 6, 5, P.xmasPaint[1], P.xmasTinsel)
  giftAt(pc, 8, base, 5, 3, o.accent, P.xmasIcing)
  giftAt(pc, 20, base, 6, 4, P.xmasPaint[6], P.xmasHolly)
  giftAt(pc, 26, base, 4, 5, P.xmasPaint[0], P.xmasPaint[2])
  return null
}

// ---------- drawing one ----------

const KINDS = { cottage, stall, workshop, chapel, tree }
/** The tree is planted in the square's snow: it needs no staging. */
const NO_STAGING = new Set(['tree'])

/**
 * @param {{ kind: string, stage: number, accent: string, variant: number, lit: boolean, frame?: number, wall?: number, roofs?: number, low?: boolean, wear?: number }} o
 */
export function drawChristmasBuilding(o) {
  const kind = KINDS[o.kind] ? o.kind : 'cottage'
  const variant = o.variant || 0
  const pc = new PixelCanvas(BUILDING_W, HEIGHT)
  const seed = variant * 6151 + 83
  if (o.stage <= 1) {
    site(pc, mulberry32(seed), o.stage, 0, variant)
    return pc.outline(P.outline)
  }
  const draw = KINDS[kind]
  const opts = {
    rand: mulberry32(seed), accent: o.accent || P.xmasPaint[0], lit: Boolean(o.lit), roof: o.stage >= 3, variant,
    wall: o.wall || 0, roofs: o.roofs || 0, low: Boolean(o.low),
  }
  const sc = draw(pc, opts)
  if (o.stage === 2 && !NO_STAGING.has(kind) && sc) {
    staging(pc, sc.x0, sc.x1, Math.max(ceiling(opts.low), sc.top), HEIGHT - 2)
  }
  const look = o.stage >= 3 ? lookFor(o.wear ?? KEPT) : null
  if (look) {
    // As the village's: roof told from walls by the building drawn without it, every drawing given
    // the same texture stream as the first.
    const again = (roof) => {
      const other = new PixelCanvas(BUILDING_W, HEIGHT)
      draw(other, { ...opts, rand: mulberry32(seed), roof })
      return other
    }
    weather(pc, again(false), look, variant, [])
  }
  if (o.stage >= 3) drawGradeTrim(pc, o)
  return pc.outline(P.outline)
}
