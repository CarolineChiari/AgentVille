// Buildings: 32 px wide (a 2×2-tile footprint), bottom row on the ground. Stages 0 and 1 are the
// same building site for every kind; stage 2 is the kind's walls with scaffolding; stage 3 is
// the finished building with its roof and the plot's accent colour on the trim.
//
// A house is put together from a spec (houseSpec): roof shape, wall material, where the door and
// windows go, shutters, window boxes, a door hood or porch, a dormer, one storey or two. The spec
// comes from the building's variant and its plot's style, so a repo's houses share a material and
// a family of roof colours but no two are quite alike.
import { PALETTE as P, shade } from './palette.js'
import { PixelCanvas } from './pixel.js'
import { mulberry32, pick, rngFor } from '../../sim/rng.js'
import { WALLS } from '../../sim/style.js'

export const BUILDING_W = 32
/** Roof colours a plot's buildings share, as indices into the palette's roof colours. */
export const ROOF_FAMILIES = [[0, 5, 3], [1, 6, 4], [2, 3, 5], [7, 1, 4]]

const TALL = { windmill: 60, tower: 60 }
/** How much of a house is upstairs: a second storey adds this many rows of wall. */
const UPSTAIRS = 9

/**
 * A house's own random stream, apart from the one that scatters texture, so the shape of a house
 * never shifts when its brickwork is drawn differently.
 */
const specRand = (variant) => mulberry32(variant * 2246822519 + 3266489917)
const storeysOf = (variant) => (specRand(variant)() < 0.3 ? 2 : 1)

/** Sprite height: the windmill and the tower are tall, and so is a house with an upstairs. */
export function heightOf(kind, variant = 0) {
  if (TALL[kind]) return TALL[kind]
  if (kind === 'house' && storeysOf(variant) === 2) return 48 + UPSTAIRS - 1
  return 48
}

/** Width of the shadow a finished building casts; a farm is flat and casts none. */
export function shadowOf(kind) {
  return kind === 'farm' ? 0 : kind === 'well' || kind === 'stall' ? 26 : 34
}

/** The roof colour of a building in its plot's family. */
const roofColorOf = (variant, roofs) => {
  const family = ROOF_FAMILIES[roofs % ROOF_FAMILIES.length]
  return P.roof[family[variant % family.length]]
}

/** Where the top edge of a trapezoid roof is, at column x. */
function roofY(roof, x) {
  const mid = (roof.x0 + roof.x1) / 2
  const full = (roof.x1 - roof.x0) / 2
  const t = Math.max(0, Math.min(1, (Math.abs(x - mid) - roof.topHalf) / (full - roof.topHalf)))
  return Math.round(roof.yTop + t * (roof.yBot - roof.yTop))
}

/**
 * Everything about a house that is not texture. `wall` and `roofs` are its plot's style; most
 * houses on a plot are built of its wall, the rest of anything.
 */
export function houseSpec(variant, wall = 0, roofs = 0) {
  const r = specRand(variant)
  const storeys = r() < 0.3 ? 2 : 1
  const H = storeys === 2 ? 48 + UPSTAIRS - 1 : 48
  const base = H - 2
  const wallTop = base - 16 - (storeys - 1) * (UPSTAIRS - 1)
  const shape = pick(r, ['gable', 'gable', 'hip', 'steep'])
  const roof = {
    shape,
    yTop: wallTop - (shape === 'hip' ? 14 : shape === 'steep' ? 24 : 20),
    yBot: wallTop,
    x0: shape === 'steep' ? 1 : 0,
    x1: shape === 'steep' ? 30 : 31,
    topHalf: shape === 'hip' ? 9 : shape === 'steep' ? 1 : 5,
  }
  const material = r() < 0.65 ? WALLS[wall % WALLS.length] : pick(r, WALLS)
  const roofColor = roofColorOf(Math.floor(r() * 3), roofs)
  const layout = pick(r, ['pair', 'pair', 'left', 'right'])
  const shutters = r() < 0.4
  const boxes = r() < 0.5
  const porch = r() < 0.35
  const dormer = shape !== 'hip' && r() < 0.35
  const woodDoor = r() < 0.35
  const side = r() < 0.5 ? 7 : 21
  const chimney = r() < 0.85 ? { x: side, top: Math.max(1, roofY(roof, side + 2) - 5) } : null
  const upstairs = pick(r, ['pair', 'trio'])
  return { storeys, H, base, wallTop, roof, material, roofColor, layout, upstairs, shutters, boxes, porch, dormer, woodDoor, chimney }
}

