// The harbour's landmarks: what a plot's work has raised above the tide line in the middle of its
// strand, from a post to tie up to all the way to the lighthouse. Same contract as the village's
// (src/render/sprites/landmarks.js): 32 px wide, the same height per tier, bottom row on the
// ground, stages 0 to 3 as a building's (2 goes up inside the theme's staging), `lit` lamps after
// dark and `busy` while somebody on the plot is in. The plot's paint family goes on the boats and
// the bands, its accent on doors and hulls, and a tower is built of its wall material.
//
// None of them is one of the harbour's own houses made bigger: a net loft, a lookout and a
// daymark are already what threads build here, so a landmark has to be the plot's own centrepiece.
// It is the light on this coast, which is why the daymark a thread builds carries no lamp.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { LANDMARK_HEIGHTS, LANDMARK_W } from '../../sprites/landmarks.js'
import { mulberry32 } from '../../../sim/rng.js'
import { MATERIALS, box, buoyAt, coilAt, doorOf, gullAt, hullAt, paintOf, paneOf, ringAt, site, staging, wallOf } from './buildings.js'
import { pot, shell } from './ground.js'

const TOP_TIER = LANDMARK_HEIGHTS.length - 1
const tierOf = (tier) => Math.max(0, Math.min(TOP_TIER, Math.floor(Number(tier) || 0)))

/** The same heights as the village's, so a plot's landmark stands as tall whichever theme it wears. */
export const heightOf = (tier) => LANDMARK_HEIGHTS[tierOf(tier)]
/** A mooring post casts none worth drawing; the bell frame is open and the light towers taper. */
export const shadowOf = (tier) => [0, 26, 24, 30, 26, 28][tierOf(tier)]
/** The pier light flashes and the lighthouse's beam goes round; the rest stand still. */
export const landmarkFrames = (tier, stage) => (stage >= 3 && tierOf(tier) >= 4 ? 2 : 1)

// ---------- parts ----------

/** Wet sand and shingle underfoot, with shell grit worked through it. */
function strand(pc, H, rand, rx = 14.5) {
  pc.ellipse(16, H - 4, rx, 3.5, P.seaGround[0][3])
  for (let i = 0; i < 9; i++) pc.px(3 + Math.floor(rand() * 26), H - 6 + Math.floor(rand() * 5), i % 2 ? P.shellGrit : P.seaGround[1][2])
}

/** A pile of shore stone, `rx` across, for a light or a bell to stand on. */
function plinth(pc, cx, base, rx, h) {
  for (let y = base - h; y <= base; y++) {
    const half = Math.round(rx * (0.8 + 0.2 * ((y - (base - h)) / Math.max(1, h))))
    box(pc, cx - half, y, cx + half, y, P.seastone)
    pc.px(cx - half, y, P.seastoneLight)
    pc.px(cx + half, y, P.seastoneDark)
    if ((y - (base - h)) % 4 === 3) pc.hline(cx - half + 1, cx + half - 1, y, P.seastoneDark)
  }
  pc.hline(cx - rx - 1, cx + rx + 1, base, P.seastoneDark)
}

/** A lamp room at (cx, y): glazing in an iron frame, its lamp alight when the harbour is. */
function lampRoom(pc, cx, y, half, bright, frame) {
  box(pc, cx - half, y, cx + half, y + 5, P.seaIron)
  box(pc, cx - half + 1, y + 1, cx + half - 1, y + 4, bright ? P.lens : P.glass)
  for (let x = cx - half + 1; x <= cx + half - 1; x += 3) pc.vline(x, y + 1, y + 4, P.seaIronLight)
  if (bright) {
    box(pc, cx - 1, y + 2, cx + 1, y + 3, P.lensCore)
    // The lens turning: its glint crosses from one side of the room to the other.
    pc.px(cx + (frame % 2 ? half - 1 : 1 - half), y + 2, P.lensCore)
  }
  pc.hline(cx - half - 1, cx + half + 1, y, P.seaIronLight)
  pc.hline(cx - half - 1, cx + half + 1, y + 6, P.seaIron)
}

/** The gallery railing round a light, from x0 to x1 on row y. */
function gallery(pc, x0, x1, y) {
  pc.hline(x0, x1, y, P.sailCloth)
  pc.hline(x0, x1, y + 1, P.sailClothShade)
  for (let x = x0; x <= x1; x += 3) pc.vline(x, y + 1, y + 4, P.sailCloth)
  pc.hline(x0, x1, y + 4, P.seaIron)
}

