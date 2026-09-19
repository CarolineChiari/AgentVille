// Finished work in an elvish realm: a lantern lit on its stand in the lantern grove, where the
// village grows flowers in a garden. A lantern keeps everything a flower says: its shape is the
// kind of work (a teardrop for a bug fix, a rune lantern for data), its glass the flower's
// colour, a white one an unlabeled PR, and an open PR's lantern is hung but not yet lit.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { FLOWER_H, FLOWER_W } from '../../sprites/flowers.js'
import { FLOWER_KINDS } from '../../../sim/flowers.js'

/** The stand rises on the flower's stem, so a lantern hangs over the same spot a flower blooms on. */
const STEM = 4
/** The flower's base row: the stand's foot rests on the same spot. */
const BASE = 11
/** Where the lantern's top row is, by the flower's stem length. */
const TOP = { tall: 1, mid: 2, short: 4 }
/** Rows of lantern, by the flower's size. */
const ROWS = { s: 4, m: 5, l: 6 }
/** The lantern is drawn in a grid seven wide, inset a column, so a flower's 9 px box still holds it. */
const W = 7
const CX = 3
const X0 = 1

const grid = (h, f) => Array.from({ length: h }, (_, y) => Array.from({ length: W }, (_, x) => f(x, y, h) || 0))
/** How far column `x` is from the middle of the grid. */
const off = (x) => Math.abs(x - CX)

/**
 * A lantern's glass and ironwork, a grid of 0 (none), 1 (glass), 2 (its shade) and 3 (mithril
 * frame), by work type. Each is `h` rows of seven. The renderer's pick box and the glitter under
 * an open PR are the flower's, so every lantern keeps inside a flower's head.
 */
const LANTERN = {
  // Bug fix: a teardrop lamp, drawn to a point at the top where it hangs.
  fix: (h) => grid(h, (x, y) => {
    const half = y === 0 ? 0 : y === 1 || y === h - 1 ? 1 : 2
    return off(x) > half ? 0 : y === h - 1 ? 2 : 1
  }),
  // New feature: a star lantern, its points out at the top, the sides and the foot.
  feature: (h) => grid(h, (x, y) => {
    const mid = Math.floor((h - 1) / 2)
    if (off(x) <= 1 && y > 0 && y < h - 1) return 1
    if (x === CX && y === 0) return 1
    if (off(x) === 3 && y === mid) return 1
    if (off(x) === 2 && y === h - 1) return 2
    return 0
  }),
  // Refactor: a leaf lantern, pointed at both ends, a vein down one side of it.
  refactor: (h) => grid(h, (x, y) => {
    const half = y === 0 || y === h - 1 ? 0 : y === 1 || y === h - 2 ? 1 : 2
    if (off(x) > half) return 0
    return x === CX + 1 ? 2 : 1
  }),
  // Docs: a scroll lamp, capped top and bottom like a rolled scroll.
  docs: (h) => grid(h, (x, y) => {
    if (off(x) > 2) return 0
    if (y === 0 || y === h - 1) return 3
    return off(x) === 2 ? 2 : 1
  }),
  // Testing: a wisp, no lantern at all: a few lights adrift over the stand.
  test: (h) => grid(h, (x, y) => (
    [[CX, 0], [CX - 2, 2], [CX + 2, h - 3], [CX, h - 1], [CX + 1, 1]].some(([sx, sy]) => sx === x && sy === y) ? 1 : 0
  )),
  // Design & UI: a blossom lantern, round, with petals out at its widest.
  ui: (h) => grid(h, (x, y) => {
    if (off(x) <= 2 && y > 0 && y < h - 1) return 1
    if (off(x) <= 1 && (y === 0 || y === h - 1)) return 1
    if (off(x) === 3 && (y === 1 || y === h - 2)) return 2
    return 0
  }),
  // Infrastructure: a forge lamp, a heavy square of ironwork round its glass.
  infra: (h) => grid(h, (x, y) => (off(x) === 3 || y === 0 || y === h - 1 ? 3 : 1)),
  // Data & APIs: a rune lantern, a mark cut into its face.
  data: (h) => grid(h, (x, y) => {
    if (off(x) > 2) return 0
    if (y === 0 || y === h - 1) return 3
    return x === CX || (off(x) === 2 && y === Math.floor(h / 2)) ? 3 : 1
  }),
  // Performance: a comet lamp, its light streaming off behind it.
  perf: (h) => grid(h, (x, y) => {
    const mid = Math.floor((h - 1) / 2)
    if (off(x) <= 1 && Math.abs(y - mid) <= 1) return 1
    if (y === mid && x > CX + 1) return 2
    if (y === mid - 1 && x === CX + 2) return 2
    return 0
  }),
  // Code review: a watch lamp, a ring of ironwork round an open eye of glass.
  review: (h) => grid(h, (x, y) => {
    if (off(x) > 2 || ((y === 0 || y === h - 1) && off(x) === 2)) return 0
    return y === 0 || y === h - 1 || off(x) === 2 ? 3 : 1
  }),
  // Research & planning: a seeker's lamp, a crystal cut to a point at both ends.
  research: (h) => grid(h, (x, y) => {
    const half = Math.min(3, Math.min(y, h - 1 - y) + 1)
    if (off(x) > half) return 0
    return off(x) === half ? 2 : 1
  }),
  // Odds & ends: an ember in a dish, barely a lantern at all.
  misc: (h) => grid(h, (x, y) => (y >= h - 2 && off(x) <= 1 ? (y === h - 1 ? 2 : 1) : 0)),
}

