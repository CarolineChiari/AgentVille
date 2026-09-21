// A contact sheet of a theme's art, as a PNG, drawn under Node with no browser: a small plot in
// each of its sub-themes, then every building at every stage, every landmark tier, every fence
// join, the ground, finished work (the village's flowers), and villagers in their work clothes.
// For working on a theme: draw, look, adjust, draw again.
//
//   npm run sheet -- [theme] [--only plots,buildings,landmarks,fences,ground,finished,villagers,rooms] [--scale 3] [--out file.png]
//
// Writes data/sheets/<theme>.png unless --out says otherwise, and prints what each band shows.
// The plots are composed the way the renderer bakes a chunk, less the night, the weather and the
// animation; they are close, not exact. For the real thing, open the app with ?demo&theme=<id>.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { encodePng } from './png.mjs'
import { generate } from '../src/render/sprites/registry.js'
import { PixelCanvas } from '../src/render/sprites/pixel.js'
import { ACCENTS, PALETTE as P, PETALS } from '../src/render/sprites/palette.js'
import { LINK, tileVariant } from '../src/render/sprites/tiles.js'
import { BUILDING_W } from '../src/render/sprites/buildings.js'
import { VILLAGER_H } from '../src/render/sprites/villagers.js'
import { lawnTone, tintMeadow } from '../src/render/ground.js'
import { landmarkShapes, packFor } from '../src/render/themes/index.js'
import { MAX_TIER } from '../src/sim/progress.js'
import { THEMES, THEME_IDS, dress, landmarkWords } from '../src/sim/themes.js'
import { KINDS } from '../src/sim/building.js'
import { DECO, TILE } from '../src/sim/plot.js'
import { hashString } from '../src/sim/rng.js'
import { lookFor } from '../src/sim/villager.js'
import { FLOWER_KINDS, WORK } from '../src/sim/flowers.js'
import { WEAR } from '../src/sim/wear.js'
import { World } from '../src/sim/world.js'
import { roomFrame } from '../src/sim/room.js'
import { interiorsOf } from '../src/sim/interiors.js'
import { PROP_PLACE, propVariant } from '../src/render/room.js'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const T = 16
const GAP = 8
const SECTIONS = ['plots', 'buildings', 'landmarks', 'fences', 'ground', 'finished', 'villagers', 'rooms']

const TILE_NAME = {
  [TILE.WILD]: 'wild', [TILE.YARD]: 'yard', [TILE.ROAD]: 'road', [TILE.PLAZA]: 'plaza', [TILE.BED]: 'bed',
  [TILE.TRAIL]: 'trail', [TILE.WATER]: 'water',
}
const FENCE = new Set([DECO.FENCE_H, DECO.FENCE_V, DECO.POST])
const DECO_NAME = {
  [DECO.FLOWERS]: 'flowers', [DECO.PEBBLES]: 'pebbles', [DECO.TALLGRASS]: 'tallgrass', [DECO.CLOVER]: 'clover', [DECO.MUSHROOMS]: 'mushrooms',
  [DECO.REEDS]: 'reeds', [DECO.LILYPAD]: 'lilypad',
}
const SIDES = [[0, -1], [1, 0], [0, 1], [-1, 0]]
const SIDE_LINK = [LINK.N, LINK.E, LINK.S, LINK.W]
const PAVED = new Set([TILE.ROAD, TILE.PLAZA])
const PATHS = new Set([TILE.TRAIL, TILE.ROAD, TILE.PLAZA])
const FRINGE_FROM = { [TILE.WILD]: 'wild', [TILE.YARD]: 'yard', [TILE.TRAIL]: 'yard' }
const MOUTH = [4, 11]

// ---------- drawing into a PixelCanvas ----------

