// Finished work at Hanukkah: a candle, set out on the plot's candle bed where the village grows a
// flower, and a dreidel for tests. A candle keeps everything a flower says: its silhouette says
// what kind of work it was (a tall candle for a bug fix, a taper for docs, the shammash for a
// review), its wax is the pull request's colour, a white one is an unlabeled PR, and an open PR's
// candle is not lit yet: the same candle with its wick dark, the wax dim with a touch of its colour.
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
/** How many rows of wax it stands, by the flower kind's stem. */
const HEIGHT = { tall: 6, mid: 5, short: 4 }

/** The flame over a wick at row y: lit, a bright core in a teardrop; unlit, only the dark wick. */
function flame(pc, x, y, lit, big = false) {
  if (lit) {
    pc.px(x, y, P.flameCore)
    pc.px(x, y - 1, P.flameTip)
    if (big) pc.px(x, y - 2, P.flame)
  } else {
    pc.px(x, y, P.hkBrassDark)
  }
}

/**
 * One candle: wax from row y0 down to the base, `half` wide either side of column x, in colour
 * `c` (dimmed unless lit), with a light edge down its left and a shadow down its right.
 */
function wax(pc, { c, lit, y0, half = 0, x = CX, y1 = BASE - 1, flameBig = false }) {
  const body = lit ? c : shade(c, -0.45)
  for (let y = y0; y <= y1; y++) {
    pc.hline(x - half, x + half, y, body)
    pc.px(x - half, y, lit ? shade(c, 0.25) : shade(c, -0.3))
    if (half > 0) pc.px(x + half, y, shade(c, lit ? -0.25 : -0.6))
  }
  flame(pc, x, y0 - 1, lit, flameBig)
}

const top = (h) => BASE - h

/**
 * Each kind of work has its own candle. `c` is the wax's colour (the pull request's), `lit`
 * whether the flame is burning, `h` how many rows of wax and `w` the half-width.
 */
