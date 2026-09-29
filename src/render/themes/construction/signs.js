// A group's mark on a building site. Everywhere else a group's houses fly its flag by the door,
// but a flag on a site is finished work (see flags.js), so here each puts up a site board on a
// post instead, painted in the group's colour. It means what the flag does, and is its size.
import { ACCENTS, PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { BANNER_H, BANNER_POLE, BANNER_W } from '../../sprites/effects.js'

/** A site board on a post, planted where a flag would be. It doesn't flap, so both frames are the same. */
export function drawSiteSign(color) {
  const pc = new PixelCanvas(BANNER_W, BANNER_H)
  const c = ACCENTS[(Number(color) || 0) % ACCENTS.length]
  pc.vline(BANNER_POLE, 6, BANNER_H - 1, P.metalDark)
  // The board, bolted to the post along its left edge: a white border round the group's colour.
  pc.rect(BANNER_POLE, 1, 7, 6, P.white)
  pc.rect(BANNER_POLE + 1, 2, 5, 4, c)
  pc.hline(BANNER_POLE + 1, BANNER_POLE + 5, 5, shade(c, -0.2))
  return pc.outline(P.outline)
}
