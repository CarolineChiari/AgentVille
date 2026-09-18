// Buildings: 32 px wide (a 2×2-tile footprint), bottom row on the ground. Stages 0 and 1 are the
// same building site for every kind; stage 2 is the kind's walls with scaffolding; stage 3 is
// the finished building with its roof and the plot's accent colour on the trim.
import { PALETTE as P, shade } from './palette.js'
import { PixelCanvas } from './pixel.js'
import { mulberry32 } from '../../sim/rng.js'

export const BUILDING_W = 32
export const heightOf = (kind) => (kind === 'windmill' ? 60 : 48)

// ---------- parts ----------

function walls(pc, x0, x1, y0, y1, material, rand) {
  if (material === 'wood') {
    pc.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, P.wood)
    for (let y = y0 + 2; y <= y1; y += 3) pc.hline(x0, x1, y, P.woodDark)
    for (let y = y0; y <= y1; y += 3) pc.hline(x0, x1, y, P.woodLight)
  } else if (material === 'stone') {
    pc.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, P.stone)
    for (let y = y0; y <= y1; y += 3) {
      pc.hline(x0, x1, y, P.stoneDark)
      const off = ((y - y0) / 3) % 2 ? 2 : 5
      for (let x = x0 + off; x <= x1; x += 6) pc.vline(x, y, Math.min(y1, y + 2), P.stoneDark)
    }
    for (let i = 0; i < 6; i++) pc.px(x0 + 1 + Math.floor(rand() * (x1 - x0 - 1)), y0 + 1 + Math.floor(rand() * (y1 - y0 - 1)), P.stoneLight)
  } else {
    pc.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, P.plaster)
    pc.hline(x0, x1, y1, P.plasterShade)
    // Timber frame.
    pc.vline(x0, y0, y1, P.woodDark)
    pc.vline(x1, y0, y1, P.woodDark)
    pc.hline(x0, x1, y0, P.woodDark)
  }
  pc.vline(x1 - (material === 'plaster' ? 1 : 0), y0 + 1, y1, material === 'stone' ? P.stoneDark : material === 'wood' ? P.woodDark : P.plasterShade)
}

function door(pc, cx, y1, color, h = 10) {
  const x0 = cx - 3
  pc.rect(x0, y1 - h + 1, 6, h, color)
  pc.vline(x0, y1 - h + 1, y1, shade(color, -0.3))
  pc.vline(x0 + 5, y1 - h + 1, y1, shade(color, -0.3))
  pc.hline(x0, x0 + 5, y1 - h + 1, shade(color, -0.3))
  pc.clearPx(x0, y1 - h + 1)
  pc.clearPx(x0 + 5, y1 - h + 1)
  pc.vline(cx - 1, y1 - h + 3, y1, shade(color, -0.15))
  pc.px(x0 + 4, y1 - h / 2, P.metal)
}

function window(pc, x, y, lit, w = 6, h = 6) {
  pc.rect(x, y, w, h, P.woodDark)
  pc.rect(x + 1, y + 1, w - 2, h - 2, lit ? P.windowLit : P.window)
  if (lit) pc.rect(x + 2, y + 2, w - 4, h - 4, P.windowLitCore)
  else pc.px(x + 1, y + 1, P.windowShine)
  pc.vline(x + Math.floor(w / 2), y + 1, y + h - 2, P.woodDark)
  pc.hline(x + 1, x + w - 2, y + Math.floor(h / 2), P.woodDark)
}

/** A trapezoid roof seen from the front, with shingle courses and an eave. */
function gableRoof(pc, x0, x1, yTop, yBot, color, topHalf = 5) {
  const mid = (x0 + x1) / 2
  const full = (x1 - x0) / 2
  const dark = shade(color, -0.25)
  const light = shade(color, 0.15)
  for (let y = yTop; y <= yBot; y++) {
    const t = (y - yTop) / Math.max(1, yBot - yTop)
    const half = topHalf + (full - topHalf) * t
    const a = Math.round(mid - half)
    const b = Math.round(mid + half)
    pc.hline(a, b, y, (y - yTop) % 3 === 2 ? dark : color)
    pc.px(a, y, dark)
  }
  pc.hline(Math.round(mid - topHalf), Math.round(mid + topHalf), yTop, light)
  pc.hline(x0, x1, yBot, dark)
}