const CANDLES = {
  // A bug fix is the tall candle: the one on every sill.
  fix: (pc, c, lit, h) => wax(pc, { c, lit, y0: top(h), half: 0 }),
  // A new feature is a fat candle, its flame large.
  feature: (pc, c, lit, h) => wax(pc, { c, lit, y0: top(h), half: 1, flameBig: true }),
  // A refactor is a twisted candle: the wax turns a pixel left and right as it climbs.
  refactor: (pc, c, lit, h) => {
    wax(pc, { c, lit, y0: top(h), half: 0 })
    for (let y = top(h); y <= BASE - 1; y++) {
      pc.px(CX + (y % 2 ? 1 : -1), y, lit ? shade(c, y % 4 < 2 ? 0.2 : -0.2) : shade(c, -0.55))
    }
  },
  // Docs are a taper: very tall and thin, a curl of wick.
  docs: (pc, c, lit, h) => {
    wax(pc, { c, lit, y0: top(h + 1), half: 0 })
    pc.px(CX - 1, top(h + 1) - 1, lit ? P.flameTip : P.hkBrassDark)
  },
  // Tests are a dreidel: the little top on its point, a letter on the face, spun on the bed.
  test: (pc, c, lit) => {
    pc.rect(CX - 2, BASE - 6, 5, 4, lit ? c : shade(c, -0.45))
    pc.hline(CX - 2, CX + 2, BASE - 6, lit ? shade(c, 0.28) : shade(c, -0.3))
    pc.hline(CX - 1, CX + 1, BASE - 2, lit ? shade(c, -0.2) : shade(c, -0.6))
    pc.px(CX, BASE - 1, P.hkBrassDark)
    pc.vline(CX, BASE - 9, BASE - 7, P.hkBrassDark)
    pc.px(CX - 1, BASE - 5, P.white)
    pc.px(CX, BASE - 4, P.white)
    pc.px(CX + 1, BASE - 5, P.white)
    if (lit) pc.px(CX, BASE - 10, P.flameTip)
  },
  // Design work is a candle with a band of silver foil round the middle.
  ui: (pc, c, lit, h) => {
    wax(pc, { c, lit, y0: top(h), half: 1 })
    pc.hline(CX - 1, CX + 1, top(h) + 2, P.hkBrassLight)
  },
  // Infrastructure stands in a silver holder: a cup and a stem.
  infra: (pc, c, lit, h) => {
    wax(pc, { c, lit, y0: top(h), y1: BASE - 3, half: 0 })
    pc.hline(CX - 2, CX + 2, BASE - 2, P.hkBrassLight)
    pc.hline(CX - 1, CX + 1, BASE - 1, P.hkBrass)
    pc.px(CX - 2, BASE - 3, P.hkBrassLight)
    pc.px(CX + 2, BASE - 3, P.hkBrassLight)
  },
  // Data is a striped candle: rings of white round the wax.
  data: (pc, c, lit, h) => {
    wax(pc, { c, lit, y0: top(h), half: 1 })
    for (let y = top(h) + 1; y <= BASE - 1; y += 2) pc.hline(CX - 1, CX + 1, y, lit ? P.white : P.hkWhitewashDark)
  },
  // Performance is a slim, short candle with a tall flame.
  perf: (pc, c, lit, h) => wax(pc, { c, lit, y0: top(h - 1), half: 0, flameBig: true }),
  // A review is the shammash, the helper candle, standing on a silver stem above the rest.
  review: (pc, c, lit, h) => {
    pc.vline(CX, BASE - 5, BASE - 1, P.hkBrass)
    pc.hline(CX - 2, CX + 2, BASE - 1, P.hkBrassLight)
    pc.px(CX - 2, BASE - 4, P.hkBrassLight)
    pc.px(CX + 2, BASE - 4, P.hkBrassLight)
    pc.hline(CX - 2, CX + 2, BASE - 3, P.hkBrassLight)
    wax(pc, { c, lit, y0: 4, y1: BASE - 6, half: 0 })
  },
  // Research is beeswax: round shouldered, with a drip down one side.
  research: (pc, c, lit, h) => {
    wax(pc, { c, lit, y0: top(h), half: 1 })
    pc.px(CX - 1, top(h), lit ? shade(c, 0.2) : shade(c, -0.45))
    pc.vline(CX + 2, top(h) + 1, top(h) + 3, P.honey)
  },
  // Odds and ends are a little candle, whatever shape it came in: a stub with a short flame.
  misc: (pc, c, lit) => wax(pc, { c, lit, y0: BASE - 3, half: 1 }),
}

/**
 * One finished thread's candle, for FLOWER_KINDS[kind], the size of a flower and on the flower's spot.
 * @param {number} kind  into FLOWER_KINDS
 * @param {number} stage 0 a candle waiting in its holder · 1 the candle, not yet lit (an open PR) · 2 lit
 * @param {string} color its colour, the pull request's
 */
export function drawHanukkah(kind, stage, color) {
  const k = FLOWER_KINDS[kind] || FLOWER_KINDS[0]
  const pc = new PixelCanvas(FLOWER_W, FLOWER_H)
  // A silver foot, always: it is what marks the spot the renderer picks the candle by.
  pc.hline(CX - 2, CX + 2, BASE, P.hkBrassDark)
  pc.px(CX - 2, BASE, P.patchSoilNightDark)
  pc.px(CX + 2, BASE, P.patchSoilNightDark)
  if (stage <= 0) {
    // Just set out: a short stub of white wax, never lit.
    pc.rect(CX - 1, BASE - 3, 2, 3, P.sugarDust)
    pc.px(CX - 1, BASE - 3, P.white)
    pc.px(CX, BASE - 4, P.hkBrassDark)
    return pc.outline(P.outline)
  }
  const h = HEIGHT[k.stem] ?? HEIGHT.mid
  const lit = stage >= 2
  const draw = CANDLES[k.work] || CANDLES.misc
  draw(pc, color, lit, h)
  // Unlit, the wax keeps a touch of its colour so an open PR reads as not done at a glance.
  if (!lit) pc.px(CX, BASE - 2, color)
  return pc.outline(P.outline)
}
