// Site buildings: what each thread builds on a construction site, drawn the way the village's
// buildings are (src/render/sprites/buildings.js): the plot's paint on its machines, cabins and
// containers, its accent on the trim, signs and flags, and a finished one aged by its wear.
//
// Contract (see ThemePack in ../index.js and the village's src/render/sprites/buildings.js):
// - A thread's building kind (KINDS in src/sim/building.js) maps to a site kind through `fitted`.
// - Every sprite is BUILDING_W (32) wide and heightOf() tall, its bottom row on the ground.
// - Down a courtyard's sides (`fitted(kind, variant, false)`) a building is 48 tall and draws
//   nothing above row DOORSTEP_CLEAR (9), outline included, at every stage: the villager at the
//   door of the house above stands there.
// - Stages 0 and 1 are the site being set out; 2 is the kind without its roof (`roof: false`)
//   with scaffolding unless it has nothing to climb; 3 is finished. Stage 3 is weathered by
//   `wear` exactly as the village's buildings are (see drawBuilding there).
// - `wall` indexes THEMES.construction.dims.wall; `roofs` its paint families; `accent` is the
//   plot's colour, for trim, signs and flags. Every colour from the palette.
//
// "Roof" here is whatever goes on last: a frame's trusses, a crane's jib, a cabin's roof and
// stovepipe, the tarp over a stack of timber. Weathering treats it as roof (see weathering.js), so
// it is kept to the tops of things; bodies are drawn the same with and without it.
import { PALETTE as P, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { BUILDING_W, DOORSTEP_CLEAR } from '../../sprites/buildings.js'
import { lookFor, weather } from '../../sprites/weathering.js'
import { mulberry32, pick, rngFor } from '../../../sim/rng.js'
import { THEMES } from '../../../sim/themes.js'
import { KEPT } from '../../../sim/wear.js'

/** A thread's building, by its kind, on a construction site. */
export const SITE_KINDS = {
  house: 'frame', cottage: 'cabin', shop: 'containers', barn: 'shed', windmill: 'crane', workshop: 'mixer',
  well: 'loos', farm: 'digger', tower: 'core', greenhouse: 'glazing', stall: 'pallets',
}
const TALL = { crane: 60, core: 60 }
/** What a crane or a concrete core is built as down the sides, where there is no room for its height. */
const STAND_INS = ['cabin', 'containers', 'shed', 'glazing']
const MATERIALS = THEMES.construction.dims.wall
/**
 * The paint a plot's machines share, by its `roofs`: three related colours each, as indices into
 * the palette's sitePaint (yellow, orange, red, blue families).
 */
const PAINT_FAMILIES = [[0, 1, 2], [2, 3, 0], [4, 5, 2], [6, 7, 8]]
/**
 * Floor to floor: 10 rows on a house, whose storeys need a door and windows with lintels; 9 on
 * concrete, steel and glass, mostly open bays, so three of their storeys stand where a house has
 * two and a roof.
 */
const STOREY = 10
const OFFICE_STOREY = 9
/** Rows between a scaffold's boarded lifts: a lift per storey, near enough. */
const LIFT = 8
/**
 * The inside of a building with no walls yet, seen through its bays: a cool dark, as the
 * village's warm interior read as timber through concrete and steel.
 */
const VOID = shade(P.steelDark, -0.45)

export function fitted(kind, variant, roomy) {
  const own = SITE_KINDS[kind] || 'frame'
  if (roomy) return { kind: own, low: false }
  if (TALL[own]) return { kind: STAND_INS[variant % STAND_INS.length], low: true }
  return { kind: own, low: true }
}

export function heightOf(kind) {
  return TALL[kind] || 48
}

/** A pit, a pair of loos and a yard of pallets are low and cast a narrow shadow. */
export function shadowOf(kind) {
  return kind === 'digger' || kind === 'loos' || kind === 'pallets' ? 26 : 34
}

/** The crane's load swings on its hook. */
export const buildingFrames = (kind, stage) => (kind === 'crane' && stage >= 3 ? 2 : 1)

/**
 * Where smoke leaves a finished building: the cabin's stovepipe, and the vent on top of the
 * mixer's cement silo (dust, when it's busy). Everything else has none.
 */
export function chimneyOf(kind, variant = 0, wall = 0, roofs = 0, low = false) {
  if (kind === 'cabin') {
    const s = cabinSpec(variant, low)
    return { x: s.pipeX + 1, y: s.pipeTop }
  }
  if (kind === 'mixer') return { x: 6, y: siloTop(low) - 6 }
  return null
}

// ---------- shared parts ----------

/** Each kind's shape comes from its own stream, apart from the one that scatters texture. */
const specRand = (kind, variant) => rngFor(`site:${kind}:${variant}`)
const box = (pc, x0, y0, x1, y1, c) => pc.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, c)
/** One of the plot's paint family, turning through it by `i`. */
const paintOf = (roofs, i) => {
  const f = PAINT_FAMILIES[(roofs || 0) % PAINT_FAMILIES.length]
  return P.sitePaint[f[Math.abs(Math.floor(i)) % f.length]]
}

/** A framed window; `bars` across it on anything left alone at night. */
function pane(pc, x, y, w, h, lit, frame = P.steelDark, bars = false) {
  box(pc, x, y, x + w - 1, y + h - 1, frame)
  box(pc, x + 1, y + 1, x + w - 2, y + h - 2, lit ? P.windowLit : P.window)
  if (lit && w > 4 && h > 4) box(pc, x + 2, y + 2, x + w - 3, y + h - 3, P.windowLitCore)
  else if (!lit) pc.px(x + 1, y + 1, P.windowShine)
  if (bars) for (let i = x + 2; i < x + w - 1; i += 2) pc.vline(i, y + 1, y + h - 2, P.metalDark)
}

/** A work lamp hung in an open bay, lit. */
function bulb(pc, x, y) {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) pc.px(x + dx, y + dy, P.windowLit)
  pc.px(x, y, P.windowLitCore)
}

function ladder(pc, x, y0, y1) {
  pc.vline(x, y0, y1, P.woodLight)
  pc.vline(x + 2, y0, y1, P.wood)
  for (let y = y0 + 1; y <= y1; y += 2) pc.px(x + 1, y, P.woodLight)
}

/** A floodlight on a tripod, standing on `base`. */
function worklight(pc, x, base, lit) {
  pc.line(x, base - 5, x - 2, base, P.metalDark)
  pc.line(x, base - 5, x + 2, base, P.metalDark)
  pc.vline(x, base - 8, base - 1, P.metalDark)
  box(pc, x - 2, base - 11, x + 1, base - 8, P.sitePaint[0])
  box(pc, x - 1, base - 10, x + 1, base - 9, lit ? P.windowLitCore : P.windowShine)
}

/** A builder's bucket and a bag of cement beside it. */
function bucket(pc, x, base) {
  box(pc, x, base - 3, x + 3, base, P.rubber)
  pc.hline(x, x + 3, base - 3, shade(P.rubber, 0.25))
  box(pc, x + 5, base - 2, x + 9, base, P.paper)
  pc.hline(x + 5, x + 9, base - 2, P.white)
  pc.hline(x + 6, x + 8, base - 1, P.hiVis[1])
}

/** A traffic cone: orange with a white band. */
function cone(pc, x, base) {
  pc.vline(x, base - 4, base - 3, P.hiVis[1])
  pc.hline(x - 1, x + 1, base - 2, P.white)
  pc.hline(x - 1, x + 1, base - 1, P.hiVis[1])
  pc.hline(x - 2, x + 2, base, shade(P.hiVis[1], -0.3))
}

/** OSB sheathing: its strands, and a seam where two boards meet every eight pixels. */
function osb(pc, x0, y0, x1, y1, rand) {
  box(pc, x0, y0, x1, y1, P.osb)
  const n = Math.round(((x1 - x0 + 1) * (y1 - y0 + 1)) / 5)
  for (let i = 0; i < n; i++) pc.px(x0 + Math.floor(rand() * (x1 - x0 + 1)), y0 + Math.floor(rand() * (y1 - y0 + 1)), P.osbFleck)
  for (let x = x0 + 8; x < x1; x += 8) pc.vline(x, y0, y1, P.osbFleck)
}

/** House-wrap over the sheathing, the maker's name printed along it in dashes. */
function wrap(pc, x0, y0, x1, y1) {
  box(pc, x0, y0, x1, y1, P.houseWrap)
  for (let y = y0 + 1; y <= y1; y += 3) for (let x = x0; x <= x1; x++) if ((x + y * 2) % 7 < 3) pc.px(x, y, P.wrapPrint)
  pc.vline(x1, y0, y1, shade(P.houseWrap, -0.12))
}

/** Bricks four long in courses three high, joints staggered, a few darker bricks. */
function brickwork(pc, x0, y0, x1, y1, rand) {
  box(pc, x0, y0, x1, y1, P.brick)
  for (let y = y0; y <= y1; y++) {
    if ((y - y0) % 3 === 2) {
      pc.hline(x0, x1, y, P.mortar)
      continue
    }
    const off = Math.floor((y - y0) / 3) % 2 ? 2 : 0
    for (let x = x0 + off; x <= x1; x += 4) pc.px(x, y, P.mortar)
  }
  for (let i = 0; i < 6; i++) {
    const x = x0 + 1 + Math.floor(rand() * (x1 - x0 - 3))
    const y = y0 + 3 * Math.floor(rand() * Math.floor((y1 - y0) / 3))
    pc.hline(x, x + 1, y, P.brickDark)
  }
  pc.vline(x1, y0, y1, P.brickDark)
}

/** Corrugated sheet: ribs every other column, the light along its top. */
function corrugated(pc, x0, y0, x1, y1, c) {
  box(pc, x0, y0, x1, y1, c)
  for (let x = x0 + 1; x <= x1; x += 2) pc.vline(x, y0, y1, shade(c, -0.14))
}

/**
 * Steel tube scaffolding from the ground to `top`: standards at each end (and one between on a
 * wide run), a boarded lift every LIFT rows with a guard rail above it, a brace in the first bay.
 */
function scaffold(pc, x0, x1, top, base) {
  const posts = x1 - x0 > 18 ? [x0, Math.round((x0 + x1) / 2), x1] : [x0, x1]
  for (const x of posts) {
    pc.vline(x, top, base, P.metal)
    pc.hline(x - 1, x + 1, base, P.metalDark)
  }
  pc.line(x0 + 1, base - 1, posts[1] - 1, base - LIFT + 2, P.metalDark)
  for (let y = base - LIFT; y >= top + 3; y -= LIFT) {
    pc.hline(x0 - 1, x1 + 1, y, P.woodLight)
    pc.hline(x0 - 1, x1 + 1, y + 1, P.wood)
    pc.hline(x0, x1, y - 4, P.metal)
  }
}

// ---------- the site being set out ----------

