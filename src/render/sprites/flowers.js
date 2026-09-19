// Flowers: 9×13 canvases, base of the stem at (4, 11), outlined. Every kind is one of a dozen
// shape recipes plus size, stem height and leaves; the petal colour is passed in.
import { FLOWER_KINDS } from '../../sim/flowers.js'
import { PALETTE as P, shade } from './palette.js'
import { PixelCanvas } from './pixel.js'

export const FLOWER_W = 9
export const FLOWER_H = 13
const CX = 4
const BASE = 11
const HEAD_Y = { tall: 3, mid: 4, short: 6 }
const R = { s: 1, m: 2, l: 2 }

function stem(pc, top, bottom = BASE, x = CX) {
  pc.vline(x, top, bottom, P.leaf)
}

function leaves(pc, n, top) {
  const y = Math.max(top + 2, 8)
  if (n >= 1) {
    pc.px(CX - 1, y, P.leaf)
    pc.px(CX - 2, y - 1, P.leafLight)
  }
  if (n >= 2) {
    pc.px(CX + 1, y + 1, P.leaf)
    pc.px(CX + 2, y, P.leafLight)
  }
}

const SHAPES = {
  daisy(pc, k, c, cy) {
    const r = R[k.size]
    for (let d = 1; d <= r; d++) {
      pc.px(CX, cy - d, c)
      pc.px(CX, cy + d, c)
      pc.px(CX - d, cy, c)
      pc.px(CX + d, cy, c)
    }
    if (k.size !== 's') for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pc.px(CX + dx, cy + dy, shade(c, 0.15))
    if (k.size === 'l') for (const [dx, dy] of [[-2, -1], [2, -1], [-2, 1], [2, 1], [-1, -2], [1, -2], [-1, 2], [1, 2]]) pc.px(CX + dx, cy + dy, c)
    pc.px(CX, cy, P.pollen)
  },
  star(pc, k, c, cy) {
    const big = k.size === 'l'
    pc.rect(CX - 1, cy - 1, 3, 3, c)
    pc.px(CX, cy - 2, c)
    pc.px(CX - 2, cy, c)
    pc.px(CX + 2, cy, c)
    pc.px(CX - 2, cy + 2, c)
    pc.px(CX + 2, cy + 2, c)
    if (big) {
      pc.px(CX, cy - 3, c)
      pc.px(CX - 3, cy, c)
      pc.px(CX + 3, cy, c)
    }
    pc.px(CX, cy, shade(c, 0.45))
  },
  tulip(pc, k, c, cy) {
    const hw = k.size === 'l' ? 2 : 1
    const h = k.size === 's' ? 2 : 3
    pc.rect(CX - hw, cy - h + 1, hw * 2 + 1, h, c)
    pc.vline(CX + hw, cy - h + 1, cy, shade(c, -0.25))
    pc.px(CX - hw, cy - h, c)
    pc.px(CX + hw, cy - h, c)
    if (hw === 2) pc.px(CX, cy - h, c)
    pc.px(CX - hw + 1, cy - h + 1, shade(c, 0.3))
  },
  lily(pc, k, c, cy) {
    const big = k.size === 'l'
    pc.px(CX, cy, shade(c, 0.4))
    pc.vline(CX, cy - 2, cy - 1, c)
    pc.hline(CX - 2, CX - 1, cy - 1, c)
    pc.hline(CX + 1, CX + 2, cy - 1, c)
    pc.px(CX - 1, cy + 1, c)
    pc.px(CX + 1, cy + 1, c)
    pc.px(CX - 3, cy, big ? c : null)
    pc.px(CX + 3, cy, big ? c : null)
    if (big) pc.px(CX, cy - 3, c)
    pc.px(CX - 1, cy, shade(c, -0.2))
    pc.px(CX + 1, cy, shade(c, -0.2))
  },
  rose(pc, k, c, cy) {
    const r = k.size === 's' ? 1.3 : k.size === 'l' ? 2.6 : 2.1
    pc.ellipse(CX + 0.5, cy + 0.5, r, r, c)
    const d = shade(c, -0.3)
    pc.px(CX, cy, d)
    if (k.size !== 's') {
      pc.px(CX + 1, cy - 1, d)
      pc.px(CX - 1, cy + 1, d)
      pc.px(CX - 1, cy - 1, shade(c, 0.3))
    }
  },
  cross(pc, k, c, cy) {
    const r = k.size === 's' ? 1 : 2
    pc.rect(CX - r, cy - 1, r * 2 + 1, 3, c)
    pc.rect(CX - 1, cy - r, 3, r * 2 + 1, c)
    if (k.size === 'l') {
      pc.rect(CX - 2, cy - 2, 5, 5, c)
      for (const [dx, dy] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) pc.clearPx(CX + dx, cy + dy)
    }
    pc.px(CX, cy, shade(c, -0.55))
  },
  sunflower(pc, k, c, cy) {
    const r = k.size === 's' ? 1.6 : k.size === 'l' ? 3 : 2.3
    pc.ellipse(CX + 0.5, cy + 0.5, r, r, c)
    const inner = k.size === 's' ? 0 : 1
    if (inner) pc.rect(CX - inner, cy - inner, inner * 2 + 1, inner * 2 + 1, P.seed)
    else pc.px(CX, cy, P.seed)
  },
  puff(pc, k, c, cy) {
    const r = k.size === 'l' ? 3 : 2
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2
      pc.px(Math.round(CX + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r), shade(c, 0.35))
    }
    pc.px(CX, cy, c)
    pc.px(CX, cy + r - 1, c)
  },
  bell(pc, k, c, cy) {
    // A curved stem with bells hanging off it.
    const bells = k.size === 's' ? 2 : k.size === 'l' ? 3 : 2
    pc.px(CX + 1, cy - 1, P.leaf)
    pc.px(CX + 2, cy - 1, P.leaf)
    const spots = [[CX + 2, cy], [CX - 1, cy + 2], [CX + 2, cy + 3]]
    for (let i = 0; i < bells; i++) {
      const [x, y] = spots[i]
      pc.px(x, y, c)
      pc.hline(x - 1, x + 1, y + 1, c)
      pc.px(x, y + 1, shade(c, -0.25))
    }
  },
  spike(pc, k, c, cy) {
    const top = cy - (k.size === 'l' ? 2 : k.size === 's' ? 0 : 1)
    const bottom = cy + (k.size === 'l' ? 4 : 3)
    for (let y = top; y <= bottom; y++) {
      pc.px(CX, y, (y - top) % 2 ? shade(c, -0.2) : c)
      if ((y - top) % 2 === 0 && y > top) {
        pc.px(CX - 1, y, c)
        pc.px(CX + 1, y, c)
      }
    }
  },
  cluster(pc, k, c, cy) {
    const blooms = k.size === 's' ? [[CX - 1, cy + 1], [CX + 2, cy]] : [[CX - 2, cy + 1], [CX + 1, cy - 1], [CX + 2, cy + 2]]
    for (const [x, y] of blooms) {
      pc.px(x, y - 1, c)
      pc.px(x - 1, y, c)
      pc.px(x + 1, y, c)
      pc.px(x, y + 1, c)
      pc.px(x, y, P.pollen)
      pc.line(x, y + 2, CX, BASE - 3, P.leaf)
    }
  },
  clover(pc, k, c, cy) {
    const y = cy + 2
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1]]) pc.ellipse(CX + 0.5 + dx * 1.3, y + 0.5 + dy * 1.3, 1.1, 1.1, P.leafLight)
    pc.px(CX, y, P.leaf)
    // A small round blossom above the leaves.
    pc.ellipse(CX + 0.5, cy - 0.5, k.size === 's' ? 1 : 1.5, k.size === 's' ? 1 : 1.5, c)
    pc.px(CX, cy - 1, shade(c, 0.35))
  },
  fern(pc, k, c, cy) {
    for (let y = cy; y <= BASE - 1; y += 2) {
      const w = Math.min(3, 1 + Math.floor((y - cy) / 2))
      pc.hline(CX - w, CX - 1, y, P.leaf)
      pc.hline(CX + 1, CX + w, y + 1, P.leafLight)
    }
    // Fiddlehead in the petal colour, so ferns still take part in the colour lottery.
    pc.px(CX, cy - 1, c)
    pc.px(CX + 1, cy - 2, c)
    pc.px(CX, cy - 2, c)
  },
  cactus(pc, k, c, cy) {
    const top = cy + 2
    const hw = k.size === 's' ? 2 : 1
    pc.rect(CX - hw, top, hw * 2 + 1, BASE - top + 1, P.cactus)
    pc.vline(CX + hw, top, BASE, shade(P.cactus, -0.25))
    if (k.size !== 's') {
      pc.px(CX - 2, top + 3, P.cactus)
      pc.px(CX - 2, top + 2, P.cactus)
      pc.px(CX + 2, top + 4, P.cactus)
    }
    pc.px(CX, top - 1, c)
    pc.px(CX - 1, top - 1, c)
    pc.px(CX + 1, top - 1, c)
    pc.px(CX, top - 2, shade(c, 0.3))
  },
  mushroom(pc, k, c, cy) {
    const big = k.size === 'l'
    // Measured up from the ground, so a short mushroom still has a stalk under its cap.
    const capY = BASE - (big ? 6 : 4)
    pc.rect(CX - 1, capY + 1, 3, BASE - capY, P.white)
    pc.px(CX + 1, BASE, P.plasterShade)
    pc.ellipse(CX + 0.5, capY + 0.5, big ? 3.5 : 2.6, big ? 2 : 1.6, c)
    pc.px(CX - 1, capY - 1, P.white)
    pc.px(CX + 2, capY, P.white)
    if (big) pc.px(CX - 2, capY + 1, P.white)
  },
}

