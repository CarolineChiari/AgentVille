// Finished work on Independence Day: little flags, fireworks and picnic things planted along the
// plot's flag bed, where the village grows a flower. They keep everything a flower says: what it is
// says what kind of work it was (a flag on a pole for a bug fix, a sparkler bunch for tests, a
// liberty bell for a review), its colour is the pull request's, a white one is an unlabeled PR,
// and an open PR's is not lit yet: the same shape dull and grey with a touch of its colour.
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
/** How far above the soil the middle stands, by the flower kind's stem. */
const LIFT = { tall: 6, mid: 5, short: 4 }
/** How big it is, by the flower kind's size. */
const R = { s: 2, m: 2, l: 3 }

/**
 * Each kind of work has its own thing. `c` is its colour (the pull request's, or held back to grey
 * while it is open), `cy` the middle and `r` the half-width; every one is drawn between
 * (CX - 4) and (CX + 4), so none leans off the 9 px canvas.
 */
const CROPS = {
  // A bug fix is a flag on a pole: put up where the problem was.
  fix(pc, c, cy, r) {
    pc.vline(CX - 2, cy - r - 1, BASE, P.porchWhiteDark)
    pc.px(CX - 2, cy - r - 2, P.starGold)
    pc.rect(CX - 1, cy - r - 1, 5, 2, c)
    pc.rect(CX - 1, cy - r + 1, 5, 2, P.flagWhite)
    pc.rect(CX - 1, cy - r + 3, 5, 1, c)
    pc.px(CX - 1, cy - r - 1, P.flagBlue)
    pc.px(CX, cy - r - 1, P.flagBlue)
  },
  // A new feature is a rocket on its stick, the cone in the PR's colour, a spark up top.
  feature(pc, c, cy, r, lit) {
    pc.vline(CX, cy + 1, BASE, P.barnTimber)
    pc.rect(CX - 1, cy - r, 3, r + 2, c)
    pc.px(CX - 1, cy - r, shade(c, 0.3))
    pc.px(CX, cy - r - 1, c)
    pc.hline(CX - 1, CX + 1, cy + 2, P.flagWhite)
    if (!lit) return
    pc.px(CX, cy - r - 3, P.starGold)
    pc.px(CX - 1, cy - r - 2, P.flagWhite)
    pc.px(CX + 1, cy - r - 2, P.flagWhite)
  },
  // A refactor is a pinwheel: four vanes round a pin, turned just so.
  refactor(pc, c, cy, r) {
    pc.vline(CX, cy + 1, BASE, P.barnTimber)
    pc.rect(CX - 3, cy - 3, 3, 3, c)
    pc.rect(CX + 1, cy - 3, 2, 2, shade(c, 0.25))
    pc.rect(CX + 1, cy + 1, 3, 2, c)
    pc.rect(CX - 3, cy, 2, 2, shade(c, -0.2))
    pc.px(CX, cy - 1, P.starGold)
  },
  // Docs are a scroll: rolled parchment, tied with a ribbon in the PR's colour.
  docs(pc, c, cy, r) {
    pc.vline(CX, cy + 3, BASE, P.barnTimber)
    pc.rect(CX - 3, cy - r, 7, r + 3, P.linen)
    pc.hline(CX - 3, CX + 3, cy - r, P.linenShade)
    pc.hline(CX - 3, CX + 3, cy + 2, P.linenShade)
    pc.vline(CX, cy - r, cy + 2, c)
    pc.px(CX - 1, cy - r - 1, c)
    pc.px(CX + 1, cy - r - 1, c)
  },
  // Tests are a bunch of sparklers, fanned out, a spark of the PR's colour at each tip.
  test(pc, c, cy, r, lit) {
    pc.hline(CX - 1, CX + 1, BASE - 1, P.flagRedDark)
    for (const dx of [-3, 0, 3]) {
      pc.line(CX, BASE - 1, CX + dx, cy - r + 1, P.outline)
      pc.px(CX + dx, cy - r, c)
      if (!lit) continue
      pc.px(CX + dx, cy - r - 1, P.starGold)
      pc.px(CX + dx + (dx < 0 ? -1 : 1), cy - r, P.flagWhite)
    }
  },
  // Design work is a string of bunting between two stakes, a pennant in turn of the PR's colour.
  ui(pc, c, cy, r) {
    pc.vline(CX - 3, cy - 1, BASE, P.barnTimber)
    pc.vline(CX + 3, cy - 1, BASE, P.barnTimber)
    pc.line(CX - 3, cy - 1, CX, cy + 1, P.porchWhiteDark)
    pc.line(CX, cy + 1, CX + 3, cy - 1, P.porchWhiteDark)
    for (const [dx, dy, col] of [[-2, 0, c], [0, 2, P.flagWhite], [2, 0, P.flagBlue]]) {
      pc.hline(CX + dx - 1, CX + dx + 1, cy + dy + 1, col)
      pc.px(CX + dx, cy + dy + 2, col)
    }
  },
  // Infrastructure is a barbecue grill: a round kettle on three legs, its lid the PR's colour.
  infra(pc, c, cy, r) {
    pc.ellipse(CX + 0.5, cy + 1.5, 3.4, 2.6, c)
    pc.hline(CX - 2, CX + 2, cy + 3, shade(c, -0.3))
    pc.px(CX - 1, cy, shade(c, 0.35))
    pc.px(CX, cy - 2, P.outline)
    for (const dx of [-2, 0, 2]) pc.vline(CX + dx, cy + 4, BASE, P.farmIron)
    pc.px(CX + 2, cy + 4, P.flameTip)
  },
  // Data is a star on a stick: five points, the PR's colour, a shine on the top one.
  data(pc, c, cy, r) {
    pc.vline(CX, cy + 2, BASE, P.barnTimber)
    pc.vline(CX, cy - 3, cy + 1, c)
    pc.hline(CX - 3, CX + 3, cy - 1, c)
    pc.hline(CX - 2, CX + 2, cy, c)
    pc.hline(CX - 3, CX - 2, cy + 2, c)
    pc.hline(CX + 2, CX + 3, cy + 2, c)
    pc.px(CX - 1, cy + 1, c)
    pc.px(CX + 1, cy + 1, c)
    pc.px(CX, cy - 3, shade(c, 0.4))
    pc.px(CX - 1, cy - 1, shade(c, 0.3))
  },
  // Performance is a roman candle: a short tube, fire already leaving it in a string of balls.
  perf(pc, c, cy, r, lit) {
    pc.rect(CX - 1, BASE - 4, 3, 5, P.flagRedDark)
    pc.hline(CX - 1, CX + 1, BASE - 4, P.flagWhite)
    if (!lit) return
    pc.px(CX, BASE - 6, c)
    pc.px(CX + 1, BASE - 8, shade(c, 0.25))
    pc.px(CX - 1, BASE - 10, c)
    pc.px(CX, BASE - 11, P.starGold)
  },
  // A review is a liberty bell: a heavy bell on a beam, a crack down its side.
  review(pc, c, cy, r) {
    pc.hline(CX - 3, CX + 3, cy - 2, P.barnTimber)
    pc.vline(CX, cy - 2, cy - 1, P.farmIronLight)
    pc.rect(CX - 2, cy - 1, 5, 3, c)
    pc.rect(CX - 3, cy + 2, 7, 2, c)
    pc.hline(CX - 3, CX + 3, cy + 3, shade(c, -0.25))
    pc.px(CX - 1, cy, shade(c, 0.35))
    pc.vline(CX + 1, cy + 1, cy + 3, P.outline)
    pc.px(CX, cy + 4, P.farmIron)
    pc.vline(CX, BASE - 3, BASE, P.barnTimber)
  },
  // Research is a red-white-and-blue popsicle, a bite out of it, in the PR's colour.
  research(pc, c, cy, r) {
    pc.vline(CX, cy + 4, BASE, P.barnTimberLight)
    pc.rect(CX - 2, cy - 2, 5, 3, c)
    pc.rect(CX - 2, cy + 1, 5, 2, P.flagWhite)
    pc.rect(CX - 2, cy + 3, 5, 1, P.flagBlue)
    pc.px(CX + 2, cy - 2, P.flagWhite)
    pc.px(CX - 1, cy - 2, shade(c, 0.35))
  },
  // Odds and ends are a cup of lemonade with a straw, the lemonade the PR's colour.
  misc(pc, c, cy, r) {
    pc.rect(CX - 2, cy, 5, 5, P.flagWhite)
    pc.rect(CX - 2, cy + 1, 5, 3, c)
    pc.hline(CX - 2, CX + 2, cy, P.linenShade)
    pc.px(CX - 1, cy + 2, shade(c, 0.35))
    pc.line(CX + 1, cy, CX + 2, cy - 3, P.flagRed)
  },
}

