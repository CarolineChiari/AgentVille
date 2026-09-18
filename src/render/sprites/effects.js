// Badges over heads and the little bits of weather villagers make: sparks, confetti, z's.
import { BADGE, BUTTERFLIES, CONFETTI, PALETTE as P, shade } from './palette.js'
import { PixelCanvas } from './pixel.js'
import { SIZE, buntingStrings, pennants } from '../square.js'

const GLYPHS = {
  waiting: ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  blocked: ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  done: ['.....', '....#', '...##', '#.##.', '###..', '.#...', '.....'],
  working: ['####.', '####.', '.##..', '..#..', '..#..', '..#..', '..#..'],
  party: ['..#..', '..#..', '#####', '.###.', '.###.', '##.##', '#...#'],
}

export const BADGE_W = 13
export const BADGE_H = 15

export function drawBadge(kind) {
  const pc = new PixelCanvas(BADGE_W, BADGE_H)
  const color = BADGE[kind] || BADGE.waiting
  pc.ellipse(6.5, 6.5, 6.5, 6.5, color)
  pc.hline(4, 8, 1, shade(color, 0.3))
  pc.hline(5, 7, 12, color)
  pc.px(6, 13, color)
  const g = GLYPHS[kind] || GLYPHS.waiting
  const ink = kind === 'waiting' || kind === 'party' ? P.outline : P.white
  g.forEach((row, y) => [...row].forEach((ch, x) => ch === '#' && pc.px(4 + x, 3 + y, ink)))
  return pc.outline(P.outline)
}

export function drawZ() {
  const pc = new PixelCanvas(6, 6)
  pc.hline(0, 4, 0, P.white)
  pc.px(3, 1, P.white)
  pc.px(2, 2, P.white)
  pc.px(1, 3, P.white)
  pc.hline(0, 4, 4, P.white)
  return pc.outline(BADGE.working)
}

/** A ring on the ground under the selected villager. */
export function drawRing(color) {
  const pc = new PixelCanvas(16, 7)
  pc.ellipse(8, 3.5, 7.5, 3.2, color)
  pc.ellipse(8, 3.5, 5.5, 1.8, null)
  for (let y = 0; y < 7; y++) for (let x = 0; x < 16; x++) {
    const dx = (x + 0.5 - 8) / 5.5
    const dy = (y + 0.5 - 3.5) / 1.8
    if (dx * dx + dy * dy <= 1) pc.clearPx(x, y)
  }
  return pc
}

export function drawShadow(w = 12, h = 4) {
  const pc = new PixelCanvas(w, h)
  pc.ellipse(w / 2, h / 2, w / 2, h / 2, P.shadow)
  return pc
}

/** A butterfly seen from above, 5×3: frame 0 wings open, frame 1 wings up and narrow. */
export function drawButterfly(color, frame) {
  const pc = new PixelCanvas(5, 3)
  const c = BUTTERFLIES[color % BUTTERFLIES.length]
  const edge = shade(c, -0.3)
  if (frame % 2 === 0) {
    for (const x of [0, 1, 3, 4]) {
      pc.px(x, 0, x === 0 || x === 4 ? edge : c)
      pc.px(x, 1, c)
    }
    pc.px(1, 2, edge)
    pc.px(3, 2, edge)
  } else {
    pc.px(1, 0, c)
    pc.px(3, 0, c)
    pc.px(1, 1, edge)
    pc.px(3, 1, edge)
  }
  pc.vline(2, 1, 2, P.outline)
  return pc
}

/** A bird in flight, 7×3: frame 0 wings raised, frame 1 wings down. */
export function drawBird(frame) {
  const pc = new PixelCanvas(7, 3)
  if (frame % 2 === 0) {
    pc.px(0, 0, P.bird)
    pc.px(6, 0, P.bird)
    pc.px(1, 1, P.bird)
    pc.px(5, 1, P.bird)
    pc.hline(2, 4, 2, P.bird)
  } else {
    pc.hline(1, 5, 1, P.bird)
    pc.px(0, 2, P.bird)
    pc.px(6, 2, P.bird)
    pc.px(3, 2, P.bird)
  }
  return pc
}

/**
 * The arrival square's bunting, the size of the whole square: strings from lamppost to lamppost
 * and up to the arch, a pennant every few pixels. Frame 1 has every other pennant blown aside.
 */
export function drawBunting(frame) {
  const pc = new PixelCanvas(SIZE, SIZE)
  for (const pts of buntingStrings()) for (const [x, y] of pts) pc.px(x, y, P.woodDark)
  pennants().forEach(([x, y, c], i) => {
    const color = CONFETTI[c % CONFETTI.length]
    const blown = frame % 2 === 1 && i % 2 === 0 ? 1 : 0
    pc.hline(x - 1, x + 1, y + 1, color)
    pc.hline(x - 1, x + 1, y + 2, shade(color, -0.15))
    pc.px(x + blown, y + 3, color)
  })
  return pc
}