// ---------- the tiers ----------

/** Which way the beam points, frame by frame, and how far it carries: it comes round, so it
 * sweeps out to one side and then the other. */
const BEAM = [[-1, 11], [1, 13]]

const TIERS = [
  function mooringPost(pc, o) {
    const base = o.H - 2
    strand(pc, o.H, o.rand, 11)
    // A baulk of timber driven into the strand, its head bound in iron.
    box(pc, 12, base - 16, 19, base, P.driftwood)
    pc.vline(12, base - 16, base, P.driftwoodLight)
    pc.vline(19, base - 16, base, P.driftwoodDark)
    pc.hline(11, 20, base - 16, P.driftwoodLight)
    pc.hline(11, 20, base - 15, P.driftwoodDark)
    for (const y of [base - 12, base - 4]) {
      pc.hline(12, 19, y, P.seaIron)
      pc.px(12, y, P.seaIronLight)
    }
    for (const [x, y] of [[9, base - 9], [21, base - 6]]) {
      pc.hline(x, x + 1, y, P.seaweed)
      pc.px(x + 2, y + 1, P.seaweedDark)
    }
    if (!o.roof) return { x0: 8, x1: 23, top: base - 17 }
    // Tied up: the rope turned round its head, coiled at its foot, and the ring it shackles to.
    for (const y of [base - 14, base - 13, base - 12]) pc.hline(10, 21, y, y === base - 13 ? P.ropeLight : P.ropeDark)
    pc.px(22, base - 12, P.ropeLight)
    pc.px(23, base - 11, P.rope)
    coilAt(pc, 24, base - 1)
    pc.ellipse(9, base - 3, 2, 1.6, P.seaIron)
    pc.ellipse(9, base - 3, 0.8, 0.7, P.seaGround[0][3])
    gullAt(pc, 16, base - 17, o.variant % 2 ? 1 : -1)
    shell(pc, 26, base - 3, o.variant)
    return null
  },

  function beachedBoat(pc, o) {
    const base = o.H - 3
    strand(pc, o.H, o.rand)
    const color = paintOf(o.roofs, 0)
    // The boat, hauled up beyond the tide and propped upright on two legs.
    hullAt(pc, 3, 28, base, color, o.variant % 2 === 0)
    for (const x of [8, 22]) {
      pc.vline(x, base - 2, base + 1, P.driftwoodDark)
      pc.px(x + 1, base + 1, P.driftwood)
    }
    pc.hline(2, 29, base + 1, P.seaGround[1][1])
    // Her name board on the bow, in the plot's colour, and her gear aboard.
    pc.hline(o.variant % 2 === 0 ? 21 : 6, o.variant % 2 === 0 ? 26 : 11, base - 8, P.sailCloth)
    pot(pc, o.variant % 2 === 0 ? 9 : 22, base - 6, 3, 3)
    if (!o.roof) return { x0: 2, x1: 29, top: base - 12 }
    // The mast stepped, with the sail furled on the boom and a lamp hung in the shrouds.
    const mx = 16
    pc.vline(mx, base - 30, base - 7, P.driftwood)
    pc.vline(mx + 1, base - 29, base - 7, P.driftwoodDark)
    pc.px(mx, base - 31, P.brass)
    box(pc, mx - 7, base - 14, mx + 7, base - 12, P.sailCloth)
    pc.hline(mx - 7, mx + 7, base - 14, P.sailClothShade)
    for (let x = mx - 6; x <= mx + 6; x += 3) pc.px(x, base - 12, P.rope)
    pc.line(mx, base - 29, mx - 9, base - 9, P.ropeDark)
    pc.line(mx + 1, base - 29, mx + 10, base - 9, P.ropeDark)
    // The lamp in the shrouds: the first light this plot keeps.
    const on = o.lit || o.busy
    pc.px(mx + 5, base - 20, P.seaIron)
    box(pc, mx + 4, base - 19, mx + 6, base - 17, on ? P.lens : P.seaIronLight)
    if (on) pc.px(mx + 5, base - 18, P.lensCore)
    gullAt(pc, 5, base - 12, 1)
    return null
  },

  function harbourBell(pc, o) {
    const base = o.H - 2
    strand(pc, o.H, o.rand)
    plinth(pc, 16, base, 11, 7)
    // A frame of heavy timber, braced, with the bell hung in the head of it.
    for (const x of [7, 23]) {
      box(pc, x, base - 34, x + 1, base - 7, P.driftwood)
      pc.vline(x, base - 34, base - 7, P.driftwoodLight)
    }
    pc.line(9, base - 9, 15, base - 24, P.driftwoodDark)
    pc.line(22, base - 9, 16, base - 24, P.driftwoodDark)
    box(pc, 5, base - 36, 26, base - 34, P.driftwood)
    pc.hline(5, 26, base - 36, P.driftwoodLight)
    pc.hline(5, 26, base - 33, P.driftwoodDark)
    // The board with the plot's colour on it, where a harbour paints its name.
    box(pc, 9, base - 14, 22, base - 10, o.accent)
    pc.hline(9, 22, base - 14, shade(o.accent, 0.2))
    pc.hline(9, 22, base - 10, shade(o.accent, -0.3))
    if (!o.roof) return { x0: 4, x1: 27, top: base - 37 }
    // The bell itself: bronze, wider as it goes down, with its mouth and clapper under it.
    for (let i = 0; i < 9; i++) {
      const half = 2 + Math.round((i / 8) ** 0.7 * 4)
      const y = base - 32 + i
      box(pc, 16 - half, y, 15 + half, y, i < 2 ? P.brassDark : P.brass)
      pc.px(16 - half, y, P.brass)
      pc.px(15 + half, y, P.brassDark)
    }
    pc.hline(10, 21, base - 23, P.brassDark)
    pc.px(16, base - 22, P.seaIron)
    pc.vline(16, base - 33, base - 32, P.seaIron)
    // The rope down to where it is rung from, and a lamp on the frame for the dark.
    pc.vline(24, base - 33, base - 16, P.ropeDark)
    pc.px(25, base - 15, P.rope)
    const on = o.lit || o.busy
    box(pc, 5, base - 32, 8, base - 29, on ? P.lens : P.seaIron)
    if (on) pc.px(6, base - 31, P.lensCore)
    pc.hline(4, 9, base - 33, P.seaIronLight)
    gullAt(pc, 27, base - 34, -1)
    return null
  },

  function quayDerrick(pc, o) {
    const base = o.H - 2
    strand(pc, o.H, o.rand)
    // A quay wall of shore stone, with a bollard on it and the water below the coping.
    box(pc, 1, base - 9, 30, base, P.seastone)
    pc.hline(1, 30, base - 9, P.seastoneLight)
    for (let y = base - 7; y <= base; y += 3) pc.hline(1, 30, y, P.seastoneDark)
    box(pc, 3, base - 12, 6, base - 10, P.driftwood)
    pc.hline(2, 7, base - 12, P.driftwoodLight)
    // The derrick: a mast on a heel, stayed back, with the jib out over the water.
    const mx = 20
    box(pc, mx - 1, base - 40, mx + 1, base - 10, P.driftwood)
    pc.vline(mx - 1, base - 40, base - 10, P.driftwoodLight)
    pc.vline(mx + 1, base - 40, base - 10, P.driftwoodDark)
    for (let y = base - 36; y <= base - 14; y += 6) pc.hline(mx - 2, mx + 2, y, P.seaIron)
    pc.line(mx + 1, base - 39, 29, base - 11, P.ropeDark)
    if (!o.roof) return { x0: 8, x1: 30, top: base - 41 }
    // The jib, the block at its end and the crate on the hook, half up.
    pc.line(mx, base - 38, 5, base - 26, P.driftwood)
    pc.line(mx, base - 37, 5, base - 25, P.driftwoodDark)
    pc.line(mx - 1, base - 36, 5, base - 24, P.ropeDark) // the topping lift
    pc.vline(6, base - 25, base - 21, P.ropeDark)
    pc.px(6, base - 20, P.seaIron)
    box(pc, 3, base - 19, 10, base - 13, o.accent)
    pc.hline(3, 10, base - 19, shade(o.accent, 0.2))
    pc.hline(3, 10, base - 13, shade(o.accent, -0.3))
    for (const x of [5, 8]) pc.vline(x, base - 18, base - 14, shade(o.accent, -0.3))
    // The winch at the heel, and a lamp on the mast.
    box(pc, mx + 3, base - 16, mx + 8, base - 11, P.seaIron)
    pc.hline(mx + 3, mx + 8, base - 16, P.seaIronLight)
    pc.ellipse(mx + 5.5, base - 14, 2, 1.6, P.brassDark)
    const on = o.lit || o.busy
    box(pc, mx - 2, base - 30, mx + 2, base - 27, on ? P.lens : P.seaIron)
    if (on) pc.px(mx, base - 29, P.lensCore)
    coilAt(pc, 13, base - 10)
    gullAt(pc, 28, base - 10, -1)
    return null
  },

  function harbourLight(pc, o) {
    const base = o.H - 2
    strand(pc, o.H, o.rand)
    plinth(pc, 16, base, 12, 9)
    // A cast-iron pier light: an open lattice tower on splayed legs, painted, with the lamp room
    // on top. The legs lean in rather than crossing: crossed ones read as a thicket.
    const paint = paintOf(o.roofs, 1)
    const halfAt = (y) => Math.round(5 + ((base - 10 - y) / 30) * -0.5 + (y - (base - 40)) * 0.2)
    for (const dir of [-1, 1]) {
      pc.line(16 + dir * halfAt(base - 10), base - 10, 16 + dir * halfAt(base - 40), base - 40, paint)
      pc.line(16 + dir * halfAt(base - 10) - dir, base - 10, 16 + dir * halfAt(base - 40) - dir, base - 40, shade(paint, -0.28))
    }
    for (let y = base - 36; y <= base - 14; y += 6) {
      const half = halfAt(y)
      pc.hline(16 - half, 15 + half, y, shade(paint, 0.2))
      pc.hline(16 - half, 15 + half, y + 1, shade(paint, -0.28))
      // A brace across each bay, leaning the other way in every second one.
      pc.line(16 - half, y + (y % 12 ? 1 : 6), 15 + half, y + (y % 12 ? 6 : 1), shade(paint, -0.28))
    }
    // The ladder up the middle of it.
    pc.vline(15, base - 40, base - 10, P.seaIron)
    pc.vline(17, base - 40, base - 10, P.seaIron)
    for (let y = base - 38; y <= base - 12; y += 4) pc.hline(15, 17, y, P.seaIronLight)
    if (!o.roof) return { x0: 6, x1: 25, top: base - 41 }
    gallery(pc, 9, 22, base - 46)
    lampRoom(pc, 16, base - 53, 5, o.lit || o.busy, o.frame)
    // The port and starboard lamps either side of the gallery, the way a harbour mouth is marked.
    pc.px(9, base - 47, o.lit || o.busy ? P.lampGreen : P.seaIron)
    pc.px(22, base - 47, o.lit || o.busy ? P.lampRed : P.seaIron)
    // A weathervane over it, and the bell for fog hung under the gallery.
    pc.vline(16, base - 57, base - 54, P.seaIron)
    pc.hline(13, 19, base - 57, P.seaIronLight)
    pc.ellipse(16, base - 43, 2, 2.5, P.brass)
    pc.hline(14, 18, base - 41, P.brassDark)
    gullAt(pc, 26, base - 11, -1)
    return null
  },

  function lighthouse(pc, o) {
    const base = o.H - 2
    strand(pc, o.H, o.rand)
    const r = mulberry32(o.variant * 977 + 7)
    const material = MATERIALS[(o.wall || 0) % MATERIALS.length]
    const band = paintOf(o.roofs, 0)
    // The keeper's house at the foot, low and long, with the tower rising out of it.
    wallOf(pc, 1, base - 13, 30, base, material === 'corrugated' ? 'seastone' : material, r, null)
    pc.hline(1, 30, base, P.seastoneDark)
    doorOf(pc, 4, base - 1, 5, 9, o.accent)
    paneOf(pc, 23, base - 11, 6, 6, o.lit)
    // The tower: tapering, its half-width from four at the lantern to nine at the house.
    const top = 14
    const halfAt = (y) => 4 + Math.round(((y - top) / (base - 13 - top)) ** 0.9 * 5)
    for (let y = top; y <= base - 13; y++) {
      const half = halfAt(y)
      // Bands of the plot's colour, six rows to a band, which is how a lighthouse is told apart
      // from the next one along the coast by day.
      const banded = Math.floor((y - top) / 7) % 2 === 1
      const face = banded ? band : P.limewash
      box(pc, 16 - half, y, 15 + half, y, face)
      pc.px(16 - half, y, shade(face, 0.2))
      pc.px(15 + half, y, shade(face, -0.28))
      if ((y - top) % 7 === 0) pc.hline(16 - half + 1, 14 + half, y, shade(face, -0.16))
    }
    paneOf(pc, 14, base - 24, 4, 5, o.lit)
    paneOf(pc, 14, base - 36, 4, 5, o.lit)
    if (!o.roof) return { x0: 6, x1: 25, top }
    // The gallery, the lantern room and the cap over it.
    gallery(pc, 8, 23, top - 1)
    lampRoom(pc, 16, top - 9, 5, o.lit || o.busy, o.frame)
    for (let i = 0; i < 3; i++) pc.hline(12 + i, 19 - i, top - 12 + i, P.seaIron)
    pc.px(16, top - 13, P.seaIronLight)
    if (o.lit || o.busy) {
      // The beam, going round: a wedge out of the lantern room, drawn at a third alpha so the sky
      // still shows through it. It leans one way and then the other, which is the turn of it.
      const [dir, len] = BEAM[o.frame % BEAM.length]
      for (let i = 1; i <= len; i++) {
        const x = 16 + dir * i
        const y = top - 6 + Math.round(i * 0.3)
        // A wedge, widening as it goes out: a one-pixel line read as a scratch on the sky.
        const half = Math.floor(i / 3)
        pc.vline(x, y - half, y + half, P.beamGlow)
      }
    }
    ringAt(pc, 27, base - 6)
    buoyAt(pc, 12, base - 3, o.variant)
    gullAt(pc, 20, base - 14, 1)
    return null
  },
]

