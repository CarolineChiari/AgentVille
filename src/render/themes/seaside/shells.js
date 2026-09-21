// Finished work in a harbour: a find set out on the strand above the tide, where the village
// grows a flower in its garden. A find keeps everything a flower says: what it is says what kind
// of work it was (a scallop for a bug fix, a nautilus for research), its colour is the pull
// request's, a white one is an unlabeled PR, and an open PR is still half buried in the sand.
//
// Its size and how high it sits come from the flower kind's own `size` and `stem`, so the five
// kinds within a work type differ from each other as the five daisies do.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { FLOWER_H, FLOWER_W } from '../../sprites/flowers.js'
import { FLOWER_KINDS } from '../../../sim/flowers.js'

/** The spot the renderer puts on the ground, and the column everything stands on. */
const CX = 4
const BASE = 11
/**
 * How far above the sand the foot of the find sits, by the flower kind's stem: a cowrie lies on
 * the sand, a conch is stood on end. Its middle is worked out from this and its size, so every
 * find rests on the strand instead of hanging over it.
 */
const STAND = { tall: 4, mid: 3, short: 2 }
/** How big it is, by the flower kind's size. */
const R = { s: 2, m: 3, l: 3 }

/**
 * Each kind of work has its own find. `c` is the pull request's colour, `cy` the middle of the
 * find and `r` its half-width; every one of them is drawn between (CX - r - 1) and (CX + r + 1),
 * so no find leans off the 9 px canvas.
 */