/**
 * Where smoke leaves a finished building: the top middle of its chimney, in sprite pixels, or
 * null if it has none.
 */
export function chimneyOf(kind, variant = 0, wall = 0, roofs = 0) {
  if (kind === 'house') {
    const c = houseSpec(variant, wall, roofs).chimney
    return c && { x: c.x + 2, y: c.top }
  }
  if (kind === 'cottage') return { x: 9, y: 8 }
  if (kind === 'workshop') return { x: 5, y: 8 }
  return null
}

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
  } else if (material === 'brick') {
    // Bricks 4 px long in courses 2 px high, joints staggered course to course.
    pc.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, P.brick)
    for (let y = y0; y <= y1; y++) {
      const row = (y - y0) % 3
      if (row === 2) {
        pc.hline(x0, x1, y, P.mortar)
        continue
      }
      const off = Math.floor((y - y0) / 3) % 2 ? 2 : 0
      for (let x = x0 + off; x <= x1; x += 4) pc.px(x, y, P.mortar)
    }
    for (let i = 0; i < 5; i++) {
      const x = x0 + 1 + Math.floor(rand() * (x1 - x0 - 3))
      const y = y0 + 3 * Math.floor(rand() * Math.floor((y1 - y0) / 3))
      pc.hline(x, x + 1, y, P.brickDark)
    }
  } else {
    pc.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, P.plaster)
    pc.hline(x0, x1, y1, P.plasterShade)
    // Timber frame.
    pc.vline(x0, y0, y1, P.woodDark)
    pc.vline(x1, y0, y1, P.woodDark)
    pc.hline(x0, x1, y0, P.woodDark)
    if (material === 'timber') {
      // Half-timbering: a rail through the middle, studs, and braces in every other bay.
      const mid = Math.round((y0 + y1) / 2)
      pc.hline(x0, x1, mid, P.woodDark)
      let bay = 0
      for (let x = x0 + 6; x < x1 - 2; x += 6) {
        pc.vline(x, y0, y1, P.woodDark)
        if (bay++ % 2 === 0) pc.line(x - 5, mid - 1, x - 1, y0 + 1, P.woodDark)
        else pc.line(x - 5, y0 + 1, x - 1, mid - 1, P.woodDark)
      }
    }
  }
  const edge = { stone: P.stoneDark, wood: P.woodDark, brick: P.brickDark }[material] || P.plasterShade
  pc.vline(x1 - (material === 'plaster' || material === 'timber' ? 1 : 0), y0 + 1, y1, edge)
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
  // A wide window gets a second mullion.
  if (w >= 10) pc.vline(x + Math.floor(w / 4), y + 1, y + h - 2, P.woodDark)
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

