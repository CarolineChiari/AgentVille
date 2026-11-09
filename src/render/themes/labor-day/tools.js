// Finished work on Labor Day: a tool laid out on the bench, where the village grows a flower. Each
// kind of work is a different trade's tool (a wrench for a bug fix, a hammer for a feature, a
// handsaw for a refactor, a ledger for docs, a spirit level for tests, a paintbrush for design, a
// shovel for infrastructure, a sheaf of wheat for data, a loaf for performance, a stethoscope for a
// review). They keep everything a flower says: what it is says what kind of work it was, the colour
// of its grip, handle or cloth is the pull request's, a white one is an unlabeled PR, and an open
// PR's is not in use yet: the same tool dull and grey with a touch of its colour.
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
/** How far above the bench the middle stands, by the flower kind's stem. */
const LIFT = { tall: 6, mid: 5, short: 4 }
/** How big it is, by the flower kind's size. */
const R = { s: 2, m: 2, l: 3 }

/**
 * Each kind of work has its own tool. `c` is its colour (the pull request's, or held back to grey
 * while it is open), `cy` the middle and `r` the half-width; every one is drawn between
 * (CX - 4) and (CX + 4), so none leans off the 9 px canvas.
 */
const CROPS = {
  // A bug fix is a wrench: an open-ended head on a long steel shank, the grip in the PR's colour.
  fix(pc, c, cy, r) {
    pc.vline(CX, cy, BASE - 1, P.laborSteel)
    pc.vline(CX + 1, cy, BASE - 1, P.laborSteelDark)
    pc.rect(CX - 2, cy - r, 2, 3, P.laborSteel)
    pc.rect(CX + 1, cy - r, 3, 3, P.laborSteel)
    pc.hline(CX - 2, CX + 3, cy - r + 2, P.laborSteel)
    pc.px(CX + 3, cy - r + 1, P.laborSteelDark)
    pc.rect(CX - 1, BASE - 4, 3, 4, c)
  },
  // A new feature is a hammer: a steel head across the top of a timber handle, banded in the PR's colour.
  feature(pc, c, cy, r) {
    pc.vline(CX, cy, BASE - 1, P.barnTimber)
    pc.vline(CX + 1, cy, BASE - 1, P.barnTimberDark)
    pc.rect(CX - 3, cy - r, 7, 3, P.laborSteel)
    pc.hline(CX - 3, CX + 3, cy - r + 2, P.laborSteelDark)
    pc.px(CX - 3, cy - r, P.laborBristle)
    pc.rect(CX - 1, cy + 2, 3, 2, c)
  },
  // A refactor is a handsaw: a long steel blade cut with teeth along one edge, the handle in the PR's colour.
  refactor(pc, c, cy, r) {
    pc.rect(CX - 1, cy - r, 3, BASE - cy - 2, P.laborSteel)
    pc.vline(CX - 1, cy - r, BASE - 4, P.laborBristle)
    for (let y = cy - r; y < BASE - 3; y += 2) pc.px(CX + 2, y, P.laborSteelDark)
    pc.rect(CX - 2, BASE - 4, 5, 4, c)
    pc.px(CX, BASE - 3, P.outline)
    pc.hline(CX - 2, CX + 2, BASE - 4, shade(c, 0.3))
  },
  // Docs are a ledger: a bound book stood on its edge, the cover the PR's colour, a ribbon out of the pages.
  docs(pc, c, cy, r) {
    pc.rect(CX - 3, cy - r, 7, BASE - cy + r - 1, c)
    pc.vline(CX - 3, cy - r, BASE - 2, shade(c, -0.3))
    pc.vline(CX + 3, cy - r + 1, BASE - 2, P.laborBanner[4])
    pc.hline(CX - 1, CX + 1, cy - r + 2, P.laborBanner[4])
    pc.hline(CX - 1, CX + 1, cy - r + 4, P.laborBanner[4])
    pc.px(CX + 2, BASE - 1, P.laborBrass)
  },
  // Tests are a spirit level, laid across a peg: the body in the PR's colour, a vial with its bubble dead centre.
  test(pc, c, cy, r) {
    pc.vline(CX, cy + 2, BASE - 1, P.barnTimber)
    pc.rect(CX - 4, cy - 1, 9, 4, c)
    pc.hline(CX - 4, CX + 4, cy - 1, shade(c, 0.3))
    pc.hline(CX - 4, CX + 4, cy + 2, shade(c, -0.3))
    pc.rect(CX - 1, cy, 3, 2, P.glassLight)
    pc.px(CX, cy, P.laborBrass)
    pc.px(CX - 3, cy + 1, P.laborSteel)
    pc.px(CX + 3, cy + 1, P.laborSteel)
  },
  // Design work is a paintbrush, bristles up: the handle timber, a steel ferrule, the paint the PR's colour.
  ui(pc, c, cy, r) {
    pc.vline(CX, cy + 3, BASE - 1, P.barnTimberLight)
    pc.vline(CX + 1, cy + 3, BASE - 1, P.barnTimber)
    pc.rect(CX - 1, cy + 1, 3, 2, P.laborSteel)
    pc.rect(CX - 1, cy - 1, 3, 2, P.laborBristle)
    pc.rect(CX - 1, cy - r, 3, r, c)
    pc.px(CX, cy - r - 1, c)
    pc.px(CX - 1, cy - r, shade(c, 0.4))
  },
  // Infrastructure is a shovel, planted blade-down: the blade in the PR's colour, a D grip on a timber shaft.
  infra(pc, c, cy, r) {
    pc.vline(CX, cy - 1, BASE - 3, P.barnTimber)
    pc.vline(CX + 1, cy - 1, BASE - 3, P.barnTimberDark)
    pc.hline(CX - 2, CX + 3, cy - r, P.barnTimberLight)
    pc.vline(CX - 2, cy - r, cy - r + 2, P.barnTimberLight)
    pc.vline(CX + 3, cy - r, cy - r + 2, P.barnTimberDark)
    pc.rect(CX - 2, BASE - 4, 5, 4, c)
    pc.hline(CX - 2, CX + 2, BASE - 4, shade(c, 0.35))
    pc.px(CX, BASE - 1, shade(c, -0.3))
  },
  // Data is a sheaf of wheat: the stalks bound with a band in the PR's colour, the heads fanned out.
  data(pc, c, cy, r) {
    for (const dx of [-3, -1, 1, 3]) {
      pc.line(CX, BASE - 1, CX + dx, cy - r + 1, P.hayDark)
      pc.rect(CX + dx - (dx < 0 ? 1 : 0), cy - r - 1, 2, 3, P.hayLight)
      pc.px(CX + dx - (dx < 0 ? 1 : 0), cy - r - 1, P.hay)
    }
    pc.vline(CX, cy - r + 1, BASE - 1, P.hay)
    pc.hline(CX - 1, CX + 1, cy + 2, c)
    pc.px(CX, cy + 3, shade(c, -0.3))
  },
  // Performance is a fresh loaf, scored, on a cloth in the PR's colour; steam rises once it is out of the oven.
  perf(pc, c, cy, r, lit) {
    const body = lit ? P.crust : c
    pc.rect(CX - 3, BASE - 2, 7, 2, c)
    pc.hline(CX - 3, CX + 3, BASE - 1, shade(c, -0.25))
    pc.ellipse(CX + 0.5, BASE - 4.2, 3.8, 2.6, body)
    pc.hline(CX - 2, CX + 2, BASE - 3, lit ? P.crustDark : shade(c, -0.3))
    for (const dx of [-2, 0, 2]) pc.px(CX + dx, BASE - 5, lit ? P.crustLight : shade(c, 0.35))
    if (!lit) return
    pc.px(CX - 1, BASE - 8, P.laborBanner[4])
    pc.px(CX + 1, BASE - 9, P.laborBanner[4])
  },
  // A review is a stethoscope: a Y of tubing in the PR's colour from two ear tips down to a steel chest piece.
  review(pc, c, cy, r) {
    pc.px(CX - 3, cy - r, P.laborSteel)
    pc.px(CX + 3, cy - r, P.laborSteel)
    pc.line(CX - 3, cy - r + 1, CX, cy + 1, c)
    pc.line(CX + 3, cy - r + 1, CX, cy + 1, c)
    pc.line(CX - 2, cy - r + 1, CX + 1, cy + 1, shade(c, -0.25))
    pc.vline(CX, cy + 1, BASE - 4, c)
    pc.rect(CX - 2, BASE - 3, 5, 3, P.laborSteel)
    pc.hline(CX - 2, CX + 2, BASE - 1, P.laborSteelDark)
    pc.px(CX, BASE - 2, P.laborBrass)
  },
  // Research is a lunch pail: a round tin with a lid band and a wire bail, the body in the PR's colour.
  research(pc, c, cy, r) {
    pc.rect(CX - 3, cy + 1, 7, BASE - cy - 2, c)
    pc.hline(CX - 3, CX + 3, cy + 1, shade(c, 0.35))
    pc.hline(CX - 3, CX + 3, cy + 3, P.laborSteel)
    pc.hline(CX - 3, CX + 3, BASE - 2, shade(c, -0.3))
    pc.vline(CX - 3, cy - r + 1, cy, P.laborSteelDark)
    pc.vline(CX + 3, cy - r + 1, cy, P.laborSteelDark)
    pc.hline(CX - 2, CX + 2, cy - r, P.laborSteelDark)
  },
  // Odds and ends are a glass of iced tea with a straw, the tea the PR's colour.
  misc(pc, c, cy, r) {
    pc.rect(CX - 2, cy, 5, 5, P.glassLight)
    pc.rect(CX - 2, cy + 1, 5, 4, c)
    pc.hline(CX - 2, CX + 2, cy, P.laborBanner[4])
    pc.px(CX - 1, cy + 2, shade(c, 0.35))
    pc.px(CX + 1, cy + 3, P.laborBanner[4])
    pc.line(CX + 1, cy, CX + 2, cy - 3, P.laborBanner[3])
  },
}