function site(pc, rand, stage, oy, variant) {
  const Y = (y) => y + oy
  pc.ellipse(16, Y(43), 15.5, 4.5, P.dirt)
  for (let i = 0; i < 14; i++) pc.px(2 + Math.floor(rand() * 28), Y(40 + Math.floor(rand() * 7)), P.dirtDark)
  const left = variant % 2 === 0
  if (stage === 0) {
    // Gravel for the sub-base, and survey pegs strung with tape round where it will stand.
    const hx = left ? 11 : 20
    for (let i = 0; i < 5; i++) pc.hline(hx - 1 - i, hx + 1 + i, Y(36 + i), i === 0 ? P.stoneLight : P.stone)
    for (let i = 0; i < 12; i++) {
      const row = 1 + Math.floor(rand() * 4)
      pc.px(hx + Math.round((rand() * 2 - 1) * row), Y(36 + row), rand() < 0.5 ? P.stoneDark : P.pebble)
    }
    const tape = P.hiVis[1]
    pc.hline(6, 25, Y(37), tape)
    pc.line(6, Y(37), 2, Y(42), tape)
    pc.line(25, Y(37), 29, Y(42), tape)
    pc.hline(2, 29, Y(42), tape)
    for (const [x, y] of [[6, 36], [25, 36], [2, 41], [29, 41]]) {
      pc.vline(x, Y(y), Y(y + 4), P.woodLight)
      pc.px(x, Y(y), tape)
    }
    cone(pc, left ? 22 : 9, Y(45))
    return
  }
  // The slab, poured in its formwork, with starter bars left standing for the walls to come.
  box(pc, 3, Y(38), 28, Y(42), P.concrete)
  pc.hline(3, 28, Y(38), P.concreteLight)
  for (let i = 0; i < 8; i++) pc.px(4 + Math.floor(rand() * 24), Y(39 + Math.floor(rand() * 3)), P.concreteLight)
  box(pc, 2, Y(43), 29, Y(45), P.wood)
  pc.hline(2, 29, Y(43), P.woodLight)
  for (let x = 4; x < 29; x += 6) pc.vline(x, Y(43), Y(46), P.woodDark)
  for (let x = 4; x <= 27; x += 3) {
    pc.vline(x, Y(33), Y(38), P.rebar)
    pc.px(x + 1, Y(33), P.rebar)
  }
  // Blocks for the first course, on a pallet at one end.
  const bx = left ? 20 : 5
  box(pc, bx, Y(40), bx + 6, Y(41), P.woodLight)
  for (let y = 36; y <= 39; y++) pc.hline(bx, bx + 6, Y(y), y % 2 ? P.concrete : P.concreteLight)
  pc.vline(bx + 3, Y(36), Y(39), P.concreteDark)
}

// ---------- frame: a building going up, in the plot's material ----------

function frameSpec(variant, wall = 0, low = false) {
  const r = specRand('frame', variant)
  const material = r() < 0.65 ? MATERIALS[wall % MATERIALS.length] : pick(r, MATERIALS)
  const house = material === 'timber' || material === 'brick'
  const three = r() < (house ? 0.3 : 0.65)
  const floors = three && !low ? 3 : 2
  const F = house ? STOREY : OFFICE_STOREY
  const base = 46
  const wallTop = base - F * floors + 1
  const detail = pick(r, ['ladder', 'ladder', 'tarp', 'bucket', 'hoist', 'light'])
  const flip = r() < 0.5
  const progress = 0.3 + r() * 0.5
  const wrapped = r() < 0.55
  const doorLeft = r() < 0.5
  const tone = Math.floor(r() * 3)
  return { material, house, floors, F, base, wallTop, detail, flip, progress, wrapped, doorLeft, tone }
}

/** Where a frame's openings go: a door and a window on the ground floor, two windows upstairs. */
function openings(s) {
  const out = []
  for (let k = 0; k < s.floors; k++) {
    const fb = s.base - k * s.F
    const ft = fb - s.F + 1
    if (k === 0) {
      out.push({ k, door: true, x: s.doorLeft ? 5 : 21, y: fb - 7, w: 6, h: 7 })
      out.push({ k, x: s.doorLeft ? 18 : 7, y: ft + 3, w: 7, h: 5 })
    } else for (const x of [6, 20]) out.push({ k, x, y: ft + 3, w: 6, h: 5 })
  }
  return out
}

/** The span of a storey that is clad, sheathed or glazed: all of it, but only `share` of the top storey. */
function coverOf(s, k, share = s.progress) {
  if (k < s.floors - 1) return [3, 28]
  const n = Math.round(26 * share)
  return s.flip ? [28 - n, 28] : [3, 3 + n]
}

