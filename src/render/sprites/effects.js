// Badges over heads and the little bits of weather villagers make: sparks, confetti, z's.
import { BADGE, PALETTE as P, shade } from './palette.js'
import { PixelCanvas } from './pixel.js'

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
