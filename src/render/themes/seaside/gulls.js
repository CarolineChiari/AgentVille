// The bird over a harbour is a gull. The village's own bird (drawBird in
// src/render/sprites/effects.js) is a dark silhouette three pixels deep; a gull is the same size
// and the same two frames — wings up, wings down — so it flies the same paths, but it is white
// with a grey mantle and black wingtips, which is what tells a gull from a crow at any distance.
//
// `fx.bird` carries the whole village's theme rather than a plot's, so this draws the birds only
// while the village itself is a harbour; over a village of any other theme they stay its own.
import { PALETTE as P } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'

export function drawGull(frame) {
  const pc = new PixelCanvas(7, 3)
  if (frame % 2 === 0) {
    // Wings up: the tips high and the body low between them.
    pc.px(0, 0, P.gullDark)
    pc.px(6, 0, P.gullDark)
    pc.px(1, 1, P.gullGrey)
    pc.px(5, 1, P.gullGrey)
    pc.hline(2, 4, 2, P.gull)
    pc.px(3, 2, P.gullBeak)
  } else {
    // Wings down: one long white bar with the tips turned under it.
    pc.hline(1, 5, 1, P.gull)
    pc.px(2, 1, P.gullGrey)
    pc.px(4, 1, P.gullGrey)
    pc.px(0, 2, P.gullDark)
    pc.px(6, 2, P.gullDark)
    pc.px(3, 0, P.gullBeak)
  }
  return pc
}
