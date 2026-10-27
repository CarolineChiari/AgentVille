// Finished work at Easter: a painted egg, or a spring flower, where the village grows a flower.
// What it is says what kind of work it was (striped for a fix, a tulip for a feature, a chick for
// performance), its paint is the pull request's colour, a white one is an unlabeled PR, and an
// open PR's egg is still undyed, in its nest, with only a dab of its colour on it.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { FLOWER_H, FLOWER_W } from '../../sprites/flowers.js'
import { FLOWER_KINDS } from '../../../sim/flowers.js'

/** The spot the renderer puts on the ground, and the column everything stands on. */
const CX = 4
const BASE = 11

/** An egg, standing on BASE, `h` tall and `w` wide at its middle: the paint, its shade and its shine. */
function egg(pc, h, w, c) {
  const cy = BASE - h / 2
  pc.ellipse(CX + 0.5, cy + 0.5, w / 2 + 0.3, h / 2, c)
  pc.px(CX - 1, BASE - h + 2, shade(c, 0.4))
  pc.vline(CX + Math.floor(w / 2), BASE - h + 3, BASE - 2, shade(c, -0.22))
  return cy
}

/** Bands of another colour across an egg's middle. */
const band = (pc, y, w, c) => pc.hline(CX - w, CX + w, y, c)

const stem = (pc, y0) => {
  pc.vline(CX, y0, BASE, P.vegLeafDark)
  pc.px(CX - 1, BASE - 2, P.vegLeafLight)
  pc.px(CX - 2, BASE - 3, P.vegLeaf)
  pc.px(CX + 1, BASE - 3, P.vegLeaf)
}

/**
 * Each kind of work has its own. `c` is the paint (the pull request's, or undyed while it is
 * open), `bud` whether it is still unopened, `r` 0 to 2 for how big.
 */
