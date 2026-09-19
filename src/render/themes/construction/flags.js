// Finished work on a construction site: survey marker flags in a setting-out yard, where the
// village grows flowers in a garden. A flag keeps everything a flower says: its style is the kind
// of work (a pennant for a bug fix, a chequered flag for data), its cloth the flower's colour, a
// white one an unlabeled PR, and an open PR's is still furled round its stake.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { FLOWER_H, FLOWER_W } from '../../sprites/flowers.js'
import { FLOWER_KINDS } from '../../../sim/flowers.js'

/** The stake stands one column left of a flower's stem, so the cloth has four columns to fly in. */
const POLE = 3
/** The flower's base row: a flag's foot stands on the same spot. */
const BASE = 11
/** Where the top of the stake is, by the flower's stem length. */
const TOP = { tall: 2, mid: 3, short: 5 }
/** Rows of cloth, by the flower's size. The cloth is always four columns wide. */
const ROWS = { s: 2, m: 3, l: 4 }
const W = 4
const X0 = POLE + 1

/**
 * A flag's cloth, a grid of 0 (none), 1 (cloth), 2 (its shade) and 3 (a contrasting mark), by
 * work type. Each is `h` rows of four; the renderer's pick box and the glitter under an open PR
 * are the flower's, so every flag keeps inside a flower's head.
 */
const CLOTH = {
  // Bug fix: a pennant, tapering to a point.
  fix: (h) => Array.from({ length: h }, (_, y) => row((x) => x < W - Math.round((y * W) / h) ? (y === h - 1 ? 2 : 1) : 0)),
  // New feature: a plain square flag.
  feature: (h) => Array.from({ length: h }, (_, y) => row(() => (y === h - 1 ? 2 : 1))),
  // Refactor: a swallowtail, notched in the fly.
  refactor: (h) => Array.from({ length: h }, (_, y) => row((x) => (x === W - 1 && y > 0 && y < h - 1 ? 0 : y === h - 1 ? 2 : 1))),
  // Docs: a long streamer, rippling.
  docs: (h) => Array.from({ length: h }, (_, y) => row((x) => ((x + y) % 2 === 0 || x === 0) && y < 2 ? (y ? 2 : 1) : 0)),
  // Testing: flagging tape knotted to the stake, its two tails hanging.
  test: (h) => Array.from({ length: h }, (_, y) => row((x) => (x === y || x === y + 1 ? (x === y ? 1 : 2) : 0))),
  // Design & UI: split on the diagonal, colour and white.
  ui: (h) => Array.from({ length: h }, (_, y) => row((x) => (x + y < W ? 1 : 3))),
  // Infrastructure: a band across the middle.
  infra: (h) => Array.from({ length: h }, (_, y) => row(() => (h > 2 && y === Math.floor(h / 2) ? 3 : y === h - 1 ? 2 : 1))),
  // Data & APIs: chequered.
  data: (h) => Array.from({ length: h }, (_, y) => row((x) => ((x + y) % 2 ? 3 : 1))),
  // Performance: an arrow, pointing on.
  perf: (h) => Array.from({ length: h }, (_, y) => row((x) => (y === Math.floor(h / 2) || x < 2 ? (y === h - 1 ? 2 : 1) : 0))),
  // Code review: a spot on it, like an eye.
  review: (h) => Array.from({ length: h }, (_, y) => row((x) => (y === Math.floor((h - 1) / 2) && (x === 1 || x === 2) ? 3 : y === h - 1 ? 2 : 1))),
  // Research & planning: a windsock, banded and tapering.
  research: (h) => Array.from({ length: h }, (_, y) => row((x) => (x < W - Math.floor((y * W) / (h + 1)) ? (x % 2 ? 3 : 1) : 0))),
  // Odds & ends: a stub of tape tied round the stake.
  misc: () => [row((x) => (x < 2 ? 1 : 0)), row((x) => (x === 0 ? 2 : 0))],
}

function row(f) {
  return Array.from({ length: W }, (_, x) => f(x))
}

/**
 * A marker flag for FLOWER_KINDS[kind], the size of a flower, standing on the flower's spot.
 * @param {number} kind  into FLOWER_KINDS
 * @param {number} stage 0 a stake just in · 1 furled (an open PR) · 2 flying
 * @param {string} color its cloth
 */
export function drawFlag(kind, stage, color) {
  const k = FLOWER_KINDS[kind] || FLOWER_KINDS[0]
  const pc = new PixelCanvas(FLOWER_W, FLOWER_H)
  const top = stage <= 0 ? BASE - 3 : TOP[k.stem] ?? TOP.mid
  // A bright wire stake, and the earth it's pushed into. Not a dark one: with its outline a dark
  // stake read as a black stick and outweighed its cloth.
  pc.vline(POLE, top, BASE - 1, P.metal)
  pc.px(POLE, top, P.white)
  pc.hline(POLE, POLE + 1, BASE, P.woodDark)
  if (stage <= 0) return pc.outline(P.outline)
  const dark = shade(color, -0.22)
  if (stage === 1) {
    // Furled round its stake.
    pc.vline(X0, top + 1, top + 3, color)
    pc.px(X0, top + 3, dark)
    return pc.outline(P.outline)
  }
  // A white flag's marks need something to show against.
  const mark = color === P.petalWhite ? P.stoneLight : P.white
  const cloth = (CLOTH[k.work] || CLOTH.feature)(ROWS[k.size] || ROWS.m)
  cloth.forEach((cells, y) => cells.forEach((c, x) => c && pc.px(X0 + x, top + y, [null, color, dark, mark][c])))
  return pc.outline(P.outline)
}
