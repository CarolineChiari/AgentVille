// Finished work in the colony: a beacon or a crystal sample, set out in the plot's sample bay where
// the village grows a flower. It keeps everything a flower says: its silhouette says what kind of
// work it was (a warning beacon for a bug fix, a cut gem for design, a sample jar for docs), its
// glass is the pull request's colour, a white one is an unlabeled PR, and an open PR's is not lit
// yet: the same sample with its lamp dark, the glass nearly black with a touch of its colour.
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
/** How many rows tall it stands, by the flower kind's stem. */
const HEIGHT = { tall: 6, mid: 5, short: 4 }
/** How wide it is either side of the middle, by the flower kind's size. */
const HALF = { s: 1, m: 2, l: 3 }

/** Glass of colour c: lit it glows, unlit it is nearly black. d lightens (+) or darkens (-) it. */
const glass = (c, lit, d = 0) => shade(c, (lit ? 0 : -0.55) + d)

/** A body of glass from row y0 to y1, `half(i, n)` wide either side of column cx on its i-th of n rows. */
function body(pc, { c, lit, y0, y1, half, cx = CX, rim }) {
  const n = y1 - y0 + 1
  for (let y = y0; y <= y1; y++) {
    const w = half(y - y0, n)
    for (let x = cx - w; x <= cx + w; x++) pc.px(x, y, x === cx - w || x === cx + w ? rim || glass(c, lit, -0.3) : glass(c, lit))
    if (w >= 2) pc.px(cx - w + 1, y, glass(c, lit, 0.3))
  }
  if (lit) pc.px(cx, y0 + Math.floor(n / 2), P.spaceGlow)
}

const round = (w) => (i, n) => Math.max(1, Math.round(w * Math.sin((Math.PI * (i + 0.5)) / n) + 0.3))
const flat = (w) => () => w
const spire = (w) => (i, n) => Math.min(w, Math.round((i * (w + 0.8)) / Math.max(1, n * 0.55)))
const gem = (w) => (i, n) => Math.max(0, Math.round(w * (1 - Math.abs((2 * i) / Math.max(1, n - 1) - 1))))
const top = (h) => BASE - h

/** The plate every sample stands on. */
function plate(pc) {
  pc.hline(CX - 2, CX + 2, BASE, P.spacePlateDark)
  pc.px(CX - 2, BASE, P.spaceBedDark)
  pc.px(CX + 2, BASE, P.spaceBedDark)
}

/** A mast of hazard bands from row y0 down to the plate. */
function mast(pc, x, y0) {
  for (let y = y0; y < BASE; y++) pc.px(x, y, (y - y0) % 2 ? P.spaceHazard : P.spacePlateLight)
}

