// Finished work at Holi: a pot of gulal, where the village grows a flower. A pot keeps everything
// a flower says: its shape says what kind of work it was (a round matka for a bug fix, a tall
// two-handled urn for a feature, a surahi for performance), the powder heaped in it is the pull
// request's colour, white powder is an unlabeled PR, and an open PR's pot is still covered with a
// cloth, tied but not yet opened.
//
// The kinds within a work type differ as the village's daisies do: a tall kind has a longer neck,
// and a large one a painted band.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { FLOWER_H, FLOWER_W } from '../../sprites/flowers.js'
import { FLOWER_KINDS } from '../../../sim/flowers.js'

/** The spot the renderer puts on the ground, and the column everything stands on. */
const CX = 4
const BASE = 11

/**
 * A pot's outline as the half-width of each row, rim first, standing on row BASE - 1. The rim row
 * is where the powder sits, so it is the first entry of every one.
 */
const PROFILE = {
  fix: [1, 1, 2, 3, 3, 3, 2, 1],
  feature: [1, 1, 1, 2, 3, 3, 3, 2, 1],
  refactor: [3, 2, 3, 3, 3, 2],
  docs: [2, 2, 2, 2, 2, 2, 2, 2],
  ui: [1, 1, 2, 3, 3, 3, 2, 1],
  infra: [3, 3, 1],
  data: [1, 1, 2, 2, 3, 3, 3, 2],
  perf: [1, 1, 1, 1, 2, 3, 3, 2],
  review: [3, 3, 2, 1, 1, 2, 2],
  research: [1, 1, 2, 3, 3, 3, 2, 1],
  misc: [1, 2, 2, 1],
}

/** Draws a pot's body from its profile, lit from the top left, and returns the row its rim is on. */
function body(pc, rows, extra) {
  const top = BASE - rows.length
  rows.forEach((w, i) => {
    const y = top + i
    pc.hline(CX - w, CX + w, y, P.matka)
    pc.px(CX - w, y, P.matkaLight)
    pc.px(CX + w, y, P.matkaDark)
    if (w > 1 && CX + w - 1 > CX) pc.px(CX + w - 1, y, shade(P.matka, -0.1))
  })
  pc.hline(CX - rows[0], CX + rows[0], top, P.matkaLight) // the rim catches the light
  pc.hline(CX - rows[rows.length - 1], CX + rows[rows.length - 1], BASE - 1, P.matkaDark) // the foot is in shade
  return top + extra
}

/** The clay shapes beyond the profile: handles, spouts, stands, a second pot. */
const DETAIL = {
  feature(pc, top) {
    // Two handles from the neck to the shoulder.
    for (const s of [-1, 1]) {
      pc.px(CX + s * 2, top + 2, P.matkaDark)
      pc.px(CX + s * 3, top + 3, P.matkaDark)
      pc.px(CX + s * 3, top + 4, P.matka)
    }
  },
  docs(pc, top) {
    pc.hline(CX - 2, CX + 2, top + 4, P.matkaDark)
  },
  data(pc, top) {
    // The second pot sits on the first: a seam where they meet.
    pc.hline(CX - 2, CX + 2, top + 3, P.matkaDark)
  },
  review(pc, top) {
    pc.hline(CX - 2, CX + 2, top + 2, P.matkaDark)
    pc.vline(CX, top + 3, top + 4, P.matkaDark)
  },
  research(pc, top) {
    // A lip to pour from, on the right.
    pc.px(CX + 2, top, P.matka)
    pc.px(CX + 3, top - 1, P.matkaLight)
  },
  perf(pc, top) {
    // The long neck's collar.
    pc.hline(CX - 1, CX + 1, top + 2, P.matkaDark)
  },
}

/** A band or dots of colour painted round the belly, for the larger kinds and design work. */
function painted(pc, rows, band, dots) {
  const top = BASE - rows.length
  const y = top + Math.min(rows.length - 3, 4)
  pc.hline(CX - 2, CX + 2, y, band)
  if (dots) {
    pc.px(CX - 2, y + 1, P.holiGulal[1])
    pc.px(CX, y + 1, P.holiGulal[3])
    pc.px(CX + 2, y + 1, P.holiGulal[2])
  }
}

/** The powder heaped on a pot's rim, with a puff of it in the air: the colour is the PR's. */
function heap(pc, top, w, c) {
  pc.ellipse(CX + 0.5, top - 0.5, w + 0.6, 1.7, c)
  pc.px(CX - 1, top - 2, shade(c, 0.35))
  pc.px(CX + w, top - 2, shade(c, 0.2))
  pc.px(CX - w - 1, top - 3, shade(c, 0.3))
}