/**
 * One finished thread's flag or firework, for FLOWER_KINDS[kind], the size of a flower and on the flower's spot.
 * @param {number} kind  into FLOWER_KINDS
 * @param {number} stage 0 just planted · 1 not lit yet (an open PR) · 2 flying
 * @param {string} color its colour, the pull request's
 */
export function drawFinished(kind, stage, color) {
  const k = FLOWER_KINDS[kind] || FLOWER_KINDS[0]
  const pc = new PixelCanvas(FLOWER_W, FLOWER_H)
  // Straw drawn up round its foot, always: it is what marks the spot the renderer picks it by.
  pc.hline(CX - 2, CX + 2, BASE, P.hayDark)
  pc.px(CX - 2, BASE, P.lawnSoilDark)
  pc.px(CX + 2, BASE, P.lawnSoilDark)
  if (stage <= 0) {
    // Just planted: a bare stick and a bit of ribbon, nothing flying yet.
    pc.vline(CX, BASE - 3, BASE - 1, P.barnTimber)
    pc.px(CX - 1, BASE - 3, P.flagRed)
    pc.px(CX + 1, BASE - 3, P.flagBlue)
    return pc.outline(P.outline)
  }
  const r = R[k.size] ?? R.m
  const cy = BASE - (LIFT[k.stem] ?? LIFT.mid) - (k.size === 'l' ? 1 : 0)
  // Not lit yet, the same shape in dull grey with a touch of its colour coming through, so an open
  // PR reads as not done at a glance rather than merely as a darker flag.
  const unripe = stage < 2
  const c = unripe ? P.ash : color
  const draw = CROPS[k.work] || CROPS.misc
  draw(pc, c, cy, r, !unripe)
  if (unripe) pc.px(CX, cy, color)
  return pc.outline(P.outline)
}