/** `src` over `dst` at (x, y), honouring its alpha. */
function blit(dst, src, x, y, alpha = 1) {
  for (let j = 0; j < src.h; j++) {
    for (let i = 0; i < src.w; i++) {
      const s = (j * src.w + i) * 4
      const a = (src.data[s + 3] / 255) * alpha
      const dx = x + i
      const dy = y + j
      if (!a || dx < 0 || dy < 0 || dx >= dst.w || dy >= dst.h) continue
      const d = (dy * dst.w + dx) * 4
      for (let k = 0; k < 3; k++) dst.data[d + k] = Math.round(src.data[s + k] * a + dst.data[d + k] * (1 - a))
      dst.data[d + 3] = 255
    }
  }
}

/** A sprite in `theme`: the pack's own if it draws one, else the village's. */
const sprite = (theme, name, frame = 0, params = {}) => generate(name, frame, { ...params, theme })

/** Panels one under the other, `GAP` apart, on the backdrop. */
function stack(panels) {
  const w = Math.max(...panels.map((p) => p.w)) + GAP * 2
  const h = panels.reduce((n, p) => n + p.h + GAP, GAP)
  const out = new PixelCanvas(w, h)
  out.rect(0, 0, w, h, P.labelInk)
  let y = GAP
  for (const p of panels) {
    blit(out, p, GAP, y)
    y += p.h + GAP
  }
  return out
}

/** Panels side by side. */
function row(panels, gap = GAP) {
  const w = panels.reduce((n, p) => n + p.w + gap, -gap)
  const h = Math.max(...panels.map((p) => p.h))
  const out = new PixelCanvas(Math.max(1, w), h)
  let x = 0
  for (const p of panels) {
    blit(out, p, x, h - p.h)
    x += p.w + gap
  }
  return out
}

/** A `w`×`h` px patch of a theme's plot ground, in its tone. */
function ground(theme, tone, w, h) {
  const pc = new PixelCanvas(w, h)
  for (let y = 0; y < h; y += T) for (let x = 0; x < w; x += T) blit(pc, sprite(theme, `tile.yard.${tileVariant('yard', hashString(`${x},${y}`))}`, 0, { tone }), x, y)
  return pc
}

// ---------- a plot, as the renderer bakes one ----------

