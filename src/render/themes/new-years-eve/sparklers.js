// Finished work on New Year's Eve: a sparkler or a party popper going off where the village grows
// a flower. It keeps everything a flower says: what it is says what kind of work it was (a
// sparkler for a bug fix, a party popper for a refactor, a rocket for performance), its sparks or
// streamers are the pull request's colour, white ones are an unlabeled PR, and an open PR's is
// not lit yet: the same shape, unlit, with a fleck of its colour.
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
/** How far above the soil the thing's top stands, by the flower kind's stem. */
const LIFT = { tall: 8, mid: 7, short: 6 }
/** How wide a burst is, by the flower kind's size. */
const R = { s: 1, m: 2, l: 2 }

/** A burst of sparks at (x, y): the colour in the middle, white at its heart, gold at its tips. */
function burst(pc, x, y, c, r, lit = true) {
  if (!lit) {
    // Not lit yet: a dull head on the wire, with its colour showing as a band.
    pc.px(x, y, P.nyeWandDark)
    pc.px(x - 1, y, P.nyeWand)
    pc.px(x + 1, y, P.nyeWand)
    return
  }
  pc.px(x, y, P.nyeSpark[0])
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) pc.px(x + dx, y + dy, c)
  if (r >= 2) {
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [-1, -1], [1, -1], [-1, 1], [1, 1]]) pc.px(x + dx, y + dy, (dx + dy) & 1 ? P.nyeSpark[1] : shade(c, 0.25))
    pc.px(x, y + 2, P.nyeSpark[2])
  }
}

/**
 * Each kind of work has its own. `c` is the colour (the pull request's), `top` the row the thing
 * reaches, `r` the burst's size and `lit` false while the PR is still open. Everything drawn stays
 * within (CX - 4) and (CX + 4), so none leans off the 9 px canvas.
 */
