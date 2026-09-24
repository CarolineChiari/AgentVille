// Finished work on a farm: a crop come ripe in the plot's kitchen garden, where the village grows a
// flower. A crop keeps everything a flower says: what it is says what kind of work it was (a
// tomato for a bug fix, a corn cob for data), its fruit or its bloom is the pull request's colour,
// a white one is an unlabeled PR, and an open PR's crop is still green on the plant.
//
// Its size and how tall it stands come from the flower kind's own `size` and `stem`, so the five
// kinds within a work type differ from each other as the five daisies do.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { FLOWER_H, FLOWER_W } from '../../sprites/flowers.js'
import { FLOWER_KINDS } from '../../../sim/flowers.js'

/** The spot the renderer puts on the ground, and the column everything stands on. */
const CX = 4
const BASE = 11
/** How far above the soil the crop's middle stands, by the flower kind's stem. */
const LIFT = { tall: 6, mid: 5, short: 4 }
/** How big it is, by the flower kind's size. */
const R = { s: 2, m: 2, l: 3 }

const leaf = (pc, x, y) => {
  pc.px(x, y, P.vegLeaf)
  pc.px(x + (x < CX ? -1 : 1), y - 1, P.vegLeafLight)
}

/**
 * Each kind of work has its own crop. `c` is the fruit's colour (the pull request's, or held
 * back to green while it is open), `cy` the middle of the fruit and `r` its half-width; every
 * one is drawn between (CX - r - 2) and (CX + r + 2), so none leans off the 9 px canvas.
 */
