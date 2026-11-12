// Finished work on the frontier: a cactus come into flower or a horseshoe nailed up for luck, set
// out in the plot's corral where the village grows a flower. It keeps everything a flower says: its
// silhouette says what kind of work it was (a horseshoe for a bug fix, a saguaro for a feature, a
// wanted poster for docs), its bloom or its paint is the pull request's colour, a white one is an
// unlabeled PR, and an open PR's is not done yet: the cactus still in bud, the paint not dry,
// darker than it will be with only a touch of its colour showing.
//
// How tall it stands and how wide it is come from the flower kind's own `stem` and `size`, so the
// kinds within a work type differ from each other as the village's daisies do.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { FLOWER_H, FLOWER_W } from '../../sprites/flowers.js'
import { FLOWER_KINDS } from '../../../sim/flowers.js'

/** The spot the renderer puts on the ground, and the column everything stands on. */
const CX = 4
const BASE = 11
/** How many rows tall it stands, by the flower kind's stem. */
const HEIGHT = { tall: 7, mid: 6, short: 5 }
/** How wide it is either side of the middle, by the flower kind's size. */
const HALF = { s: 1, m: 2, l: 3 }

/** The paint or the bloom of colour c: done, it is c; still open, it is darker. */
const paint = (c, lit, d = 0) => shade(c, (lit ? 0 : -0.45) + d)
const top = (h) => BASE - h

/** The scuffed spot every keepsake stands on. */
function spot(pc) {
  pc.hline(CX - 2, CX + 2, BASE, P.wwBedDeep)
  pc.px(CX - 2, BASE, P.wwBedDark)
  pc.px(CX + 2, BASE, P.wwBedDark)
}

/** A post from row y0 down to the spot. */
function stake(pc, x, y0) {
  pc.vline(x, y0, BASE - 1, P.wwTimber)
  pc.px(x, y0, P.wwTimberLight)
}

/** A cactus stem from row y0 down to the spot, `w` either side of x, ribbed. */
function stem(pc, x, y0, w = 1) {
  for (let y = y0; y < BASE; y++) {
    pc.hline(x - w, x + w, y, P.wwCactus)
    pc.px(x - w, y, P.wwCactusLight)
    pc.px(x + w, y, P.wwCactusDark)
  }
}

/** A horseshoe, toes down, heels up, its arms at x0 and x1, from row y0 to y1. */
function horseshoe(pc, x0, x1, y0, y1, c) {
  pc.vline(x0, y0, y1 - 1, c)
  pc.vline(x1, y0, y1 - 1, c)
  pc.hline(x0 + 1, x1 - 1, y1, c)
  pc.px(x0, y0, shade(c, 0.3))
}

