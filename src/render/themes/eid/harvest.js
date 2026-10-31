// Finished work at Eid: a fanous, the festival lantern, set out on the plot's lantern bed where the
// village grows a flower. A lantern keeps everything a flower says: its silhouette says what kind
// of work it was (a round fanous for a bug fix, a star for design, a paper lantern for docs), its
// glass is the pull request's colour, a white one is an unlabeled PR, and an open PR's lantern is
// not lit yet: the same lantern with its candle out, the glass dark with a touch of its colour.
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
/** How many rows of glass it stands, by the flower kind's stem. */
const HEIGHT = { tall: 6, mid: 5, short: 4 }
/** How wide it is either side of the middle, by the flower kind's size. */
const HALF = { s: 1, m: 2, l: 3 }

/**
 * One lantern: glass from row y0 to y1, `half(i, n)` wide either side of the middle on its i-th
 * row of n, in brass unless `edge` says otherwise. Lit, the candle shows through the glass.
 */
function lamp(pc, { c, lit, y0, y1, half, edge = P.eidBrass, cap = true, ribs = false }) {
  const n = y1 - y0 + 1
  const glass = lit ? c : shade(c, -0.55)
  for (let y = y0; y <= y1; y++) {
    const i = y - y0
    const w = half(i, n)
    for (let x = CX - w; x <= CX + w; x++) {
      const rim = x === CX - w || x === CX + w
      pc.px(x, y, rim ? edge : glass)
    }
    if (w >= 2) pc.px(CX - w + 1, y, lit ? shade(c, 0.28) : shade(c, -0.4))
    if (ribs && i % 2 === 1) pc.hline(CX - w, CX + w, y, shade(c, lit ? -0.3 : -0.7))
  }
  // The candle, behind the glass: a warm core when lit.
  const mid = y0 + Math.floor(n / 2)
  if (lit) {
    pc.px(CX, mid, P.glowCandle)
    pc.px(CX, mid - 1, P.flameTip)
  } else {
    pc.px(CX, mid, P.eidBrassDark)
  }
  if (cap) {
    const w0 = half(0, n)
    pc.hline(CX - w0 - 1, CX + w0 + 1, y0 - 1, P.eidBrassLight)
    pc.px(CX, y0 - 2, P.eidBrass)
    pc.px(CX, y0 - 3, P.eidBrassDark)
    const w1 = half(n - 1, n)
    pc.hline(CX - w1, CX + w1, y1 + 1, P.eidBrassDark)
  }
}

const round = (w) => (i, n) => Math.max(1, Math.round(w * Math.sin((Math.PI * (i + 0.5)) / n) + 0.3))
const flat = (w) => () => w
const hexagon = (w) => (i, n) => (i === 0 || i === n - 1 ? Math.max(1, w - 1) : w)
const teardrop = (w) => (i, n) => 1 + Math.round(((w - 1) * i) / Math.max(1, n - 1))
const diamond = (w) => (i, n) => Math.max(0, Math.round(w * (1 - Math.abs((2 * i) / Math.max(1, n - 1) - 1))))

const top = (h) => BASE - h

/**
 * Each kind of work has its own lantern. `c` is the glass's colour (the pull request's), `lit`
 * whether the candle is burning, `h` how many rows of glass and `w` the half-width.
 */