/**
 * One finished thread's tool, for FLOWER_KINDS[kind], the size of a flower and on the flower's spot.
 * @param {number} kind  into FLOWER_KINDS
 * @param {number} stage 0 just planted · 1 not in use yet (an open PR) · 2 in use
 * @param {string} color its colour, the pull request's
 */
export function drawFinished(kind, stage, color) {
  const k = FLOWER_KINDS[kind] || FLOWER_KINDS[0]
  const pc = new PixelCanvas(FLOWER_W, FLOWER_H)
  // Chips swept round its foot, always: it is what marks the spot the renderer picks it by.
  pc.hline(CX - 2, CX + 2, BASE, P.laborChipsLight)
  pc.px(CX - 2, BASE, P.laborChipsDark)
  pc.px(CX + 2, BASE, P.laborChipsDark)
  if (stage <= 0) {
    // Just planted: a bare peg with a loop of chalk line round it, nothing laid out yet.
    pc.vline(CX, BASE - 3, BASE - 1, P.barnTimber)
    pc.px(CX - 1, BASE - 3, P.laborBanner[4])
    pc.px(CX + 1, BASE - 3, P.laborBanner[0])
    return pc.outline(P.outline)
  }
  const r = R[k.size] ?? R.m
  const cy = BASE - (LIFT[k.stem] ?? LIFT.mid) - (k.size === 'l' ? 1 : 0)
  // Not in use yet, the same shape in dull grey with a touch of its colour coming through, so an
  // open PR reads as not done at a glance rather than merely as a darker tool.
  const unripe = stage < 2
  const c = unripe ? P.ash : color
  const draw = CROPS[k.work] || CROPS.misc
  draw(pc, c, cy, r, !unripe)
  if (unripe) pc.px(CX, cy, color)
  return pc.outline(P.outline)
}