/**
 * @param {number} kindIndex into FLOWER_KINDS
 * @param {number} stage 0 sprout · 1 bud · 2 bloom
 * @param {string} color petal colour
 */
export function drawFlower(kindIndex, stage, color) {
  const k = FLOWER_KINDS[kindIndex] || FLOWER_KINDS[0]
  const pc = new PixelCanvas(FLOWER_W, FLOWER_H)
  const cy = HEAD_Y[k.stem] ?? 4
  if (stage <= 0) {
    pc.px(CX, BASE, P.leaf)
    pc.px(CX, BASE - 1, P.leaf)
    pc.px(CX - 1, BASE - 2, P.leafLight)
    pc.px(CX + 1, BASE - 2, P.leafLight)
    return pc.outline(P.outline)
  }
  const selfStemmed = k.shape === 'fern' || k.shape === 'cactus' || k.shape === 'mushroom'
  if (stage === 1) {
    // A self-stemmed kind draws its own stem when it blooms; a bud still needs one, or it floats.
    stem(pc, cy + 2)
    leaves(pc, k.leaves, cy + 2)
    pc.px(CX, cy + 1, color)
    pc.px(CX, cy + 2, shade(color, -0.2))
    return pc.outline(P.outline)
  }
  if (!selfStemmed) {
    stem(pc, k.shape === 'bell' ? cy - 1 : cy + 1)
    leaves(pc, k.leaves, cy)
  }
  SHAPES[k.shape](pc, k, color, cy)
  return pc.outline(P.outline)
}