const CROPS = {
  // A bug fix is a tomato: a round fruit hanging off a staked vine, its green star on top.
  fix(pc, c, cy, r) {
    pc.vline(CX + 3, cy - 4, BASE, P.barnTimber) // the cane
    pc.vline(CX, cy + r, BASE, P.vegLeafDark)
    leaf(pc, CX - 2, cy + r + 2)
    const R2 = r + 0.6
    pc.ellipse(CX + 0.5, cy + 0.5, R2, R2 - 0.2, c)
    pc.px(CX - 1, cy - 1, shade(c, 0.35))
    pc.px(CX - 1, cy, shade(c, 0.2))
    pc.hline(CX, CX + r, cy + r, shade(c, -0.3))
    pc.hline(CX - 1, CX + 1, cy - r, P.vegLeafDark) // the calyx on top
    pc.px(CX, cy - r - 1, P.vegLeaf)
  },
  // A new feature is a sunflower: a big bloom turned to the light.
  feature(pc, c, cy, r) {
    pc.vline(CX, cy, BASE, P.vegLeafDark)
    leaf(pc, CX - 1, cy + 3)
    leaf(pc, CX + 1, cy + 5)
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [-1, -1], [1, 1], [-1, 1]]) {
      pc.px(CX + dx * (r + 1), cy + dy * (r + 1), c)
      pc.px(CX + dx * r, cy + dy * r, shade(c, 0.15))
    }
    pc.ellipse(CX + 0.5, cy + 0.5, r - 0.5, r - 0.5, P.barnTimberDark)
    pc.px(CX, cy, P.barnTimber)
  },
  // A refactor is a carrot: pulled half out of the ground, clean and tapering, its tops above.
  refactor(pc, c, cy, r) {
    const top = cy + 1
    for (let i = 0; i <= r + 2; i++) {
      const w = Math.max(0, r - Math.floor(i / 2) - 1)
      pc.hline(CX - w, CX + w, top + i, c)
      if (i % 2) pc.px(CX - w, top + i, shade(c, -0.3))
    }
    pc.px(CX - 1, top, shade(c, 0.3))
    // The feathery tops.
    for (const dx of [-2, 0, 2]) pc.line(CX, top - 1, CX + dx, top - 4, dx ? P.vegLeaf : P.vegLeafDark)
    pc.px(CX - 2, top - 5, P.vegLeafLight)
    pc.px(CX + 2, top - 5, P.vegLeafLight)
  },
  // Docs are a cabbage: leaf over leaf, like pages, the outer ones in the PR's colour.
  docs(pc, c, cy, r) {
    const R2 = r + 1
    pc.ellipse(CX + 0.5, cy + 1.5, R2 + 0.5, R2 - 0.5, shade(c, -0.25))
    pc.ellipse(CX + 0.5, cy + 0.5, R2 - 0.5, R2 - 1, c)
    pc.ellipse(CX + 0.5, cy, R2 - 1.5, R2 - 1.5, shade(c, 0.22))
    pc.vline(CX, cy - 1, cy + 2, shade(c, -0.25)) // the rib down the heart
    pc.px(CX - R2, cy + 2, shade(c, -0.35))
    pc.px(CX + R2, cy + 2, shade(c, -0.35))
  },
  // Tests are pea pods: small, many, and all in a row, hanging from the vine.
  test(pc, c, cy, r) {
    pc.vline(CX, cy - 4, BASE, P.vegLeafDark)
    leaf(pc, CX - 1, cy - 3)
    leaf(pc, CX + 1, cy + 4)
    // The pod: a plump blade on a slant, the peas swelling along its seam.
    const len = r + 4
    for (let i = 0; i < len; i++) {
      const x = CX - 2 + i
      const y = cy - 1 + Math.floor(i / 2)
      pc.vline(x, y, y + 1, c)
      pc.px(x, y + 2, shade(c, -0.3))
      if (i % 2 && i < len - 1) pc.px(x, y, shade(c, 0.32))
    }
  },
  // Design work is a strawberry: a heart of red flecked with seeds under its green cap.
  ui(pc, c, cy, r) {
    pc.vline(CX, cy - r - 2, BASE, P.vegLeafDark)
    leaf(pc, CX + 1, BASE - 1)
    for (let i = 0; i <= r + 1; i++) {
      const w = Math.max(0, r - Math.max(0, i - 1))
      pc.hline(CX - w, CX + w, cy - 1 + i, c)
    }
    for (const [dx, dy] of [[-1, 0], [1, 1], [0, 2], [-1, 2]]) if (pc.opaque(CX + dx, cy + dy)) pc.px(CX + dx, cy + dy, P.hayLight)
    pc.hline(CX - 1, CX + 1, cy - 2, P.vegLeaf) // the cap
    pc.px(CX - 2, cy - 2, P.vegLeafDark)
    pc.px(CX + 2, cy - 2, P.vegLeafDark)
  },
  // Infrastructure is a pumpkin: the heavy thing sitting on the ground, ribbed.
  infra(pc, c, cy, r) {
    const R2 = r + 1
    const y = BASE - R2 + 1
    pc.ellipse(CX + 0.5, y, R2 + 0.8, R2 - 0.5, c)
    for (const dx of [-2, 0, 2]) pc.vline(CX + dx, y - R2 + 2, y + R2 - 2, shade(c, -0.25))
    pc.px(CX - R2, y - 1, shade(c, 0.28))
    pc.vline(CX, y - R2, y - R2 + 1, P.vegLeafDark) // the stalk
    pc.px(CX + 1, y - R2 - 1, P.vegLeaf)
  },
  // Data is a corn cob: kernels in a grid, in their husk.
  data(pc, c, cy, r) {
    pc.vline(CX, cy + r + 1, BASE, P.vegLeafDark)
    const h = r * 2 + 2
    for (let i = 0; i < h; i++) {
      const w = i === 0 || i === h - 1 ? 0 : 1
      pc.hline(CX - w, CX + w, cy - r + i, (i % 2) ? c : shade(c, 0.2))
      if (w) pc.px(CX, cy - r + i, (i % 2) ? shade(c, -0.25) : c)
    }
    // The husk, peeled back either side.
    pc.line(CX - 2, cy + r + 1, CX - 2, cy - 1, P.vegLeaf)
    pc.line(CX + 2, cy + r + 1, CX + 2, cy, P.vegLeafDark)
    pc.px(CX, cy - r - 1, P.hayLight) // the silk
  },
  // Performance is a chilli: hot, quick and hanging in a curve.
  perf(pc, c, cy, r) {
    pc.vline(CX - 1, cy - 3, BASE, P.vegLeafDark)
    leaf(pc, CX - 2, cy + 3)
    pc.px(CX, cy - 2, P.vegLeafDark)
    const len = r + 3
    for (let i = 0; i < len; i++) {
      const x = CX + Math.round(Math.sin((i / len) * 1.4) * 2)
      pc.px(x, cy - 1 + i, c)
      if (i < len - 2) pc.px(x + 1, cy - 1 + i, shade(c, -0.22))
    }
    pc.px(CX, cy - 1, shade(c, 0.3))
  },
  // A review is an onion: layer after layer, looked at closely, lifted to dry.
  review(pc, c, cy, r) {
    const R2 = r + 0.5
    pc.ellipse(CX + 0.5, cy + 1.5, R2, R2, c)
    pc.vline(CX, cy - R2, cy + R2, shade(c, 0.24))
    pc.px(CX - 1, cy + 1, shade(c, -0.25))
    pc.px(CX + 1, cy + 1, shade(c, -0.25))
    pc.line(CX, cy - r, CX - 1, cy - r - 3, P.vegLeaf) // the tops, flopped over
    pc.line(CX, cy - r, CX + 2, cy - r - 2, P.vegLeafDark)
    pc.hline(CX - 1, CX + 1, cy + r + 2, P.barnTimberLight) // the roots
  },
  // Research is a runner bean: a cane and a vine climbing it, its flowers in the PR's colour.
  research(pc, c, cy, r) {
    pc.vline(CX, cy - r - 3, BASE, P.barnTimber)
    for (let y = cy - r - 2; y <= BASE; y++) pc.px(CX + ((y >> 1) & 1 ? 1 : -1), y, P.vegLeafDark)
    for (const [dx, dy] of [[-2, -r], [2, 0], [-2, r]]) {
      pc.px(CX + dx, cy + dy, c)
      pc.px(CX + dx + (dx < 0 ? 1 : -1), cy + dy - 1, shade(c, 0.24))
    }
    pc.vline(CX + 2, cy + 2, cy + 5, P.vegLeaf) // a bean hanging
  },
  // Odds and ends are a radish: small, bright and pulled for the table.
  misc(pc, c, cy, r) {
    const y = BASE - 2
    pc.ellipse(CX + 0.5, y, r * 0.8 + 0.4, r * 0.8, c)
    pc.px(CX - 1, y - 1, shade(c, 0.3))
    pc.px(CX, y + r, P.petalWhite) // the white tip
    pc.line(CX, y - r, CX - 1, y - r - 2, P.vegLeaf)
    pc.line(CX, y - r, CX + 1, y - r - 3, P.vegLeafDark)
  },
}