const FRAMES = {
  timber: {
    body(pc, o, s) {
      const { base, wallTop, F, floors } = s
      box(pc, 3, wallTop, 28, base - 1, P.interior)
      for (let k = 0; k < floors; k++) {
        const fb = base - k * F - 1
        const ft = base - (k + 1) * F + 1
        for (let x = 3; x <= 27; x += 3) pc.vline(x, ft, fb, P.woodLight)
        pc.vline(28, ft, fb, P.wood)
        // Sheathed below, the top storey's studs still mostly bare, house-wrap over the ground floor.
        const [a, b] = coverOf(s, k, s.progress - 0.25)
        if (k === 0 && s.wrapped) wrap(pc, 3, ft + 2, 28, fb)
        else osb(pc, a, ft + 2, b, fb, o.rand)
        pc.hline(3, 28, ft, P.woodLight)
        pc.hline(3, 28, ft + 1, P.woodDark)
      }
      pc.hline(3, 28, base - 1, P.wood)
      for (const w of openings(s)) {
        if (w.door) {
          // The front door goes in early, in the plot's colour, to lock the site up at night.
          box(pc, w.x - 1, w.y - 1, w.x + w.w, w.y + w.h - 1, P.wood)
          box(pc, w.x, w.y, w.x + w.w - 1, w.y + w.h - 1, o.accent)
          pc.vline(w.x + w.w - 1, w.y, w.y + w.h - 1, shade(o.accent, -0.3))
          pc.px(w.x + w.w - 2, w.y + 3, P.metal)
          continue
        }
        // Windows are in on the wrapped ground floor; elsewhere the openings are still framed out.
        if (w.k === 0 && s.wrapped) pane(pc, w.x, w.y, w.w, w.h, o.lit, P.white)
        else {
          box(pc, w.x - 1, w.y - 1, w.x + w.w, w.y + w.h, P.wood)
          box(pc, w.x, w.y, w.x + w.w - 1, w.y + w.h - 1, P.interior)
          if (o.lit && w.k === 1) bulb(pc, w.x + 2, w.y + 2)
        }
      }
      pc.hline(2, 29, base, P.concrete)
    },
    top(pc, o, s) {
      // Rafters up to the ridge beam, one slope of them sheathed.
      roofFrame(pc, s.wallTop, (x, y, edge) => {
        if (edge) return y === s.wallTop - ROOF_RISE ? P.wood : P.woodDark
        if (x === 15 || x === 16) return P.woodLight
        if ((x < 16) !== s.flip) return o.rand() < 0.22 ? P.osbFleck : P.osb
        return x % 3 === 1 ? P.woodLight : P.interior
      })
    },
  },
  brick: {
    body(pc, o, s) {
      const { base, wallTop } = s
      brickwork(pc, 3, wallTop, 28, base - 1, o.rand)
      for (const w of openings(s)) {
        box(pc, w.x - 1, w.y - 2, w.x + w.w, w.y - 2, P.concreteLight)
        pc.hline(w.x - 1, w.x + w.w, w.y - 1, P.concreteDark)
        if (w.door) {
          box(pc, w.x, w.y, w.x + w.w - 1, w.y + w.h - 1, o.accent)
          pc.vline(w.x, w.y, w.y + w.h - 1, shade(o.accent, -0.3))
          pc.vline(w.x + w.w - 1, w.y, w.y + w.h - 1, shade(o.accent, -0.3))
          pc.px(w.x + w.w - 2, w.y + 3, P.metal)
        } else if (w.k === 0) {
          pane(pc, w.x, w.y, w.w, w.h, o.lit, P.white)
          pc.hline(w.x - 1, w.x + w.w, w.y + w.h, P.concreteLight)
        } else {
          box(pc, w.x, w.y, w.x + w.w - 1, w.y + w.h - 1, P.interior)
          if (o.lit) bulb(pc, w.x + 2, w.y + 2)
        }
      }
      pc.hline(2, 29, base, P.concrete)
      if (o.roof) return
      // The top courses racked back from the corners, as a bricklayer leaves them overnight.
      for (let x = 3; x <= 28; x++) {
        const fromEnd = Math.min(x - 3, 28 - x)
        const brick = Math.floor((x - 3) / 4)
        const missing = fromEnd < 4 ? 0 : fromEnd < 8 ? 1 : 2 - ((brick * 7 + s.tone) % 3 === 0 ? 1 : 0)
        for (let y = wallTop; y < wallTop + missing * 3; y++) pc.clearPx(x, y)
      }
    },
    top(pc, o, s) {
      // Felt and battens, tiled from the eaves up, with a stack of tiles waiting on the battens.
      const tile = P.roof[5]
      const yTop = s.wallTop - ROOF_RISE
      const tiled = s.wallTop - 1 - Math.round(2 + s.progress * 4)
      roofFrame(pc, s.wallTop, (x, y, edge) => {
        if (edge) return P.woodDark
        if (y >= tiled) return (y - tiled) % 2 === 1 ? shade(tile, -0.25) : (x + (y % 4 < 2 ? 0 : 2)) % 4 === 0 ? shade(tile, -0.12) : tile
        return (y - yTop) % 2 === 0 ? P.woodLight : P.slate
      })
      const sx = s.flip ? 8 : 20
      box(pc, sx, tiled - 3, sx + 3, tiled - 1, tile)
      pc.hline(sx, sx + 3, tiled - 2, shade(tile, -0.25))
      // A chimney stack going up with the roof, left ragged.
      const cx = s.flip ? 22 : 6
      brickwork(pc, cx, yTop + 1, cx + 4, s.wallTop - 3, mulberry32(o.variant))
      pc.clearPx(cx + 4, yTop + 1)
      pc.clearPx(cx + 3, yTop + 1)
    },
  },
  concrete: {
    body(pc, o, s) {
      const { base, wallTop, F, floors } = s
      box(pc, 3, wallTop + 2, 28, base - 1, VOID)
      const cols = [3, 11, 19, 27]
      for (let k = 0; k < floors; k++) {
        const fb = base - k * F - 1
        const ft = base - (k + 1) * F + 1
        if (k === 0) {
          // Blockwork between the ground-floor columns, a doorway left in it.
          for (let y = ft + 2; y <= fb; y++) for (let x = 5; x <= 26; x++) {
            const joint = (y - ft) % 2 === 0 || (x + ((y - ft) % 4 < 2 ? 0 : 2)) % 4 === 0
            pc.px(x, y, joint ? P.concrete : P.concreteLight)
          }
          const dx = s.doorLeft ? 6 : 21
          box(pc, dx, fb - 6, dx + 4, fb, VOID)
          box(pc, dx - 1, fb - 7, dx + 5, fb - 7, P.concreteDark)
          pane(pc, s.doorLeft ? 15 : 8, ft + 3, 7, 4, o.lit)
        } else {
          // Props holding up the slab above until it cures, the builder's banner hung on the first
          // floor, and a lamp for whoever's working late.
          for (const c of cols.slice(0, 3)) pc.vline(c + 5, ft + 2, fb, P.metal)
          if (k === 1) sign(pc, s.flip ? 5 : 18, ft + 3, o.accent)
          if (o.lit && k === 1) bulb(pc, s.flip ? 22 : 9, ft + 4)
        }
      }
      for (const c of cols) {
        pc.vline(c, wallTop, base - 1, P.concrete)
        pc.vline(c + 1, wallTop, base - 1, P.concreteDark)
      }
      for (let k = 0; k < floors; k++) {
        const ft = base - (k + 1) * F + 1
        pc.hline(2, 29, ft, P.concreteLight)
        pc.hline(2, 29, ft + 1, P.concrete)
        pc.hline(3, 28, ft + 2, shade(VOID, 0.2))
      }
      // Edge protection round the top storey's floor, in the plot's paint.
      const paint = paintOf(o.roofs, s.tone)
      const floor = base - (floors - 1) * F - 1
      for (let x = 3; x <= 28; x++) pc.px(x, floor - 3, (x % 4 < 2) ? paint : shade(paint, -0.3))
      pc.hline(2, 29, base, P.concrete)
    },
    top(pc, o, s) {
      // Plywood forms boxed round some of the next storey's columns, and starter bars standing
      // up out of the slab everywhere else, their tops bent over.
      const y = s.wallTop
      const boxed = [3, 11, 19, 27].filter((c, i) => (i + s.tone) % 2 === 0)
      for (let x = 4; x <= 27; x += 3) {
        if (boxed.some((c) => x >= c - 2 && x <= c + 3)) continue
        pc.vline(x, y - 4, y - 1, P.rebar)
        pc.px(x + 1, y - 4, P.rebar)
      }
      for (const c of boxed) {
        box(pc, c - 1, y - 6, c + 2, y - 1, P.woodLight)
        pc.vline(c + 2, y - 6, y - 1, P.wood)
        pc.hline(c - 1, c + 2, y - 4, P.woodDark)
        pc.px(c, y - 7, P.rebar)
        pc.px(c + 1, y - 7, P.rebar)
      }
      // A stack of plywood for the next pour's forms.
      const px = s.flip ? 6 : 21
      for (let yy = y - 3; yy <= y - 1; yy++) pc.hline(px, px + 4, yy, yy % 2 ? P.woodLight : P.wood)
    },
  },
  steel: {
    body(pc, o, s) {
      const { base, wallTop, F, floors } = s
      box(pc, 3, wallTop + 2, 28, base - 1, VOID)
      const clad = [paintOf(o.roofs, s.tone), P.steelLight, P.cladWhite][s.tone]
      for (let k = 0; k < floors; k++) {
        const fb = base - k * F - 1
        const ft = base - (k + 1) * F + 1
        if (k < floors - 1 || s.progress > 0.4) {
          // Cladding panels, with a ribbon of windows along each clad storey.
          const [a, b] = coverOf(s, k)
          corrugated(pc, a, ft + 2, b, fb, clad)
          pc.hline(a, b, ft + 2, shade(clad, 0.15))
          if (k < floors - 1) {
            box(pc, 5, ft + 4, 26, ft + 6, P.steelDark)
            for (let x = 6; x <= 25; x++) pc.vline(x, ft + 5, ft + 5, x % 5 === 0 ? P.steelDark : o.lit ? P.windowLit : P.window)
            if (!o.lit) for (let x = 6; x <= 25; x += 5) pc.px(x + 1, ft + 5, P.windowShine)
          }
        } else {
          // Open bays, cross-braced.
          pc.line(5, fb, 14, ft + 2, P.steel)
          pc.line(5, ft + 2, 14, fb, P.steel)
          if (o.lit) bulb(pc, 21, ft + 4)
        }
      }
      for (const c of [3, 15, 26]) {
        pc.vline(c, wallTop, base - 1, P.steelLight)
        pc.vline(c + 1, wallTop, base - 1, P.steel)
        pc.vline(c + 2, wallTop, base - 1, P.steelDark)
      }
      for (let k = 0; k < floors - 1; k++) steelBeam(pc, base - (k + 1) * F + 1)
      const dx = s.doorLeft ? 7 : 20
      box(pc, dx, base - 7, dx + 4, base - 1, o.accent)
      pc.vline(dx + 4, base - 7, base - 1, shade(o.accent, -0.3))
      pc.px(dx + 3, base - 4, P.metal)
      pc.hline(2, 29, base, P.concrete)
    },
    top(pc, o, s) {
      steelBeam(pc, s.wallTop)
      // Topped out: a flag on the last column up, and a bundle of beams waiting beside it.
      const fx = s.flip ? 4 : 27
      pc.vline(fx, s.wallTop - 7, s.wallTop - 1, P.metalDark)
      const dir = s.flip ? 1 : -1
      for (let i = 1; i <= 4; i++) pc.vline(fx + dir * i, s.wallTop - 7, s.wallTop - 7 + (i < 4 ? 2 : 1), o.accent)
      const bx = s.flip ? 12 : 8
      for (let y = s.wallTop - 3; y <= s.wallTop - 1; y++) pc.hline(bx, bx + 10, y, y % 2 ? P.steel : P.steelLight)
      pc.vline(bx + 3, s.wallTop - 3, s.wallTop - 1, P.hiVis[1])
      pc.vline(bx + 8, s.wallTop - 3, s.wallTop - 1, P.hiVis[1])
    },
  },
  glass: {
    body(pc, o, s) {
      const { base, wallTop, F, floors } = s
      box(pc, 3, wallTop + 2, 28, base - 1, VOID)
      for (let k = 0; k < floors; k++) {
        const fb = base - k * F - 1
        const ft = base - (k + 1) * F + 1
        // The curtain wall, a panel at a time: every storey but the top, and part of that.
        const [a, b] = coverOf(s, k)
        const glazed = k < floors - 1 || s.progress > 0.35
        for (let x = 3; x <= 28; x++) {
          for (let y = ft + 2; y <= fb; y++) {
            const mullion = (x - 3) % 5 === 0 || x === 28
            if (mullion) pc.px(x, y, P.steelLight)
            else if (glazed && x >= a && x <= b) {
              const litPane = o.lit && (Math.floor((x - 3) / 5) + k) % 3 !== 1
              pc.px(x, y, litPane ? ((x + y) % 4 === 0 ? P.windowLitCore : P.windowLit) : (x + y - ft) % 7 === 0 || (x + y - ft) % 7 === 1 ? P.glassLight : P.glass)
            }
          }
        }
        steelBeam(pc, ft)
      }
      // The way in, framed in the plot's colour.
      const dx = s.doorLeft ? 8 : 18
      box(pc, dx - 1, base - 8, dx + 5, base - 1, o.accent)
      box(pc, dx, base - 7, dx + 4, base - 1, o.lit ? P.windowLit : P.window)
      pc.vline(dx + 2, base - 7, base - 1, o.accent)
      pc.hline(2, 29, base, P.concrete)
    },
    top(pc, o, s) {
      pc.hline(2, 29, s.wallTop, P.steelLight)
      pc.hline(2, 29, s.wallTop + 1, P.steelDark)
      // A davit on the roof lowering the next panel into place on its suction lifter.
      const open = s.flip ? 6 : 24
      const px = s.flip ? 3 : 28
      pc.vline(px, s.wallTop - 7, s.wallTop - 1, P.steelDark)
      pc.hline(Math.min(px, open), Math.max(px, open), s.wallTop - 7, P.steelDark)
      const ft = s.wallTop + 2
      pc.vline(open, s.wallTop - 6, ft + 1, P.metalDark)
      box(pc, open - 2, ft + 2, open + 2, ft + 2, paintOf(o.roofs, s.tone))
      box(pc, open - 2, ft + 3, open + 2, ft + 7, P.glass)
      pc.px(open - 1, ft + 4, P.glassLight)
      pc.px(open, ft + 3, P.glassLight)
    },
  },
}

/** A floor's edge beam, the ribs of its metal decking showing along the top. */
function steelBeam(pc, y) {
  pc.hline(2, 29, y, P.steelLight)
  pc.hline(2, 29, y + 1, P.steel)
  for (let x = 5; x <= 28; x += 4) pc.px(x, y - 1, P.steel)
}

/** A frame's roof: 11 rows from its eaves on `wallTop`, overhanging a pixel each side. */
const ROOF_RISE = 11
const roofEdge = (wallTop, y) => {
  const t = (y - (wallTop - ROOF_RISE)) / (ROOF_RISE - 1)
  const half = 6 + (15 - 6) * t
  return [Math.round(15.5 - half), Math.round(15.5 + half)]
}
/** The roof's outline filled by `fill(x, y, edge)`, which returns null to leave a pixel open. */
function roofFrame(pc, wallTop, fill) {
  const yTop = wallTop - ROOF_RISE
  for (let y = yTop; y < wallTop; y++) {
    const [a, b] = roofEdge(wallTop, y)
    for (let x = a; x <= b; x++) {
      const edge = x === a || x === b || y === wallTop - 1 || y === yTop
      const c = fill(x, y, edge)
      if (c) pc.px(x, y, c)
    }
  }
}

function frame(pc, o) {
  const s = frameSpec(o.variant, o.wall, o.low)
  const m = FRAMES[s.material]
  m.body(pc, o, s)
  const top = s.base - (s.floors - 1) * s.F
  if (s.detail === 'ladder') ladder(pc, s.doorLeft ? 23 : 6, top - 4, s.base)
  else if (s.detail === 'bucket') bucket(pc, s.doorLeft ? 18 : 4, s.base)
  // A gin wheel only goes on a house's top plate; anything bigger has its light instead.
  else if (s.detail === 'light' || (s.detail === 'hoist' && !s.house)) worklight(pc, s.doorLeft ? 26 : 5, s.base, o.lit)
  else if (s.detail === 'tarp') {
    // A tarp hung over the open end of the top storey, sagging between its ties.
    const [x0, x1] = s.flip ? [3, 12] : [19, 28]
    const y0 = s.wallTop + 2
    for (let x = x0; x <= x1; x++) {
      const sag = x === x0 || x === x1 ? 0 : 1 + ((x - x0) % 4 === 2 ? 1 : 0)
      pc.vline(x, y0, y0 + 5 + sag, (x - x0) % 4 === 0 ? shade(P.tarp, -0.25) : P.tarp)
    }
    pc.hline(x0, x1, y0, shade(P.tarp, 0.2))
  }
  const sc = { x0: 1, x1: 30, top: s.wallTop - 3 }
  if (!o.roof) return sc
  m.top(pc, o, s)
  if (s.detail === 'hoist' && s.house) {
    // A gin wheel on a pole off the top plate, a bucket of mortar on its rope.
    const x = s.flip ? 27 : 4
    pc.vline(x, s.wallTop - 8, s.wallTop + 2, P.steel)
    const out = s.flip ? x + 2 : x - 2
    pc.hline(Math.min(x, out), Math.max(x, out), s.wallTop - 8, P.steel)
    pc.px(out, s.wallTop - 7, P.metalDark)
    pc.vline(out, s.wallTop - 6, s.wallTop + 6, P.plasterShade)
    box(pc, out - 1, s.wallTop + 7, out + 1, s.wallTop + 9, P.rubber)
  }
  return sc
}

