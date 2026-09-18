// Ground tiles (16×16), their decorations, and the tall scenery that is y-sorted with villagers.
import { PALETTE as P, shade } from './palette.js'
import { PixelCanvas } from './pixel.js'
import { mulberry32 } from '../../sim/rng.js'

const T = 16

function speckle(pc, rand, colors, n) {
  for (let i = 0; i < n; i++) pc.px(Math.floor(rand() * T), Math.floor(rand() * T), colors[Math.floor(rand() * colors.length)])
}

export const TILE_VARIANTS = { wild: 4, yard: 3, road: 3, plaza: 2, bed: 2 }

export function drawTile(kind, variant) {
  const rand = mulberry32(variant * 131 + kind.length * 17)
  const pc = new PixelCanvas(T, T)
  if (kind === 'wild') {
    pc.rect(0, 0, T, T, P.grass[0])
    speckle(pc, rand, [P.grass[1], P.grass[2]], 18)
    for (let i = 0; i < 3; i++) {
      const x = 1 + Math.floor(rand() * 14)
      const y = 2 + Math.floor(rand() * 12)
      pc.px(x, y, P.grass[3])
      pc.px(x, y - 1, P.grass[3])
      pc.px(x + 1, y, P.grass[3])
      pc.px(x + 1, y - 2, P.grass[2])
    }
  } else if (kind === 'yard') {
    pc.rect(0, 0, T, T, P.yard[0])
    speckle(pc, rand, [P.yard[1], P.yard[2]], 12)
  } else if (kind === 'road') {
    pc.rect(0, 0, T, T, P.path)
    speckle(pc, rand, [P.pathLight], 10)
    for (let i = 0; i < 3; i++) {
      const x = Math.floor(rand() * 14)
      const y = Math.floor(rand() * 15)
      pc.hline(x, x + 1, y, P.pathDark)
    }
  } else if (kind === 'bed') {
    // Ploughed soil. The empty dimples mark where flowers will go, 8 px apart, the way a
    // contribution graph shows empty days. Variant 0 is a field's top row, whose first row of
    // flowers sits 4 px under the plank edging; variant 1 is every row below, where the grid
    // carries on from the row above, so it has a second row of dimples near its top.
    pc.rect(0, 0, T, T, P.bed)
    speckle(pc, rand, [P.bedDark], 8)
    for (const y0 of variant ? [-4, 4] : [4]) {
      for (const x0 of [0, 8]) {
        pc.hline(x0 + 2, x0 + 5, y0 + 5, P.bedHole)
        pc.hline(x0 + 3, x0 + 4, y0 + 6, P.bedHole)
      }
    }
  } else if (kind === 'plaza') {
    pc.rect(0, 0, T, T, P.plaza)
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? 2 : 0
      pc.hline(0, T - 1, row * 4 + 3, P.plazaDark)
      for (let x = off; x < T; x += 4) pc.vline(x, row * 4, row * 4 + 2, P.plazaDark)
      for (let x = off + 1; x < T; x += 4) pc.px(x, row * 4, P.plazaLight)
    }
  }
  return pc
}

export function drawDeco(kind, variant = 0) {
  const pc = new PixelCanvas(T, T)
  const rand = mulberry32(variant * 977 + 3)
  const post = (x, y0, y1) => {
    pc.rect(x, y0, 3, y1 - y0 + 1, P.fence)
    pc.vline(x + 2, y0 + 1, y1, P.fenceDark)
    pc.hline(x, x + 2, y0, shade(P.fence, 0.2))
  }
  if (kind === 'fenceh' || kind === 'post') {
    pc.hline(0, T - 1, 6, P.fence)
    pc.hline(0, T - 1, 7, P.fenceDark)
    pc.hline(0, T - 1, 10, P.fence)
    pc.hline(0, T - 1, 11, P.fenceDark)
    post(1, 3, 13)
    post(12, 3, 13)
  }
  if (kind === 'fencev' || kind === 'post') {
    pc.rect(7, 0, 2, T, P.fence)
    pc.vline(8, 0, T - 1, P.fenceDark)
    post(6, 1, 6)
    post(6, 9, 14)
  }
  if (kind === 'flowers') {
    const n = 3 + Math.floor(rand() * 3)
    const color = P.flower[variant % P.flower.length]
    for (let i = 0; i < n; i++) {
      const x = 2 + Math.floor(rand() * 12)
      const y = 3 + Math.floor(rand() * 10)
      pc.px(x, y + 2, P.leafDark)
      pc.px(x - 1, y + 1, P.leaf)
      pc.px(x, y - 1, color)
      pc.px(x - 1, y, color)
      pc.px(x + 1, y, color)
      pc.px(x, y + 1, color)
      pc.px(x, y, P.flower[1] === color ? P.white : P.flower[1])
    }
  }
  if (kind === 'pebbles') {
    for (let i = 0; i < 3; i++) {
      const x = 2 + Math.floor(rand() * 11)
      const y = 3 + Math.floor(rand() * 10)
      pc.hline(x, x + 1, y, P.pebble)
      pc.hline(x, x + 1, y + 1, shade(P.pebble, -0.25))
    }
  }
  return pc
}

