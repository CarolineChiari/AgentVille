// Finished work in the Neon city: a neon sign on a post, set out in the sign row where the village
// grows a flower. A sign keeps everything a flower says: its glyph says what kind of work it was
// (a warning triangle for a fix, an arrow for a feature, a check for tests), its tube is the pull
// request's colour, a white tube is an unlabeled PR, and an open PR's sign is not switched on
// yet: the same glyph, the tube dark with a touch of its colour.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { FLOWER_H, FLOWER_W } from '../../sprites/flowers.js'
import { FLOWER_KINDS } from '../../../sim/flowers.js'

/** The spot the renderer puts on the ground, and the column everything stands on. */
const CX = 4
const BASE = 11

/** One 5×5 glyph per kind of work. */
const GLYPHS = {
  fix: ['..#..', '.#.#.', '.#.#.', '#.#.#', '#####'],
  feature: ['..#..', '...#.', '#####', '...#.', '..#..'],
  refactor: ['.###.', '#...#', '#...#', '#..#.', '.####'],
  docs: ['#####', '.....', '#####', '.....', '###..'],
  test: ['.....', '....#', '#..#.', '.##..', '..#..'],
  ui: ['..#..', '#####', '.###.', '.#.#.', '#...#'],
  infra: ['#.#.#', '.###.', '##.##', '.###.', '#.#.#'],
  data: ['#.#.#', '#####', '#.#.#', '#####', '#.#.#'],
  perf: ['...##', '..##.', '.####', '..##.', '.##..'],
  review: ['.....', '.###.', '#.#.#', '.###.', '.....'],
  research: ['.###.', '#...#', '...#.', '.....', '..#..'],
  misc: ['.....', '.#.#.', '.....', '..#..', '.....'],
}

/**
 * One finished thread's sign, for FLOWER_KINDS[kind], the size of a flower and on the flower's spot.
 * @param {number} kind  into FLOWER_KINDS
 * @param {number} stage 0 just a post · 1 the sign, not yet lit (an open PR) · 2 lit
 * @param {string} color its colour, the pull request's
 */
export function drawNeonSign(kind, stage, color) {
  const k = FLOWER_KINDS[kind] || FLOWER_KINDS[0]
  const pc = new PixelCanvas(FLOWER_W, FLOWER_H)
  // A steel foot, always: it is what marks the spot the renderer picks the sign by.
  pc.hline(CX - 2, CX + 2, BASE, P.neonSteelDark)
  pc.vline(CX, 8, BASE - 1, P.neonSteelDark)
  if (stage <= 0) {
    // Just set out: a post with a dead tube hung from it.
    pc.hline(CX - 1, CX + 1, 7, P.neonSteel)
    pc.px(CX, 6, P.neonSteelDark)
    return pc.outline(P.outline)
  }
  const lit = stage >= 2
  const tube = lit ? color : shade(color, -0.6)
  // The plate: 7×7 of dark glass, rimmed in the tube's colour.
  pc.rect(1, 1, 7, 7, P.neonGlass)
  for (let i = 1; i <= 7; i++) {
    pc.px(i, 1, tube)
    pc.px(i, 7, tube)
    pc.px(1, i, tube)
    pc.px(7, i, tube)
  }
  const glyph = GLYPHS[k.work] || GLYPHS.misc
  glyph.forEach((row, y) => {
    for (let x = 0; x < 5; x++) if (row[x] === '#') pc.px(2 + x, 2 + y, tube)
  })
  // An open PR keeps a touch of its colour in the dark, so it reads as not done rather than as
  // merely a darker sign; a lit one has a bright white heart to its tube.
  if (!lit) pc.px(CX, 8, color)
  else pc.px(CX, 4, shade(color, 0.5))
  return pc.outline(P.outline)
}