/**
 * A plot's landmark, tier by tier.
 * @param {{ tier: number, stage: number, variant?: number, accent?: string, wall?: number, roofs?: number, lit?: boolean, busy?: boolean, frame?: number }} o
 */
export function drawSeaLandmark(o) {
  const tier = tierOf(o.tier)
  const H = heightOf(tier)
  const variant = o.variant || 0
  const pc = new PixelCanvas(LANDMARK_W, H)
  const rand = mulberry32(variant * 7919 + tier * 131 + 59)
  // The mooring post is driven in rather than built, so it has no site stages of its own.
  if (tier > 0 && o.stage <= 1) {
    site(pc, rand, o.stage, H - 48, variant)
    return pc.outline(P.outline)
  }
  const opts = {
    H, rand, variant, stage: o.stage, frame: o.frame || 0, roof: o.stage >= 3, lit: Boolean(o.lit), busy: Boolean(o.busy),
    accent: o.accent || P.harbourPaint[0], roofs: o.roofs || 0, wall: o.wall || 0,
  }
  const up = TIERS[tier](pc, opts)
  if (o.stage === 2 && up) staging(pc, up.x0, up.x1, Math.max(1, up.top), H - 2)
  return pc.outline(P.outline)
}

// ---------- what a landmark brings with it ----------