const CROPS = {
  // A bug fix is a striped egg.
  fix(pc, c, r, bud, color) {
    egg(pc, 6 + r, 4 + (r > 1 ? 1 : 0), c)
    if (!bud) { band(pc, BASE - 4, 2, P.linen); band(pc, BASE - 3, 2, shade(c, -0.28)) }
  },
  // A new feature is a tulip: a cup on a stem.
  feature(pc, c, r, bud, color) {
    stem(pc, BASE - 5 - r)
    const y = BASE - 6 - r
    if (bud) { pc.rect(CX - 1, y, 3, 3, P.vegLeafLight); pc.px(CX, y - 1, P.vegLeaf); return }
    pc.rect(CX - 2, y, 5, 3, c)
    pc.px(CX - 2, y - 1, c); pc.px(CX, y - 1, shade(c, 0.3)); pc.px(CX + 2, y - 1, c)
    pc.vline(CX + 2, y + 1, y + 2, shade(c, -0.28))
  },
  // A refactor is a zigzag egg: tidy, in rows.
  refactor(pc, c, r, bud) {
    const cy = egg(pc, 6 + r, 4, c)
    if (!bud) for (let x = CX - 2; x <= CX + 2; x++) pc.px(x, Math.round(cy) + (x & 1), P.linen)
  },
  // Docs are a hyacinth: a spike of small blossoms, bunched at the top.
  docs(pc, c, r, bud) {
    stem(pc, BASE - 4)
    for (let i = 0; i < 4 + r; i++) {
      const y = BASE - 4 - i
      const w = i > 3 ? 0 : 1
      pc.hline(CX - w, CX + w, y, bud ? P.vegLeafLight : i & 1 ? c : shade(c, 0.22))
    }
  },
  // Tests are a clutch of small eggs in the straw.
  test(pc, c, r, bud) {
    for (const [dx, dy, k] of [[-2, 0, 0], [1, 0, 1], [-0.5, -2, 2]]) {
      pc.ellipse(CX + dx + 0.5, BASE - 2 + dy, 1.2, 1.6, k === 1 ? shade(c, 0.18) : c)
      pc.px(CX + dx - 1, BASE - 3 + dy, shade(c, 0.4))
    }
  },
  // Design work is a polka-dot egg, showy.
  ui(pc, c, r, bud) {
    const cy = egg(pc, 7 + r, 5, c)
    if (!bud) for (const [dx, dy] of [[-1, -2], [1, -1], [-1, 1], [1, 2]]) pc.px(CX + dx, Math.round(cy) + dy, P.linen)
  },
  // Infrastructure is an egg in its nest of twigs.
  infra(pc, c, r, bud) {
    egg(pc, 5 + r, 4, c)
    pc.hline(CX - 3, CX + 3, BASE - 1, P.twig)
    pc.hline(CX - 2, CX + 2, BASE, P.hayDark)
    pc.px(CX - 3, BASE - 2, P.twig)
    pc.px(CX + 3, BASE - 2, P.twig)
  },
  // Data is a checkered egg.
  data(pc, c, r, bud) {
    const cy = Math.round(egg(pc, 6 + r, 4, c))
    if (!bud) for (let y = cy - 2; y <= cy + 2; y++) for (let x = CX - 1; x <= CX + 1; x++) if ((x + y) & 1) pc.px(x, y, P.linen)
  },
  // Performance is a chick, quick: a yellow puff with a beak.
  perf(pc, c, r, bud) {
    const body = bud ? P.linen : P.eggYellow
    pc.ellipse(CX + 0.5, BASE - 3, 2.6, 2.4, body)
    pc.ellipse(CX + 1.5, BASE - 6, 1.6, 1.6, body)
    pc.px(CX + 3, BASE - 6, P.daffodil)
    pc.px(CX + 2, BASE - 7, P.outline)
    pc.px(CX - 2, BASE - 4, shade(body, -0.2))
    pc.vline(CX, BASE - 1, BASE, P.daffodil)
    pc.vline(CX + 2, BASE - 1, BASE, P.daffodil)
    if (!bud) pc.px(CX - 1, BASE - 4, shade(c, -0.1))
  },
  // A review is an egg with a ribbon tied round it.
  review(pc, c, r, bud) {
    const cy = Math.round(egg(pc, 7 + r, 5, c))
    if (!bud) { band(pc, cy + 1, 2, P.linen); pc.vline(CX, cy - 1, cy + 3, P.linen); pc.px(CX - 1, cy - 1, P.linen); pc.px(CX + 1, cy - 1, P.linen) }
  },
  // Research is a crocus, low to the ground, three petals up out of the grass.
  research(pc, c, r, bud) {
    pc.vline(CX, BASE - 3, BASE, P.vegLeafDark)
    pc.px(CX - 1, BASE - 1, P.vegLeaf)
    pc.px(CX + 1, BASE - 1, P.vegLeaf)
    const y = BASE - 5
    if (bud) { pc.rect(CX - 1, y, 3, 3, P.vegLeafLight); return }
    pc.rect(CX - 1, y, 3, 3, c)
    pc.px(CX - 2, y, shade(c, 0.2)); pc.px(CX + 2, y, shade(c, -0.2))
    pc.px(CX, y + 1, P.daffodil)
  },
  // Odds and ends are a speckled egg.
  misc(pc, c, r, bud) {
    const cy = Math.round(egg(pc, 6, 4, c))
    if (!bud) for (const [dx, dy] of [[-1, -2], [1, -1], [0, 0], [-1, 1], [1, 2]]) pc.px(CX + dx, cy + dy, shade(c, -0.34))
  },
}

/**
 * One finished thread's egg or flower, for FLOWER_KINDS[kind], on the flower's spot.
 * @param {number} kind  into FLOWER_KINDS
 * @param {number} stage 0 sprouting · 1 undyed or unopened (an open PR) · 2 painted or in bloom
 * @param {string} color its colour, the pull request's
 */
export function drawEgg(kind, stage, color) {
  const k = FLOWER_KINDS[kind] || FLOWER_KINDS[0]
  const pc = new PixelCanvas(FLOWER_W, FLOWER_H)
  // Straw drawn up round its foot, always: it is what marks the spot the renderer picks it by.
  pc.hline(CX - 2, CX + 2, BASE, P.hayDark)
  pc.px(CX - 2, BASE, P.eggBedDark)
  pc.px(CX + 2, BASE, P.eggBedDark)
  if (stage <= 0) {
    // Just sown: a sprout's two leaves up out of the grass.
    pc.vline(CX, BASE - 2, BASE - 1, P.vegLeafDark)
    pc.px(CX - 1, BASE - 3, P.vegLeafLight)
    pc.px(CX + 1, BASE - 3, P.vegLeaf)
    return pc.outline(P.outline)
  }
  const bud = stage < 2
  const r = k.size === 'l' ? 2 : k.size === 'm' ? 1 : 0
  const draw = CROPS[k.work] || CROPS.misc
  // An open PR is undyed: cream, with a dab of its colour so it still says which one it is.
  draw(pc, bud ? P.linen : color, r, bud, color)
  if (bud) pc.px(CX, BASE - 3, color)
  return pc.outline(P.outline)
}