const KEEPSAKES = {
  // A bug fix is the lucky horseshoe, nailed to a post heels up so the luck stays in.
  fix: (pc, c, lit, h, w) => {
    stake(pc, CX, top(h) + 2)
    const hw = Math.max(1, Math.min(w, 2))
    horseshoe(pc, CX - hw - 1, CX + hw + 1, top(h), top(h) + 3, paint(c, lit))
    pc.px(CX, top(h) + 3, P.wwIronLight) // the nail
  },
  // A new feature is a saguaro: a tall trunk, an arm either side turning up, a bloom on its crown.
  feature: (pc, c, lit, h) => {
    const t = top(h + 1)
    stem(pc, CX, t + 1, 1)
    pc.hline(CX - 3, CX - 2, BASE - 4, P.wwCactus)
    pc.vline(CX - 3, BASE - 7, BASE - 5, P.wwCactusLight)
    pc.hline(CX + 2, CX + 3, BASE - 5, P.wwCactusDark)
    pc.vline(CX + 3, t + 2, BASE - 6, P.wwCactusDark)
    if (lit) {
      pc.hline(CX - 1, CX + 1, t, c)
      pc.px(CX, t - 1, shade(c, 0.3))
    } else pc.px(CX, t, paint(c, false))
  },
  // A refactor is a barrel cactus: squat and ribbed, a ring of flowers on top.
  refactor: (pc, c, lit, h, w) => {
    const hw = Math.max(2, w)
    for (let y = BASE - 5; y < BASE; y++) {
      const ww = y === BASE - 5 ? hw - 1 : hw
      pc.hline(CX - ww, CX + ww, y, P.wwCactus)
      for (let x = CX - ww + 1; x < CX + ww; x += 2) pc.px(x, y, P.wwCactusDark)
      pc.px(CX - ww, y, P.wwCactusLight)
    }
    if (lit) pc.hline(CX - hw + 1, CX + hw - 1, BASE - 6, c)
    else for (const x of [CX - 1, CX + 1]) pc.px(x, BASE - 6, paint(c, false))
  },
  // Docs are a wanted poster on a post: paper inside a border of the colour.
  docs: (pc, c, lit, h) => {
    const t = top(h)
    stake(pc, CX, t + 4)
    pc.rect(CX - 2, t, 5, 5, P.wwPaper)
    const b = paint(c, lit)
    pc.hline(CX - 2, CX + 2, t, b)
    pc.hline(CX - 2, CX + 2, t + 4, b)
    pc.px(CX, t + 2, P.wwTimberDark) // the face on it
    pc.px(CX - 1, t + 3, P.wwBoneShade)
    pc.px(CX + 1, t + 3, P.wwBoneShade)
  },
  // Tests are a prickly pear: flat paddles one on another, fruit along their rims.
  test: (pc, c, lit) => {
    pc.ellipse(CX, BASE - 2, 2, 1.6, P.wwCactus)
    pc.ellipse(CX - 1, BASE - 5, 1.5, 1.6, P.wwCactusLight)
    pc.ellipse(CX + 2, BASE - 4, 1.4, 1.4, P.wwCactusDark)
    pc.px(CX - 1, BASE - 7, paint(c, lit))
    if (lit) {
      pc.px(CX + 2, BASE - 6, c)
      pc.px(CX + 3, BASE - 5, c)
    }
  },
  // Design work is a painted olla: a round clay pot, a band of the colour round its belly.
  ui: (pc, c, lit, h, w) => {
    const hw = Math.max(2, w)
    pc.ellipse(CX, BASE - 3, hw + 0.4, 2.6, P.wwAdobe)
    pc.hline(CX - 1, CX + 1, BASE - 6, P.wwAdobeDark)
    pc.hline(CX - 1, CX + 1, BASE - 7, P.wwAdobeLight)
    pc.hline(CX - hw, CX + hw, BASE - 3, paint(c, lit))
    pc.hline(CX - hw + 1, CX + hw - 1, BASE - 4, paint(c, lit, 0.25))
    pc.px(CX - hw + 1, BASE - 2, P.wwAdobeLight)
  },
  // Infrastructure is a wagon wheel stood on end, its rim painted the colour.
  infra: (pc, c, lit, h) => {
    const r = Math.min(4, Math.max(3, h - 3))
    const cy = BASE - r
    pc.ellipse(CX, cy, r, r, paint(c, lit))
    pc.ellipse(CX, cy, r - 1, r - 1, P.wwBed)
    for (let a = 0; a < 4; a++) {
      const t = (a / 4) * Math.PI + Math.PI / 4
      pc.line(Math.round(CX - Math.cos(t) * (r - 1)), Math.round(cy - Math.sin(t) * (r - 1)), Math.round(CX + Math.cos(t) * (r - 1)), Math.round(cy + Math.sin(t) * (r - 1)), P.wwTimberLight)
    }
    pc.px(CX, cy, P.wwIron)
  },
  // Data is a gold pan propped on a stake, its rim the colour, nuggets in it.
  data: (pc, c, lit, h) => {
    const t = top(h)
    stake(pc, CX, t + 3)
    pc.hline(CX - 3, CX + 3, t + 1, paint(c, lit))
    pc.hline(CX - 2, CX + 2, t + 2, paint(c, lit, -0.25))
    pc.px(CX - 1, t, P.wwGold)
    pc.px(CX + 1, t, lit ? P.wwGoldLight : P.wwGold)
  },
  // Performance is a lariat, coiled and hung on a post: loops of rope in the colour.
  perf: (pc, c, lit, h) => {
    const t = top(h)
    stake(pc, CX, t)
    pc.ellipse(CX, t + 3, 2.6, 2.4, paint(c, lit))
    pc.ellipse(CX, t + 3, 1.4, 1.2, P.wwBed)
    pc.vline(CX, t + 1, t + 2, P.wwTimber)
    pc.vline(CX + 2, t + 5, BASE - 1, paint(c, lit, -0.2)) // the tail, hanging
  },
  // A review is a lantern hung from a gallows post, looking down on the rest.
  review: (pc, c, lit, h, w) => {
    pc.vline(CX - 3, 2, BASE - 1, P.wwTimber)
    pc.hline(CX - 3, CX, 2, P.wwTimberLight)
    pc.px(CX, 3, P.wwIron)
    const hw = Math.min(w, 2)
    pc.hline(CX - 1, CX + 1, 4, P.wwIron)
    pc.rect(CX - hw + (hw > 1 ? 1 : 0), 5, hw > 1 ? 3 : 2 * hw + 1, 3, paint(c, lit))
    if (lit) pc.px(CX, 6, P.windowLitCore)
    pc.hline(CX - 1, CX + 1, 8, P.wwIron)
  },
  // Research is an ocotillo: long thin canes fanning up from one root, red-tipped with the colour.
  research: (pc, c, lit, h) => {
    const t = top(h + 1)
    for (const [dx, dy] of [[-3, 2], [-1, 0], [1, 0], [3, 2]]) {
      pc.line(CX, BASE - 1, CX + dx, t + dy, P.wwCactusDark)
      pc.px(CX + dx, t + dy - 1, dx < 0 || lit ? paint(c, lit) : P.wwCactusDark)
    }
    pc.px(CX, BASE - 1, P.wwCactusLight)
  },
  // Odds and ends are a horseshoe pitch: a stake, and a horseshoe ringing it in the dirt.
  misc: (pc, c, lit) => {
    stake(pc, CX, BASE - 4)
    horseshoe(pc, CX - 2, CX + 2, BASE - 2, BASE - 1, paint(c, lit))
  },
}

