// Finished work at Diwali: a diya, the clay oil lamp, set out on the plot's lamp bed where the village
// grows a flower. A diya keeps everything a flower says: its silhouette says what kind of work it was
// (a plain clay diya for a bug fix, a tall brass deepam for a feature, a leaf boat for docs), the band
// painted round its rim is the pull request's colour, a white one is an unlabeled PR, and an open PR's
// diya is not lit yet: the same lamp with its wick dark and the paint dimmed.
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
/** How many rows tall the flame or the stand is, by the flower kind's stem. */
const HEIGHT = { tall: 3, mid: 2, short: 1 }
/** How wide the bowl is either side of the middle, by the flower kind's size. */
const HALF = { s: 1, m: 2, l: 3 }

/** The flame over a wick at (x, y): warm when lit, a black wick when not. */
function flame(pc, x, y, lit, tall = 1) {
  if (!lit) return pc.px(x, y, P.cinder)
  pc.px(x, y, P.flameTip)
  for (let i = 1; i <= tall; i++) pc.px(x, y - i, i === tall ? P.glowCandle : P.flameTip)
}

/**
 * A diya's bowl with its rim at row y, `w` either side of the middle: a light rim, a band painted
 * in the pull request's colour, and clay below. Unlit, the paint dims but keeps a touch of its colour.
 */
function bowl(pc, { c, lit, y, w, cx = CX, clay = P.diyaClay, rim = P.diyaClayLight, dark = P.diyaClayDark }) {
  const paint = lit ? c : shade(c, -0.5)
  pc.hline(cx - w, cx + w, y, rim)
  pc.hline(cx - w, cx + w, y + 1, paint)
  if (!lit) pc.px(cx, y + 1, c)
  pc.hline(cx - w + 1, cx + w - 1, y + 2, clay)
  if (w >= 2) pc.hline(cx - w + 2, cx + w - 2, y + 3, dark)
  // The lip the oil is poured from, on the left.
  pc.px(cx - w - 1, y - 1 + 1, rim)
}

const stand = (pc, y0, y1, c = P.diwaliBrass) => {
  pc.vline(CX, y0, y1, c)
  pc.hline(CX - 2, CX + 2, y1 + 1, P.diwaliBrassDark)
}

/**
 * Each kind of work has its own lamp. `c` is the paint's colour (the pull request's), `lit` whether
 * the wick is burning, `h` how tall (flame or stand) and `w` the half-width of the bowl.
 */