function plotPanel(theme, sub) {
  const pack = packFor(theme)
  const B = pack.buildings
  const world = new World()
  const repo = `sheet-${sub}`
  // `picks` takes looks ({ theme, sub }), not bare sub-theme ids; the third argument is the one
  // that puts every folder in one sub-theme, which is what a panel of this band is.
  world.setTheme(theme, new Map(), sub)
  // Each sub-theme's plot shows a different tier of landmark, the tallest first.
  const tier = Math.max(0, MAX_TIER - THEMES[theme].subthemes.findIndex((s) => s.id === sub))
  const statuses = ['working', 'idle', 'waiting', 'working', 'sleeping']
  const threads = statuses.map((status, i) => ({ id: `sheet:${theme}:${sub}:${i}`, project: repo, createdAt: i, status, known: true, wear: [0, 1, 2, 1, 4][i] }))
  const gardens = new Map([[repo, Array.from({ length: 12 }, (_, i) => ({ id: `f${i}`, kind: i % FLOWER_KINDS.length, color: i, open: i === 11 }))]])
  world.setRoster(threads, undefined, gardens, new Map([[repo, [{ id: 'a' }, { id: 'b' }, { id: 'c' }]]]), new Map([[repo, tier]]))
  // Show a building going up and one just set out, as well as finished ones.
  const [, , , going, setOut] = threads.map((t) => world.buildings.get(t.id))
  if (going) going.progress = 0.6
  if (setOut) setOut.progress = 0.3
  const frame = world.snapshot()
  const plot = frame.plots[0]
  const map = frame.map
  const style = plot.style
  const tone = style.yard
  const cx = Math.min(...plot.cells.map((c) => c[0]))
  const cy = Math.min(...plot.cells.map((c) => c[1]))
  const cw = Math.max(...plot.cells.map((c) => c[0])) - cx + 1
  const ch = Math.max(...plot.cells.map((c) => c[1])) - cy + 1
  const x0 = cx * 12
  const y0 = cy * 12
  const pc = new PixelCanvas(cw * 12 * T, ch * 12 * T)
  const underfoot = new Set()
  for (const b of frame.buildings) for (let dy = 0; dy < b.h; dy++) for (let dx = 0; dx < b.w; dx++) underfoot.add(`${b.x + dx},${b.y + dy}`)
  for (const b of frame.boards) underfoot.add(`${b.tx},${b.ty}`)
  for (const l of frame.landmarks) for (let dy = 0; dy < l.h; dy++) for (let dx = 0; dx < l.w; dx++) underfoot.add(`${l.x + dx},${l.y + dy}`)
  const tileAt = (x, y) => map.tileAt(x, y)
  const decoAt = (x, y) => map.decoAt(x, y)
  const fill = (x, y, w, h, c) => pc.rect(x, y, w, h, c)

  for (let ly = 0; ly < ch * 12; ly++) {
    for (let lx = 0; lx < cw * 12; lx++) {
      const x = x0 + lx
      const y = y0 + ly
      const kind = tileAt(x, y)
      const name = TILE_NAME[kind]
      const variant = kind === TILE.BED ? (tileAt(x, y - 1) === TILE.BED ? 1 : 0) : tileVariant(name, hashString(`${x},${y}`))
      let params = {}
      if (kind === TILE.TRAIL) {
        let links = 0
        SIDES.forEach(([dx, dy], side) => PATHS.has(tileAt(x + dx, y + dy)) && (links |= SIDE_LINK[side]))
        params = { links, tone }
      } else if (kind === TILE.YARD || kind === TILE.BED) params = { tone }
      blit(pc, sprite(theme, `tile.${name}.${variant}`, 0, params), lx * T, ly * T)
      if (kind === TILE.YARD && !decoAt(x, y) && !underfoot.has(`${x},${y}`)) {
        const cover = pack.cover(x, y, tone)
        if (cover) blit(pc, sprite(theme, `deco.${cover.kind}.${cover.variant}`, 0, { tone }), lx * T, ly * T)
      }
      if (PAVED.has(kind)) {
        SIDES.forEach(([dx, dy], side) => {
          const next = tileAt(x + dx, y + dy)
          if (PAVED.has(next)) return
          const mouth = next === TILE.TRAIL
          const ex = lx * T + (dx > 0 ? T - 1 : 0)
          const ey = ly * T + (dy > 0 ? T - 1 : 0)
          for (const [a, b] of mouth ? [[0, MOUTH[0] - 1], [MOUTH[1] + 1, T - 1]] : [[0, T - 1]]) {
            if (dx) fill(ex, ly * T + a, 1, b - a + 1, pack.edges.road)
            else fill(lx * T + a, ey, b - a + 1, 1, pack.edges.road)
          }
          const from = FRINGE_FROM[next]
          if (!from) return
          const k = hashString(`e${x},${y},${side}`) & 1
          blit(pc, sprite(theme, `deco.fringe.${(mouth ? 8 : 0) + side * 2 + k}`, 0, from === 'yard' ? { ground: from, tone } : { ground: from }), lx * T, ly * T)
        })
      }
      if (kind === TILE.BED) {
        const edge = pack.edges.bed
        if (tileAt(x, y - 1) !== TILE.BED) fill(lx * T, ly * T, T, 2, edge)
        if (tileAt(x, y + 1) !== TILE.BED) fill(lx * T, ly * T + T - 2, T, 2, edge)
        if (tileAt(x - 1, y) !== TILE.BED) fill(lx * T, ly * T, 1, T, edge)
        if (tileAt(x + 1, y) !== TILE.BED) fill(lx * T + T - 1, ly * T, 1, T, edge)
      }
    }
  }
  for (let ly = 0; ly < ch * 12; ly++) {
    for (let lx = 0; lx < cw * 12; lx++) {
      const d = decoAt(x0 + lx, y0 + ly)
      if (!d) continue
      if (FENCE.has(d)) {
        let mask = 0
        SIDES.forEach(([dx, dy], side) => FENCE.has(decoAt(x0 + lx + dx, y0 + ly + dy)) && (mask |= SIDE_LINK[side]))
        blit(pc, sprite(theme, `fence.${style.fence}.${mask}`), lx * T, ly * T)
        blit(pc, sprite(theme, `deco.verge.${mask}`, 0, { tone }), lx * T, ly * T)
      } else if (DECO_NAME[d]) blit(pc, sprite(theme, `deco.${DECO_NAME[d]}.0`), lx * T, ly * T)
    }
  }
  const img = { data: pc.data }
  tintMeadow(img.data, pc.w, pc.h, x0 * T, y0 * T, pack.patches(tone), lawnTone)

  // Everything that stands up, back to front.
  const items = []
  for (const b of frame.buildings) items.push([b.y + b.h - 0.05, () => {
    const { kind, low } = B.fitted(b.kind, b.variant, b.roomy !== false)
    const H = B.heightOf(kind, b.variant, low)
    const wear = b.stage >= 3 ? b.wear : 1
    const img = sprite(theme, `building.${kind}.${b.stage}`, 0, { accent: ACCENTS[b.accent % ACCENTS.length], variant: b.variant, lit: false, wall: style.wall, roofs: style.roofs, low, wear })
    const shadow = b.stage >= 2 ? B.shadowOf(kind) : 0
    const px = (b.x - x0) * T
    const py = (b.y - y0 + b.h) * T
    if (shadow) blit(pc, generate(`fx.shadow.${shadow}x6`, 0, {}), px + (b.w * T - shadow) / 2, py - 4)
    blit(pc, img, px + (b.w * T - BUILDING_W) / 2, py - H)
  }])
  for (const f of frame.flowers) items.push([f.y, () => {
    const color = PETALS[f.color % PETALS.length]
    blit(pc, sprite(theme, `flower.${f.kind}.${f.open ? 1 : 2}`, 0, { color }), Math.round((f.x - x0) * T - 4), Math.round((f.y - y0) * T - 11))
  }])
  for (const b of frame.boards) items.push([b.y, () => blit(pc, sprite(theme, `static.board.${Math.min(6, b.count)}`), (b.x - x0) * T - 8, (b.y - y0) * T - 22)])
  // What the plot's landmark has brought, standing in its fence line.
  for (const st of frame.statics) {
    if (st.plot !== repo) continue
    items.push([st.y, () => {
      const img = sprite(theme, `static.${st.sprite}.${st.variant || 0}`, 0, { lit: false })
      blit(pc, img, Math.round((st.x - x0) * T - img.w / 2), Math.round((st.y - y0) * T - img.h))
    }])
  }
  const L = landmarkShapes(theme)
  for (const l of frame.landmarks) items.push([l.y + l.h - 0.05, () => {
    const H = L.heightOf(l.tier)
    const img = sprite(theme, `landmark.${l.tier}.${l.stage}`, 0, { accent: ACCENTS[l.accent % ACCENTS.length], variant: l.variant, lit: false, busy: true, wall: style.wall, roofs: style.roofs })
    const shadow = l.stage >= 2 ? L.shadowOf(l.tier) : 0
    const px = (l.x - x0) * T
    const py = (l.y - y0 + l.h) * T
    if (shadow) blit(pc, generate(`fx.shadow.${shadow}x6`, 0, {}), px + (l.w * T - shadow) / 2, py - 4)
    blit(pc, img, px + (l.w * T - BUILDING_W) / 2, py - H)
  }])
  threads.forEach((t, i) => {
    const b = world.buildings.get(t.id)
    if (!b) return
    const fx = b.front.x + (i % 2 ? 0.6 : -0.4)
    const fy = b.front.y
    const anim = t.status === 'working' ? 'hammer' : t.status === 'sleeping' ? 'sit' : 'idle'
    items.push([fy, () => {
      blit(pc, generate('fx.shadow.10', 0, {}), Math.round((fx - x0) * T - 5), Math.round((fy - y0) * T - 2))
      blit(pc, sprite(theme, `villager.${anim}.s`, i % 2, { look: dress(lookFor(t.id), theme, sub) }), Math.round((fx - x0) * T - 8), Math.round((fy - y0) * T - VILLAGER_H + 1))
    }])
  })
  items.sort((a, b) => a[0] - b[0])
  for (const [, draw] of items) draw()
  return pc
}

