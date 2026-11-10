// Finished work at Christmas: a wrapped present, set out on the plot's present pile where the village
// grows a flower. A present keeps everything a flower says: its shape says what kind of work it
// was (a ribboned box for a bug fix, a round tin for a refactor, a stocking for a review), its
// ribbon is the pull request's colour, a white ribbon is an unlabeled PR, and an open PR's is
// still being wrapped: a box in plain brown paper with the ribbon not yet tied, lying beside it.
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
/** How many rows of box it stands, by the flower kind's stem. */
const HEIGHT = { tall: 6, mid: 5, short: 4 }
/** How wide it is either side of the middle, by the flower kind's size. */
const HALF = { s: 1, m: 2, l: 3 }
/** The wrapping paper of each kind of work: base, then its darker side. Never white, so a white ribbon shows. */
const PAPER = {
  fix: P.xmasPaint[0], feature: P.xmasPaint[1], refactor: P.xmasPaint[6], docs: P.xmasPaint[2], test: P.xmasPaint[4],
  ui: P.xmasPaint[6], infra: P.xmasPlank, data: P.xmasPaint[1], perf: P.xmasPaint[3], review: P.xmasPaint[0],
  research: P.xmasPaint[7], misc: P.xmasPaint[5],
}
/** Brown kraft paper, for a present not yet wrapped. */
const KRAFT = P.xmasPlankLight

/** A box with its left lit and its right in shade, x from CX-half to CX+half, y0..y1. */
function boxOf(pc, half, y0, y1, paper) {
  for (let x = CX - half; x <= CX + half; x++) {
    const c = x === CX - half ? shade(paper, 0.25) : x === CX + half ? shade(paper, -0.3) : paper
    pc.vline(x, y0, y1, c)
  }
  pc.hline(CX - half, CX + half, y1, shade(paper, -0.35))
}

/** A ribbon straight down the middle, and one across at row y. */
function ribbon(pc, half, y0, y1, y, c, { down = true, across = true } = {}) {
  if (down) pc.vline(CX, y0, y1 - 1, c)
  if (across) pc.hline(CX - half, CX + half, y, c)
}

/** A bow on top of a box at row y: two loops and a knot. */
function bow(pc, y, c) {
  pc.px(CX - 2, y - 1, c)
  pc.px(CX - 1, y, c)
  pc.px(CX + 1, y, c)
  pc.px(CX + 2, y - 1, c)
  pc.px(CX - 1, y - 1, shade(c, 0.3))
  pc.px(CX + 1, y - 1, shade(c, -0.25))
  pc.px(CX, y, shade(c, -0.35))
}

const top = (h) => BASE - h

/**
 * Each kind of work has its own present. `c` is the ribbon's colour (the pull request's), `h` how
 * many rows tall it stands and `w` the half-width.
 */