/** Tall scenery. Anchor: bottom centre on the tile's bottom edge. */
export function drawStatic(sprite, variant = 0, opts = {}) {
  if (sprite === 'tree') {
    const pc = new PixelCanvas(24, 34)
    const rand = mulberry32(variant * 53 + 11)
    if (variant === 1) {
      pc.rect(10, 26, 4, 7, P.trunk)
      pc.vline(13, 26, 32, shade(P.trunk, -0.3))
      for (const [top, half, h] of [[1, 5, 9], [7, 8, 10], [14, 11, 13]]) {
        for (let y = 0; y < h; y++) {
          const w = Math.round(1 + (half * y) / h)
          pc.hline(12 - w, 11 + w, top + y, y > h - 3 ? P.pineDark : P.pine)
          pc.px(12 - w, top + y, P.pineDark)
        }
      }
      for (let i = 0; i < 6; i++) pc.px(6 + Math.floor(rand() * 12), 6 + Math.floor(rand() * 18), shade(P.pine, 0.2))
      return pc.outline(P.outline)
    }
    pc.rect(10, 20, 4, 13, P.trunk)
    pc.vline(13, 20, 32, shade(P.trunk, -0.3))
    pc.px(9, 32, P.trunk)
    pc.px(14, 32, P.trunk)
    pc.ellipse(12, 12, 11.5, 10.5, P.leafDark)
    pc.ellipse(11.5, 11, 10.5, 9, P.leaf)
    for (let i = 0; i < 5; i++) pc.ellipse(5 + rand() * 11, 5 + rand() * 8, 2.5, 2, P.leafLight)
    for (let i = 0; i < 10; i++) pc.px(3 + Math.floor(rand() * 18), 4 + Math.floor(rand() * 16), P.leafDark)
    if (variant === 2) for (let i = 0; i < 7; i++) {
      const x = 4 + Math.floor(rand() * 16)
      const y = 6 + Math.floor(rand() * 12)
      pc.px(x, y, P.fruit)
      pc.px(x + 1, y, shade(P.fruit, -0.2))
    }
    return pc.outline(P.outline)
  }
  if (sprite === 'lamp') {
    const pc = new PixelCanvas(8, 24)
    pc.vline(3, 8, 22, P.metalDark)
    pc.vline(4, 8, 22, P.metal)
    pc.rect(2, 21, 4, 3, P.metalDark)
    pc.rect(1, 2, 6, 6, P.metalDark)
    pc.rect(2, 3, 4, 4, opts.lit ? P.windowLit : P.windowShine)
    pc.hline(0, 7, 1, P.metalDark)
    return pc.outline(P.outline)
  }
  if (sprite === 'arch') {
    const pc = new PixelCanvas(64, 44)
    for (const x0 of [0, 56]) {
      pc.rect(x0, 12, 8, 32, P.stone)
      for (let y = 12; y < 44; y += 4) {
        pc.hline(x0, x0 + 7, y, P.stoneDark)
        pc.vline(x0 + (y % 8 ? 3 : 5), y, y + 3, P.stoneDark)
      }
      pc.vline(x0 + 7, 12, 43, P.stoneDark)
      pc.rect(x0 - 1 + (x0 ? 0 : 1), 10, 8, 2, P.stoneLight)
      for (let y = 16; y < 40; y += 5) {
        pc.px(x0 + (y % 2 ? 1 : 6), y, P.leaf)
        pc.px(x0 + (y % 2 ? 2 : 5), y + 1, P.leafDark)
      }
      pc.px(x0 + 2, 22, P.flower[0])
      pc.px(x0 + 5, 33, P.flower[3])
    }
    pc.rect(0, 4, 64, 6, P.wood)
    pc.hline(0, 63, 4, P.woodLight)
    pc.hline(0, 63, 9, P.woodDark)
    pc.rect(18, 11, 28, 9, P.plaster)
    pc.hline(18, 45, 11, P.woodDark)
    pc.hline(18, 45, 19, P.woodDark)
    pc.vline(18, 11, 19, P.woodDark)
    pc.vline(45, 11, 19, P.woodDark)
    pc.vline(22, 9, 11, P.woodDark)
    pc.vline(41, 9, 11, P.woodDark)
    // "AgentVille" as a row of little letter-strokes: legible as a sign, not as text.
    for (let x = 21; x <= 42; x += 2) pc.vline(x, 14, (x * 7) % 3 ? 16 : 17, P.woodDark)
    return pc.outline(P.outline)
  }
  if (sprite === 'board') {
    // A notice board with `variant` notes pinned to it (0–6), filled left to right, top row first.
    // One pixel of margin all round leaves room for the outline.
    const pc = new PixelCanvas(16, 22)
    pc.rect(3, 14, 2, 7, P.woodDark)
    pc.rect(11, 14, 2, 7, P.woodDark)
    pc.vline(3, 14, 20, P.wood)
    pc.vline(11, 14, 20, P.wood)
    pc.rect(1, 1, 14, 2, P.woodDark)
    pc.hline(1, 14, 1, P.woodLight)
    pc.rect(1, 3, 14, 11, P.woodDark)
    pc.rect(2, 4, 12, 9, P.wood)
    const shown = Math.max(0, Math.min(6, variant))
    for (let i = 0; i < shown; i++) {
      const x = 3 + (i % 3) * 4
      const y = 5 + Math.floor(i / 3) * 4
      pc.rect(x, y, 3, 3, i % 2 ? shade(P.paper, -0.06) : P.paper)
      pc.hline(x, x + 2, y + 2, P.plasterShade)
      pc.px(x + 1, y, P.pin)
    }
    return pc.outline(P.outline)
  }
  return new PixelCanvas(1, 1)
}