// ---------- the bands ----------

function plots(theme) {
  return row(THEMES[theme].subthemes.map((s) => plotPanel(theme, s.id)))
}

/** Every kind a thread builds, a row each: stages 0–2, finished in five looks, lit, its frames, every grade of wear, and down a courtyard's side. */
function buildings(theme) {
  const { dims } = THEMES[theme]
  const B = packFor(theme).buildings
  const rows = []
  for (const kind of KINDS) {
    const cells = []
    const cell = (drawn, stage, o = {}) => {
      const variant = o.variant ?? 1
      const low = o.low ?? false
      const H = B.heightOf(drawn, variant, low)
      const pc = ground(theme, 0, 36, 66)
      const img = sprite(theme, `building.${drawn}.${stage}`, o.frame || 0, {
        accent: ACCENTS[variant % ACCENTS.length], variant, lit: Boolean(o.lit), wall: variant % dims.wall.length, roofs: variant % dims.roofs, low, wear: o.wear ?? 1,
      })
      blit(pc, img, 2, 66 - 2 - H)
      cells.push(pc)
    }
    const own = B.fitted(kind, 1, true).kind
    for (const stage of [0, 1, 2]) cell(own, stage)
    for (let v = 0; v < 5; v++) cell(own, 3, { variant: v + 2 })
    cell(own, 3, { lit: true })
    for (let f = 1; f < B.frames(own, 3); f++) cell(own, 3, { frame: f })
    for (let w = 0; w < WEAR.length; w++) cell(own, 3, { variant: 7, wear: w })
    const side = B.fitted(kind, 3, false)
    cell(side.kind, 3, { variant: 3, low: side.low })
    rows.push(row(cells, 2))
  }
  return stack(rows)
}