const THINGS = {
  // A bug fix is a sparkler: a steel wire, its head throwing sparks.
  fix(pc, c, top, r, lit) {
    pc.vline(CX, top + 2, BASE, P.nyeWand)
    pc.px(CX + 1, top + 5, P.nyeWandDark)
    burst(pc, CX, top + 1, c, r, lit)
  },
  // A new feature is a Roman candle: a fat tube, banded, a plume of colour shooting out of the top.
  feature(pc, c, top, r, lit) {
    pc.rect(CX - 1, top + 4, 3, BASE - top - 3, P.nyePaint[5])
    pc.vline(CX + 1, top + 4, BASE, shade(P.nyePaint[5], -0.3))
    pc.hline(CX - 1, CX + 1, top + 6, P.nyePaint[4])
    pc.px(CX, top + 3, P.nyeFuse)
    if (lit) {
      pc.vline(CX, top, top + 2, c)
      pc.px(CX - 1, top, P.nyeSpark[1])
      pc.px(CX + 1, top + 1, P.nyeSpark[0])
      pc.px(CX - 2, top - 1 < 0 ? 0 : top - 1, c)
    }
  },
  // A refactor is a party popper: a cone with a ribbon round it, streamers bursting from its mouth.
  refactor(pc, c, top, r, lit) {
    for (let i = 0; i < 5; i++) pc.hline(CX - 1 - (i >> 1), CX + 1 + (i >> 1), BASE - 4 + i, i === 2 ? P.nyePaint[4] : P.nyePaint[(i & 1) ? 1 : 0])
    pc.px(CX - 1, BASE - 4, P.nyeSpark[0])
    if (lit) {
      for (const [dx, dy] of [[-3, -1], [-2, -3], [0, -4], [2, -3], [3, -1]]) pc.line(CX, BASE - 4, CX + dx, BASE - 4 + dy, (dx + dy) & 1 ? c : P.nyeSpark[1])
      pc.px(CX, BASE - 7, P.nyeSpark[0])
    } else {
      pc.px(CX, BASE - 5, c)
    }
  },
  // Docs are a party horn: a paper blower, curled up and out, its tongue unrolled.
  docs(pc, c, top, r, lit) {
    pc.vline(CX, BASE - 3, BASE, P.nyePaint[1])
    pc.hline(CX - 1, CX + 1, BASE - 3, P.nyeWand)
    const n = lit ? 6 : 2
    for (let i = 0; i < n; i++) pc.px(CX + 1 + Math.round(Math.sin(i * 0.9) * 1.5), BASE - 4 - i, i & 1 ? c : P.nyePaint[4])
    if (lit) pc.px(CX + 2, top, P.nyeSpark[0])
  },
  // Tests are a bunch of sparklers: three wires fanned out, each with its own spark.
  test(pc, c, top, r, lit) {
    for (const dx of [-2, 0, 2]) {
      pc.line(CX, BASE, CX + dx, top + 3 + (dx ? 1 : 0), P.nyeWand)
      if (lit) {
        pc.px(CX + dx, top + 2 + (dx ? 1 : 0), dx ? c : P.nyeSpark[0])
        pc.px(CX + dx, top + 1 + (dx ? 1 : 0), P.nyeSpark[1])
      } else pc.px(CX + dx, top + 2 + (dx ? 1 : 0), P.nyeWandDark)
    }
    pc.hline(CX - 1, CX + 1, BASE - 2, P.nyePaint[0])
  },
  // Design work is a pinwheel: a wheel of colour on a stick, turning.
  ui(pc, c, top, r, lit) {
    const cy = top + 3
    pc.vline(CX, cy, BASE, P.nyeWand)
    for (const [dx, dy, k] of [[-2, -2, 0], [2, -2, 1], [2, 2, 0], [-2, 2, 1]]) {
      pc.line(CX, cy, CX + dx, cy + dy, k ? c : P.nyePaint[4])
      pc.px(CX + dx, cy + (dy > 0 ? dy - 1 : dy + 1), lit ? c : P.nyeWand)
    }
    pc.px(CX, cy, lit ? P.nyeSpark[1] : P.nyeWandDark)
  },
  // Infrastructure is a confetti cannon: a squat tube with a wide mouth, confetti raining out.
  infra(pc, c, top, r, lit) {
    pc.rect(CX - 1, BASE - 5, 3, 6, P.nyePaint[6])
    pc.hline(CX - 2, CX + 2, BASE - 5, P.gilt)
    pc.vline(CX - 1, BASE - 4, BASE, P.nyePaint[7])
    if (lit) {
      for (const [dx, dy] of [[-3, 2], [-2, 0], [-1, 2], [0, 0], [1, 3], [2, 1], [3, 3]]) pc.px(CX + dx, top + dy, (dx + dy) & 1 ? c : P.nyeBulb[(dx + 3) % 5])
      pc.px(CX, BASE - 6, c)
    } else pc.px(CX, BASE - 6, c)
  },
  // Data is a noisemaker: a wooden rattle, spun, with a ring of sound lines round it.
  data(pc, c, top, r, lit) {
    pc.vline(CX, BASE - 3, BASE, P.barnTimber)
    pc.rect(CX - 2, BASE - 7, 5, 4, P.barnTimberLight)
    pc.vline(CX - 2, BASE - 7, BASE - 4, P.barnTimberDark)
    pc.hline(CX - 2, CX + 2, BASE - 5, c)
    if (lit) for (const [dx, dy] of [[-4, -8], [4, -8], [-4, -5], [4, -5]]) pc.px(CX + dx, BASE + dy, P.nyeSpark[1])
  },
  // Performance is a rocket on its stick: a pointed nose, fins and a trail of sparks behind.
  perf(pc, c, top, r, lit) {
    pc.vline(CX, BASE - 5, BASE, P.nyeWand)
    pc.rect(CX - 1, top + 2, 3, 5, P.nyePaint[4])
    pc.vline(CX + 1, top + 2, top + 6, P.nyeStuccoDark)
    pc.px(CX, top + 1, c)
    pc.hline(CX - 1, CX + 1, top + 2, c)
    pc.px(CX - 2, top + 6, c)
    pc.px(CX + 2, top + 6, c)
    if (lit) {
      pc.px(CX, top + 7, P.nyeSpark[2])
      pc.px(CX - 1, top + 8, P.nyeSpark[1])
      pc.px(CX + 1, top + 9, P.nyeSpark[1])
      pc.px(CX, top, P.nyeSpark[0])
    }
  },
  // A review is a firework fountain: a tub on the ground, a fan of sparks sprayed up out of it.
  review(pc, c, top, r, lit) {
    pc.rect(CX - 2, BASE - 3, 5, 4, P.nyePaint[0])
    pc.hline(CX - 2, CX + 2, BASE - 3, shade(P.nyePaint[0], 0.3))
    pc.vline(CX + 2, BASE - 2, BASE, shade(P.nyePaint[0], -0.3))
    if (lit) {
      for (const [dx, dy] of [[-3, -3], [-2, -5], [-1, -6], [0, -7], [1, -6], [2, -5], [3, -3]]) {
        pc.line(CX, BASE - 4, CX + dx, BASE - 3 + dy, (dx & 1) ? c : P.nyeSpark[1])
      }
      pc.px(CX, BASE - 4, P.nyeSpark[0])
    } else pc.px(CX, BASE - 4, c)
  },
  // Research is a wishing lantern: a paper balloon on a string, its flame lighting it from inside.
  research(pc, c, top, r, lit) {
    pc.ellipse(CX + 0.5, top + 2.5, 2.4, 3, lit ? c : P.nyeStuccoDark)
    pc.hline(CX - 1, CX + 1, top + 5, P.nyeWandDark)
    pc.vline(CX, top + 6, BASE, P.nyeFuse)
    pc.px(CX - 1, top + 1, lit ? P.nyeSpark[0] : P.nyeStucco)
    if (lit) pc.px(CX, top + 3, P.nyeSpark[1])
  },
  // Odds and ends are a lost party hat: a cone on the ground, a pom on its tip.
  misc(pc, c, top, r, lit) {
    for (let i = 0; i < 6; i++) pc.hline(CX - 1 - (i >> 1), CX + (i >> 1), BASE - 5 + i, i === 3 ? P.nyePaint[4] : c)
    pc.px(CX, BASE - 6, lit ? P.nyeSpark[0] : P.nyeWand)
    pc.px(CX - 2, BASE - 3, shade(c, 0.3))
    pc.hline(CX - 3, CX + 2, BASE, shade(c, -0.3))
  },
}