const LANTERNS = {
  // A bug fix is the round fanous: the one on every doorstep.
  fix: (pc, c, lit, h, w) => lamp(pc, { c, lit, y0: top(h), y1: BASE - 1, half: round(w + 0.4) }),
  // A new feature is a tall fanous, straight sided.
  feature: (pc, c, lit, h, w) => lamp(pc, { c, lit, y0: top(h + 1), y1: BASE - 1, half: flat(Math.min(w, 2)) }),
  // A refactor is the hexagonal one, its corners turned.
  refactor: (pc, c, lit, h, w) => lamp(pc, { c, lit, y0: top(h), y1: BASE - 1, half: hexagon(w), edge: P.eidBrassLight }),
  // Docs are a paper lantern: ribbed, no brass, a cord over the top.
  docs: (pc, c, lit, h, w) => {
    lamp(pc, { c, lit, y0: top(h), y1: BASE - 1, half: round(w + 0.4), edge: shade(c, -0.35), cap: false, ribs: true })
    pc.px(CX, top(h) - 1, P.eidBrassDark)
    pc.px(CX, top(h) - 2, P.eidBrassDark)
    pc.hline(CX - 1, CX + 1, BASE - 0, P.eidBrassDark)
  },
  // Tests are a small candle lantern: short, a flame showing through a window.
  test: (pc, c, lit, h, w) => lamp(pc, { c, lit, y0: BASE - 3, y1: BASE - 1, half: flat(2) }),
  // Design work is a star lantern: points out all round.
  ui: (pc, c, lit, h, w) => lamp(pc, { c, lit, y0: top(h + 1), y1: BASE - 1, half: diamond(w + 1) }),
  // Infrastructure is a brass lantern: more metal than glass.
  infra: (pc, c, lit, h, w) => {
    const iw = Math.max(2, w)
    lamp(pc, { c, lit, y0: top(h), y1: BASE - 1, half: flat(iw), edge: P.eidBrassLight })
    pc.hline(CX - iw + 1, CX + iw - 1, top(h), P.eidBrass)
    pc.hline(CX - iw + 1, CX + iw - 1, BASE - 1, P.eidBrass)
  },
  // Data is a lattice lantern: a grid of brass over the glass.
  data: (pc, c, lit, h, w) => {
    lamp(pc, { c, lit, y0: top(h), y1: BASE - 1, half: flat(Math.max(2, w)) })
    for (let y = top(h); y <= BASE - 1; y += 2) pc.hline(CX - Math.max(2, w), CX + Math.max(2, w), y, P.eidBrass)
  },
  // Performance is a teardrop: narrow at the top, swelling to the foot.
  perf: (pc, c, lit, h, w) => lamp(pc, { c, lit, y0: top(h + 1), y1: BASE - 1, half: teardrop(w + 0.5) }),
  // A review hangs from a hook on a short post, looking down on the rest.
  review: (pc, c, lit, h, w) => {
    pc.vline(CX - 3, 2, BASE - 1, P.barnTimber)
    pc.hline(CX - 3, CX, 2, P.barnTimber)
    pc.px(CX, 3, P.eidBrassDark)
    lamp(pc, { c, lit, y0: 5, y1: BASE - 2, half: round(Math.min(w, 2) + 0.4), cap: false })
    pc.hline(CX - 1, CX + 1, 4, P.eidBrassLight)
    pc.hline(CX - 1, CX + 1, BASE - 1, P.eidBrassDark)
  },
  // Research is a glass hurricane lamp: clear glass, a bright shine down one side.
  research: (pc, c, lit, h, w) => {
    lamp(pc, { c, lit, y0: top(h), y1: BASE - 1, half: round(w + 0.4), edge: P.glazeWhite })
    pc.vline(CX - w + 1, top(h) + 1, top(h) + 2, P.white)
  },
  // Odds and ends are a small fanous, whatever shape it came in: straight sided, no brass cap,
  // a tassel hung from the top.
  misc: (pc, c, lit, h, w) => {
    lamp(pc, { c, lit, y0: BASE - 4, y1: BASE - 1, half: flat(2), cap: false })
    pc.vline(CX, BASE - 7, BASE - 5, P.brassDark)
    pc.px(CX, BASE - 8, P.brassLight)
  },
}

/**
 * One finished thread's lantern, for FLOWER_KINDS[kind], the size of a flower and on the flower's spot.
 * @param {number} kind  into FLOWER_KINDS
 * @param {number} stage 0 an unlit candle · 1 the lantern, not yet lit (an open PR) · 2 lit
 * @param {string} color its colour, the pull request's
 */
export function drawEid(kind, stage, color) {
  const k = FLOWER_KINDS[kind] || FLOWER_KINDS[0]
  const pc = new PixelCanvas(FLOWER_W, FLOWER_H)
  // A brass foot, always: it is what marks the spot the renderer picks the lantern by.
  pc.hline(CX - 2, CX + 2, BASE, P.eidBrassDark)
  pc.px(CX - 2, BASE, P.patchSoilNightDark)
  pc.px(CX + 2, BASE, P.patchSoilNightDark)
  if (stage <= 0) {
    // Just set out: a candle in the soil, unlit.
    pc.rect(CX - 1, BASE - 3, 2, 3, P.sugarDust)
    pc.px(CX - 1, BASE - 3, P.white)
    pc.px(CX, BASE - 4, P.eidBrassDark)
    return pc.outline(P.outline)
  }
  const w = HALF[k.size] ?? HALF.m
  const h = HEIGHT[k.stem] ?? HEIGHT.mid
  const draw = LANTERNS[k.work] || LANTERNS.misc
  const lit = stage >= 2
  // Unlit, the glass keeps a touch of its colour so an open PR reads as not done at a glance
  // rather than merely as a darker lantern.
  draw(pc, color, lit, h, w)
  if (!lit) pc.px(CX, BASE - 3, color)
  return pc.outline(P.outline)
}