const LAMPS = {
  // A bug fix is the plain clay diya, the one on every doorstep.
  fix: (pc, c, lit, h, w) => {
    bowl(pc, { c, lit, y: BASE - 4, w: Math.max(2, w) })
    flame(pc, CX, BASE - 5, lit, h)
  },
  // A new feature is a deepam: a brass lamp lifted on a stem.
  feature: (pc, c, lit, h, w) => {
    stand(pc, BASE - 4 - h, BASE - 2)
    bowl(pc, { c, lit, y: BASE - 6 - h, w: Math.min(w, 2), clay: P.diwaliBrass, rim: P.diwaliBrassLight, dark: P.diwaliBrassDark })
    flame(pc, CX, BASE - 7 - h, lit, 1)
  },
  // A refactor is two lamps, side by side, one turned.
  refactor: (pc, c, lit, h, w) => {
    bowl(pc, { c, lit, y: BASE - 3, w: 1, cx: CX - 2 })
    bowl(pc, { c, lit, y: BASE - 3, w: 1, cx: CX + 2 })
    flame(pc, CX - 2, BASE - 4, lit, h)
    flame(pc, CX + 2, BASE - 5 + 1, lit, 1)
    pc.hline(CX - 3, CX + 3, BASE - 1, P.diyaClayDark)
  },
  // Docs are a leaf boat: a green leaf with a lamp floated on it and the colour as a petal.
  docs: (pc, c, lit, h, w) => {
    pc.hline(CX - 3, CX + 3, BASE - 2, P.palmGreen)
    pc.hline(CX - 2, CX + 2, BASE - 1, P.palmGreenDark)
    pc.px(CX - 4, BASE - 3, P.palmGreen)
    pc.px(CX + 4, BASE - 3, P.palmGreen)
    bowl(pc, { c, lit, y: BASE - 5, w: 1 })
    flame(pc, CX, BASE - 6, lit, 1)
    pc.px(CX + 2, BASE - 3, c)
  },
  // Tests are a tiny diya, the sort a child lights.
  test: (pc, c, lit) => {
    bowl(pc, { c, lit, y: BASE - 3, w: 1 })
    flame(pc, CX, BASE - 4, lit, 1)
  },
  // Design work is a rangoli: a diamond of coloured powder with a lamp in the middle.
  ui: (pc, c, lit, h, w) => {
    const r = Math.max(2, w + 1)
    for (let dy = -r; dy <= r; dy++) {
      const half = r - Math.abs(dy)
      pc.hline(CX - half, CX + half, BASE - 3 + Math.round(dy / 2), dy % 2 ? shade(c, 0.25) : c)
    }
    pc.px(CX, BASE - 3, P.white)
    flame(pc, CX, BASE - 5 - Math.round(r / 2), lit, 1)
    pc.px(CX, BASE - 4 - Math.round(r / 2) + 0, P.diyaClay)
  },
  // Infrastructure is a lamp on a brass thali: more metal than clay.
  infra: (pc, c, lit, h, w) => {
    pc.hline(CX - 4, CX + 4, BASE - 1, P.diwaliBrassLight)
    pc.hline(CX - 3, CX + 3, BASE, P.diwaliBrassDark)
    bowl(pc, { c, lit, y: BASE - 4, w: Math.max(1, w - 1), clay: P.diwaliBrass, rim: P.diwaliBrassLight, dark: P.diwaliBrassDark })
    flame(pc, CX, BASE - 5, lit, 1)
  },
  // Data is a lamp of many wicks: a row of flames along one long bowl.
  data: (pc, c, lit, h, w) => {
    const hw = Math.max(2, w)
    bowl(pc, { c, lit, y: BASE - 4, w: hw })
    for (let x = CX - hw + 1; x <= CX + hw - 1; x += 2) flame(pc, x, BASE - 5, lit, 0)
  },
  // Performance is a tall flame, narrow and quick, over a small bowl.
  perf: (pc, c, lit, h, w) => {
    bowl(pc, { c, lit, y: BASE - 4, w: 1 })
    flame(pc, CX, BASE - 5, lit, h + 2)
  },
  // A review hangs from a hook on a short post, looking down on the rest.
  review: (pc, c, lit, h, w) => {
    pc.vline(CX - 3, 2, BASE - 1, P.barnTimber)
    pc.hline(CX - 3, CX, 2, P.barnTimber)
    pc.px(CX, 3, P.diwaliBrassDark)
    pc.vline(CX, 3, 4, P.diwaliBrassDark)
    bowl(pc, { c, lit, y: 6, w: 1 })
    flame(pc, CX, 5, lit, 0)
  },
  // Research is a glass jar with a candle in it: clear glass, a bright shine down one side.
  research: (pc, c, lit, h, w) => {
    const hw = Math.max(1, Math.min(w, 2))
    pc.rect(CX - hw, BASE - 5, 2 * hw + 1, 4, lit ? shade(c, 0.1) : shade(c, -0.55))
    pc.hline(CX - hw, CX + hw, BASE - 6, P.glazeWhite)
    pc.vline(CX - hw, BASE - 5, BASE - 4, P.white)
    flame(pc, CX, BASE - 6 + 1, lit, 0)
  },
  // Odds and ends are a small diya with a marigold petal beside it.
  misc: (pc, c, lit) => {
    bowl(pc, { c, lit, y: BASE - 3, w: 1, cx: CX - 1 })
    flame(pc, CX - 1, BASE - 4, lit, 1)
    pc.px(CX + 2, BASE - 1, P.marigold)
    pc.px(CX + 3, BASE - 1, P.marigoldLight)
  },
}

/**
 * One finished thread's diya, for FLOWER_KINDS[kind], the size of a flower and on the flower's spot.
 * @param {number} kind  into FLOWER_KINDS
 * @param {number} stage 0 an unlit lamp just set out · 1 the lamp, not yet lit (an open PR) · 2 lit
 * @param {string} color its colour, the pull request's
 */
export function drawDiwali(kind, stage, color) {
  const k = FLOWER_KINDS[kind] || FLOWER_KINDS[0]
  const pc = new PixelCanvas(FLOWER_W, FLOWER_H)
  // A brass foot, always: it is what marks the spot the renderer picks the lamp by.
  pc.hline(CX - 2, CX + 2, BASE, P.diwaliBrassDark)
  pc.px(CX - 2, BASE, P.patchSoilNightDark)
  pc.px(CX + 2, BASE, P.patchSoilNightDark)
  if (stage <= 0) {
    // Just set out: a plain clay diya in the soil, wick dry.
    pc.hline(CX - 2, CX + 2, BASE - 3, P.diyaClayLight)
    pc.hline(CX - 1, CX + 1, BASE - 2, P.diyaClay)
    pc.hline(CX - 1, CX + 1, BASE - 1, P.diyaClayDark)
    pc.px(CX, BASE - 4, P.cinder)
    return pc.outline(P.outline)
  }
  const w = HALF[k.size] ?? HALF.m
  const h = HEIGHT[k.stem] ?? HEIGHT.mid
  const draw = LAMPS[k.work] || LAMPS.misc
  draw(pc, color, stage >= 2, h, w)
  return pc.outline(P.outline)
}
