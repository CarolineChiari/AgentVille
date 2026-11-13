// Finished work on the Day of the Dead: an offering set out on the plot's marigold bed where the
// village grows a flower, a cempasúchil or a candle. It keeps everything a flower says: its
// silhouette says what kind of work it was (a single marigold for a bug fix, a tall candle for a
// feature, a sugar skull for design work), the colour is the pull request's (a marigold's petals,
// a candle's painted band, a skull's icing), a white one is an unlabeled PR, and an open PR's is
// not ready yet: a marigold still in bud, a candle not yet lit and its paint dimmed.
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
/** How many rows tall a stem or a candle is, by the flower kind's stem. */
const HEIGHT = { tall: 3, mid: 2, short: 1 }
/** How wide a bloom is either side of the middle, by the flower kind's size. */
const HALF = { s: 1, m: 1, l: 2 }

/** The flame over a wick at (x, y): warm when lit, a black wick when not. */
function flame(pc, x, y, lit, tall = 1) {
  if (!lit) return pc.px(x, y, P.cinder)
  pc.px(x, y, P.flameTip)
  for (let i = 1; i <= tall; i++) pc.px(x, y - i, i === tall ? P.glowCandle : P.flameTip)
}

/**
 * A candle standing on row `foot` at column x, `h` rows of wax: cream wax with a band painted in
 * the pull request's colour, and its flame over it. Unlit, the band dims but keeps a touch of its colour.
 */
function candle(pc, x, foot, h, c, lit, w = 1) {
  const top = foot - h + 1
  for (let dx = 0; dx < w; dx++) pc.vline(x + dx, top, foot, dx ? P.candleWaxDark : P.candleWax)
  const band = lit ? c : shade(c, -0.5)
  const by = Math.min(foot, top + Math.max(1, Math.floor(h / 2)))
  pc.hline(x, x + w - 1, by, band)
  if (!lit && w > 1) pc.px(x, by, c)
  flame(pc, x + (w > 1 ? w - 1 : 0), top - 1, lit, 1)
}

/**
 * A cempasúchil on a stem: the bloom at (cx, cy), `r` either side, its petals in the pull
 * request's colour round a gold heart. In bud (an open PR) it is a green bud with its colour just
 * showing at the tip.
 */
function marigold(pc, cx, cy, r, c, open) {
  pc.vline(cx, cy + 1, BASE - 1, P.palmGreenDark)
  pc.px(cx + 1, BASE - 2, P.palmGreen)
  if (!open) {
    pc.rect(cx - 1, cy - 1, 3, 2, P.palmGreen)
    pc.px(cx, cy - 2, c)
    pc.px(cx, cy, P.palmGreenDark)
    return
  }
  for (let dy = -r; dy <= r; dy++) {
    const half = r - Math.abs(dy) + 1
    pc.hline(cx - half, cx + half, cy + dy, dy % 2 ? shade(c, -0.25) : c)
  }
  pc.px(cx, cy, P.marigoldLight)
  pc.px(cx, cy - r - 1, shade(c, 0.25))
}

/**
 * Each kind of work has its own offering. `c` is its colour (the pull request's), `ready` whether
 * it is finished (lit, or in bloom), `h` how tall and `w` how wide.
 */
