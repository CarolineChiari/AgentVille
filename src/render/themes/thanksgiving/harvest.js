// Finished work at Thanksgiving: the harvest brought in from the plot's patch, where the village
// grows a flower. A gourd keeps everything a flower says: what it is says what kind of work it was
// (a pumpkin for a bug fix, a corn cob for data, a bottle gourd for a review), its skin is the pull
// request's colour, a white one is an unlabeled PR, and an open PR's gourd is still green on the vine.
//
// Its size and how tall it stands come from the flower kind's own `size` and `stem`, so the kinds
// within a work type differ from each other as the village's daisies do.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { FLOWER_H, FLOWER_W } from '../../sprites/flowers.js'
import { FLOWER_KINDS } from '../../../sim/flowers.js'

/** The spot the renderer puts on the ground, and the column everything stands on. */
const CX = 4
const BASE = 11
/** How far above the soil the harvest's middle stands, by the flower kind's stem. */
const LIFT = { tall: 6, mid: 5, short: 4 }
/** How big it is, by the flower kind's size. */
const R = { s: 2, m: 2, l: 3 }

const leaf = (pc, x, y) => {
  pc.px(x, y, P.vegLeaf)
  pc.px(x + (x < CX ? -1 : 1), y - 1, P.vegLeafLight)
}

/**
 * Each kind of work has its own harvest. `c` is the skin's colour (the pull request's, or held
 * back to green while it is open), `cy` the middle and `r` the half-width; every one is drawn
 * between (CX - r - 2) and (CX + r + 2), so none leans off the 9 px canvas.
 */
const CROPS = {
  // A bug fix is a pumpkin: the heavy round thing sitting on the ground, ribbed.
  fix(pc, c, cy, r) {
    const R2 = r + 1
    const y = BASE - R2 + 1
    pc.ellipse(CX + 0.5, y, R2 + 0.8, R2 - 0.5, c)
    for (const dx of [-2, 0, 2]) pc.vline(CX + dx, y - R2 + 2, y + R2 - 2, shade(c, -0.25))
    pc.px(CX - R2, y - 1, shade(c, 0.28))
    pc.vline(CX, y - R2, y - R2 + 1, P.vegLeafDark)
    pc.px(CX + 1, y - R2 - 1, P.vegLeaf)
  },
  // A new feature is a corn stalk grown tall: an ear in its husk, and the tassel on top.
  feature(pc, c, cy, r) {
    pc.vline(CX, cy - r - 1, BASE, P.vegLeafDark)
    leaf(pc, CX - 1, BASE - 2)
    leaf(pc, CX + 1, cy + 3)
    pc.px(CX - 1, cy - r - 2, P.hayLight)
    pc.px(CX + 1, cy - r - 2, P.hayLight)
    pc.px(CX, cy - r - 3, P.hay)
    // The ear, on the stalk's side, its silk out of the top.
    pc.rect(CX + 1, cy - 1, 2, r + 2, P.husk)
    pc.vline(CX + 1, cy, cy + r, c)
    pc.px(CX + 2, cy - 2, P.hayLight)
  },
  // A refactor is a butternut squash: a narrow neck and a heavy bulb, tidy and smooth.
  refactor(pc, c, cy, r) {
    pc.ellipse(CX + 0.5, BASE - r, r + 0.7, r, c)
    pc.rect(CX - 1, cy - r - 1, 3, r + 2, c)
    pc.px(CX - 1, BASE - r - 1, shade(c, 0.3))
    pc.vline(CX + 1, BASE - r, BASE - 1, shade(c, -0.25))
    pc.px(CX, cy - r - 2, P.vegLeafDark)
    pc.px(CX + 1, cy - r - 2, P.vegLeaf)
  },
  // Docs are a wheat sheaf: stalks bound in the middle, the heads heavy with the PR's colour.
  docs(pc, c, cy, r) {
    for (const dx of [-2, -1, 0, 1, 2]) {
      const top = cy - r + Math.abs(dx)
      pc.line(CX + dx, BASE, CX + Math.sign(dx), cy + 1, P.hay)
      pc.line(CX + Math.sign(dx), cy + 1, CX + dx, top, P.hay)
      pc.px(CX + dx, top - 1, c)
      pc.px(CX + dx, top - 2, shade(c, 0.22))
    }
    pc.hline(CX - 1, CX + 1, cy + 1, P.oakBrown)
    pc.px(CX, BASE - 1, P.hayDark)
  },
  // Tests are cranberries: small, many, red in a cluster on a low vine.
  test(pc, c, cy, r) {
    pc.hline(CX - 3, CX + 3, BASE - 1, P.vegLeafDark)
    for (const [dx, dy] of [[-2, 1], [0, 0], [2, 1], [-1, 3], [1, 3]]) {
      pc.ellipse(CX + dx + 0.5, cy + dy + 0.5, 1.1, 1.1, c)
      pc.px(CX + dx, cy + dy, shade(c, 0.35))
    }
    leaf(pc, CX - 3, BASE - 2)
    leaf(pc, CX + 3, BASE - 2)
  },
  // Design work is Indian corn: a cob of many-coloured kernels, the husk peeled back from it.
  ui(pc, c, cy, r) {
    const h = r * 2 + 3
    const kernels = [c, P.kernelRed, P.kernelPlum, P.kernelGold]
    for (let i = 0; i < h; i++) {
      const w = i === 0 || i === h - 1 ? 0 : 1
      for (let x = CX - w; x <= CX + w; x++) pc.px(x, cy - r + i, kernels[(x + i * 2) & 3])
    }
    pc.line(CX - 2, BASE, CX - 2, cy + 1, P.husk)
    pc.line(CX + 2, BASE, CX + 2, cy + 2, P.huskDark)
    pc.vline(CX, cy + r + 2, BASE, P.huskDark)
  },
  // Infrastructure is an acorn squash: squat and ridged, pointed at the bottom.
  infra(pc, c, cy, r) {
    const R2 = r + 1
    const y = BASE - R2 + 1
    pc.ellipse(CX + 0.5, y, R2 + 0.5, R2 - 0.3, c)
    pc.px(CX, BASE, shade(c, -0.3))
    for (const dx of [-2, 0, 2]) pc.vline(CX + dx, y - R2 + 2, y + R2 - 2, shade(c, -0.3))
    pc.px(CX - 2, y - 1, shade(c, 0.3))
    pc.px(CX, y - R2, P.vegLeafDark)
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
    pc.line(CX - 2, cy + r + 1, CX - 2, cy - 1, P.vegLeaf)
    pc.line(CX + 2, cy + r + 1, CX + 2, cy, P.vegLeafDark)
    pc.px(CX, cy - r - 1, P.hayLight)
  },
  // Performance is a crookneck squash: a bulb at the foot and a neck that curves away, quick.
  perf(pc, c, cy, r) {
    pc.ellipse(CX + 0.5, BASE - 1, r + 0.5, 1.8, c)
    for (let i = 0; i < r + 3; i++) {
      const x = CX + Math.round(Math.sin((i / (r + 3)) * 1.6) * 2)
      pc.px(x, BASE - 3 - i, c)
      pc.px(x + 1, BASE - 3 - i, shade(c, -0.25))
    }
    pc.px(CX - 1, BASE - 1, shade(c, 0.3))
    pc.px(CX + 2, BASE - r - 6, P.vegLeafDark)
  },
  // A review is a bottle gourd: a small bulb over a big one, looked at from both sides.
  review(pc, c, cy, r) {
    pc.ellipse(CX + 0.5, BASE - r, r + 0.7, r, c)
    pc.ellipse(CX + 0.5, BASE - 2 * r - 2, r - 0.6, r - 0.6, c)
    pc.rect(CX - 1, BASE - 2 * r - 1, 2, 2, shade(c, -0.15))
    pc.px(CX - 1, BASE - r - 1, shade(c, 0.3))
    pc.px(CX, BASE - 3 * r - 2, P.barnTimberDark)
    pc.px(CX + 1, BASE - 3 * r - 3, P.vegLeaf)
  },
  // Research is a sweet potato: dug and lying on its side, its vine trailing off it.
  research(pc, c, cy, r) {
    pc.ellipse(CX + 0.5, BASE - 1, r + 1.6, 1.7, c)
    pc.px(CX - r, BASE - 1, shade(c, -0.3))
    pc.px(CX - 1, BASE - 2, shade(c, 0.3))
    pc.hline(CX + 1, CX + 2, BASE, shade(c, -0.3))
    pc.line(CX + r + 1, BASE - 2, CX + r + 1, BASE - 6, P.vegLeafDark)
    pc.px(CX + r, BASE - 5, P.vegLeaf)
    pc.px(CX + r + 2, BASE - 4, P.vegLeafLight)
  },
  // Odds and ends are a warty gourd: small and bumpy, a dozen sorts of nobble.
  misc(pc, c, cy, r) {
    const y = BASE - 2
    pc.ellipse(CX + 0.5, y, r * 0.8 + 0.6, r * 0.8 + 0.2, c)
    for (const [dx, dy] of [[-1, -1], [1, 0], [0, 1], [-2, 1]]) pc.px(CX + dx, y + dy, shade(c, dy < 0 ? 0.32 : -0.28))
    pc.px(CX, y - r, P.vegLeafDark)
    pc.px(CX + 1, y - r - 1, P.vegLeaf)
  },
}