/** Each style of fence: all sixteen joins, then a small ring of it with a gap either side. */
function fences(theme) {
  const rows = []
  THEMES[theme].dims.fence.forEach((_, style) => {
    const joins = ground(theme, 0, 16 * T, T)
    for (let mask = 0; mask < 16; mask++) blit(joins, sprite(theme, `fence.${style}.${mask}`), mask * T, 0)
    const W = 8
    const H = 4
    const ring = ground(theme, style % THEMES[theme].dims.yard.length, W * T, H * T)
    const on = (x, y) => x >= 0 && y >= 0 && x < W && y < H && (x === 0 || y === 0 || x === W - 1 || y === H - 1) && !(y === 0 && x === 3) && !(y === H - 1 && x === 5)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!on(x, y)) continue
        let mask = 0
        SIDES.forEach(([dx, dy], side) => on(x + dx, y + dy) && (mask |= SIDE_LINK[side]))
        blit(ring, sprite(theme, `fence.${style}.${mask}`), x * T, y * T)
        blit(ring, sprite(theme, `deco.verge.${mask}`, 0, { tone: style % THEMES[theme].dims.yard.length }), x * T, y * T)
      }
    }
    rows.push(row([joins, ring]))
  })
  return stack(rows)
}

/** Each ground: its tiles, footpaths, road, fringes, what lies about on it, and a stretch of it as a plot shows it. */
function groundBand(theme) {
  const pack = packFor(theme)
  const rows = []
  THEMES[theme].dims.yard.forEach((_, tone) => {
    const tiles = []
    for (let v = 0; v < 6; v++) tiles.push(sprite(theme, `tile.yard.${v}`, 0, { tone }))
    for (const links of [LINK.N | LINK.S, LINK.E | LINK.W, 15, LINK.N | LINK.E, LINK.S]) tiles.push(sprite(theme, `tile.trail.${links % 4}`, 0, { links, tone }))
    for (let v = 0; v < 6; v++) tiles.push(sprite(theme, `tile.road.${v}`))
    for (let v = 0; v < 16; v++) {
      const pc = new PixelCanvas(T, T)
      blit(pc, sprite(theme, 'tile.road.0'), 0, 0)
      blit(pc, sprite(theme, `deco.fringe.${v}`, 0, { ground: 'yard', tone }), 0, 0)
      tiles.push(pc)
    }
    const kinds = new Map()
    for (let y = 0; y < 60; y++) for (let x = 0; x < 60; x++) {
      const c = pack.cover(x, y, tone)
      if (c) kinds.set(`${c.kind}.${c.variant}`, c)
    }
    for (const k of [...kinds.keys()].sort()) {
      const pc = ground(theme, tone, T, T)
      blit(pc, sprite(theme, `deco.${k}`, 0, { tone }), 0, 0)
      tiles.push(pc)
    }
    // A stretch of it: tiles by their weights, what lies about, and its patches.
    const W = 16
    const H = 5
    const stretch = new PixelCanvas(W * T, H * T)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      blit(stretch, sprite(theme, `tile.yard.${tileVariant('yard', hashString(`${x},${y}`))}`, 0, { tone }), x * T, y * T)
      const c = pack.cover(x, y, tone)
      if (c) blit(stretch, sprite(theme, `deco.${c.kind}.${c.variant}`, 0, { tone }), x * T, y * T)
    }
    tintMeadow(stretch.data, stretch.w, stretch.h, 0, 0, pack.patches(tone), lawnTone)
    rows.push(stack([row(tiles, 1), stretch]))
  })
  return stack(rows)
}