const OFFERINGS = {
  // A bug fix is a single cempasúchil, the flower that guides the dead home.
  fix: (pc, c, ready, h, w) => marigold(pc, CX, BASE - 3 - h, w, c, ready),
  // A new feature is a tall candle, two wide, standing on a clay dish.
  feature: (pc, c, ready, h) => {
    pc.hline(CX - 2, CX + 2, BASE - 1, P.diyaClay)
    candle(pc, CX - 1, BASE - 2, 3 + h, c, ready, 2)
  },
  // A refactor is two marigolds side by side, one a little taller.
  refactor: (pc, c, ready, h) => {
    marigold(pc, CX - 2, BASE - 4, 1, c, ready)
    marigold(pc, CX + 2, BASE - 4 - h, 1, c, ready)
  },
  // Docs are a papel picado flag on a stick, cut through with a pattern.
  docs: (pc, c, ready, h) => {
    pc.vline(CX - 2, BASE - 7 - h, BASE - 1, P.barnTimber)
    const paper = ready ? c : shade(c, -0.5)
    pc.rect(CX - 1, BASE - 7 - h, 4, 4, paper)
    pc.px(CX, BASE - 6 - h, P.white)
    pc.px(CX + 2, BASE - 5 - h, P.white)
    if (!ready) pc.px(CX + 1, BASE - 6 - h, c)
    for (const x of [CX - 1, CX + 1]) pc.px(x, BASE - 3 - h, paper)
  },
  // Tests are a votive: a stub of a candle in a little clay cup.
  test: (pc, c, ready) => {
    pc.hline(CX - 1, CX + 1, BASE - 1, P.diyaClay)
    pc.hline(CX - 1, CX + 1, BASE - 2, P.diyaClayLight)
    candle(pc, CX, BASE - 3, 2, c, ready)
  },
  // Design work is a sugar skull, its icing in the colour. Unfinished, it is plain sugar.
  ui: (pc, c, ready, h, w) => {
    const top = BASE - 6 - (w > 1 ? 1 : 0)
    pc.rect(CX - 2, top, 5, 4, P.sugarSkull)
    pc.hline(CX - 1, CX + 1, top + 4, P.sugarSkullShade)
    pc.px(CX - 1, top + 2, P.muertosIron)
    pc.px(CX + 1, top + 2, P.muertosIron)
    pc.px(CX, top + 3, P.sugarSkullShade)
    if (ready) {
      pc.hline(CX - 1, CX + 1, top, c)
      pc.px(CX - 2, top + 1, c)
      pc.px(CX + 2, top + 1, c)
    } else pc.px(CX, top, shade(c, -0.5)) // the first dab of icing, the rest still to come
  },
  // Infrastructure is a candelabra: three candles on an iron stand.
  infra: (pc, c, ready, h) => {
    pc.vline(CX, BASE - 4, BASE - 1, P.muertosIron)
    pc.hline(CX - 3, CX + 3, BASE - 4, P.muertosIronLight)
    pc.hline(CX - 1, CX + 1, BASE - 1, P.muertosIron)
    candle(pc, CX - 3, BASE - 5, 2, c, ready)
    candle(pc, CX, BASE - 5, 2 + h, c, ready)
    candle(pc, CX + 3, BASE - 5, 2, c, ready)
  },
  // Data is a row of votives along the edge of the bed.
  data: (pc, c, ready) => {
    pc.hline(CX - 4, CX + 4, BASE - 1, P.diyaClayDark)
    for (const x of [CX - 3, CX, CX + 3]) candle(pc, x, BASE - 2, 2, c, ready)
  },
  // Performance is a taper, narrow and tall, its flame tall too.
  perf: (pc, c, ready, h) => {
    pc.hline(CX - 1, CX + 1, BASE - 1, P.muertosIronLight)
    candle(pc, CX, BASE - 2, 4 + h, c, ready)
  },
  // A review is a farol, a tin lantern hung from a post, looking down on the rest.
  review: (pc, c, ready) => {
    pc.vline(CX - 3, 2, BASE - 1, P.barnTimber)
    pc.hline(CX - 3, CX, 2, P.barnTimber)
    pc.vline(CX, 3, 4, P.muertosIron)
    pc.rect(CX - 1, 5, 3, 4, ready ? P.windowLit : shade(c, -0.5))
    pc.vline(CX - 1, 5, 8, ready ? c : shade(c, -0.3))
    pc.vline(CX + 1, 5, 8, ready ? c : shade(c, -0.3))
    pc.hline(CX - 1, CX + 1, 9, P.muertosIron)
    if (ready) pc.px(CX, 7, P.flameTip)
  },
  // Research is a veladora: a tall glass jar painted in the colour, a candle burning down inside it.
  research: (pc, c, ready, h, w) => {
    const hw = Math.max(1, Math.min(w, 2))
    const top = BASE - 5 - h
    pc.rect(CX - hw, top, 2 * hw + 1, BASE - top, ready ? c : shade(c, -0.55))
    pc.vline(CX - hw, top, BASE - 1, P.white)
    pc.hline(CX - hw, CX + hw, top - 1, P.talaveraDark)
    if (ready) pc.px(CX, top + 1, P.glowCandle)
    else pc.px(CX, top + 1, c)
  },
  // Odds and ends are a small marigold with its petals fallen beside it.
  misc: (pc, c, ready) => {
    marigold(pc, CX - 1, BASE - 4, 1, c, ready)
    pc.px(CX + 2, BASE - 1, c)
    pc.px(CX + 3, BASE - 1, P.marigoldLight)
  },
}

/**
 * One finished thread's offering, for FLOWER_KINDS[kind], the size of a flower and on the flower's spot.
 * @param {number} kind  into FLOWER_KINDS
 * @param {number} stage 0 just set out · 1 not ready yet (an open PR) · 2 lit, or in bloom
 * @param {string} color its colour, the pull request's
 */
export function drawMuertos(kind, stage, color) {
  const k = FLOWER_KINDS[kind] || FLOWER_KINDS[0]
  const pc = new PixelCanvas(FLOWER_W, FLOWER_H)
  // A ring of petals at its foot, always: it is what marks the spot the renderer picks it by.
  pc.hline(CX - 2, CX + 2, BASE, P.marigoldDeep)
  pc.px(CX, BASE, P.marigold)
  if (stage <= 0) {
    // Just set out: a sprout of a marigold in the soil.
    pc.vline(CX, BASE - 3, BASE - 1, P.palmGreenDark)
    pc.px(CX - 1, BASE - 3, P.palmGreen)
    pc.px(CX + 1, BASE - 2, P.palmGreen)
    return pc.outline(P.outline)
  }
  const w = HALF[k.size] ?? HALF.m
  const h = HEIGHT[k.stem] ?? HEIGHT.mid
  const draw = OFFERINGS[k.work] || OFFERINGS.misc
  draw(pc, color, stage >= 2, h, w)
  return pc.outline(P.outline)
}