// ---------- cabin: the site office ----------

function cabinSpec(variant, low = false) {
  const r = specRand('cabin', variant)
  const two = r() < 0.4
  const white = r() < 0.45
  const doorLeft = r() < 0.5
  const bars = r() < 0.6
  const tone = Math.floor(r() * 3)
  const stacked = two && !low
  const top = stacked ? 16 : 27
  // The stovepipe goes up at the far end from the door, its cap PIPE rows over the top rail.
  return { stacked, white, doorLeft, bars, tone, top, pipeX: doorLeft ? 24 : 5, pipeTop: top - PIPE }
}
/** How far a cabin's stovepipe stands above its top rail, cap and all. */
const PIPE = 10

/** A cabin's shell: steel panels between corner posts, rails top and bottom. */
function shell(pc, x0, y0, x1, y1, c) {
  box(pc, x0, y0, x1, y1, c)
  for (let x = x0 + 6; x < x1 - 2; x += 6) pc.vline(x, y0 + 1, y1 - 1, shade(c, -0.1))
  pc.hline(x0, x1, y0, shade(c, 0.12))
  pc.hline(x0, x1, y1, shade(c, -0.35))
  pc.vline(x0, y0, y1, shade(c, -0.08))
  pc.vline(x1 - 1, y0, y1, shade(c, -0.2))
  pc.vline(x1, y0, y1, shade(c, -0.32))
}

function cabinDoor(pc, x, y1, c, lit) {
  const d = shade(c, -0.15)
  box(pc, x, y1 - 10, x + 5, y1 - 1, d)
  pc.vline(x, y1 - 10, y1 - 1, shade(c, -0.4))
  pc.vline(x + 5, y1 - 10, y1 - 1, shade(c, -0.4))
  pc.hline(x, x + 5, y1 - 10, shade(c, -0.4))
  pane(pc, x + 1, y1 - 9, 4, 3, lit)
  pc.px(x + 4, y1 - 5, P.metal)
}

function sign(pc, x, y, accent) {
  box(pc, x, y, x + 8, y + 3, accent)
  pc.hline(x, x + 8, y + 3, shade(accent, -0.3))
  pc.hline(x + 2, x + 6, y + 1, P.white)
  pc.hline(x + 2, x + 4, y + 2, P.white)
}

function steps(pc, x, base) {
  pc.hline(x, x + 5, base - 2, P.metal)
  pc.hline(x - 1, x + 6, base - 1, P.metalDark)
  pc.hline(x - 1, x + 6, base, P.metal)
  pc.vline(x + 7, base - 7, base, P.metal)
  pc.px(x + 6, base - 7, P.metal)
}

function cabin(pc, o) {
  const s = cabinSpec(o.variant, o.low)
  const c = s.white ? P.cladWhite : paintOf(o.roofs, s.tone)
  for (const x of [3, 14, 25]) {
    box(pc, x, 44, x + 3, 46, P.concrete)
    pc.hline(x, x + 3, 44, P.concreteLight)
    pc.vline(x + 3, 45, 46, P.concreteDark)
  }
  const dx = s.doorLeft ? 4 : 22
  let rc = c
  if (s.stacked) {
    // Two high: the stair up to the top one's door climbs across the bottom one's blank wall.
    rc = s.white ? P.cladWhite : paintOf(o.roofs, s.tone + 1)
    shell(pc, 2, 30, 29, 43, c)
    shell(pc, 2, s.top, 29, 29, rc)
    cabinDoor(pc, dx, 43, c, o.lit)
    pane(pc, s.doorLeft ? 21 : 4, 33, 7, 6, o.lit, P.steelDark, s.bars)
    cabinDoor(pc, dx, 29, rc, o.lit)
    pane(pc, 13, 19, 7, 6, o.lit, P.steelDark, s.bars)
    sign(pc, s.doorLeft ? 21 : 3, 20, o.accent)
    const [lx0, lx1] = s.doorLeft ? [1, 11] : [20, 30]
    const dir = s.doorLeft ? 1 : -1
    const from = s.doorLeft ? lx1 + 1 : lx0 - 1
    for (let i = 0; i <= 14; i++) {
      const x = from + dir * Math.round(i * 0.72)
      const y = 31 + i
      pc.px(x, y, P.metalDark)
      if (i % 2 === 0) pc.hline(Math.min(x, x + dir * 2), Math.max(x, x + dir * 2), y, P.metal)
    }
    pc.line(from, 26, from + dir * 10, 40, P.metal)
    pc.hline(lx0, lx1, 30, P.metal)
    pc.hline(lx0, lx1, 31, P.metalDark)
    pc.hline(lx0, lx1, 26, P.metal)
    pc.vline(s.doorLeft ? 1 : 30, 26, 46, P.metal)
  } else {
    shell(pc, 2, s.top, 29, 43, c)
    cabinDoor(pc, dx, 43, c, o.lit)
    for (const x of s.doorLeft ? [12, 21] : [4, 13]) pane(pc, x, s.top + 3, 7, 6, o.lit, P.steelDark, s.bars)
    sign(pc, s.doorLeft ? 16 : 7, s.top + 11, o.accent)
    steps(pc, dx, 46)
  }
  const sc = { x0: 1, x1: 30, top: s.top - 2 }
  if (!o.roof) return sc
  // A flat roof with a drip edge, and the stove's flue with its cap.
  pc.hline(1, 30, s.top - 2, shade(rc, 0.2))
  pc.hline(1, 30, s.top - 1, shade(rc, -0.4))
  pc.vline(s.pipeX, s.pipeTop + 1, s.top - 3, P.metal)
  pc.vline(s.pipeX + 1, s.pipeTop + 1, s.top - 3, P.metalDark)
  pc.hline(s.pipeX - 1, s.pipeX + 2, s.pipeTop, P.metalDark)
  return sc
}

// ---------- containers ----------

function containerSide(pc, x0, y0, x1, y1, c, rand) {
  box(pc, x0, y0, x1, y1, c)
  for (let x = x0 + 2; x < x1; x += 2) pc.vline(x, y0 + 1, y1 - 1, shade(c, -0.14))
  pc.hline(x0, x1, y0, shade(c, 0.18))
  pc.hline(x0, x1, y1, shade(c, -0.35))
  pc.vline(x0, y0, y1, shade(c, -0.08))
  pc.vline(x1, y0, y1, shade(c, -0.35))
  for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) pc.px(x, y, shade(c, -0.5))
  if (c === P.rust) return
  // Rust weeping from the top rail.
  for (let i = 0; i < 3; i++) {
    const x = x0 + 2 + Math.floor(rand() * (x1 - x0 - 3))
    const y = y0 + 1 + Math.floor(rand() * 3)
    pc.vline(x, y0 + 1, y, P.rust)
    pc.px(x, y0 + 1, P.rustDark)
  }
}

function containerEnd(pc, x0, y0, x1, y1, c) {
  box(pc, x0, y0, x1, y1, c)
  const mid = Math.round((x0 + x1) / 2)
  pc.hline(x0, x1, y0, shade(c, 0.18))
  pc.hline(x0, x1, y1, shade(c, -0.35))
  pc.vline(x0, y0, y1, shade(c, -0.2))
  pc.vline(x1, y0, y1, shade(c, -0.35))
  pc.vline(mid, y0 + 1, y1 - 1, shade(c, -0.4))
  for (const x of [x0 + 2, mid - 2, mid + 2, x1 - 2]) {
    pc.vline(x, y0 + 1, y1 - 1, shade(c, -0.22))
    pc.px(x + (x < mid ? 1 : -1), Math.round((y0 + y1) / 2), P.metal)
  }
  for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) pc.px(x, y, shade(c, -0.5))
}

function containersSpec(variant, low = false) {
  const r = specRand('containers', variant)
  const ends = r() < 0.45
  const office = r() < 0.5 ? 0 : 1
  const shift = pick(r, [-2, 0, 0, 2])
  const half = r() < 0.5
  const halfLeft = r() < 0.5
  const tones = [r(), r(), r(), r()]
  return { ends, office, shift, half, halfLeft, tones, levels: low ? 2 : 3 }
}

/** A container's height on the stack: 12 rows, near enough the 8'6" of a real one to its 20 ft. */
const BOX = 12

function containers(pc, o) {
  const s = containersSpec(o.variant, o.low)
  // Most in the plot's paint, the rest rust, grey or white, as a yard's odd ones are.
  const colour = (t, i) => (t < 0.6 ? paintOf(o.roofs, i + Math.floor(t * 5)) : [P.rust, P.steel, P.rust, P.cladWhite][Math.floor(((t - 0.6) / 0.4) * 4)])
  const level = (i) => [46 - BOX * (i + 1) + 1, 46 - BOX * i]
  const roofLevel = s.levels - 1
  const [b0, b1] = level(0)
  if (s.ends) {
    // Two end on, doors to us, a placard on the right-hand one.
    containerEnd(pc, 1, b0, 13, b1, colour(s.tones[0], 0))
    containerEnd(pc, 18, b0, 30, b1, colour(s.tones[3], 1))
    box(pc, 26, b0 + 3, 28, b0 + 4, o.accent)
  } else containerSide(pc, 1, b0, 30, b1, colour(s.tones[0], 0), o.rand)
  const [u0, u1] = level(1)
  const ux0 = 1 + Math.max(0, s.shift)
  if (roofLevel > 1) containerSide(pc, ux0, u0, 30 + Math.min(0, s.shift), u1, colour(s.tones[1], 1), o.rand)
  // A long one below the top is fitted out as the office: a barred window, a door, the plot's sign.
  const office = s.ends ? 1 : Math.min(s.office, roofLevel - 1)
  if (office < roofLevel && !(office === 0 && s.ends)) {
    const [y0, y1] = level(office)
    const x0 = office ? ux0 : 1
    pane(pc, x0 + 3, y0 + 3, 7, 5, o.lit, P.steelDark, true)
    box(pc, x0 + 19, y0 + 2, x0 + 23, y1 - 1, shade(P.steelDark, 0.1))
    pc.px(x0 + 22, y0 + 6, P.metal)
    sign(pc, x0 + 10, y0 + 3, o.accent)
  }
  const sc = { x0: 25, x1: 30, top: level(roofLevel - 1)[0] - 2 }
  if (!o.roof) return sc
  // The top one goes on last: a twenty-footer, or a ten-footer at one end.
  const [t0, t1] = level(roofLevel)
  const c = colour(s.tones[2], 2)
  if (s.half) {
    const x0 = s.halfLeft ? 2 : 15
    containerSide(pc, x0, t0, x0 + 14, t1, c, o.rand)
  } else containerSide(pc, 1 - Math.min(0, s.shift), t0, 30 - Math.max(0, s.shift), t1, c, o.rand)
  return sc
}