function chimney(pc, x, y0, y1) {
  pc.rect(x, y0, 4, y1 - y0 + 1, P.stone)
  pc.vline(x + 3, y0, y1, P.stoneDark)
  pc.hline(x - 1, x + 4, y0, P.stoneDark)
}

function scaffold(pc) {
  pc.vline(1, 16, 47, P.woodDark)
  pc.vline(30, 16, 47, P.woodDark)
  pc.hline(0, 31, 24, P.woodLight)
  pc.hline(0, 31, 36, P.woodLight)
}

// ---------- building sites ----------

function site(pc, rand, stage) {
  pc.ellipse(16, 43, 15.5, 4.5, P.dirt)
  for (let i = 0; i < 14; i++) pc.px(2 + Math.floor(rand() * 28), 40 + Math.floor(rand() * 7), P.dirtDark)
  if (stage === 0) {
    for (const x of [3, 28]) pc.vline(x, 34, 42, P.wood)
    pc.hline(3, 28, 35, P.white)
    for (let y = 40; y <= 44; y++) pc.hline(18, 27, y, y % 2 ? P.woodLight : P.wood)
    pc.rect(5, 41, 6, 3, P.stone)
    pc.px(6, 41, P.stoneLight)
    pc.px(9, 42, P.stoneDark)
    return
  }
  pc.rect(3, 43, 26, 4, P.stone)
  pc.hline(3, 28, 43, P.stoneLight)
  for (const x of [3, 15, 27]) pc.rect(x, 26, 2, 17, P.wood)
  pc.rect(3, 26, 26, 2, P.woodDark)
  pc.line(5, 42, 14, 28, P.woodLight)
  pc.line(17, 28, 26, 42, P.woodLight)
  for (const x of [21, 24]) pc.vline(x, 30, 46, P.woodDark)
  for (let y = 32; y <= 45; y += 3) pc.hline(21, 24, y, P.woodDark)
}

// ---------- kinds ----------