/**
 * Finished work, a row per kind of work: each of its kinds sprouting, as an open PR's bud, and
 * finished in three colours, then white (an unlabeled PR), on the plot's field.
 */
function finished(theme) {
  const rows = WORK.map((w) => {
    const cells = []
    FLOWER_KINDS.forEach((k, kind) => {
      if (k.work !== w.id) return
      const shows = [[0, 0], [1, 3], [2, 0], [2, 5], [2, 9], [2, -1]]
      for (const [stage, c] of shows) {
        const pc = new PixelCanvas(12, 16)
        blit(pc, sprite(theme, `tile.bed.1`, 0, { tone: 0 }), -2, 0)
        blit(pc, sprite(theme, `flower.${kind}.${stage}`, 0, { color: c < 0 ? P.petalWhite : PETALS[c % PETALS.length] }), 2, 2)
        cells.push(pc)
      }
    })
    return row(cells, 1)
  })
  return stack(rows)
}

/** Villagers from each sub-theme in its work clothes, in every pose. */
function villagers(theme) {
  const poses = [['idle', 's', 0], ['walk', 'e', 1], ['walk', 'w', 3], ['walk', 'n', 0], ['hammer', 's', 0], ['hammer', 's', 1], ['sit', 's', 0], ['jump', 's', 1], ['wave', 's', 0], ['slump', 's', 0]]
  const rows = THEMES[theme].subthemes.map((s, si) => {
    const cells = []
    for (let i = 0; i < 4; i++) {
      const look = dress(lookFor(`sheet:${si}:${i}`), theme, s.id)
      for (const [anim, facing, frame] of poses) {
        const pc = ground(theme, 0, 18, 26)
        blit(pc, sprite(theme, `villager.${anim}.${facing}`, frame, { look }), 1, 1)
        cells.push(pc)
      }
    }
    return row(cells, 1)
  })
  return stack(rows)
}

/** Enough work to furnish a room with: a spine per file on the shelves, a note per commit. */
const ROOM_LOG = {
  ok: true,
  files: Array.from({ length: 11 }, (_, i) => ({ path: `src/f${i}.js`, edits: (i % 5) + 1, kind: 'edited', at: i, outside: false })),
  commits: Array.from({ length: 5 }, (_, i) => ({ at: i, message: `commit ${i}` })),
  entries: [],
  more: 0,
}