// ---------- shed: a steel portal-frame warehouse ----------

const EAVE = 26
const RIDGE = 16

function shedSpec(variant) {
  const r = specRand('shed', variant)
  const tone = Math.floor(r() * 5)
  const openLeft = r() < 0.5
  const shutter = pick(r, ['down', 'down', 'half', 'up'])
  const sheets = r() < 0.6
  return { tone, openLeft, shutter, sheets }
}

function shed(pc, o) {
  const s = shedSpec(o.variant)
  const clad = [paintOf(o.roofs, 0), paintOf(o.roofs, 1), P.steelLight, P.cladWhite, P.steelLight][s.tone]
  const base = 46
  // The portal frame: stanchions and rafters up to the ridge, purlins along the rafters.
  const rafter = (x0, x1) => {
    pc.line(x0, EAVE, x1, RIDGE + 1, P.steel)
    pc.line(x0, EAVE + 1, x1, RIDGE + 2, P.steelDark)
  }
  rafter(1, 15)
  rafter(30, 16)
  pc.hline(15, 16, RIDGE + 1, P.steel)
  for (let x = 3; x <= 28; x += 3) {
    const y = Math.round(RIDGE + 1 + Math.abs(x - 15.5) * (EAVE - RIDGE - 1) / 14.5)
    pc.px(x, y - 1, P.steelDark)
  }
  corrugated(pc, 1, EAVE, 30, base - 1, clad)
  pc.hline(1, 30, EAVE, shade(clad, 0.15))
  // One end bay still open, showing its frame and the dark inside.
  const [ox0, ox1] = s.openLeft ? [1, 9] : [22, 30]
  box(pc, ox0, EAVE, ox1, base - 1, VOID)
  for (let y = EAVE + 4; y < base; y += 5) pc.hline(ox0, ox1, y, P.steelLight)
  for (const x of [ox0, ox1]) pc.vline(x, EAVE, base - 1, P.steel)
  pc.vline(s.openLeft ? ox0 + 1 : ox1 - 1, EAVE, base - 1, P.steelDark)
  if (o.lit) bulb(pc, Math.round((ox0 + ox1) / 2), EAVE + 6)
  // The roller shutter in the middle bay.
  const sx0 = 11
  const sx1 = 20
  box(pc, sx0 - 1, EAVE + 5, sx1 + 1, EAVE + 6, P.metalDark)
  const down = { down: EAVE + 7, half: EAVE + 13, up: base }[s.shutter]
  box(pc, sx0, EAVE + 7, sx1, base - 1, o.lit ? P.windowLit : VOID)
  for (let y = EAVE + 7; y < down; y++) pc.hline(sx0, sx1, y, y % 2 ? P.metal : shade(P.metal, -0.12))
  if (down < base) pc.hline(sx0, sx1, down, P.metalDark)
  pc.vline(sx0 - 1, EAVE + 7, base - 1, P.metalDark)
  pc.vline(sx1 + 1, EAVE + 7, base - 1, P.metalDark)
  // A door for people, in the plot's colour.
  const dx = s.openLeft ? 24 : 4
  box(pc, dx, base - 9, dx + 4, base - 1, o.accent)
  pc.vline(dx + 4, base - 9, base - 1, shade(o.accent, -0.3))
  pc.hline(dx, dx + 4, base - 9, shade(o.accent, 0.15))
  pc.px(dx + 3, base - 5, P.metal)
  if (s.sheets) {
    // A stack of cladding sheets waiting against the open bay.
    const x = s.openLeft ? 3 : 23
    for (let y = base - 5; y <= base - 1; y++) pc.hline(x, x + 5, y, y % 2 ? clad : shade(clad, -0.2))
  }
  pc.hline(0, 31, base, P.concrete)
  const sc = { x0: 1, x1: 30, top: EAVE - 1 }
  if (!o.roof) return sc
  // The gable clad over the frame, its verge trimmed in the plot's colour, a louvre at its peak.
  for (let y = RIDGE; y < EAVE; y++) {
    const half = 1 + (y - RIDGE) * 14.5 / (EAVE - RIDGE)
    const a = Math.round(15.5 - half)
    const b = Math.round(15.5 + half)
    for (let x = a; x <= b; x++) pc.px(x, y, (x - 1) % 2 ? clad : shade(clad, -0.14))
    pc.px(a, y, o.accent)
    pc.px(b, y, shade(o.accent, -0.3))
    if (a > 0) pc.px(a - 1, y, o.accent)
    if (b < 31) pc.px(b + 1, y, shade(o.accent, -0.3))
  }
  pc.hline(0, 31, EAVE, shade(clad, -0.4))
  pc.hline(15, 16, RIDGE - 1, o.accent)
  box(pc, 13, RIDGE + 3, 18, RIDGE + 6, P.metalDark)
  for (let y = RIDGE + 4; y <= RIDGE + 5; y++) pc.hline(14, 17, y, P.metal)
  return sc
}

// ---------- crane: a tower crane, 60 tall ----------

function craneSpec(variant) {
  const r = specRand('crane', variant)
  return { load: pick(r, ['planks', 'skip', 'bricks']), tone: Math.floor(r() * 2), trolley: 20 + Math.floor(r() * 5) }
}

/** A lattice mast between `x0` and `x0 + 5`, zigzag bracing every four rows. */
function mast(pc, x0, y0, y1, c) {
  const dark = shade(c, -0.3)
  pc.vline(x0, y0, y1, shade(c, 0.12))
  pc.vline(x0 + 5, y0, y1, dark)
  for (let y = y1; y > y0; y -= 4) {
    pc.hline(x0, x0 + 5, y, c)
    pc.line(x0 + 1, y - 1, x0 + 4, Math.max(y0, y - 3), shade(c, -0.12))
  }
}

function crane(pc, o) {
  const s = craneSpec(o.variant)
  const c = paintOf(o.roofs, s.tone)
  const dark = shade(c, -0.3)
  const base = 58
  // The footing, cast round the mast's feet.
  box(pc, 4, 53, 17, base, P.concrete)
  pc.hline(4, 17, 53, P.concreteLight)
  pc.vline(17, 54, base, P.concreteDark)
  for (const x of [6, 15]) pc.px(x, 54, P.steelDark)
  mast(pc, 8, 20, 52, c)
  const sc = { x0: 6, x1: 15, top: 18 }
  if (!o.roof) return sc
  // The tower head, and the pendant ties from its peak out to the jib and the counter-jib.
  pc.line(8, 16, 10, 4, shade(c, 0.12))
  pc.line(13, 16, 11, 4, dark)
  pc.hline(9, 12, 9, c)
  pc.line(11, 4, 28, 10, P.metal)
  pc.line(10, 4, 1, 11, P.metal)
  // The jib: a lattice from the mast to the edge.
  pc.hline(12, 31, 11, shade(c, 0.15))
  pc.hline(12, 31, 14, dark)
  for (let x = 12; x < 31; x += 4) {
    pc.line(x, 14, x + 2, 11, c)
    pc.line(x + 2, 11, x + 4, 14, shade(c, -0.12))
  }
  pc.vline(31, 11, 14, dark)
  // The counter-jib, its winch, and the counterweights hanging off its end.
  pc.hline(0, 8, 12, shade(c, 0.15))
  pc.hline(0, 8, 14, dark)
  for (let x = 0; x < 8; x += 3) pc.line(x, 14, x + 2, 12, c)
  box(pc, 4, 10, 7, 11, P.steelDark)
  box(pc, 0, 15, 4, 20, P.concrete)
  pc.hline(0, 4, 15, P.concreteLight)
  pc.hline(0, 4, 18, P.concreteDark)
  pc.vline(4, 15, 20, P.concreteDark)
  // The slewing ring on top of the mast, and the operator's cab hung off its side under the jib.
  box(pc, 7, 16, 14, 19, P.steelDark)
  pc.hline(7, 14, 16, P.steel)
  box(pc, 14, 15, 19, 20, c)
  pc.hline(14, 19, 15, shade(c, 0.15))
  pc.vline(19, 15, 20, dark)
  pane(pc, 15, 16, 4, 4, o.lit)
  // A flag in the plot's colour on top, and a warning light for aircraft at the jib's tip.
  pc.vline(11, 0, 3, P.metalDark)
  box(pc, 12, 0, 14, 1, o.accent)
  pc.px(12, 2, o.accent)
  pc.px(31, 10, P.pin)
  // The trolley, and the load on its hook, swinging a little between frames.
  const tx = s.trolley
  box(pc, tx - 1, 15, tx + 1, 15, P.steelDark)
  const swing = o.frame % 2 ? 2 : 0
  const hy = 29
  pc.line(tx, 16, tx + swing, hy - 1, P.steelDark)
  const hx = tx + swing
  box(pc, hx - 1, hy, hx + 1, hy + 1, P.sitePaint[0])
  pc.px(hx, hy + 2, P.metalDark)
  pc.line(hx, hy + 2, hx - 3, hy + 5, P.steelDark)
  pc.line(hx, hy + 2, hx + 3, hy + 5, P.steelDark)
  const ly = hy + 6
  if (s.load === 'planks') {
    for (let y = ly; y <= ly + 2; y++) pc.hline(hx - 4, hx + 4, y, y % 2 ? P.wood : P.woodLight)
    pc.vline(hx - 2, ly, ly + 2, o.accent)
    pc.vline(hx + 2, ly, ly + 2, o.accent)
  } else if (s.load === 'skip') {
    const k = paintOf(o.roofs, s.tone + 1)
    for (let y = ly; y <= ly + 3; y++) {
      const inset = Math.floor((y - ly) / 2)
      pc.hline(hx - 4 + inset, hx + 4 - inset, y, y === ly ? shade(k, 0.2) : k)
    }
    pc.hline(hx - 3, hx + 3, ly - 1, P.stoneDark)
  } else {
    box(pc, hx - 3, ly, hx + 3, ly + 3, P.brick)
    pc.hline(hx - 3, hx + 3, ly + 1, P.mortar)
    pc.vline(hx, ly, ly + 3, P.mortar)
    pc.hline(hx - 4, hx + 4, ly + 4, P.woodLight)
  }
  return sc
}