/**
 * One finished thread's harvest, for FLOWER_KINDS[kind], the size of a flower and on the flower's spot.
 * @param {number} kind  into FLOWER_KINDS
 * @param {number} stage 0 a seedling · 1 green on the vine (an open PR) · 2 ripe
 * @param {string} color its colour, the pull request's
 */
export function drawHarvest(kind, stage, color) {
  const k = FLOWER_KINDS[kind] || FLOWER_KINDS[0]
  const pc = new PixelCanvas(FLOWER_W, FLOWER_H)
  // Straw drawn up round its foot, always: it is what marks the spot the renderer picks it by.
  pc.hline(CX - 2, CX + 2, BASE, P.hayDark)
  pc.px(CX - 2, BASE, P.patchSoilDark)
  pc.px(CX + 2, BASE, P.patchSoilDark)
  if (stage <= 0) {
    // Just sown: a seedling's two leaves up out of the mulch.
    pc.vline(CX, BASE - 2, BASE - 1, P.vegLeafDark)
    pc.px(CX - 1, BASE - 3, P.vegLeafLight)
    pc.px(CX + 1, BASE - 3, P.vegLeaf)
    return pc.outline(P.outline)
  }
  const r = R[k.size] ?? R.m
  const cy = BASE - (LIFT[k.stem] ?? LIFT.mid) - (k.size === 'l' ? 1 : 0)
  // Unripe, the same shape in green with a touch of its colour coming through, so an open PR reads
  // as not done at a glance rather than merely as a darker gourd.
  const unripe = stage < 2
  const c = unripe ? P.vegLeafLight : color
  const draw = CROPS[k.work] || CROPS.misc
  draw(pc, c, cy, r)
  if (unripe) pc.px(CX, cy, color)
  return pc.outline(P.outline)
}