const PRESENTS = {
  // A bug fix is the plain ribboned box: the one under every tree.
  fix: (pc, c, h, w) => {
    const y0 = top(h)
    boxOf(pc, w, y0, BASE - 1, PAPER.fix)
    ribbon(pc, w, y0, BASE, y0 + 1, c)
    bow(pc, y0 - 1, c)
  },
  // A new feature is a tall box, tied once up its length.
  feature: (pc, c, h, w) => {
    const y0 = top(h + 1)
    boxOf(pc, Math.min(w, 2), y0, BASE - 1, PAPER.feature)
    ribbon(pc, Math.min(w, 2), y0, BASE, y0 + 1, c, { across: false })
    pc.vline(CX - 1, y0, BASE - 1, shade(PAPER.feature, 0.2))
    bow(pc, y0 - 1, c)
  },
  // A refactor is a round tin, its lid on, a band of ribbon round its middle.
  refactor: (pc, c, h, w) => {
    const y0 = top(h)
    const r = Math.max(2, w)
    boxOf(pc, r, y0, BASE - 1, PAPER.refactor)
    pc.hline(CX - r - 1 + 1, CX + r - 1, y0, P.xmasSnow)
    pc.hline(CX - r, CX + r, y0 + 1, shade(PAPER.refactor, 0.35))
    pc.hline(CX - r, CX + r, y0 + Math.floor(h / 2) + 1, c)
    pc.px(CX, y0 - 1, c)
    pc.px(CX - r, y0, P.xmasTinsel)
    pc.px(CX + r, y0, P.xmasTinsel)
  },
  // Docs are a flat parcel, string-tied, with a paper tag.
  docs: (pc, c, h, w) => {
    const r = Math.max(2, w)
    const y0 = BASE - 4
    boxOf(pc, r, y0, BASE - 1, PAPER.docs)
    pc.hline(CX - r, CX + r, y0 + 1, shade(PAPER.docs, 0.3))
    ribbon(pc, r, y0, BASE, y0 + 1, c, { across: false })
    pc.hline(CX - r, CX + r, y0 + 2, c)
    pc.px(CX + r, y0 - 1, P.xmasIcing)
    pc.px(CX + r, y0 - 2, P.xmasIcing)
    pc.px(CX + r - 1, y0 - 1, c)
  },
  // Tests are a small spotted box, a single bow.
  test: (pc, c, h, w) => {
    const y0 = BASE - 4
    boxOf(pc, 2, y0, BASE - 1, PAPER.test)
    for (const [x, y] of [[CX - 1, y0 + 1], [CX + 1, y0 + 2], [CX - 1, y0 + 3]]) pc.px(x, y, P.xmasPaint[0])
    pc.px(CX, y0, c)
    bow(pc, y0 - 1, c)
  },
  // Design work has a star on top instead of a bow.
  ui: (pc, c, h, w) => {
    const y0 = top(h)
    boxOf(pc, w, y0, BASE - 1, PAPER.ui)
    ribbon(pc, w, y0, BASE, y0 + 1, c, { down: false })
    pc.vline(CX, y0, BASE - 1, c)
    pc.px(CX, y0 - 1, P.xmasTinsel)
    pc.hline(CX - 1, CX + 1, y0 - 2, P.xmasTinsel)
    pc.px(CX, y0 - 3, P.xmasBulbYellow)
  },
  // Infrastructure is a toy chest: a lid, iron straps and a clasp.
  infra: (pc, c, h, w) => {
    const r = Math.max(2, w)
    const y0 = BASE - 5
    boxOf(pc, r, y0, BASE - 1, PAPER.infra)
    pc.hline(CX - r, CX + r, y0 + 1, P.xmasPlankDark)
    for (const x of [CX - r, CX + r]) pc.vline(x, y0, BASE - 1, P.farmIron)
    pc.px(CX, y0 + 2, P.xmasTinsel)
    pc.hline(CX - r, CX + r, y0 - 1, c)
  },
  // Data is wrapped in plaid: a check of two papers, ribbon across.
  data: (pc, c, h, w) => {
    const y0 = top(h)
    const r = Math.max(2, w)
    boxOf(pc, r, y0, BASE - 1, PAPER.data)
    for (let y = y0; y < BASE; y++) for (let x = CX - r; x <= CX + r; x++) if ((x + y) % 2 === 0) pc.px(x, y, P.xmasIcingDark)
    ribbon(pc, r, y0, BASE, y0 + 1, c, { down: false })
    pc.px(CX + r, y0 - 1, c)
    pc.px(CX + r - 1, y0 - 2, c)
  },
  // Performance is a narrow box with a long curled streamer shooting up from it.
  perf: (pc, c, h, w) => {
    const y0 = top(h)
    boxOf(pc, 1, y0, BASE - 1, PAPER.perf)
    ribbon(pc, 1, y0, BASE, y0 + 1, c)
    pc.px(CX, y0 - 1, c)
    pc.px(CX + 1, y0 - 2, c)
    pc.px(CX, y0 - 3, shade(c, 0.3))
    pc.px(CX - 1, y0 - 4, c)
  },
  // A review hangs from a hook on a short post, looking down on the rest: a stocking.
  review: (pc, c, h, w) => {
    pc.vline(CX - 3, 2, BASE - 1, P.xmasLog)
    pc.hline(CX - 3, CX, 2, P.xmasLog)
    pc.px(CX, 3, P.xmasLogDark)
    pc.rect(CX - 1, 4, 3, 2, P.xmasIcing)
    pc.px(CX - 1, 4, P.white)
    pc.rect(CX - 1, 6, 3, 3, PAPER.review)
    pc.rect(CX - 1, 9, 4, 2, PAPER.review)
    pc.px(CX + 2, 10, shade(PAPER.review, -0.3))
    pc.hline(CX - 1, CX + 1, 7, c)
    pc.px(CX - 1, 6, shade(PAPER.review, 0.3))
  },
  // Research is a snow globe: a glass dome on a ribbon-banded base.
  research: (pc, c, h, w) => {
    const r = Math.max(2, w)
    pc.ellipse(CX, BASE - 5, r + 0.4, 3.2, PAPER.research)
    pc.px(CX - 1, BASE - 7, P.white)
    pc.px(CX + 1, BASE - 5, P.xmasSnow)
    pc.px(CX - 1, BASE - 4, P.xmasSnow)
    pc.hline(CX - 1, CX + 1, BASE - 4, P.xmasSnowShade)
    pc.rect(CX - r, BASE - 2, 2 * r + 1, 2, P.xmasLogDark)
    pc.hline(CX - r, CX + r, BASE - 2, c)
  },
  // Odds and ends are a gift sack tied at the neck.
  misc: (pc, c, h, w) => {
    pc.ellipse(CX, BASE - 3, 2.6, 3.2, PAPER.misc)
    pc.px(CX - 2, BASE - 4, shade(PAPER.misc, 0.3))
    pc.rect(CX - 1, BASE - 8, 3, 2, PAPER.misc)
    pc.hline(CX - 2, CX + 2, BASE - 6, c)
    pc.px(CX - 2, BASE - 5, c)
    pc.px(CX + 2, BASE - 5, c)
    pc.px(CX, BASE - 9, shade(PAPER.misc, 0.3))
  },
}