const KINDS = {
  house(pc, o) {
    if (o.roof) chimney(pc, 21, 6, 16)
    walls(pc, 3, 28, 30, 46, o.rand() < 0.5 ? 'plaster' : 'wood', o.rand)
    window(pc, 6, 33, o.lit)
    window(pc, 20, 33, o.lit)
    door(pc, 16, 46, o.accent)
    pc.hline(6, 11, 40, o.accent)
    pc.hline(20, 25, 40, o.accent)
    if (o.roof) {
      gableRoof(pc, 0, 31, 10, 30, o.roofColor)
      pc.hline(3, 28, 31, o.accent)
    }
  },
  cottage(pc, o) {
    if (o.roof) chimney(pc, 7, 8, 16)
    walls(pc, 4, 27, 31, 46, 'stone', o.rand)
    window(pc, 8, 35, o.lit, 5, 5)
    door(pc, 20, 46, o.accent, 9)
    if (o.roof) {
      for (let y = 12; y <= 32; y++) {
        const t = (y - 12) / 20
        const half = 6 + 10 * Math.sqrt(t)
        pc.hline(Math.round(16 - half), Math.round(15 + half), y, y % 2 ? P.thatch : shade(P.thatch, 0.08))
      }
      for (let i = 0; i < 22; i++) {
        const x = 3 + Math.floor(o.rand() * 26)
        const y = 16 + Math.floor(o.rand() * 15)
        if (pc.opaque(x, y)) pc.vline(x, y, y + 1, P.thatchDark)
      }
      pc.hline(0, 31, 32, P.thatchDark)
      pc.px(16, 11, o.accent)
    }
  },
  shop(pc, o) {
    walls(pc, 2, 29, 28, 46, 'wood', o.rand)
    pc.rect(4, 35, 11, 8, P.woodDark)
    pc.rect(5, 36, 9, 6, o.lit ? P.windowLit : P.window)
    for (let i = 0; i < 4; i++) pc.px(6 + i * 2, 40, P.cloth[Math.floor(o.rand() * P.cloth.length)])
    door(pc, 23, 46, P.door)
    if (o.roof) {
      pc.rect(1, 24, 30, 4, P.woodDark)
      pc.hline(1, 30, 24, P.woodLight)
      for (let x = 1; x <= 30; x++) {
        const c = Math.floor((x - 1) / 3) % 2 ? P.white : o.accent
        pc.vline(x, 28, 32, c)
        if (Math.floor((x - 1) / 3) % 2 === 0) pc.px(x, 33, c)
      }
      pc.rect(8, 15, 16, 8, P.plaster)
      pc.hline(8, 23, 15, o.accent)
      pc.hline(8, 23, 22, o.accent)
      pc.vline(8, 15, 22, o.accent)
      pc.vline(23, 15, 22, o.accent)
      pc.hline(11, 14, 18, P.woodDark)
      pc.hline(16, 20, 18, P.woodDark)
      pc.hline(12, 19, 20, P.woodDark)
    }
  },
  barn(pc, o) {
    const red = o.roofColor === P.roof[1] ? P.roof[0] : o.roofColor
    pc.rect(3, 26, 26, 21, red)
    pc.hline(3, 28, 26, P.white)
    pc.vline(3, 26, 46, P.white)
    pc.vline(28, 26, 46, P.white)
    pc.rect(10, 34, 12, 13, shade(red, -0.2))
    pc.line(10, 34, 21, 46, P.white)
    pc.line(21, 34, 10, 46, P.white)
    pc.hline(10, 21, 34, P.white)
    pc.vline(10, 34, 46, P.white)
    pc.vline(21, 34, 46, P.white)
    if (o.roof) {
      for (let y = 8; y <= 16; y++) {
        const half = 5 + (y - 8) * 1.1
        pc.hline(Math.round(16 - half), Math.round(15 + half), y, P.metalDark)
      }
      for (let y = 17; y <= 26; y++) {
        const half = 14 + (y - 17) * 0.2
        pc.hline(Math.round(16 - half), Math.round(15 + half), y, y % 3 ? P.metalDark : shade(P.metalDark, -0.2))
      }
      pc.rect(13, 18, 6, 5, P.woodDark)
      pc.rect(14, 19, 4, 3, o.accent)
    }
  },
  windmill(pc, o) {
    const H = 60
    for (let y = 24; y <= H - 2; y++) {
      const t = (y - 24) / (H - 26)
      const half = 5 + 3 * t
      pc.hline(Math.round(16 - half), Math.round(15 + half), y, P.plaster)
      pc.px(Math.round(15 + half), y, P.plasterShade)
    }
    pc.rect(7, H - 7, 18, 6, P.stone)
    pc.hline(7, 24, H - 7, P.stoneDark)
    door(pc, 16, H - 2, o.accent, 8)
    window(pc, 14, 34, o.lit, 4, 5)
    if (o.roof) {
      gableRoof(pc, 9, 22, 14, 24, o.roofColor, 1)
      const blade = (x0, y0, x1, y1) => {
        pc.line(x0, y0, x1, y1, P.woodDark)
        pc.line(x0 + 1, y0, x1 + 1, y1, P.woodLight)
      }
      const cx = 16
      const cy = 19
      if (o.frame % 2 === 0) {
        blade(cx, cy, cx, cy - 16)
        blade(cx, cy, cx, cy + 16)
        pc.rect(cx - 15, cy - 1, 15, 2, P.woodLight)
        pc.rect(cx + 1, cy - 1, 15, 2, P.woodLight)
        for (let i = 0; i < 14; i += 3) {
          pc.px(cx - 14 + i, cy - 2, P.woodDark)
          pc.px(cx + 2 + i, cy + 1, P.woodDark)
          pc.px(cx + 1, cy - 14 + i, P.woodDark)
          pc.px(cx - 1, cy + 2 + i, P.woodDark)
        }
      } else {
        blade(cx, cy, cx - 12, cy - 12)
        blade(cx, cy, cx + 12, cy + 12)
        blade(cx, cy, cx + 12, cy - 12)
        blade(cx, cy, cx - 12, cy + 12)
      }
      pc.rect(cx - 1, cy - 1, 3, 3, P.metalDark)
    }
  },
  workshop(pc, o) {
    if (o.roof) {
      pc.rect(4, 8, 3, 12, P.metalDark)
      pc.hline(3, 7, 8, P.metal)
    }
    walls(pc, 2, 29, 30, 46, 'wood', o.rand)
    pc.rect(14, 34, 12, 13, P.interior)
    pc.rect(17, 41, 6, 2, P.metalDark)
    pc.rect(19, 43, 2, 3, P.metalDark)
    pc.rect(4, 33, 8, 6, o.accent)
    pc.hline(4, 11, 33, shade(o.accent, -0.3))
    pc.vline(7, 34, 36, P.white)
    pc.hline(6, 9, 34, P.white)
    window(pc, 5, 40, o.lit, 5, 4)
    if (o.roof) {
      for (let x = 0; x <= 31; x++) {
        const top = Math.round(14 + x * 0.35)
        pc.vline(x, top, 30, (x % 4 === 0) ? shade(o.roofColor, -0.25) : o.roofColor)
        pc.px(x, top, shade(o.roofColor, 0.15))
      }
      pc.hline(0, 31, 30, shade(o.roofColor, -0.3))
    }
  },
  well(pc, o) {
    pc.rect(7, 38, 18, 8, P.stone)
    for (const x of [10, 16, 22]) pc.vline(x, 38, 45, P.stoneDark)
    pc.hline(7, 24, 41, P.stoneDark)
    pc.ellipse(16, 38, 9, 3.5, P.stoneLight)
    pc.ellipse(16, 38, 6.5, 2, P.water)
    if (o.roof) {
      pc.rect(8, 20, 2, 18, P.wood)
      pc.rect(22, 20, 2, 18, P.wood)
      pc.hline(8, 23, 22, P.woodDark)
      pc.vline(16, 22, 31, P.white)
      pc.rect(14, 31, 4, 3, P.wood)
      pc.hline(14, 17, 31, P.woodDark)
      gableRoof(pc, 4, 27, 12, 20, o.accent, 2)
    }
  },
  farm(pc, o) {
    pc.rect(1, 30, 30, 17, P.soil)
    for (let y = 32; y <= 45; y += 3) {
      pc.hline(1, 30, y, shade(P.soil, -0.2))
      if (!o.roof) continue
      for (let x = 2 + (y % 2); x <= 29; x += 3) {
        pc.px(x, y - 1, P.crop)
        pc.px(x, y - 2, P.cropDark)
        pc.px(x + 1, y - 1, P.cropDark)
      }
    }
    if (o.roof) {
      pc.vline(16, 16, 36, P.wood)
      pc.hline(10, 22, 22, P.wood)
      pc.rect(13, 20, 7, 8, o.accent)
      pc.ellipse(16.5, 16, 3, 3, P.plaster)
      pc.px(15, 16, P.eye)
      pc.px(17, 16, P.eye)
      pc.hline(12, 21, 13, P.thatchDark)
      pc.rect(14, 10, 5, 3, P.thatch)
    }
  },
}