/**
 * A lantern for FLOWER_KINDS[kind], the size of a flower, on the flower's spot.
 * @param {number} kind  into FLOWER_KINDS
 * @param {number} stage 0 a bare stand · 1 hung but unlit (an open PR) · 2 lit
 * @param {string} color its glass
 */
export function drawLantern(kind, stage, color) {
  const k = FLOWER_KINDS[kind] || FLOWER_KINDS[0]
  const pc = new PixelCanvas(FLOWER_W, FLOWER_H)
  const h = ROWS[k.size] ?? ROWS.m
  const top = stage <= 0 ? BASE - 3 : TOP[k.stem] ?? TOP.mid
  const bottom = stage <= 0 ? BASE - 2 : top + h - 1
  // A slender mithril stand on a flat foot. Bright, not dark: a dark stand and its outline
  // together read as a twig, and outweighed the light it holds up.
  if (bottom + 1 <= BASE - 1) pc.vline(STEM, bottom + 1, BASE - 1, P.mithril)
  pc.hline(STEM - 1, STEM + 1, BASE, P.mithrilDark)
  pc.px(STEM, BASE, P.mithril)
  if (stage <= 0) {
    // Nothing hung on it yet: the crook at the top is empty.
    pc.px(STEM + 1, top, P.mithrilLight)
    pc.px(STEM, top, P.mithril)
    return pc.outline(P.outline)
  }
  const lit = stage >= 2
  const glass = lit ? color : shade(color, -0.42)
  const dark = lit ? shade(color, -0.25) : shade(color, -0.55)
  const frame = lit ? P.mithril : P.mithrilDark
  const cells = (LANTERN[k.work] || LANTERN.feature)(h)
  cells.forEach((row, y) => row.forEach((c, x) => c && pc.px(X0 + x, top + y, [null, glass, dark, frame][c])))
  // The flame itself, in the middle of whatever holds it, so a lit lantern reads as lit at 1×.
  if (lit) {
    const my = top + Math.floor((h - 1) / 2)
    if (cells[Math.floor((h - 1) / 2)][CX]) pc.px(X0 + CX, my, P.lanternGlow)
    else pc.px(X0 + CX, top + h - 2, P.lanternGlow)
  }
  return pc.outline(P.outline)
}