/** An unwrapped present: plain kraft paper, a ribbon lying across it untied, a curl on the ground. */
function unwrapped(pc, c, h, w) {
  const y0 = top(Math.min(h, 5))
  const r = Math.max(1, Math.min(w, 2))
  boxOf(pc, r, y0, BASE - 1, KRAFT)
  pc.hline(CX - r, CX + r, y0 + 1, c)
  pc.px(CX + r, y0, c)
  pc.px(CX + r + 1, y0 - 1, c)
  pc.px(CX - r - 1, BASE - 1, c)
}

/**
 * One finished thread's present, for FLOWER_KINDS[kind], the size of a flower and on the flower's spot.
 * @param {number} kind  into FLOWER_KINDS
 * @param {number} stage 0 a fir sprig · 1 still being wrapped (an open PR) · 2 wrapped and tied
 * @param {string} color its ribbon's colour, the pull request's
 */
export function drawChristmas(kind, stage, color) {
  const k = FLOWER_KINDS[kind] || FLOWER_KINDS[0]
  const pc = new PixelCanvas(FLOWER_W, FLOWER_H)
  // A tuft of snow at the foot, always: it is what marks the spot the renderer picks the present by.
  pc.hline(CX - 2, CX + 2, BASE, P.xmasSnowShade)
  pc.px(CX - 2, BASE, P.xmasBedDeep)
  pc.px(CX + 2, BASE, P.xmasBedDeep)
  if (stage <= 0) {
    // Just set out: a fir seedling in the felt.
    pc.vline(CX, BASE - 3, BASE - 1, P.xmasLog)
    pc.hline(CX - 1, CX + 1, BASE - 3, P.xmasFir)
    pc.px(CX, BASE - 4, P.xmasFirLight)
    pc.px(CX - 1, BASE - 2, P.xmasFirDark)
    pc.px(CX + 1, BASE - 2, P.xmasFirDark)
    return pc.outline(P.outline)
  }
  const w = HALF[k.size] ?? HALF.m
  const h = HEIGHT[k.stem] ?? HEIGHT.mid
  if (stage === 1) unwrapped(pc, color, h, w)
  else (PRESENTS[k.work] || PRESENTS.misc)(pc, color, h, w)
  return pc.outline(P.outline)
}