/**
 * @param {{ kind: string, stage: number, accent: string, roofColor?: string, variant: number, lit: boolean, frame?: number }} o
 */
export function drawBuilding(o) {
  const H = heightOf(o.kind)
  const pc = new PixelCanvas(BUILDING_W, H)
  const rand = mulberry32(o.variant * 7919 + 1)
  const roofColor = o.roofColor || P.roof[o.variant % P.roof.length]
  if (o.stage <= 1) {
    const offset = H - 48
    const tmp = new PixelCanvas(BUILDING_W, 48)
    site(tmp, rand, o.stage)
    for (let y = 0; y < 48; y++) for (let x = 0; x < BUILDING_W; x++) {
      const i = (y * BUILDING_W + x) * 4
      const j = ((y + offset) * BUILDING_W + x) * 4
      for (let k = 0; k < 4; k++) pc.data[j + k] = tmp.data[i + k]
    }
    return pc.outline(P.outline)
  }
  const draw = KINDS[o.kind] || KINDS.house
  draw(pc, { rand, accent: o.accent, roofColor, lit: o.lit, roof: o.stage >= 3, frame: o.frame || 0 })
  if (o.stage === 2 && o.kind !== 'farm' && o.kind !== 'well') scaffold(pc)
  return pc.outline(P.outline)
}

/** Frames a finished building animates through (the windmill's sails). */
export const buildingFrames = (kind, stage) => (kind === 'windmill' && stage >= 3 ? 2 : 1)