/** The crane's scaffolding: the climbing frame that jacks the mast up a section at a time. */
function climbingFrame(pc) {
  box(pc, 6, 18, 15, 19, P.steelDark)
  pc.hline(6, 15, 18, P.steelLight)
  for (const x of [6, 15]) pc.vline(x, 18, 28, P.steel)
  pc.hline(5, 16, 26, P.woodLight)
  pc.hline(5, 16, 27, P.wood)
  pc.hline(6, 15, 22, P.metal)
}

// ---------- mixer: a batching plant ----------

/** The top of the cement silo's body: lower down the sides, so its vent clears the doorstep above. */
const siloTop = (low) => (low ? 18 : 12)
/** Across a cylinder lit from the left: how much lighter or darker each of its nine columns is. */
const ROUND = [0.24, 0.14, 0.06, 0, 0, -0.05, -0.12, -0.22, -0.34]

function mixer(pc, o) {
  const r = specRand('mixer', o.variant)
  const white = r() < 0.45
  const tone = Math.floor(r() * 3)
  const silo = white ? P.cladWhite : paintOf(o.roofs, tone)
  const drum = paintOf(o.roofs, tone + 1)
  const top = siloTop(o.low)
  const base = 46
  const hopper = 31
  // Legs under the silo, braced, and a ring beam where the cone sits on them.
  for (const x of [2, 10]) pc.vline(x, hopper, base, P.steel)
  pc.line(3, 38, 9, base - 1, P.steelDark)
  pc.line(9, 38, 3, base - 1, P.steelDark)
  // The silo: a cylinder, banded in the plot's colour, seams every few rows, over its cone.
  for (let y = top; y < hopper; y++) {
    const seam = (y - top) % 6 === 5 ? -0.08 : 0
    ROUND.forEach((f, i) => pc.px(2 + i, y, shade(silo, f + seam)))
  }
  for (const [y, f] of [[top + 2, 0], [top + 3, -0.25]]) ROUND.forEach((g, i) => pc.px(2 + i, y, shade(o.accent, f + g / 2)))
  for (let y = hopper; y <= hopper + 5; y++) {
    const inset = Math.round((y - hopper) * 0.8)
    for (let x = 2 + inset; x <= 10 - inset; x++) pc.px(x, y, shade(silo, ROUND[x - 2] - 0.12))
  }
  pc.hline(2, 10, hopper, P.steelDark)
  pc.vline(6, hopper + 6, hopper + 7, P.metalDark)
  // A ladder up its side.
  pc.vline(11, top - 1, base, P.metalDark)
  pc.vline(13, top - 1, base, P.metal)
  for (let y = top; y <= base; y += 2) pc.px(12, y, P.metal)
  // The screw conveyor from the silo's foot up into the mixer, on a prop.
  pc.line(7, 39, 19, 29, P.metal)
  pc.line(7, 40, 19, 30, P.metalDark)
  pc.vline(14, 35, base, P.steelDark)
  // The drum: a barrel tipped up towards its mouth, lit from above, spiral fins round it.
  const [ax, ay, bx, by] = [15, 38, 29.5, 31.5]
  const len = Math.hypot(bx - ax, by - ay)
  const [ux, uy] = [(bx - ax) / len, (by - ay) / len]
  for (let y = 24; y <= 45; y++) {
    for (let x = 10; x <= 31; x++) {
      const vx = x + 0.5 - ax
      const vy = y + 0.5 - ay
      const t = (vx * ux + vy * uy) / len
      const d = vx * -uy + vy * ux
      const rad = t < 0.55 ? 5.2 : 5.2 - ((t - 0.55) / 0.45) * 3
      if (t < 0 || t > 1 || Math.abs(d) > rad) continue
      const light = d < -rad + 1.2 ? 0.22 : d < -rad + 3.2 ? 0.08 : d > rad - 1.2 ? -0.32 : d > rad - 2.6 ? -0.15 : 0
      const fin = t > 0.08 && ((t * 3.2 - d * 0.07) % 1 + 1) % 1 < 0.14
      pc.px(x, y, shade(drum, (fin ? -0.3 : 0) + (t < 0.06 ? -0.12 : 0) + light))
    }
  }
  pc.ellipse(bx - 0.3, by, 1.4, 1.9, P.rubber)
  // Its stand, and the chute it pours down.
  pc.line(20, 38, 17, base, P.steelDark)
  pc.line(21, 38, 24, base, P.steelDark)
  pc.hline(18, 23, 43, P.steelDark)
  pc.line(30, 33, 31, 39, P.metal)
  box(pc, 12, 40, 14, 43, P.metalDark)
  if (o.lit) bulb(pc, 27, 41)
  pc.hline(0, 31, base, P.concrete)
  const sc = { x0: 1, x1: 14, top: top - 2 }
  if (!o.roof) return sc
  // Its top, a rail round it, and the dust filter's vent.
  pc.hline(2, 10, top - 1, shade(silo, 0.3))
  box(pc, 4, top - 5, 7, top - 2, P.metal)
  pc.vline(7, top - 5, top - 2, P.metalDark)
  pc.hline(5, 6, top - 6, P.metalDark)
  pc.hline(1, 11, top - 4, P.metal)
  for (const x of [1, 11]) pc.vline(x, top - 3, top - 2, P.metal)
  return sc
}

// ---------- loos: a pair of portable toilets ----------

function loos(pc, o) {
  const r = specRand('loos', o.variant)
  const engaged = [r() < 0.5, r() < 0.5]
  const wash = r() < 0.6
  const tone = Math.floor(r() * 3)
  const colours = [P.sitePaint[6], paintOf(o.roofs, tone)]
  if (colours[1] === colours[0]) colours[1] = P.sitePaint[7]
  const base = 46
  // Side by side, and to the left to make room for the hand-wash station when there is one.
  const xs = wash ? [2, 14] : [4, 17]
  xs.forEach((x0, i) => {
    const c = colours[i]
    const x1 = x0 + 10
    box(pc, x0, 22, x1, base - 1, c)
    pc.vline(x0, 22, base - 1, shade(c, 0.15))
    pc.vline(x1, 22, base - 1, shade(c, -0.3))
    pc.vline(x1 - 1, 22, base - 1, shade(c, -0.15))
    // The door, moulded with ribs, its latch showing whether anyone's in.
    box(pc, x0 + 2, 25, x1 - 2, base - 2, shade(c, -0.08))
    for (let x = x0 + 3; x <= x1 - 3; x += 2) pc.vline(x, 27, base - 4, shade(c, -0.2))
    pc.hline(x0 + 2, x1 - 2, 25, shade(c, 0.12))
    pc.px(x1 - 3, 35, P.metal)
    pc.px(x1 - 3, 34, engaged[i] ? P.pin : P.crop)
    box(pc, x0 + 4, 27, x0 + 6, 28, P.white)
    pc.px(x0 + 5, 27, o.accent)
    // A vent strip under the roof, that shows the light inside at night.
    pc.hline(x0 + 2, x1 - 2, 23, o.lit ? P.windowLit : shade(c, -0.35))
    pc.hline(x0, x1, base, shade(c, -0.4))
  })
  if (wash) {
    // The hand-wash station beside them.
    box(pc, 26, 33, 30, base - 1, P.cladWhite)
    pc.vline(30, 33, base - 1, shade(P.cladWhite, -0.25))
    pc.hline(26, 30, 33, P.white)
    box(pc, 27, 36, 29, 37, P.metal)
    pc.px(28, 35, P.metalDark)
    pc.hline(26, 30, base, P.rubber)
  }
  if (!o.roof) return null
  // Their white moulded roofs, and the vent pipes out the back.
  xs.forEach((x0) => {
    const x1 = x0 + 10
    pc.vline(x1 - 2, 15, 20, P.metalDark)
    pc.hline(x1 - 3, x1 - 1, 15, P.metalDark)
    pc.hline(x0 + 1, x1 - 1, 19, P.white)
    pc.hline(x0, x1, 20, P.cladWhite)
    pc.hline(x0, x1, 21, shade(P.cladWhite, -0.25))
  })
  return null
}

// ---------- digger: an excavation ----------

function digger(pc, o) {
  const r = specRand('digger', o.variant)
  const tone = Math.floor(r() * 2)
  const heap = r() < 0.7
  const puddle = r() < 0.5
  const c = paintOf(o.roofs, tone)
  const dark = shade(c, -0.3)
  const base = 46
  // Spoil heaped up behind the pit.
  if (heap) {
    for (let y = 29; y <= 36; y++) {
      const half = (y - 28) * 1.6
      const a = Math.max(0, Math.round(7 - half))
      pc.hline(a, Math.round(7 + half), y, P.dirt)
      pc.px(a, y, shade(P.dirt, 0.15))
    }
    for (let i = 0; i < 8; i++) {
      const y = 31 + Math.floor(o.rand() * 5)
      pc.px(Math.round(7 + (o.rand() * 2 - 1) * (y - 29)), y, P.dirtDark)
    }
  }
  // The pit, seen from above and in front: dug earth round it, the far wall's layers of soil
  // between trench sheets shoring its ends, and the floor in shadow.
  box(pc, 0, 36, 17, base, P.dirt)
  pc.hline(0, 17, 36, shade(P.dirt, 0.12))
  box(pc, 2, 37, 15, 42, P.soil)
  pc.hline(2, 15, 37, shade(P.soil, 0.12))
  pc.hline(2, 15, 39, shade(P.soil, -0.15))
  for (let x = 4; x <= 13; x += 3) pc.px(x, 38 + (x % 2), P.dirtDark)
  box(pc, 2, 42, 15, 44, shade(P.soil, -0.4))
  for (const x of [2, 14]) {
    pc.vline(x, 37, 44, P.steelLight)
    pc.vline(x + 1, 37, 44, P.steel)
  }
  if (puddle) pc.hline(8, 12, 44, P.water)
  pc.hline(1, 16, base - 1, shade(P.dirt, -0.12))
  // The excavator: tracks round their sprockets, the house on its slew ring, the cab in front.
  for (let y = 41; y <= base; y++) {
    const inset = y === 41 || y === base ? 1 : 0
    pc.hline(15 + inset, 31 - inset, y, P.rubber)
  }
  pc.hline(16, 30, 41, shade(P.rubber, 0.3))
  for (let x = 16; x <= 30; x += 2) pc.px(x, base, shade(P.rubber, 0.2))
  for (const x of [17.5, 29]) pc.ellipse(x, 43.5, 1.6, 1.6, P.metalDark)
  for (const x of [22, 25]) pc.px(x, 44, P.metalDark)
  box(pc, 19, 39, 28, 40, P.steelDark)
  box(pc, 17, 32, 31, 38, c)
  pc.hline(17, 31, 32, shade(c, 0.2))
  pc.hline(17, 31, 38, dark)
  pc.vline(31, 33, 38, dark)
  for (let x = 25; x <= 29; x += 2) pc.vline(x, 34, 36, shade(c, -0.2))
  for (let x = 17; x <= 31; x++) if (x % 4 < 2) pc.px(x, 37, shade(c, -0.12))
  pc.vline(28, 29, 31, P.metalDark)
  box(pc, 17, 25, 23, 33, c)
  pc.vline(17, 25, 33, shade(c, 0.15))
  pc.vline(23, 25, 33, dark)
  box(pc, 18, 26, 22, 31, o.lit ? P.windowLit : P.glass)
  if (o.lit) box(pc, 19, 27, 21, 30, P.windowLitCore)
  else {
    pc.px(19, 27, P.glassLight)
    pc.px(18, 28, P.glassLight)
  }
  if (!o.roof) return null
  // The cab's roof and beacon, then the boom and stick reaching down into the pit.
  pc.hline(16, 24, 24, dark)
  pc.px(20, 23, P.hiVis[1])
  const [kx, ky] = [9, 21]
  pc.line(17, 34, kx, ky, c)
  pc.line(18, 34, kx + 1, ky, c)
  pc.line(18, 35, kx + 1, ky + 1, dark)
  pc.line(19, 36, 13, 26, P.metal)
  pc.line(kx, ky, 6, 37, c)
  pc.line(kx + 1, ky, 7, 37, dark)
  pc.px(kx, ky - 1, shade(c, 0.2))
  // The bucket, teeth down in the dirt at the pit's floor.
  box(pc, 3, 38, 8, 41, P.steelDark)
  pc.hline(3, 8, 38, P.steel)
  pc.vline(3, 38, 41, P.steel)
  for (const x of [3, 5, 7]) pc.px(x, 42, P.metal)
  // Barrier tape across the near side, on pins, in the plot's colour.
  for (const x of [0, 16]) pc.vline(x, 42, base, P.metal)
  for (let x = 1; x <= 15; x++) pc.px(x, 43, Math.floor(x / 2) % 2 ? P.white : o.accent)
  return null
}