/** A cloth tied over the mouth, the PR's colour, its ends hanging and a knot on top: not yet opened. */
function cloth(pc, top, w, c) {
  pc.hline(CX - w - 1, CX + w + 1, top, c)
  pc.hline(CX - w - 1, CX + w + 1, top - 1, shade(c, 0.2))
  pc.px(CX - w - 1, top + 1, shade(c, -0.2))
  pc.px(CX + w + 1, top + 1, shade(c, -0.2))
  pc.px(CX, top - 2, c)
  pc.px(CX, top + 1, P.matkaDark) // the string
}

/** Draws one work type's pot into `pc`; returns where its rim is and how wide it is. */
function pot(pc, work, k, c, stage) {
  const key = PROFILE[work] ? work : 'misc'
  const rows = PROFILE[key].slice()
  // A tall kind has a longer neck.
  if (k.stem === 'tall' && rows.length < 9 && key !== 'infra') rows.splice(1, 0, rows[0])
  const top = BASE - rows.length

  if (key === 'infra') {
    // A thali: a wide shallow plate on a short foot, the powder heaped in a cone on it.
    body(pc, rows, 0)
    pc.hline(CX - 3, CX + 3, top + 1, P.matkaDark)
    const cone = stage >= 2 ? c : shade(c, -0.1)
    for (let i = 0; i < 4; i++) pc.hline(CX - 3 + i, CX + 3 - i, top - i, i ? cone : shade(cone, 0.3))
    if (stage < 2) {
      pc.hline(CX - 3, CX + 3, top - 1, P.holiWhite)
      pc.hline(CX - 2, CX + 2, top - 2, c)
    }
    return null
  }
  body(pc, rows, 0)
  DETAIL[key]?.(pc, top)
  if (k.size === 'l') painted(pc, rows, key === 'ui' ? P.holiGulal[0] : P.marigold, key === 'ui')
  else if (key === 'ui') painted(pc, rows, P.holiGulal[1], true)
  const w = rows[0]
  if (key === 'research' && stage >= 2) {
    // Spilling: a stream of powder from the lip down to a little heap on the ground.
    heap(pc, top, w, c)
    pc.vline(CX + 4, top, BASE - 1, c)
    pc.px(CX + 3, BASE - 1, shade(c, 0.25))
    return null
  }
  if (stage >= 2) heap(pc, top, w, c)
  else cloth(pc, top, w, c)
  return null
}

/**
 * One finished thread's pot of gulal, for FLOWER_KINDS[kind], the size of a flower and on the
 * flower's spot.
 * @param {number} kind  into FLOWER_KINDS
 * @param {number} stage 0 a sprout · 1 covered with a cloth (an open PR) · 2 opened and heaped
 * @param {string} color its colour, the pull request's
 */
export function drawPot(kind, stage, color) {
  const k = FLOWER_KINDS[kind] || FLOWER_KINDS[0]
  const pc = new PixelCanvas(FLOWER_W, FLOWER_H)
  // Petals drawn up round its foot, always: it is what marks the spot the renderer picks it by.
  pc.hline(CX - 2, CX + 2, BASE, P.marigoldDark)
  pc.px(CX - 2, BASE, P.holiBedDark)
  pc.px(CX + 2, BASE, P.roseRed)
  if (stage <= 0) {
    // Just set out: a marigold seedling's two leaves up out of the field.
    pc.vline(CX, BASE - 3, BASE - 1, P.vegLeafDark)
    pc.px(CX - 1, BASE - 4, P.vegLeafLight)
    pc.px(CX + 1, BASE - 4, P.vegLeaf)
    return pc.outline(P.outline)
  }
  if (k.work === 'test') {
    // Tests are a trio of small cups side by side: small, many, each with its own heap or cloth.
    for (const dx of [-3, 0, 3]) {
      const top = BASE - 3
      pc.hline(CX + dx - 1, CX + dx + 1, top + 1, P.matka)
      pc.hline(CX + dx - 1, CX + dx + 1, top, P.matkaLight)
      pc.px(CX + dx, top + 2, P.matkaDark)
      pc.px(CX + dx + 1, top + 1, P.matkaDark)
      if (stage >= 2) {
        pc.hline(CX + dx - 1, CX + dx + 1, top - 1, dx ? shade(color, dx * 0.04) : color)
        pc.px(CX + dx, top - 2, shade(color, 0.3))
      } else {
        pc.hline(CX + dx - 1, CX + dx + 1, top - 1, color)
      }
    }
    return pc.outline(P.outline)
  }
  pot(pc, k.work, k, color, stage)
  return pc.outline(P.outline)
}
