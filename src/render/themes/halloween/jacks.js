// Finished work on Halloween night: a jack-o'-lantern carved and lit in the plot's pumpkin patch,
// where the village grows a flower in its garden. A lantern keeps everything a flower says: what
// is cut into its face is the kind of work (a grin for a bug fix, an owl for research), its skin
// the flower's colour, a white one an unlabeled PR, and an open PR's pumpkin is grown but not yet
// cut open.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { FLOWER_H, FLOWER_W } from '../../sprites/flowers.js'
import { FLOWER_KINDS } from '../../../sim/flowers.js'

/** The stake rises on the flower's stem, so a lantern stands over the spot a flower blooms on. */
const STEM = 4
/** The flower's base row: the bine at the lantern's foot lies on the same spot. */
const BASE = 11
/** Where the pumpkin's top row is, by the flower's stem length. */
const TOP = { tall: 2, mid: 4, short: 6 }
/** Rows of pumpkin, by the flower's size, and how wide its widest row is. */
const ROWS = { s: 4, m: 5, l: 6 }
const HALF = { s: 2, m: 3, l: 3 }
/**
 * Half-widths down a pumpkin, by its height: narrow at the crown and the foot, full in between.
 * Capped by the size's own half-width. The crown and the foot have to come in by a whole pixel,
 * or the outline closes round the sprite and what is left reads as a ball rather than a pumpkin.
 */
const PROFILE = { 4: [1, 2, 2, 1], 5: [2, 3, 3, 3, 2], 6: [2, 3, 3, 3, 3, 2] }

/**
 * What is cut into the face, by kind of work: five columns by three rows, '#' where the candle
 * shows through. Three rows because that is all a four-row pumpkin can hold — at this size the
 * top two rows are merged rather than dropped, so no two faces collapse into each other.
 */
const FACE = {
  fix: [' # # ', '  #  ', '## ##'], // a grin with a tooth left in it
  feature: ['#   #', '  #  ', ' ### '], // wide-set eyes over a round mouth
  refactor: [' ### ', '     ', ' ### '], // two neat slots, nothing wasted
  docs: ['#####', '     ', '#####'], // cut in lines, like something written down
  test: [' #  #', '     ', '  #  '], // the smallest face that is still a face
  ui: ['## ##', '  #  ', '# # #'], // carved all over, for the sake of it
  infra: ['# # #', '# # #', '# # #'], // barred top to bottom
  data: ['#   #', ' ### ', '#   #'], // a lattice
  perf: [' ##  ', '   ##', '  ###'], // streaming away to one side
  review: ['#### ', '#### ', '  #  '], // one wide eye, taking it all in
  research: ['## ##', '# # #', '  #  '], // an owl
  misc: ['#  # ', '     ', ' ##  '], // lopsided, cut in a hurry
}

/** The three face rows, onto a pumpkin `h` rows tall whose crown is on `top`. */
const faceRows = (top, h) => (h <= 4 ? [top + 1, top + 1, top + 2] : [top + 1, top + 2, top + h - 2])

/**
 * A jack-o'-lantern for FLOWER_KINDS[kind], the size of a flower, on the flower's spot.
 * @param {number} kind  into FLOWER_KINDS
 * @param {number} stage 0 a seedling · 1 grown but uncarved (an open PR) · 2 carved and lit
 * @param {string} color its skin
 */