// ---------- core: a concrete lift core going up, 60 tall ----------

function core(pc, o) {
  const r = specRand('core', o.variant)
  const tone = Math.floor(r() * 2)
  const car = 30 + Math.floor(r() * 14)
  const paint = paintOf(o.roofs, tone)
  const base = 58
  const top = 16
  const [x0, x1] = [4, 21]
  // Floor after floor of cast concrete, each pour's tie holes and a doorway to the lift.
  box(pc, x0, top, x1, base - 1, P.concrete)
  for (let y = base - 1; y > top; y -= 7) {
    pc.hline(x0, x1, y - 6, P.concreteLight)
    pc.hline(x0, x1, y, P.concreteDark)
    for (let x = x0 + 2; x < x1; x += 4) pc.px(x, y - 3, P.concreteDark)
    const k = Math.round((base - 1 - y) / 7)
    const dx = k % 2 ? x0 + 3 : x1 - 7
    box(pc, dx, y - 5, dx + 3, y - 1, VOID)
    if (o.lit && k % 3 === 1) bulb(pc, dx + 1, y - 3)
  }
  pc.vline(x0, top, base - 1, P.concreteLight)
  pc.vline(x1, top, base - 1, P.concreteDark)
  pc.vline(x1 - 1, top, base - 1, shade(P.concrete, -0.1))
  // The construction hoist: its mast tied to the core, the car, the gate at its foot.
  const hx = 25
  for (let y = 12; y <= base; y++) {
    pc.px(hx, y, P.steelLight)
    pc.px(hx + 2, y, P.steelDark)
    if (y % 3 === 0) pc.px(hx + 1, y, P.steel)
  }
  for (let y = 20; y < base; y += 12) pc.hline(x1 + 1, hx - 1, y, P.steelDark)
  box(pc, 26, car, 31, car + 7, paint)
  pc.vline(31, car, car + 7, shade(paint, -0.3))
  pc.hline(26, 31, car, shade(paint, 0.2))
  pane(pc, 27, car + 2, 4, 3, o.lit)
  for (let y = base - 5; y <= base; y++) for (let x = 23; x <= 31; x++) if ((x + y) % 2 === 0 || y === base - 5) pc.px(x, y, P.metal)
  pc.hline(0, 31, base, P.concrete)
  const sc = { x0: 2, x1: 23, top: top - 1 }
  if (!o.roof) return sc
  // The next floor, fresh from its pour, inside the jump-form rig: forms in the plot's paint
  // round the top, a railed deck over them, and platforms hung below for the finishers.
  const deck = 8
  box(pc, x0, deck, x1, top, P.concreteLight)
  pc.vline(x1, deck, top, P.concreteDark)
  pc.vline(x1 - 1, deck, top, shade(P.concrete, -0.1))
  for (let x = x0 + 2; x < x1; x += 4) pc.px(x, top - 3, P.concrete)
  const forms = [x0 - 2, x1 + 2]
  box(pc, forms[0], deck + 1, forms[1], deck + 7, paint)
  for (let x = forms[0] + 2; x < forms[1]; x += 3) pc.vline(x, deck + 1, deck + 7, shade(paint, -0.15))
  pc.vline(forms[0], deck + 1, deck + 7, shade(paint, 0.18))
  pc.vline(forms[1], deck + 1, deck + 7, shade(paint, -0.35))
  pc.hline(forms[0], forms[1], deck + 7, shade(paint, -0.3))
  box(pc, x0 + 5, deck + 3, x1 - 5, deck + 5, o.accent)
  pc.hline(x0 + 7, x1 - 7, deck + 4, P.white)
  for (const y of [deck, top + 5]) pc.hline(forms[0] - 1, forms[1] + 1, y, P.steelDark)
  for (const y of [deck - 3, top + 2]) pc.hline(forms[0] - 1, forms[1] + 1, y, P.metal)
  for (const x of [forms[0] - 1, forms[1] + 1]) {
    pc.vline(x, deck - 3, deck, P.metal)
    pc.vline(x, top + 2, top + 5, P.metal)
    pc.line(x, top + 5, x + (x < 16 ? 2 : -2), top + 7, P.steelDark)
  }
  // Rebar standing up out of the forms for the pour after this one.
  for (let x = x0 + 1; x < x1; x += 3) pc.vline(x, deck - 4, deck - 1, P.rebar)
  return sc
}

// ---------- glazing: a low block getting its curtain wall ----------

function glazing(pc, o) {
  const r = specRand('glazing', o.variant)
  const flip = r() < 0.5
  const done = 0.4 + r() * 0.35
  const rack = r() < 0.6
  const tone = Math.floor(r() * 2)
  const base = 46
  const y0 = 24
  const mid = 35
  box(pc, 2, y0 + 2, 29, base - 1, VOID)
  const n = Math.round(27 * done)
  const [a, b] = flip ? [29 - n, 29] : [2, 2 + n]
  for (let y = y0 + 2; y < base; y++) {
    for (let x = 2; x <= 29; x++) {
      const mullion = (x - 2) % 5 === 0 || x === 29
      const upper = y < mid
      const glazed = (x >= a && x <= b) || (!upper && x >= (flip ? a - 5 : a) && x <= (flip ? b : b + 5))
      if (mullion) pc.px(x, y, glazed ? P.steelLight : P.steel)
      else if (glazed) {
        const litPane = o.lit && Math.floor((x - 2) / 5) % 2 === 0
        pc.px(x, y, litPane ? P.windowLit : (x + y) % 6 === 0 || (x + y) % 6 === 1 ? P.glassLight : P.glass)
      }
    }
  }
  pc.hline(2, 29, mid, P.steelLight)
  pc.hline(2, 29, mid + 1, P.steel)
  // Brackets waiting on the slab edge where the next panels go.
  for (let x = flip ? 4 : 17; x < (flip ? 14 : 28); x += 5) pc.px(x, y0 + 3, P.metal)
  if (rack) {
    // A stillage of panels waiting to go up, stood on edge in their steel frame.
    const rx = flip ? 4 : 20
    box(pc, rx, base - 8, rx + 7, base - 1, P.steelDark)
    for (let x = rx + 1; x <= rx + 6; x++) pc.vline(x, base - 7 + (x % 2), base - 2, x % 2 ? P.glass : P.glassLight)
    pc.hline(rx, rx + 7, base - 8, P.steelLight)
  }
  pc.hline(1, 30, base, P.concrete)
  const sc = { x0: 1, x1: 30, top: y0 - 1 }
  if (!o.roof) return sc
  // The roof slab's edge and parapet, the plot's banner on it, and a spider crane lowering a panel
  // on its suction lifter.
  pc.hline(1, 30, y0, P.concreteLight)
  pc.hline(1, 30, y0 + 1, P.concrete)
  pc.hline(1, 30, y0 - 1, P.steelDark)
  const bx = flip ? 18 : 5
  box(pc, bx, y0 - 5, bx + 8, y0 - 2, o.accent)
  pc.hline(bx + 2, bx + 6, y0 - 4, P.white)
  pc.vline(bx, y0 - 5, y0 - 2, P.metalDark)
  pc.vline(bx + 8, y0 - 5, y0 - 2, P.metalDark)
  const cx = flip ? 6 : 25
  const paint = paintOf(o.roofs, tone)
  box(pc, cx - 2, y0 - 3, cx + 2, y0 - 1, paint)
  const tip = flip ? cx + 6 : cx - 6
  pc.line(cx, y0 - 3, tip, y0 - 10, paint)
  pc.vline(tip, y0 - 9, y0 + 3, P.metalDark)
  box(pc, tip - 2, y0 + 4, tip + 2, y0 + 4, P.steelDark)
  box(pc, tip - 2, y0 + 5, tip + 2, y0 + 9, P.glass)
  pc.px(tip - 1, y0 + 6, P.glassLight)
  return sc
}

// ---------- pallets: a materials yard ----------

/** A timber pallet under a load, from x0 to x1, its deck on row y. */
function pallet(pc, x0, x1, y) {
  pc.hline(x0, x1, y, P.woodLight)
  pc.hline(x0, x1, y + 1, P.woodDark)
  for (let x = x0; x <= x1; x += 4) pc.px(x, y + 1, P.wood)
}

/** A pack of bricks (or blocks) on its pallet, shrink-wrapped and strapped, sitting on row y1. */
function pack(pc, x0, x1, y1, blocks, strap, rand) {
  const y0 = y1 - 8
  if (blocks) {
    for (let y = y0; y <= y1 - 2; y++) {
      for (let x = x0; x <= x1; x++) {
        const course = Math.floor((y - y0) / 2)
        const joint = (y - y0) % 2 === 1 || (x - x0 + (course % 2 ? 3 : 0)) % 5 === 4
        pc.px(x, y, joint ? P.concrete : P.concreteLight)
      }
    }
    pc.vline(x1, y0, y1 - 2, P.concreteDark)
  } else brickwork(pc, x0, y0, x1, y1 - 2, rand)
  const face = blocks ? P.concreteLight : P.brick
  pc.hline(x0, x1, y0, shade(face, 0.3))
  pc.line(x0 + 1, y0 + 2, x0 + 4, y0 + 5, shade(face, 0.3))
  for (const x of [x0 + 3, x1 - 3]) pc.vline(x, y0, y1 - 2, strap)
  pallet(pc, x0, x1, y1 - 1)
}