/**
 * One finished thread's celebration, for FLOWER_KINDS[kind], the size of a flower and on the
 * flower's spot.
 * @param {number} kind  into FLOWER_KINDS
 * @param {number} stage 0 a fuse just struck · 1 not lit yet (an open PR) · 2 going off
 * @param {string} color its colour, the pull request's
 */
export function drawSparkler(kind, stage, color) {
  const k = FLOWER_KINDS[kind] || FLOWER_KINDS[0]
  const pc = new PixelCanvas(FLOWER_W, FLOWER_H)
  // A scatter of confetti round the foot, always: it is what marks the spot the renderer picks it by.
  pc.hline(CX - 2, CX + 2, BASE, P.nyeBedLight)
  pc.px(CX - 2, BASE, P.nyeBulb[1])
  pc.px(CX + 2, BASE, P.nyeBulb[2])
  if (stage <= 0) {
    // Just a sprout: a short fuse stuck up out of the soil with a first spark on its tip.
    pc.vline(CX, BASE - 2, BASE - 1, P.nyeFuse)
    pc.px(CX, BASE - 3, P.nyeSpark[1])
    pc.px(CX - 1, BASE - 4, P.nyeSpark[0])
    pc.px(CX + 1, BASE - 4, P.nyeSpark[2])
    return pc.outline(P.outline)
  }
  const r = R[k.size] ?? R.m
  const top = BASE - (LIFT[k.stem] ?? LIFT.mid) - (k.size === 'l' ? 1 : 0) - 1
  const lit = stage >= 2
  const draw = THINGS[k.work] || THINGS.misc
  draw(pc, color, Math.max(1, top), r, lit)
  // Not lit: the same shape with a fleck of its colour, so an open PR reads as not done yet.
  if (!lit) pc.px(CX, BASE - 1, color)
  return pc.outline(P.outline)
}