/**
 * One finished thread's crop, for FLOWER_KINDS[kind], the size of a flower and on the flower's spot.
 * @param {number} kind  into FLOWER_KINDS
 * @param {number} stage 0 a seedling · 1 green on the plant (an open PR) · 2 ripe
 * @param {string} color its colour, the pull request's
 */
export function drawCrop(kind, stage, color) {
  const k = FLOWER_KINDS[kind] || FLOWER_KINDS[0]
  const pc = new PixelCanvas(FLOWER_W, FLOWER_H)
  // The soil drawn up round its foot, always: it is what marks the spot the renderer picks it by.
  pc.hline(CX - 2, CX + 2, BASE, P.tilthLight)
  pc.px(CX - 2, BASE, P.tilthDark)
  pc.px(CX + 2, BASE, P.tilthDark)
  if (stage <= 0) {
    // Just sown: a seedling's two leaves up out of the soil.
    pc.vline(CX, BASE - 2, BASE - 1, P.vegLeafDark)
    pc.px(CX - 1, BASE - 3, P.vegLeafLight)
    pc.px(CX + 1, BASE - 3, P.vegLeaf)
    return pc.outline(P.outline)
  }
  const r = R[k.size] ?? R.m
  const cy = BASE - (LIFT[k.stem] ?? LIFT.mid) - (k.size === 'l' ? 1 : 0)
  // Unripe, the crop is the same shape in green, with a touch of its colour coming through, so
  // an open PR reads as not done at a glance rather than merely as a darker crop.
  const unripe = stage < 2
  const c = unripe ? P.vegLeafLight : color
  const draw = CROPS[k.work] || CROPS.misc
  draw(pc, c, cy, r)
  if (unripe) pc.px(CX, cy, color)
  return pc.outline(P.outline)
}