/** What a materials yard keeps, each with a part that goes on last (its "roof"). */
const YARD = {
  bricks: {
    body: (pc, x0, x1, base, o) => pack(pc, x0 + 1, x1 - 1, base, false, shade(o.accent, -0.1), o.rand),
    top: (pc, x0, x1, base, o) => pack(pc, x0 + 1, x1 - 1, base - 9, false, shade(o.accent, -0.1), o.rand),
  },
  blocks: {
    body: (pc, x0, x1, base, o) => pack(pc, x0 + 1, x1 - 1, base, true, o.accent, o.rand),
    top: (pc, x0, x1, base, o) => pack(pc, x0 + 1, x1 - 1, base - 9, true, o.accent, o.rand),
  },
  timber: {
    // Sawn timber on bearers, the ends showing; a tarp in the plot's colour tied over it at the end
    // of the day.
    body(pc, x0, x1, base) {
      for (let y = base - 7; y <= base - 2; y++) {
        for (let x = x0; x <= x1; x++) pc.px(x, y, (x - x0) % 3 === 2 || (y - base) % 2 === 0 ? P.wood : P.woodLight)
      }
      pc.hline(x0, x1, base - 7, P.woodLight)
      for (const x of [x0 + 1, x1 - 2]) box(pc, x, base - 1, x + 1, base, P.woodDark)
    },
    top(pc, x0, x1, base, o) {
      for (let x = x0 - 1; x <= x1 + 1; x++) {
        const end = x < x0 + 1 || x > x1 - 1
        const y0 = base - 9 + (x === x0 - 1 || x === x1 + 1 ? 1 : 0)
        const y1 = end ? base - 2 : base - 5 + ((x - x0) % 5 === 2 ? 1 : 0)
        pc.vline(x, y0, y1, (x - x0) % 5 === 4 ? shade(o.accent, -0.22) : o.accent)
      }
      pc.hline(x0, x1, base - 9, shade(o.accent, 0.25))
      pc.vline(x1 + 1, base - 7, base - 2, shade(o.accent, -0.3))
      for (const x of [x0 + 3, x1 - 3]) pc.vline(x, base - 9, base - 4, P.stoneLight)
    },
  },
  pipes: {
    // Pipes lying on bearers, stacked, their bores capped in the plot's colour.
    body(pc, x0, x1, base, o) {
      const pipe = o.variant % 2 ? P.sitePaint[2] : P.sitePaint[6]
      pipeRow(pc, x0, x1, base - 3, pipe, o.accent)
      pipeRow(pc, x0 + 1, x1 - 1, base - 6, pipe, o.accent)
      for (const x of [x0 + 2, x1 - 3]) pc.px(x, base, P.woodDark)
    },
    top(pc, x0, x1, base, o) {
      pipeRow(pc, x0 + 2, x1, base - 9, o.variant % 2 ? P.sitePaint[2] : P.sitePaint[6], o.accent)
    },
  },
  skip: {
    // A skip in the plot's paint, its hire firm's sign on the side, heaped with rubble.
    body(pc, x0, x1, base, o) {
      const k = paintOf(o.roofs, 0)
      for (let y = base - 7; y <= base - 1; y++) {
        const inset = Math.round((y - (base - 7)) / 3)
        pc.hline(x0 - 1 + inset, x1 + 1 - inset, y, y === base - 7 ? shade(k, 0.25) : (y === base - 6 ? shade(k, -0.2) : k))
      }
      for (let x = x0 + 2; x < x1; x += 3) pc.vline(x, base - 5, base - 2, shade(k, -0.12))
      pc.vline(x1 + 1, base - 7, base - 5, shade(k, -0.35))
      for (const x of [x0 - 1, x1 + 1]) pc.px(x, base - 4, P.metalDark)
      const xm = Math.round((x0 + x1) / 2)
      box(pc, xm - 2, base - 5, xm + 2, base - 3, o.accent)
      pc.hline(xm - 1, xm + 1, base - 4, P.white)
      pc.hline(x0 + 1, x1 - 1, base, P.rubber)
    },
    top(pc, x0, x1, base, o) {
      const bits = [P.stone, P.brick, P.concreteLight, P.woodLight, P.stoneDark, P.brickDark]
      for (let x = x0; x <= x1; x++) {
        const h = 1 + Math.round(2 * Math.sin(((x - x0) / (x1 - x0)) * Math.PI))
        for (let y = base - 7 - h; y < base - 7; y++) pc.px(x, y, bits[Math.floor(o.rand() * bits.length)])
      }
      pc.line(x0 + 3, base - 11, x0 + 8, base - 9, P.woodLight)
    },
  },
  bag: {
    // A bulk bag of sand on a pallet, its lifting loops up and the maker's label on it.
    body(pc, x0, x1, base, o) {
      box(pc, x0 + 2, base - 10, x1 - 2, base - 2, P.cladWhite)
      pc.vline(x0 + 2, base - 10, base - 2, P.white)
      pc.vline(x1 - 2, base - 10, base - 2, shade(P.cladWhite, -0.2))
      pc.vline(Math.round((x0 + x1) / 2), base - 9, base - 2, shade(P.cladWhite, -0.08))
      for (let x = x0 + 3; x < x1 - 2; x++) pc.px(x, base - 3, shade(P.cladWhite, -0.1))
      box(pc, x0 + 4, base - 7, x0 + 7, base - 5, o.accent)
      pallet(pc, x0 + 1, x1 - 1, base - 1)
    },
    top(pc, x0, x1, base) {
      for (const x of [x0 + 2, x1 - 2]) pc.px(x, base - 11, shade(P.cladWhite, -0.15))
      pc.hline(x0 + 4, x1 - 4, base - 11, P.pathDark)
      pc.hline(x0 + 5, x1 - 5, base - 12, P.path)
    },
  },
}

/** One layer of pipes seen side on, the bore at the right-hand end capped in `cap`. */
function pipeRow(pc, x0, x1, y0, c, cap) {
  pc.hline(x0, x1 - 1, y0, shade(c, 0.25))
  pc.hline(x0, x1 - 1, y0 + 1, c)
  pc.hline(x0, x1 - 1, y0 + 2, shade(c, -0.25))
  pc.vline(x1, y0, y0 + 2, shade(c, 0.1))
  pc.px(x1, y0 + 1, cap)
}

const YARD_LAYOUTS = [
  ['bricks', 'timber'], ['timber', 'pipes'], ['bricks', 'skip'], ['bag', 'timber'], ['pipes', 'blocks'],
  ['skip', 'timber'], ['blocks', 'bag'], ['timber', 'bricks'], ['pipes', 'skip'],
]

function pallets(pc, o) {
  const r = specRand('pallets', o.variant)
  const layout = pick(r, YARD_LAYOUTS)
  const extra = pick(r, ['cone', 'bucket', 'rebar', 'none'])
  const tower = r() < 0.55
  const base = 46
  const slots = [[1, 14], [17, 30]]
  if (tower) {
    // A lighting tower on its trailer behind everything, its mast up and its lamps on at night.
    const paint = paintOf(o.roofs, 1)
    box(pc, 12, 38, 19, 42, paint)
    pc.hline(12, 19, 38, shade(paint, 0.2))
    pc.vline(15, 21, 37, P.metal)
    pc.vline(16, 21, 37, P.metalDark)
    box(pc, 11, 18, 20, 20, P.steelDark)
    for (const x of [12, 15, 18]) box(pc, x, 18, x + 1, 19, o.lit ? P.windowLitCore : P.windowShine)
  }
  layout.forEach((item, i) => YARD[item].body(pc, slots[i][0], slots[i][1], base, o))
  // Something lying about in front.
  if (extra === 'cone') cone(pc, 15, base)
  else if (extra === 'bucket') bucket(pc, 12, base)
  else if (extra === 'rebar') {
    pc.hline(11, 20, base - 1, P.rebar)
    pc.hline(12, 21, base, shade(P.rebar, -0.2))
    pc.px(14, base - 1, P.metal)
    pc.px(18, base, P.metal)
  }
  if (!o.roof) return null
  layout.forEach((item, i) => YARD[item].top(pc, slots[i][0], slots[i][1], base, o))
  return null
}

// ---------- drawing one ----------

const KINDS = { frame, cabin, containers, shed, crane, mixer, loos, digger, core, glazing, pallets }
/** Nothing to climb: these go up without scaffolding. */
const NO_SCAFFOLD = new Set(['loos', 'digger', 'pallets'])

/**
 * @param {{ kind: string, stage: number, accent: string, variant: number, lit: boolean, frame?: number, wall?: number, roofs?: number, low?: boolean, wear?: number }} o
 */
export function drawSiteBuilding(o) {
  const kind = KINDS[o.kind] ? o.kind : 'frame'
  const variant = o.variant || 0
  const H = heightOf(kind)
  const pc = new PixelCanvas(BUILDING_W, H)
  const seed = variant * 7919 + 17
  if (o.stage <= 1) {
    site(pc, mulberry32(seed), o.stage, H - 48, variant)
    return pc.outline(P.outline)
  }
  const draw = KINDS[kind]
  const frameNo = o.frame || 0
  const opts = {
    rand: mulberry32(seed), accent: o.accent || P.sitePaint[0], lit: Boolean(o.lit), roof: o.stage >= 3, frame: frameNo, variant,
    wall: o.wall || 0, roofs: o.roofs || 0, low: Boolean(o.low),
  }
  const sc = draw(pc, opts)
  if (o.stage === 2 && !NO_SCAFFOLD.has(kind) && sc) {
    if (kind === 'crane') climbingFrame(pc)
    else scaffold(pc, sc.x0, sc.x1, Math.max(opts.low ? DOORSTEP_CLEAR + 1 : 0, sc.top), H - 2)
  }
  const look = o.stage >= 3 ? lookFor(o.wear ?? KEPT) : null
  if (look) {
    // As the village's: roof told from walls by the building drawn without it, whatever moves
    // between frames left alone, every drawing given the same texture stream as the first.
    const again = (roof, f) => {
      const other = new PixelCanvas(BUILDING_W, H)
      draw(other, { ...opts, rand: mulberry32(seed), roof, frame: f })
      return other
    }
    const frames = buildingFrames(kind, o.stage)
    const others = []
    for (let f = 0; f < frames; f++) if (f !== frameNo % frames) others.push(again(true, f))
    weather(pc, again(false, 0), look, variant, others)
  }
  return pc.outline(P.outline)
}