const SAMPLES = {
  // A bug fix is the warning beacon: a domed lamp on a short banded post.
  fix: (pc, c, lit, h, w) => {
    mast(pc, CX, BASE - 2)
    pc.hline(CX - 2, CX + 2, BASE - 3, P.spacePlate)
    body(pc, { c, lit, y0: top(h), y1: BASE - 4, half: round(w + 0.4) })
  },
  // A new feature is a mast beacon: a tall banded mast with a lamp right at the top and a cross-arm.
  feature: (pc, c, lit, h) => {
    mast(pc, CX, top(h + 1) + 3)
    pc.hline(CX - 2, CX + 2, top(h + 1) + 3, P.spacePlate)
    body(pc, { c, lit, y0: top(h + 1), y1: top(h + 1) + 2, half: flat(1) })
  },
  // A refactor is a cluster of three crystals leaning on each other.
  refactor: (pc, c, lit, h) => {
    body(pc, { c, lit, y0: BASE - 4, y1: BASE - 1, half: spire(1), cx: CX - 2 })
    body(pc, { c, lit, y0: BASE - 3, y1: BASE - 1, half: spire(1), cx: CX + 2 })
    body(pc, { c, lit, y0: top(h), y1: BASE - 1, half: spire(1) })
  },
  // Docs are a sample jar: glass, a plate lid, the colour sealed inside.
  docs: (pc, c, lit, h, w) => {
    const iw = Math.max(2, w)
    body(pc, { c, lit, y0: top(h) + 1, y1: BASE - 1, half: flat(iw), rim: P.spaceGlassLight })
    pc.hline(CX - iw, CX + iw, top(h), P.spacePlateLight)
    pc.hline(CX - iw + 1, CX + iw - 1, top(h) - 1, P.spacePlate)
    pc.px(CX, BASE - 2, P.spaceGlassLight)
  },
  // Tests are a small shard: one little crystal on its plate.
  test: (pc, c, lit) => body(pc, { c, lit, y0: BASE - 4, y1: BASE - 1, half: spire(1) }),
  // Design work is a cut gem: wide at the girdle, faceted, pointed below.
  ui: (pc, c, lit, h, w) => {
    body(pc, { c, lit, y0: top(h), y1: BASE - 1, half: gem(w + 1) })
    pc.hline(CX - 1, CX + 1, top(h) + 1, glass(c, lit, 0.4))
  },
  // Infrastructure is a relay mast: a lattice tower with a lamp at its tip.
  infra: (pc, c, lit, h) => {
    const t = top(h + 1)
    pc.line(CX - 2, BASE - 1, CX, t + 3, P.spacePlateLight)
    pc.line(CX + 2, BASE - 1, CX, t + 3, P.spacePlate)
    pc.hline(CX - 1, CX + 1, BASE - 4, P.spacePlateDark)
    pc.vline(CX, t + 3, BASE - 1, P.spacePlateDark)
    body(pc, { c, lit, y0: t, y1: t + 2, half: flat(1) })
  },
  // Data is a core sample tray: three cores in a rack, each a different length.
  data: (pc, c, lit, h) => {
    pc.hline(CX - 3, CX + 3, BASE - 1, P.spacePlate)
    for (const [dx, hh] of [[-2, h - 1], [0, h], [2, h - 2]]) {
      pc.vline(CX + dx, BASE - 1 - hh, BASE - 2, glass(c, lit))
      pc.px(CX + dx - 1, BASE - 1 - hh, glass(c, lit, -0.3))
      pc.px(CX + dx, BASE - 1 - hh, glass(c, lit, 0.3))
    }
    if (lit) pc.px(CX, BASE - 3, P.spaceGlow)
  },
  // Performance is a spire: a long needle of crystal, widest at the foot.
  perf: (pc, c, lit, h, w) => body(pc, { c, lit, y0: top(h + 1), y1: BASE - 1, half: spire(Math.min(w, 2)) }),
  // A review hangs from a gantry arm, looking down on the rest.
  review: (pc, c, lit, h, w) => {
    pc.vline(CX - 3, 2, BASE - 1, P.spacePlate)
    pc.hline(CX - 3, CX, 2, P.spacePlateLight)
    pc.px(CX, 3, P.spacePlateDark)
    body(pc, { c, lit, y0: 4, y1: BASE - 2, half: round(Math.min(w, 2) + 0.4) })
  },
  // Research is a specimen dome: a bell of clear glass over a crystal on its plate.
  research: (pc, c, lit, h, w) => {
    const iw = Math.max(2, w)
    body(pc, { c: P.spaceGlass, lit: true, y0: top(h), y1: BASE - 2, half: round(iw + 0.5), rim: P.spaceGlassLight })
    pc.hline(CX - iw - 1, CX + iw + 1, BASE - 1, P.spacePlate)
    body(pc, { c, lit, y0: BASE - 4, y1: BASE - 2, half: spire(1) })
  },
  // Odds and ends are a sample cube: a sealed box, a label on its face.
  misc: (pc, c, lit) => {
    pc.rect(CX - 2, BASE - 4, 5, 4, glass(c, lit))
    pc.hline(CX - 2, CX + 2, BASE - 4, P.spacePlateLight)
    pc.vline(CX + 2, BASE - 3, BASE - 1, glass(c, lit, -0.3))
    pc.px(CX - 1, BASE - 2, P.spaceHullLight)
    pc.px(CX, BASE - 2, P.spaceHullDark)
  },
}

/**
 * One finished thread's beacon or crystal, for FLOWER_KINDS[kind], the size of a flower and on the flower's spot.
 * @param {number} kind  into FLOWER_KINDS
 * @param {number} stage 0 a bare marker peg · 1 the sample, not yet lit (an open PR) · 2 lit
 * @param {string} color its colour, the pull request's
 */
export function drawSpace(kind, stage, color) {
  const k = FLOWER_KINDS[kind] || FLOWER_KINDS[0]
  const pc = new PixelCanvas(FLOWER_W, FLOWER_H)
  // A plate, always: it is what marks the spot the renderer picks the sample by.
  plate(pc)
  if (stage <= 0) {
    // Just surveyed: a peg with a hazard stripe, its lamp not fitted.
    mast(pc, CX, BASE - 4)
    pc.px(CX, BASE - 5, P.spacePlateDark)
    return pc.outline(P.outline)
  }
  const w = HALF[k.size] ?? HALF.m
  const h = HEIGHT[k.stem] ?? HEIGHT.mid
  const lit = stage >= 2
  const draw = SAMPLES[k.work] || SAMPLES.misc
  draw(pc, color, lit, h, w)
  // Unlit, the glass keeps a touch of its colour so an open PR reads as not done at a glance
  // rather than merely as a darker sample.
  if (!lit) pc.px(CX, BASE - 3, color)
  return pc.outline(P.outline)
}