/**
 * One finished thread's keepsake, for FLOWER_KINDS[kind], the size of a flower and on the flower's spot.
 * @param {number} kind  into FLOWER_KINDS
 * @param {number} stage 0 a sprout · 1 not done yet (an open PR) · 2 done
 * @param {string} color its colour, the pull request's
 */
export function drawKeepsake(kind, stage, color) {
  const k = FLOWER_KINDS[kind] || FLOWER_KINDS[0]
  const pc = new PixelCanvas(FLOWER_W, FLOWER_H)
  // The spot, always: it is what marks where the renderer picks the keepsake by.
  spot(pc)
  if (stage <= 0) {
    // Just planted: a cactus no bigger than a thumb.
    pc.vline(CX, BASE - 2, BASE - 1, P.wwCactus)
    pc.px(CX + 1, BASE - 1, P.wwCactusDark)
    return pc.outline(P.outline)
  }
  const w = HALF[k.size] ?? HALF.m
  const h = HEIGHT[k.stem] ?? HEIGHT.mid
  const lit = stage >= 2
  const draw = KEEPSAKES[k.work] || KEEPSAKES.misc
  draw(pc, color, lit, h, w)
  // Not done yet, it keeps a touch of its colour so an open PR reads as on its way at a glance
  // rather than merely as a darker keepsake.
  if (!lit) pc.px(CX, BASE - 1, color)
  return pc.outline(P.outline)
}