/** One room, drawn the way src/render/room.js draws it, less the writing on the board. */
function roomPanel(theme, room) {
  const pc = new PixelCanvas(room.w * T, (room.h + room.wallH) * T)
  const at = (x, y) => [Math.round(x * T), Math.round((y + room.wallH) * T)]
  const wallV = room.style.wall
  for (let y = -room.wallH; y < 0; y++) for (let x = 0; x < room.w; x++) blit(pc, sprite(theme, `interior.wall.${wallV}`), ...at(x, y))
  for (let y = 0; y < room.h; y++) for (let x = 0; x < room.w; x++) blit(pc, sprite(theme, `interior.floor.${wallV}`), ...at(x, y))
  pc.rect(0, room.wallH * T - 1, pc.w, 1, P.outline) // the skirting
  blit(pc, sprite(theme, 'interior.logboard'), ...at(room.board.x, room.board.y))
  for (const prop of room.props) {
    const img = sprite(theme, `interior.${prop.kind}.${propVariant(prop)}`)
    const [dx, dy] = PROP_PLACE[prop.kind] || [0, 0]
    const [left, top] = at(prop.x + dx / T, prop.y + 1)
    blit(pc, img, left, top - img.h + dy)
    if (prop.kind === 'shelf') {
      for (const [i, b] of (prop.books || []).entries()) {
        const rowY = [15, 28, 41][Math.floor(i / prop.cols)]
        if (rowY === undefined) break
        const spine = sprite(theme, `interior.book.${(b.color % 8) * 3 + b.tall}`)
        blit(pc, spine, left + 3 + (i % prop.cols) * 4, top - img.h + rowY - spine.h)
      }
    } else if (prop.kind === 'pinboard') {
      for (const [i] of (prop.notes || []).entries()) {
        blit(pc, sprite(theme, `interior.note.${i % 3}`), left + 4 + (i % 4) * 10, top - img.h + dy + [4, 15][Math.floor(i / 4) % 2])
      }
    }
  }
  const v = room.villager
  const [vx, vy] = at(v.x, v.y + 1)
  if (v.inBed) blit(pc, generate('fx.z', 0, {}), vx + 8, vy - 28)
  else blit(pc, sprite(theme, `villager.${v.anim}.${v.facing}`, 0, { look: v.look }), vx + 1, vy - VILLAGER_H)
  return pc
}

/** Each of a theme's rooms, in a plot's own materials, with somebody in it. */
function rooms(theme) {
  const { dims, subthemes } = THEMES[theme]
  return stack(interiorsOf(theme).map((plan, i) => {
    const sub = plan.subs?.[0] || subthemes[0].id
    const style = { theme, sub, fence: 0, yard: 0, wall: i % dims.wall.length, roofs: 0 }
    const status = ['working', 'idle', 'sleeping', 'waiting'][i % 4]
    const thread = { id: `sheet:${theme}:${plan.id}`, status, title: plan.label }
    const room = roomFrame(thread, { style, look: dress(lookFor(thread.id), theme, sub), interior: plan, log: ROOM_LOG, night: i % 2 })
    return roomPanel(theme, room)
  }))
}

/**
 * A row per tier, smallest first: set out, framed, in scaffolding and finished; then lit with
 * somebody in, through each frame it animates; then finished in three more plots' looks.
 */