export function drawJack(kind, stage, color) {
  const k = FLOWER_KINDS[kind] || FLOWER_KINDS[0]
  const pc = new PixelCanvas(FLOWER_W, FLOWER_H)
  // The bine, always at the foot: it is what marks the spot the renderer picks the lantern by.
  pc.hline(STEM - 2, STEM + 2, BASE, P.bine)
  pc.px(STEM - 2, BASE, P.stalkDark)
  if (stage <= 0) {
    // Nothing up yet but a seedling: a shoot with its first two leaves.
    pc.vline(STEM, BASE - 3, BASE - 1, P.stalkDark)
    pc.px(STEM - 1, BASE - 3, P.stalk)
    pc.px(STEM - 2, BASE - 4, P.bine)
    pc.px(STEM + 1, BASE - 2, P.stalk)
    return pc.outline(P.outline)
  }
  const h = ROWS[k.size] ?? ROWS.m
  const hm = HALF[k.size] ?? HALF.m
  const top = Math.min(TOP[k.stem] ?? TOP.mid, BASE - h)
  const bottom = top + h - 1
  // A stake driven into the mound, where the pumpkin does not reach the ground by itself.
  if (bottom + 1 <= BASE - 1) {
    pc.vline(STEM - 1, bottom + 1, BASE - 1, P.deadBarkDark)
    pc.vline(STEM, bottom + 1, BASE - 1, P.deadBark)
    pc.vline(STEM + 1, bottom + 1, BASE - 1, P.deadBarkDark)
    pc.hline(STEM - 1, STEM + 1, bottom + 1, P.deadBarkLight)
  }
  const lit = stage >= 2
  // Uncarved, the pumpkin is still ripening: the same skin, held back, so an open PR reads as
  // not done at a glance and not merely as a darker colour.
  const skin = lit ? color : shade(color, -0.32)
  const dark = shade(skin, -0.34)
  const light = shade(skin, 0.24)
  const profile = PROFILE[h] || PROFILE[5]
  const halfAt = (y) => Math.min(hm, profile[y])
  for (let y = 0; y < h; y++) {
    const half = halfAt(y)
    pc.hline(STEM - half, STEM + half, top + y, skin)
    pc.px(STEM - half, top + y, dark)
    pc.px(STEM + half, top + y, dark)
  }
  // The ribs, and the light down its near shoulder. Only inside the silhouette: on a small
  // pumpkin the rib column is the edge, which is already drawn dark.
  for (const dx of [-2, 2]) for (let y = 0; y < h; y++) if (halfAt(y) > 2) pc.px(STEM + dx, top + y, dark)
  for (const dx of [-1, 1]) pc.px(STEM + dx, top, dark) // the dip in the crown, either side of the stalk
  pc.px(STEM - 1, top + 1, light)
  pc.px(STEM - halfAt(1) + 1, top + 2, light)
  // The stalk, cut short and left on.
  pc.px(STEM, top - 1, P.stalkDark)
  pc.px(STEM + 1, top - 1, P.stalk)
  if (!lit) return pc.outline(P.outline)
  const rows = faceRows(top, h)
  const cells = FACE[k.work] || FACE.feature
  const cuts = []
  cells.forEach((row, j) => [...row].forEach((c, i) => c === '#' && cuts.push(STEM - 2 + i, rows[j])))
  // The rind is thick, so the skin right round a cut is in shadow. That shadow is not decoration:
  // a lantern's colour is the pull request's, and on a pale one the candlelight and the skin were
  // the same colour, which left the face invisible at 1×.
  const rind = shade(color, -0.55)
  for (let n = 0; n < cuts.length; n += 2) {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      if (pc.opaque(cuts[n] + dx, cuts[n + 1] + dy)) pc.px(cuts[n] + dx, cuts[n + 1] + dy, rind)
    }
  }
  for (let n = 0; n < cuts.length; n += 2) pc.px(cuts[n], cuts[n + 1], P.jackGlow)
  // The candle itself, brightest in the middle of whatever was cut, so a lit lantern reads as lit
  // at 1×, where the face is only a few pixels.
  // The middle row of the face first, then whatever is cut nearest the middle of the pumpkin:
  // a face cut only down its sides (the iron-hooped one) has nothing on the centre column at all.
  for (const j of [1, 2, 0]) {
    const i = [2, 1, 3, 0, 4].find((n) => cells[j][n] === '#')
    if (i === undefined) continue
    pc.px(STEM - 2 + i, rows[j], P.jackCore)
    break
  }
  return pc.outline(P.outline)
}