function scaffold(pc, H) {
  const o = H - 48
  pc.vline(1, 16 + o, 47 + o, P.woodDark)
  pc.vline(30, 16 + o, 47 + o, P.woodDark)
  pc.hline(0, 31, 24 + o, P.woodLight)
  pc.hline(0, 31, 36 + o, P.woodLight)
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

function house(pc, o) {
  const s = houseSpec(o.variant, o.wall, o.roofs)
  const { base, wallTop, roof } = s
  if (o.roof && s.chimney) chimney(pc, s.chimney.x, s.chimney.top, wallTop - 2)
  walls(pc, 3, 28, wallTop, base, s.material, o.rand)
  const trim = shade(o.accent, -0.2)
  const flowers = [P.flower[0], P.flower[1], P.flower[3], P.flower[4]]
  const win = (x, y, w, h) => {
    window(pc, x, y, o.lit, w, h)
    if (s.shutters) {
      pc.vline(x - 1, y, y + h - 1, trim)
      pc.vline(x + w, y, y + h - 1, trim)
    }
    if (s.boxes) {
      for (let i = x; i < x + w; i++) pc.px(i, y + h, i % 2 ? P.leaf : flowers[(i + o.variant) % flowers.length])
      pc.hline(x, x + w - 1, y + h + 1, trim)
    } else pc.hline(x, x + w - 1, y + h + 1, o.accent)
  }
  // The ground floor: a door and windows in one of three arrangements.
  const gy = base - 13
  let doorX = 16
  if (s.layout === 'pair') {
    win(6, gy, 6, 6)
    win(20, gy, 6, 6)
  } else if (s.layout === 'left') {
    doorX = 9
    win(15, gy, 11, 6)
  } else {
    doorX = 23
    win(6, gy, 5, 6)
    win(13, gy, 5, 6)
  }
  door(pc, doorX, base, s.woodDoor ? P.door : o.accent)
  if (s.storeys === 2) {
    pc.hline(3, 28, wallTop + UPSTAIRS - 1, s.material === 'plaster' || s.material === 'timber' ? P.woodDark : trim)
    const uy = wallTop + 2
    if (s.upstairs === 'pair') {
      win(7, uy, 5, 5)
      win(20, uy, 5, 5)
    } else for (const x of [5, 13, 21]) win(x, uy, 5, 5)
  }
  if (!o.roof) return
  if (s.porch) {
    // A hood over the door; posts too, where the windows leave room for them.
    pc.rect(doorX - 4, base - 11, 8, 2, s.roofColor)
    pc.hline(doorX - 4, doorX + 3, base - 11, shade(s.roofColor, 0.15))
    if (s.layout !== 'pair') {
      pc.vline(doorX - 4, base - 9, base, P.wood)
      pc.vline(doorX + 3, base - 9, base, P.wood)
    }
  }
  gableRoof(pc, roof.x0, roof.x1, roof.yTop, roof.yBot, s.roofColor, roof.topHalf)
  pc.hline(3, 28, wallTop + 1, o.accent)
  if (s.dormer) {
    const dy = Math.round(roof.yTop + (roof.yBot - roof.yTop) * 0.45)
    pc.rect(12, dy, 8, 6, P.plaster)
    pc.vline(19, dy, dy + 5, P.plasterShade)
    window(pc, 13, dy + 1, o.lit, 6, 4)
    for (let i = 0; i < 4; i++) pc.hline(11 + i, 20 - i, dy - 1 - i, i === 3 ? shade(s.roofColor, 0.15) : s.roofColor)
    pc.hline(11, 20, dy - 1, shade(s.roofColor, -0.25))
  }
}

const KINDS = {
  house,
  cottage(pc, o) {
    const r = rngFor(`cottage:${o.variant}`)
    const slate = r() < 0.4
    const round = r() < 0.5
    if (o.roof) chimney(pc, 7, 8, 16)
    walls(pc, 4, 27, 31, 46, 'stone', o.rand)
    if (round) {
      pc.ellipse(10.5, 37.5, 3, 3, P.woodDark)
      pc.ellipse(10.5, 37.5, 2, 2, o.lit ? P.windowLit : P.window)
      pc.px(10, 37, o.lit ? P.windowLitCore : P.windowShine)
      pc.hline(9, 11, 37, P.woodDark)
      pc.vline(10, 36, 38, P.woodDark)
    } else window(pc, 8, 35, o.lit, 5, 5)
    door(pc, 20, 46, o.accent, 9)
    if (!o.roof) return
    const roof = slate ? P.slate : P.thatch
    for (let y = 12; y <= 32; y++) {
      const t = (y - 12) / 20
      const half = 6 + 10 * Math.sqrt(t)
      const a = Math.round(16 - half)
      const b = Math.round(15 + half)
      if (slate) {
        // Slates in scalloped courses.
        pc.hline(a, b, y, (y - 12) % 3 === 2 ? shade(roof, -0.25) : roof)
        if ((y - 12) % 3 === 0) for (let x = a + ((y / 3) % 2 ? 1 : 3); x <= b; x += 4) pc.px(x, y, shade(roof, 0.15))
      } else pc.hline(a, b, y, y % 2 ? roof : shade(roof, 0.08))
    }
    if (!slate) {
      for (let i = 0; i < 22; i++) {
        const x = 3 + Math.floor(o.rand() * 26)
        const y = 16 + Math.floor(o.rand() * 15)
        if (pc.opaque(x, y)) pc.vline(x, y, y + 1, P.thatchDark)
      }
    }
    pc.hline(0, 31, 32, slate ? shade(roof, -0.3) : P.thatchDark)
    pc.px(16, 11, o.accent)
  },
  shop(pc, o) {
    const r = rngFor(`shop:${o.variant}`)
    const brick = o.wall === WALLS.indexOf('brick') || o.wall === WALLS.indexOf('stone')
    const awning = r() < 0.5 ? o.accent : o.roofColor
    const scallop = r() < 0.5
    const hanging = r() < 0.4
    walls(pc, 2, 29, 28, 46, brick ? 'brick' : r() < 0.5 ? 'wood' : 'plaster', o.rand)
    pc.rect(4, 35, 11, 8, P.woodDark)
    pc.rect(5, 36, 9, 6, o.lit ? P.windowLit : P.window)
    for (let i = 0; i < 4; i++) pc.px(6 + i * 2, 40, P.cloth[Math.floor(o.rand() * P.cloth.length)])
    door(pc, 23, 46, P.door)
    if (!o.roof) return
    pc.rect(1, 24, 30, 4, P.woodDark)
    pc.hline(1, 30, 24, P.woodLight)
    if (scallop) {
      // A plain awning with a scalloped white edge.
      pc.rect(1, 28, 30, 4, awning)
      pc.hline(1, 30, 28, shade(awning, 0.2))
      for (let x = 1; x <= 30; x++) pc.px(x, 32, x % 3 === 1 ? null : P.white)
    } else {
      for (let x = 1; x <= 30; x++) {
        const c = Math.floor((x - 1) / 3) % 2 ? P.white : awning
        pc.vline(x, 28, 32, c)
        if (Math.floor((x - 1) / 3) % 2 === 0) pc.px(x, 33, c)
      }
    }
    if (hanging) {
      // A round sign on a bracket between the window and the door, and a flat roof line above.
      pc.hline(1, 30, 23, shade(awning, -0.3))
      pc.hline(15, 19, 34, P.metalDark)
      pc.px(17, 35, P.metalDark)
      pc.ellipse(17.5, 38, 2.5, 2.5, P.plaster)
      pc.px(17, 38, o.accent)
      pc.px(18, 37, o.accent)
      return
    }
    pc.rect(8, 15, 16, 8, P.plaster)
    pc.hline(8, 23, 15, o.accent)
    pc.hline(8, 23, 22, o.accent)
    pc.vline(8, 15, 22, o.accent)
    pc.vline(23, 15, 22, o.accent)
    pc.hline(11, 14, 18, P.woodDark)
    pc.hline(16, 20, 18, P.woodDark)
    pc.hline(12, 19, 20, P.woodDark)
  },
  barn(pc, o) {
    // Barn red, weathered wood or green-grey, with white trim.
    const body = [P.roof[0], P.wood, P.barnGreen][o.variant % 3]
    pc.rect(3, 26, 26, 21, body)
    for (let x = 5; x < 28; x += 3) pc.vline(x, 27, 46, shade(body, -0.08))
    pc.hline(3, 28, 26, P.white)
    pc.vline(3, 26, 46, P.white)
    pc.vline(28, 26, 46, P.white)
    pc.rect(10, 34, 12, 13, shade(body, -0.2))
    pc.line(10, 34, 21, 46, P.white)
    pc.line(21, 34, 10, 46, P.white)
    pc.hline(10, 21, 34, P.white)
    pc.vline(10, 34, 46, P.white)
    pc.vline(21, 34, 46, P.white)
    if (!o.roof) return
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
    if (!o.roof) return
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
  },
  workshop(pc, o) {
    if (o.roof) {
      pc.rect(4, 8, 3, 12, P.metalDark)
      pc.hline(3, 7, 8, P.metal)
    }
    const brick = o.wall === WALLS.indexOf('brick') || o.wall === WALLS.indexOf('stone')
    walls(pc, 2, 29, 30, 46, brick ? 'brick' : 'wood', o.rand)
    pc.rect(14, 34, 12, 13, P.interior)
    pc.rect(17, 41, 6, 2, P.metalDark)
    pc.rect(19, 43, 2, 3, P.metalDark)
    pc.rect(4, 33, 8, 6, o.accent)
    pc.hline(4, 11, 33, shade(o.accent, -0.3))
    pc.vline(7, 34, 36, P.white)
    pc.hline(6, 9, 34, P.white)
    window(pc, 5, 40, o.lit, 5, 4)
    if (!o.roof) return
    for (let x = 0; x <= 31; x++) {
      const top = Math.round(14 + x * 0.35)
      pc.vline(x, top, 30, (x % 4 === 0) ? shade(o.roofColor, -0.25) : o.roofColor)
      pc.px(x, top, shade(o.roofColor, 0.15))
    }
    pc.hline(0, 31, 30, shade(o.roofColor, -0.3))
  },
  well(pc, o) {
    pc.rect(7, 38, 18, 8, P.stone)
    for (const x of [10, 16, 22]) pc.vline(x, 38, 45, P.stoneDark)
    pc.hline(7, 24, 41, P.stoneDark)
    pc.ellipse(16, 38, 9, 3.5, P.stoneLight)
    pc.ellipse(16, 38, 6.5, 2, P.water)
    if (!o.roof) return
    pc.rect(8, 20, 2, 18, P.wood)
    pc.rect(22, 20, 2, 18, P.wood)
    pc.hline(8, 23, 22, P.woodDark)
    pc.vline(16, 22, 31, P.white)
    pc.rect(14, 31, 4, 3, P.wood)
    pc.hline(14, 17, 31, P.woodDark)
    gableRoof(pc, 4, 27, 12, 20, o.accent, 2)
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
    if (!o.roof) return
    pc.vline(16, 16, 36, P.wood)
    pc.hline(10, 22, 22, P.wood)
    pc.rect(13, 20, 7, 8, o.accent)
    pc.ellipse(16.5, 16, 3, 3, P.plaster)
    pc.px(15, 16, P.eye)
    pc.px(17, 16, P.eye)
    pc.hline(12, 21, 13, P.thatchDark)
    pc.rect(14, 10, 5, 3, P.thatch)
  },
  tower(pc, o) {
    // A round stone tower with a conical roof and a pennant in the plot's colour.
    const H = 60
    pc.rect(8, 20, 16, H - 21, P.stone)
    for (let y = 22; y < H - 1; y += 3) {
      pc.hline(8, 23, y, P.stoneDark)
      for (let x = 8 + ((y / 3) % 2 ? 2 : 5); x < 23; x += 6) pc.vline(x, y, y + 2, P.stoneDark)
    }
    pc.vline(8, 20, H - 2, P.stoneLight)
    pc.vline(22, 20, H - 2, P.stoneDark)
    pc.vline(23, 20, H - 2, shade(P.stoneDark, -0.15))
    pc.rect(6, H - 6, 20, 5, P.stone)
    pc.hline(6, 25, H - 6, P.stoneLight)
    pc.vline(25, H - 6, H - 2, P.stoneDark)
    door(pc, 16, H - 2, o.accent, 9)
    for (const y of [27, 39]) {
      pc.rect(14, y, 4, 6, P.woodDark)
      pc.rect(15, y + 1, 2, 4, o.lit ? P.windowLit : P.window)
      // Round the top of the slit into an arch.
      pc.clearPx(14, y)
      pc.clearPx(17, y)
    }
    if (!o.roof) return
    for (let y = 5; y <= 21; y++) {
      const half = 1 + (y - 5) * 0.72
      const a = Math.round(15.5 - half)
      const b = Math.round(15.5 + half)
      pc.hline(a, b, y, (y - 5) % 3 === 2 ? shade(o.roofColor, -0.25) : o.roofColor)
      pc.px(a, y, shade(o.roofColor, -0.25))
      pc.px(b, y, shade(o.roofColor, -0.35))
    }
    pc.hline(3, 28, 21, shade(o.roofColor, -0.35))
    pc.vline(15, 0, 4, P.metalDark)
    pc.hline(16, 19, 0, o.accent)
    pc.hline(16, 18, 1, o.accent)
    pc.px(16, 2, o.accent)
  },
  greenhouse(pc, o) {
    // Glass on a low brick base, with plants inside and a glass roof.
    pc.rect(2, 42, 28, 5, P.brick)
    pc.hline(2, 29, 42, P.mortar)
    for (let x = 4; x < 30; x += 4) pc.px(x, 44, P.mortar)
    pc.rect(3, 28, 26, 14, P.glass)
    for (let x = 3; x <= 28; x++) if ((x - 3) % 5 === 4) pc.line(x - 3, 40, x, 30, P.glassLight)
    for (let i = 0; i < 6; i++) {
      const x = 5 + i * 4
      pc.ellipse(x, 39, 2.2, 2.6, i % 2 ? P.leaf : P.leafDark)
      if (i % 2 === 0) pc.px(x, 37, P.flower[(i + o.variant) % P.flower.length])
    }
    if (o.lit) for (const x of [9, 19]) pc.rect(x, 31, 3, 3, P.windowLit)
    for (const x of [3, 9, 15, 16, 22, 28]) pc.vline(x, 28, 41, P.white)
    pc.hline(3, 28, 28, P.white)
    pc.hline(3, 28, 35, P.white)
    if (!o.roof) return
    for (let y = 16; y <= 27; y++) {
      const half = 2 + (y - 16) * 1.25
      pc.hline(Math.round(15.5 - half), Math.round(15.5 + half), y, P.glass)
    }
    for (const x of [4, 10, 21, 27]) pc.line(15, 16, x, 27, P.white)
    pc.line(16, 16, 29, 27, P.white)
    pc.line(15, 16, 2, 27, P.white)
    pc.hline(2, 29, 27, P.white)
    pc.hline(13, 18, 16, P.white)
    pc.px(12, 20, P.glassLight)
    pc.px(11, 21, P.glassLight)
  },
  stall(pc, o) {
    // A market stall: a counter piled with goods under a striped canopy.
    pc.vline(4, 22, 46, P.woodDark)
    pc.vline(27, 22, 46, P.woodDark)
    pc.rect(3, 38, 26, 9, P.wood)
    pc.hline(3, 28, 38, P.woodLight)
    for (let x = 7; x < 28; x += 5) pc.vline(x, 39, 46, P.woodDark)
    const goods = [P.fruit, P.pollen, P.berry, P.crop, P.flower[4]]
    for (let i = 0; i < 5; i++) {
      const x = 5 + i * 5
      const c = goods[(i + o.variant) % goods.length]
      pc.hline(x, x + 2, 37, c)
      pc.px(x + 1, 36, shade(c, 0.2))
    }
    if (!o.roof) return
    pc.hline(2, 29, 17, shade(o.accent, -0.25))
    for (let y = 18; y <= 24; y++) {
      for (let x = 2; x <= 29; x++) pc.px(x, y, Math.floor((x - 2) / 4) % 2 ? P.white : o.accent)
    }
    for (let x = 2; x <= 29; x++) if ((x - 2) % 4 !== 3) pc.px(x, 25, Math.floor((x - 2) / 4) % 2 ? P.white : o.accent)
    pc.hline(2, 29, 18, shade(o.accent, 0.2))
  },
}

/**
 * @param {{ kind: string, stage: number, accent: string, variant: number, lit: boolean, frame?: number, wall?: number, roofs?: number }} o
 *        `wall` and `roofs` are the plot's style.
 */
export function drawBuilding(o) {
  const H = heightOf(o.kind, o.variant)
  const pc = new PixelCanvas(BUILDING_W, H)
  const rand = mulberry32(o.variant * 7919 + 1)
  const wall = o.wall || 0
  const roofs = o.roofs || 0
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
  draw(pc, { rand, accent: o.accent, roofColor: roofColorOf(o.variant, roofs), lit: o.lit, roof: o.stage >= 3, frame: o.frame || 0, variant: o.variant, wall, roofs })
  if (o.stage === 2 && !NO_SCAFFOLD.has(o.kind)) scaffold(pc, H)
  return pc.outline(P.outline)
}

/** Nothing to climb: these go up without scaffolding. */
const NO_SCAFFOLD = new Set(['farm', 'well', 'stall'])

/** Frames a finished building animates through (the windmill's sails). */
export const buildingFrames = (kind, stage) => (kind === 'windmill' && stage >= 3 ? 2 : 1)