/**
 * The harbour's take on what a plot's landmark brings (propsOf in src/sim/shape.js), the same
 * sizes as the village's: a harbour lamp on a cast-iron post, a painted bench looking out to sea,
 * a half-barrel of marram grass or thrift for its planters, and two posts hung with floats and
 * signal flags for its gateway. Null for any other static, which the village draws.
 */
export function drawSeaProp(sprite, variant, p = {}) {
  if (sprite === 'yardlamp') {
    const pc = new PixelCanvas(12, 30)
    box(pc, 2, 26, 8, 29, P.seastone)
    pc.hline(2, 8, 26, P.seastoneLight)
    pc.vline(8, 26, 29, P.seastoneDark)
    // A fluted iron column, painted white and rusting where the salt gets in.
    box(pc, 4, 8, 6, 25, P.sailCloth)
    pc.vline(4, 8, 25, P.sailClothShade)
    pc.vline(6, 8, 25, P.seaIronLight)
    for (const y of [14, 21]) pc.px(5, y, P.rust)
    pc.hline(3, 7, 7, P.sailCloth)
    pc.hline(3, 7, 8, P.seaIron)
    // The lantern: six panes in an iron frame with a little cap over it.
    box(pc, 2, 2, 8, 7, P.seaIron)
    box(pc, 3, 3, 7, 6, p.lit ? P.lens : P.glass)
    pc.vline(5, 3, 6, P.seaIronLight)
    if (p.lit) {
      pc.hline(4, 6, 4, P.lensCore)
      pc.px(5, 5, P.lensCore)
    }
    pc.hline(1, 9, 2, P.seaIronLight)
    pc.hline(3, 7, 1, P.seaIron)
    pc.px(5, 0, P.brass)
    return pc.outline(P.outline)
  }
  if (sprite === 'yardbench') {
    // As the village's bench, two tiles long along the fence: its back on the west side. Painted
    // and salt-bleached, with a brass plate on the back as a seaside bench always has.
    const pc = new PixelCanvas(14, 32)
    box(pc, 1, 1, 3, 29, P.sailCloth)
    pc.vline(1, 1, 29, P.sailClothShade)
    for (let y = 4; y < 29; y += 5) pc.hline(1, 3, y, P.driftwoodDark)
    // The seat: four boards with the gap between each one dark. Drawn as one pale panel it read
    // as a door lying against the fence rather than as a bench.
    box(pc, 4, 3, 10, 28, P.driftwood)
    for (const x of [4, 6, 8, 10]) pc.vline(x, 3, 28, P.driftwoodLight)
    for (const x of [5, 7, 9]) pc.vline(x, 3, 28, P.driftwoodDark)
    for (const y of [2, 28]) {
      pc.hline(0, 11, y, P.driftwoodDark)
      pc.px(11, y + 1, P.driftwoodDark)
    }
    box(pc, 1, 30, 2, 31, P.seaIron)
    box(pc, 9, 30, 10, 31, P.seaIron)
    pc.hline(2, 3, 15, P.brass)
    pc.px(2, 16, P.brassDark)
    shell(pc, 7, 24, 1)
    return pc.outline(P.outline)
  }
  if (sprite === 'yardplanter') {
    const pc = new PixelCanvas(16, 20)
    // A half-barrel, hooped in iron, of the kind a chandler always has spare.
    box(pc, 3, 10, 12, 19, P.driftwood)
    pc.vline(3, 10, 19, P.driftwoodLight)
    pc.vline(12, 10, 19, P.driftwoodDark)
    for (let x = 5; x <= 11; x += 3) pc.vline(x, 10, 19, P.driftwoodDark)
    for (const y of [12, 17]) pc.hline(3, 12, y, P.seaIron)
    pc.hline(3, 12, 10, P.driftwoodLight)
    if (variant % 2 === 0) {
      // Marram grass, which is what will grow in sand and salt.
      for (const [x, h] of [[4, 8], [6, 10], [8, 11], [10, 9], [11, 7]]) {
        pc.vline(x, 10 - h, 10, (x & 1) ? P.seaweed : P.seaweedDark)
        pc.px(x + 1, 12 - h, P.shoreLichen)
      }
      pc.px(3, 3, P.seaweed)
    } else {
      // Sea thrift in flower, and a few shells pressed into the top of the soil.
      pc.hline(4, 11, 9, P.seaweedDark)
      for (const [x, y] of [[5, 6], [8, 5], [11, 7]]) {
        pc.vline(x, y + 1, 9, P.seaweed)
        pc.ellipse(x, y, 1.6, 1.2, P.blossom)
        pc.px(x, y, P.blossomLight)
      }
      shell(pc, 1, 19, 0)
      shell(pc, 13, 18, 2)
    }
    return pc.outline(P.outline)
  }
  if (sprite === 'gateway') {
    // Two posts with a beam across them, hung with floats and a string of signal flags. Open
    // underneath: a gateway is walked through.
    const pc = new PixelCanvas(32, 30)
    for (const x of [2, 27]) {
      box(pc, x, 6, x + 2, 29, P.driftwood)
      pc.vline(x, 6, 29, P.driftwoodLight)
      pc.vline(x + 2, 6, 29, P.driftwoodDark)
      pc.hline(x - 1, x + 3, 29, P.seastoneDark)
    }
    box(pc, 1, 3, 30, 5, P.driftwood)
    pc.hline(1, 30, 3, P.driftwoodLight)
    pc.hline(1, 30, 5, P.driftwoodDark)
    // Signal flags along the beam, each one a different colour, as a dressed harbour flies them.
    for (let x = 3, i = 0; x <= 28; x += 3, i++) {
      const c = P.harbourPaint[i % P.harbourPaint.length]
      pc.hline(x, x + 1, 6, c)
      pc.px(x, 7, shade(c, -0.25))
    }
    for (const x of [7, 24]) buoyAt(pc, x, 12, x)
    pc.hline(4, 8, 8, P.rope)
    pc.hline(23, 27, 8, P.rope)
    return pc.outline(P.outline)
  }
  return null
}