const FINDS = {
  // A bug fix is a scallop: the fan everybody pictures when they hear shell.
  fix(pc, c, cy, r) {
    const light = shade(c, 0.22)
    const dark = shade(c, -0.3)
    // An arched rim over a body that narrows to the hinge, with the ribs fanning out from the
    // hinge to the rim. Vertical ribs under a flat rim read as a trophy; a fan has to fan.
    const hinge = cy + r
    for (let i = 0; i <= r; i++) {
      const w = i === 0 ? r - 1 : r - Math.max(0, i - 1)
      pc.hline(CX - w, CX + w, cy - 1 + i, c)
    }
    pc.hline(CX - r + 1, CX + r - 1, cy - 1, light)
    for (const dx of [-r + 1, 0, r - 1]) pc.line(CX, hinge, CX + dx, cy - 1, dark)
    pc.px(CX - r, cy, light)
    pc.px(CX + r, cy, dark)
    // The ears either side of the hinge, and the hinge itself sitting in the sand.
    pc.px(CX - 2, hinge, dark)
    pc.px(CX + 2, hinge, dark)
    pc.hline(CX - 1, CX + 1, hinge, light)
  },
  // A new feature is a conch: a spire drawn out to a point over a body with a flared lip.
  feature(pc, c, cy, r) {
    const light = shade(c, 0.24)
    const dark = shade(c, -0.3)
    // Half-widths from the tip of the spire down to the mouth, each pair [left, right]: the lip
    // flares out to the right, which is what tells a conch from a round shell at this size.
    const profile = [[0, 0], [1, 0], [1, 1], [r - 1, r - 1], [r, r], [r - 1, r]]
    profile.forEach(([l, w], i) => {
      const y = cy - r + i
      pc.hline(CX - l, CX + w, y, c)
      pc.px(CX - l, y, light)
      pc.px(CX + w, y, dark)
    })
    pc.px(CX, cy - r, light)
    // The mouth: a pale slot up the inside of the lip.
    pc.vline(CX + r - 1, cy + 1, cy + r - 1, light)
    pc.px(CX + r - 1, cy + r, dark)
  },
  // A refactor is a razor shell: one clean blade, nothing wasted.
  refactor(pc, c, cy, r) {
    const h = r + 3
    pc.vline(CX, cy - h + 2, cy + 2, c)
    pc.vline(CX - 1, cy - h + 3, cy + 2, shade(c, 0.22))
    pc.vline(CX + 1, cy - h + 2, cy + 1, shade(c, -0.3))
    pc.px(CX, cy - h + 1, shade(c, 0.22))
    pc.hline(CX - 1, CX + 1, cy + 2, shade(c, -0.3))
  },
  // Docs are a cuttlebone: flat, pale and written all over with fine lines.
  docs(pc, c, cy, r) {
    pc.ellipse(CX, cy + 1, r * 0.8, r + 0.5, c)
    for (let y = cy - r + 1; y <= cy + r; y += 2) pc.hline(CX - 1, CX + 1, y, shade(c, -0.28))
    pc.px(CX - 1, cy - r + 1, shade(c, 0.24))
    pc.px(CX, cy + r + 1, shade(c, -0.28))
  },
  // Tests are cowries: small, hard and there in numbers.
  test(pc, c, cy, r) {
    pc.ellipse(CX, cy + 1, r * 0.8, r * 0.7, c)
    pc.hline(CX - 1, CX + 1, cy + 1, shade(c, -0.34)) // the slit along its underside
    pc.px(CX - 1, cy, shade(c, 0.24))
    if (r > 2) {
      pc.ellipse(CX + 2, cy + 3, 1.4, 1, shade(c, -0.18))
      pc.px(CX + 2, cy + 3, shade(c, 0.24))
    }
  },
  // Design work is a starfish: five arms, and it wants to be seen.
  ui(pc, c, cy, r) {
    const light = shade(c, 0.24)
    const dark = shade(c, -0.3)
    pc.ellipse(CX, cy, 1.6, 1.4, c)
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]]) {
      for (let i = 1; i <= r - 1; i++) pc.px(CX + dx * i, cy + dy * i, i === r - 1 ? light : c)
    }
    pc.px(CX, cy, light)
    pc.px(CX - 1, cy + 1, dark)
    pc.px(CX + 1, cy + 1, dark)
  },
  // Infrastructure is a mooring buoy: the heavy thing everything else is tied to.
  infra(pc, c, cy, r) {
    pc.ellipse(CX, cy + 1, r, r, c)
    pc.ellipse(CX - 1, cy, r * 0.4, r * 0.4, shade(c, 0.26))
    pc.hline(CX - r, CX + r, cy + 1, shade(c, -0.3)) // the band round its middle
    pc.px(CX, cy - r, P.seaIron)
    pc.px(CX, cy - r - 1, P.seaIronLight) // and the ring on top
    pc.px(CX + 1, cy - r - 1, P.seaIron)
  },
  // Data is a net float: the same round thing, but held in a mesh.
  data(pc, c, cy, r) {
    pc.ellipse(CX, cy, r, r, c)
    // The mesh only where the float is, and only on its diagonals: drawn as a grid over every
    // other row and column it covered the float and read as a crate.
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = CX - r; x <= CX + r; x++) {
        if (!pc.opaque(x, y)) continue
        const a = ((x + y) % 3 + 3) % 3 === 0
        const b = ((x - y) % 3 + 3) % 3 === 0
        if (a && b) pc.px(x, y, P.netTwine)
        else if (a) pc.px(x, y, P.netTwineDark)
      }
    }
    pc.px(CX - 1, cy - 1, shade(c, 0.26))
    pc.px(CX, cy - r - 1, P.rope)
  },
  // Performance is a whelk: a tall spire streaming away over its mouth.
  perf(pc, c, cy, r) {
    const light = shade(c, 0.24)
    const dark = shade(c, -0.3)
    // A tall spire: three rows of point, then the body, and the mouth open at the foot. The step
    // down its right-hand side is the whorl turning; a smooth cone read as a hat.
    const h = r + 4
    for (let i = 0; i < h; i++) {
      const w = Math.min(r, Math.floor(i / 2))
      // Leaning: the spire's tip stands over the right-hand side of the mouth, which is what
      // tells a whelk from the conch's straight cone at this size.
      const lean = Math.round(((h - 1 - i) / (h - 1)) * 2)
      const y = cy - h + 3 + i
      pc.hline(CX - w + lean, CX + w + lean, y, c)
      pc.px(CX - w + lean, y, light)
      if (w) pc.px(CX + w + lean, y, dark)
      if (i % 2 === 0 && w > 0) pc.px(CX + w - 1 + lean, y, dark)
    }
    pc.hline(CX - r + 1, CX + r, cy + 3, light) // the mouth
    pc.px(CX + r, cy + 3, dark)
  },
  // A review is an abalone: low and wide, with the row of holes along its back, taking it all in.
  review(pc, c, cy, r) {
    pc.ellipse(CX, cy + 1, r, r * 0.6, c)
    // Mother-of-pearl inside the rim, and the breathing holes along the back of it: the holes are
    // most of what says abalone, so they are drawn in the shell's deepest shadow.
    pc.hline(CX - r + 1, CX + r - 1, cy, shade(c, 0.34))
    for (let dx = -r + 1; dx <= r - 1; dx += 2) {
      pc.px(CX + dx, cy, P.outline)
      pc.px(CX + dx, cy - 1, shade(c, -0.4))
    }
    pc.hline(CX - r, CX + r, cy + 2, shade(c, -0.3))
    pc.px(CX - r, cy + 1, shade(c, 0.3))
  },
  // Research is a nautilus: one chamber after another, each bigger than the last.
  research(pc, c, cy, r) {
    const dark = shade(c, -0.3)
    pc.ellipse(CX, cy, r, r * 0.95, c)
    // The whorl: a curl of shadow from the rim in to the eye of the spiral, and one chamber wall
    // across it. A ring of shadow read as a hole, and spokes all round read as a cut cake.
    for (const [dx, dy] of [[0, -r], [1, -r + 1], [r - 1, -1], [r, 0], [r - 1, 1]]) pc.px(CX + dx, cy + dy, dark)
    pc.px(CX + 1, cy - 1, dark)
    pc.px(CX + 1, cy, dark)
    pc.px(CX - 1, cy - 1, shade(c, 0.34)) // the eye of it, catching the light
    pc.px(CX - r, cy, shade(c, 0.3))
  },
  // Odds and ends are sea glass: a corner of a bottle the sea has rounded off.
  misc(pc, c, cy, r) {
    pc.hline(CX - 1, CX + 1, cy, c)
    pc.hline(CX - r + 1, CX + r - 1, cy + 1, c)
    pc.px(CX - 1, cy, shade(c, 0.3))
    pc.px(CX + r - 1, cy + 1, shade(c, -0.3))
    pc.px(CX + 1, cy + 2, shade(c, -0.3))
  },
}