function landmarks(theme) {
  const L = landmarkShapes(theme)
  const { dims } = THEMES[theme]
  const rows = []
  for (let tier = 0; tier <= MAX_TIER; tier++) {
    const H = L.heightOf(tier)
    const at = (stage, frame, variant, extra = {}) => {
      const p = { accent: ACCENTS[variant % ACCENTS.length], variant, wall: variant % dims.wall.length, roofs: variant % dims.roofs, lit: false, busy: false, ...extra }
      const pc = ground(theme, variant % dims.yard.length, 40, H + 8)
      const shadow = stage >= 2 ? L.shadowOf(tier) : 0
      if (shadow) blit(pc, generate(`fx.shadow.${shadow}x6`, 0, {}), (40 - shadow) / 2, H + 2)
      blit(pc, sprite(theme, `landmark.${tier}.${stage}`, frame, p), 4, 4)
      return pc
    }
    const cells = [0, 1, 2, 3].map((stage) => at(stage, 0, 0))
    for (let f = 0; f < L.frames(tier, 3); f++) cells.push(at(3, f, 0, { lit: true, busy: true }))
    for (const v of [1, 2, 3]) cells.push(at(3, 0, v))
    rows.push(row(cells))
  }
  return stack(rows)
}

const BANDS = { plots, buildings, landmarks, fences, ground: groundBand, finished, villagers, rooms }
const LEGEND = {
  plots: 'a plot in each sub-theme, in order: %s',
  buildings: `a row per kind (${KINDS.join(', ')}): stages 0, 1, 2; finished ×5 (wall and paint vary); lit; any other animation frames; wear gleaming→derelict; down a courtyard's side`,
  landmarks: 'a row per tier (%s): set out, framed, in scaffolding, finished; lit with somebody in, each frame; three more plots\' looks',
  fences: 'a row per fence (%s): its sixteen joins by mask, then a small ring of it',
  ground: 'a band per ground (%s): six tiles, five footpaths, six roads, sixteen fringes on a road, what lies about; then a stretch of it with its patches',
  finished: `a row per kind of work (${WORK.map((w) => w.id).join(', ')}): each kind sprouting, as an open PR's bud, in bloom in three colours, then white`,
  villagers: 'a row per sub-theme: four villagers in ten poses',
  rooms: 'a room per interior (%s), each in a different wall material, by day and after dark',
}

// ---------- main ----------

function parseArgs(argv) {
  const out = { theme: null, only: SECTIONS, scale: 3, out: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--only') out.only = argv[++i].split(',').filter((s) => SECTIONS.includes(s))
    else if (a === '--scale') out.scale = Math.max(1, Math.min(8, Number(argv[++i]) || 3))
    else if (a === '--out') out.out = argv[++i]
    else if (!a.startsWith('--')) out.theme = a
  }
  return out
}

const args = parseArgs(process.argv.slice(2))
const themes = args.theme ? [args.theme] : THEME_IDS
for (const theme of themes) {
  if (!THEMES[theme]) {
    console.error(`No theme "${theme}". Themes: ${THEME_IDS.join(', ')}`)
    process.exit(1)
  }
  const { dims, subthemes } = THEMES[theme]
  const names = {
    plots: subthemes.map((s) => s.id).join(', '),
    fences: dims.fence.join(', '),
    ground: dims.yard.join(', '),
    landmarks: landmarkWords(theme).tiers.join(', '),
    rooms: interiorsOf(theme).map((r) => r.label).join(', '),
  }
  const sheet = stack(args.only.map((s) => BANDS[s](theme)))
  const n = args.scale
  const big = new Uint8Array(sheet.w * n * sheet.h * n * 4)
  for (let y = 0; y < sheet.h * n; y++) {
    for (let x = 0; x < sheet.w * n; x++) {
      const s = (Math.floor(y / n) * sheet.w + Math.floor(x / n)) * 4
      big.set(sheet.data.subarray(s, s + 4), (y * sheet.w * n + x) * 4)
    }
  }
  const file = args.out && themes.length === 1 ? path.resolve(args.out) : path.join(ROOT, 'data', 'sheets', `${theme}.png`)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, encodePng(sheet.w * n, sheet.h * n, big))
  console.log(`${theme}: ${file} (${sheet.w * n}×${sheet.h * n})`)
  for (const s of args.only) console.log(`  ${s}: ${LEGEND[s].replace('%s', names[s] || '')}`)
}