/**
 * One finished thread's find, for FLOWER_KINDS[kind], the size of a flower and on the flower's spot.
 * @param {number} kind  into FLOWER_KINDS
 * @param {number} stage 0 the mark in the sand · 1 half buried (an open PR) · 2 set out on the strand
 * @param {string} color its colour, the pull request's
 */
export function drawShell(kind, stage, color) {
  const k = FLOWER_KINDS[kind] || FLOWER_KINDS[0]
  const pc = new PixelCanvas(FLOWER_W, FLOWER_H)
  // The sand at the foot, always: it is what marks the spot the renderer picks the find by.
  pc.hline(CX - 2, CX + 2, BASE, P.shellGrit)
  pc.px(CX - 2, BASE, P.shellShade)
  pc.px(CX + 2, BASE, P.shellShade)
  if (stage <= 0) {
    // Nothing found yet: a dimple the tide left, with a wisp of weed across it.
    pc.hline(CX - 1, CX + 1, BASE - 1, P.shellShade)
    pc.px(CX, BASE - 2, P.seaweed)
    pc.px(CX + 1, BASE - 3, P.seaweedDark)
    pc.px(CX - 2, BASE - 1, P.shellGrit)
    return pc.outline(P.outline)
  }
  const r = R[k.size] ?? R.m
  const cy = Math.max(r + 1, BASE - (STAND[k.stem] ?? STAND.mid) - r)
  const buried = stage < 2
  // Half buried, the find is the same shape in the same colour held back, so an open PR reads as
  // not done at a glance rather than merely as a darker find.
  const c = buried ? shade(color, -0.3) : color
  const draw = FINDS[k.work] || FINDS.misc
  draw(pc, c, cy, r)
  if (buried) {
    // The sand heaped over its lower half, drawn after it, so only the top of the find shows. A
    // heap rather than a band across the sprite: a full-width block read as a crate round it.
    for (let y = cy; y <= BASE; y++) {
      const half = Math.min(4, 1 + (y - cy))
      pc.hline(CX - half, CX + half, y, y === cy ? P.shellWhite : (y & 1) ? P.shellGrit : P.shellShade)
    }
    pc.px(CX + 2, cy + 1, P.shellWhite)
  } else {
    // Set out on the strand: a little sand pushed up round its foot, and a grain or two beside it.
    pc.hline(CX - r, CX + r, BASE, P.shellShade)
    pc.hline(CX - r + 1, CX + r - 1, BASE - 1, P.shellGrit)
    pc.px(CX + r + (r > 2 ? 0 : 1), BASE - 1, P.shellGrit)
  }
  return pc.outline(P.outline)
}
