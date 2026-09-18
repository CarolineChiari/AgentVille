// The Canvas 2D renderer. It reads a Frame and nothing else; see src/sim/frame.js.
import { CELL_TILES } from '../sim/constants.js'
import { DECO, TILE } from '../sim/plot.js'
import { hashString, mulberry32 } from '../sim/rng.js'
import { ACCENTS, BUTTERFLIES, CONFETTI, NIGHT, PALETTE as P, PETALS, TILE_PX as T, BADGE, hexToRgb, rgba } from './sprites/palette.js'
import { sprites } from './sprites/registry.js'
import { DECO_VARIANTS, LINK, tileVariant } from './sprites/tiles.js'
import { tintMeadow } from './ground.js'
import { PLAIN_STYLE, cellStyles } from '../sim/style.js'
import { buildingFrames, chimneyOf, heightOf, shadowOf, BUILDING_W } from './sprites/buildings.js'
import { FLOCK_EVERY, MAX_BUTTERFLIES, birdsAt, butterflyAt, cloudsIn, flockFor, smokePuffs } from './ambient.js'
import { VILLAGER_H, VILLAGER_W } from './sprites/villagers.js'
import { BADGE_H, BADGE_W } from './sprites/effects.js'

const CHUNK = CELL_TILES * T
const TILE_NAME = {
  [TILE.WILD]: 'wild', [TILE.YARD]: 'yard', [TILE.ROAD]: 'road', [TILE.PLAZA]: 'plaza', [TILE.BED]: 'bed',
  [TILE.TRAIL]: 'trail', [TILE.WATER]: 'water',
}
const FENCE = new Set([DECO.FENCE_H, DECO.FENCE_V, DECO.POST])
const DECO_NAME = {
  [DECO.FLOWERS]: 'flowers', [DECO.PEBBLES]: 'pebbles', [DECO.TALLGRASS]: 'tallgrass', [DECO.CLOVER]: 'clover', [DECO.MUSHROOMS]: 'mushrooms',
  [DECO.REEDS]: 'reeds', [DECO.LILYPAD]: 'lilypad',
}
const PAVED = new Set([TILE.ROAD, TILE.PLAZA])
/** Ground a path's grass fringe grows from, and whose greens it wears. A footpath runs through lawn. */
const FRINGE_FROM = { [TILE.WILD]: 'wild', [TILE.YARD]: 'yard', [TILE.TRAIL]: 'yard' }
/** Neighbour offsets for the four sides of a tile, in the fringe sprite's side order. */
const SIDES = [[0, -1], [1, 0], [0, 1], [-1, 0]]
const SIDE_LINK = [LINK.N, LINK.E, LINK.S, LINK.W]
/** What a footpath joins up with. */
const PATHS = new Set([TILE.TRAIL, TILE.ROAD, TILE.PLAZA])
/** The span of a tile edge a footpath's mouth takes up, in px; see the footpath sprite. */
const MOUTH = [4, 11]
const MEADOW = [P.grass, P.grassSunny, P.grassLush]
/** Notes a board has room for; the card lists the rest. */
const BOARD_NOTES = 6
/** Width of the shadow each kind of static casts on the ground; the rest cast none. */
const STATIC_SHADOW = { tree: 16, bush: 14, rock: 14, stump: 12, log: 20, sapling: 8 }
/** Statics that light up after dark. */
const LIT_STATICS = new Set(['lamp'])
/** How dark a cloud's shadow is at noon; see ambient.js for where clouds are. */
const CLOUD_SHADE = 0.3
/** How strongly the warm light of sunrise and sunset colours everything (soft-light alpha). */
const DUSK_STRENGTH = 0.6
/** Birds fly this high: their shadows fall this far below them, in world px. */
const BIRD_HEIGHT = 44
/** One in this many garden flowers, and one in this many wildflower tiles, has a butterfly. */
const BUTTERFLY_GARDEN = 6
const BUTTERFLY_WILD = 4

/** A full-screen multiply towards `color`, `k` of the way from white: 0 leaves the picture be. */
function tint(color, k) {
  const { r, g, b } = typeof color === 'string' ? hexToRgb(color) : color
  const mix = (c) => Math.round(255 + (c - 255) * k)
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
}

function villagerFrame(v) {
  switch (v.anim) {
    case 'walk': return Math.floor(v.animTime * 8) % 4
    case 'idle': return Math.floor(v.animTime / 0.7) % 2
    case 'hammer': return Math.floor(v.animTime / 0.25) % 2
    case 'wave': return Math.floor(v.animTime / 0.18) % 2
    default: return 0
  }
}

/** Height of a hop in world pixels; the jump anim switches to its airborne pose above 1px. */
const hopOf = (v) => (v.anim === 'jump' ? Math.round(Math.abs(Math.sin(v.animTime * Math.PI * 1.4)) * 5) : 0)

export class Canvas2dRenderer {
  constructor(canvas, camera) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d', { alpha: false })
    this.camera = camera
    this.chunks = new Map() // "cx,cy" → { version, canvas, water: [x, y, hash][], flowers: [x, y, hash][] }
    this.inView = [] // the chunks drawn this frame, for passes that only care about what is on screen
    this.cellStyle = new Map() // "cx,cy" → the style of the plot on that cell
    this.styleVersion = -1
    this.flock = null // the birds crossing now, if any; see ambient.js
    this.hashes = new Map() // id → hashString(id), so per-frame passes don't rehash every id
    this.chimneys = new Map() // building look → where its chimney is, or null
  }

  _hash(id) {
    let h = this.hashes.get(id)
    if (h === undefined) this.hashes.set(id, (h = hashString(id)))
    return h
  }

  /** The world rectangle on screen, in world px. */
  _view() {
    const cam = this.camera
    const tl = cam.toWorld(0, 0)
    const br = cam.toWorld(cam.width / cam.dpr, cam.height / cam.dpr)
    return { x0: tl.x, y0: tl.y, x1: br.x, y1: br.y }
  }

  resize() {
    const r = this.canvas.getBoundingClientRect()
    this.camera.resize(r.width, r.height, window.devicePixelRatio || 1)
    this.canvas.width = this.camera.width
    this.canvas.height = this.camera.height
  }

  // ---------- ground ----------

  /**
   * One cell's ground, baked once per map version. Besides the picture it keeps the tiles that
   * something animates over (water glints, butterflies), so those passes never scan the map.
   */
  _chunk(map, cx, cy) {
    const k = `${cx},${cy}`
    const hit = this.chunks.get(k)
    if (hit && hit.version === map.version) return hit
    const canvas = hit?.canvas || document.createElement('canvas')
    const entry = { version: map.version, canvas, water: [], flowers: [] }
    canvas.width = CHUNK
    canvas.height = CHUNK
    const g = canvas.getContext('2d', { willReadFrequently: true })
    g.imageSmoothingEnabled = false
    const x0 = cx * CELL_TILES
    const y0 = cy * CELL_TILES
    const style = this.cellStyle.get(k) || PLAIN_STYLE
    const tone = style.yard
    const tileAt = (x, y) => map.tileAt(x, y)
    const decoAt = (x, y) => map.decoAt(x, y)
    for (let ly = 0; ly < CELL_TILES; ly++) {
      for (let lx = 0; lx < CELL_TILES; lx++) {
        const x = x0 + lx
        const y = y0 + ly
        const kind = tileAt(x, y)
        const name = TILE_NAME[kind]
        // Soil under more soil carries the flower grid on; a field's top row starts it.
        const variant = kind === TILE.BED ? (tileAt(x, y - 1) === TILE.BED ? 1 : 0) : tileVariant(name, hashString(`${x},${y}`))
        // A footpath runs out of each side where another path carries on.
        let params
        if (kind === TILE.TRAIL) {
          let links = 0
          SIDES.forEach(([dx, dy], side) => PATHS.has(tileAt(x + dx, y + dy)) && (links |= SIDE_LINK[side]))
          params = { links, tone }
        } else if (kind === TILE.YARD) params = { tone }
        g.drawImage(sprites.get(`tile.${name}.${variant}`, 0, params), lx * T, ly * T)
        if (kind === TILE.WATER) {
          let land = 0
          SIDES.forEach(([dx, dy], side) => tileAt(x + dx, y + dy) !== TILE.WATER && (land |= SIDE_LINK[side]))
          if (land) g.drawImage(sprites.get(`deco.shore.${land}`), lx * T, ly * T)
          entry.water.push([x, y, hashString(`w${x},${y}`)])
        }
        // Cheap autotiling: a darker lip where paving meets grass, and the grass hanging over it,
        // leaving a gap where a footpath comes in.
        if (PAVED.has(kind)) {
          g.fillStyle = kind === TILE.ROAD ? P.pathDark : P.plazaDark
          SIDES.forEach(([dx, dy], side) => {
            const next = tileAt(x + dx, y + dy)
            if (PAVED.has(next)) return
            const mouth = next === TILE.TRAIL
            const ex = lx * T + (dx > 0 ? T - 1 : 0)
            const ey = ly * T + (dy > 0 ? T - 1 : 0)
            for (const [a, b] of mouth ? [[0, MOUTH[0] - 1], [MOUTH[1] + 1, T - 1]] : [[0, T - 1]]) {
              if (dx) g.fillRect(ex, ly * T + a, 1, b - a + 1)
              else g.fillRect(lx * T + a, ey, b - a + 1, 1)
            }
            const ground = FRINGE_FROM[next]
            if (!ground) return
            const k = hashString(`e${x},${y},${side}`) & 1
            const fringe = ground === 'yard' ? { ground, tone } : { ground }
            g.drawImage(sprites.get(`deco.fringe.${(mouth ? 8 : 0) + side * 2 + k}`, 0, fringe), lx * T, ly * T)
          })
        }
        // A plank edging round each garden bed.
        if (kind === TILE.BED) {
          g.fillStyle = P.bedEdge
          if (tileAt(x, y - 1) !== TILE.BED) g.fillRect(lx * T, ly * T, T, 2)
          if (tileAt(x, y + 1) !== TILE.BED) g.fillRect(lx * T, ly * T + T - 2, T, 2)
          if (tileAt(x - 1, y) !== TILE.BED) g.fillRect(lx * T, ly * T, 1, T)
          if (tileAt(x + 1, y) !== TILE.BED) g.fillRect(lx * T + T - 1, ly * T, 1, T)
        }
      }
    }
    for (let ly = 0; ly < CELL_TILES; ly++) {
      for (let lx = 0; lx < CELL_TILES; lx++) {
        const d = decoAt(x0 + lx, y0 + ly)
        if (!d) continue
        if (FENCE.has(d)) {
          // A fence joins up with the fence on either side of it, in the plot's own style.
          let mask = 0
          SIDES.forEach(([dx, dy], side) => FENCE.has(decoAt(x0 + lx + dx, y0 + ly + dy)) && (mask |= SIDE_LINK[side]))
          g.drawImage(sprites.get(`fence.${style.fence}.${mask}`), lx * T, ly * T)
          continue
        }
        const name = DECO_NAME[d]
        const variant = hashString(`f${x0 + lx},${y0 + ly}`) % DECO_VARIANTS[name]
        g.drawImage(sprites.get(`deco.${name}.${variant}`), lx * T, ly * T)
        if (d === DECO.FLOWERS) entry.flowers.push([x0 + lx, y0 + ly, hashString(`b${x0 + lx},${y0 + ly}`)])
      }
    }
    // Sunny and lush patches across the countryside, pixel by pixel (see ground.js).
    const img = g.getImageData(0, 0, CHUNK, CHUNK)
    tintMeadow(img.data, CHUNK, CHUNK, x0 * T, y0 * T, MEADOW)
    g.putImageData(img, 0, 0)
    this.chunks.set(k, entry)
    return entry
  }

  _drawGround(frame) {
    const { ctx, camera: cam } = this
    const s = cam.scale
    const tl = cam.toWorld(0, 0)
    const br = cam.toWorld(cam.width / cam.dpr, cam.height / cam.dpr)
    const c0x = Math.floor(tl.x / CHUNK)
    const c0y = Math.floor(tl.y / CHUNK)
    const c1x = Math.floor(br.x / CHUNK)
    const c1y = Math.floor(br.y / CHUNK)
    this.inView = []
    for (let cy = c0y; cy <= c1y; cy++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        const chunk = this._chunk(frame.map, cx, cy)
        this.inView.push(chunk)
        ctx.drawImage(chunk.canvas, cam.offX + cx * CHUNK * s, cam.offY + cy * CHUNK * s, CHUNK * s, CHUNK * s)
      }
    }
  }

  /** Light glinting off the ponds on screen: a pixel or two per tile, each on its own slow clock. */
  _drawWater(frame) {
    const { ctx, camera: cam } = this
    const s = cam.scale
    ctx.fillStyle = P.waterGlint
    for (const chunk of this.inView) {
      for (const [x, y, h] of chunk.water) {
        const t = (frame.time * 0.35 + (h % 1000) / 1000) % 1
        // Lit for a fifth of each cycle, longest in the middle of it.
        if (t > 0.2) continue
        const len = t > 0.06 && t < 0.14 ? 2 : 1
        const gx = x * T + 3 + ((h >>> 10) % 9)
        const gy = y * T + 4 + ((h >>> 14) % 8)
        ctx.fillRect(cam.offX + gx * s, cam.offY + gy * s, len * s, s)
      }
    }
  }

  // ---------- sprites ----------

  _blit(img, wx, wy, alpha = 1) {
    const { ctx, camera: cam } = this
    const s = cam.scale
    if (alpha < 1) ctx.globalAlpha = Math.max(0, alpha)
    ctx.drawImage(img, cam.offX + Math.round(wx) * s, cam.offY + Math.round(wy) * s, img.width * s, img.height * s)
    if (alpha < 1) ctx.globalAlpha = 1
  }

  _drawVillager(v, night) {
    const px = v.x * T
    const py = v.y * T
    const shadow = sprites.get('fx.shadow.10')
    this._blit(shadow, px - 5, py - 2, v.alpha)
    if (v.selected || v.hovered) {
      const ring = sprites.get(`fx.ring.${v.selected ? BADGE.waiting : P.white}`)
      this._blit(ring, px - 8, py - 4, v.selected ? 1 : 0.6)
    }
    const hop = hopOf(v)
    const anim = v.anim === 'jump' ? 'jump' : v.anim
    const frame = v.anim === 'jump' ? (hop > 1 ? 1 : 0) : villagerFrame(v)
    const img = sprites.get(`villager.${anim}.${v.facing}`, frame, { look: v.look })
    this._blit(img, px - VILLAGER_W / 2, py - VILLAGER_H + 1 - hop, v.alpha)
  }

  _drawBuilding(b, night, time) {
    const lit = b.lit && night > 0.35
    const frames = buildingFrames(b.kind, b.stage)
    const frame = frames > 1 ? Math.floor(time * 1.6) % frames : 0
    const style = b.style || PLAIN_STYLE
    const img = sprites.get(`building.${b.kind}.${b.stage}`, frame, {
      accent: ACCENTS[b.accent % ACCENTS.length], variant: b.variant, lit, wall: style.wall, roofs: style.roofs,
    })
    const H = heightOf(b.kind, b.variant)
    const shadow = b.stage >= 2 ? shadowOf(b.kind) : 0
    if (shadow) this._blit(sprites.get(`fx.shadow.${shadow}x6`), b.x * T + (b.w * T - shadow) / 2, (b.y + b.h) * T - 4, b.alpha)
    this._blit(img, b.x * T + (b.w * T - BUILDING_W) / 2, (b.y + b.h) * T - H, b.alpha)
  }

  /** Tall scenery stands on the bottom centre of its sprite, so a new kind needs no code here. */
  _drawStatic(st, night) {
    const lit = LIT_STATICS.has(st.sprite) ? { lit: night > 0.35 } : undefined
    const img = sprites.get(`static.${st.sprite}.${st.variant || 0}`, 0, lit)
    const shadow = STATIC_SHADOW[st.sprite]
    if (shadow) this._blit(sprites.get(`fx.shadow.${shadow}`), st.x * T - shadow / 2, st.y * T - 4)
    this._blit(img, st.x * T - img.width / 2, st.y * T - img.height)
  }

  /** A notice board: one note pinned up per open issue, up to six. */
  _drawBoard(b) {
    const px = b.x * T
    const py = b.y * T
    this._blit(sprites.get('fx.shadow.16'), px - 8, py - 3)
    if (b.selected || b.hovered) this._blit(sprites.get(`fx.ring.${b.selected ? BADGE.waiting : P.white}`), px - 8, py - 4, b.selected ? 1 : 0.6)
    this._blit(sprites.get(`static.board.${Math.min(BOARD_NOTES, b.count)}`), px - 8, py - 22)
  }

  /** Growth stage from age: a sprout, then a bud, then the bloom. */
  _flowerStage(f, time) {
    if (f.born === null || f.born === undefined) return 2
    const age = time - f.born
    return age < 0.6 ? 0 : age < 1.4 ? 1 : 2
  }

  /** Flowers on screen. They are drawn in the depth-sorted pass, so a villager in the bed stands among them. */
  _flowersInView(frame) {
    const cam = this.camera
    const tl = cam.toWorld(0, 0)
    const br = cam.toWorld(cam.width / cam.dpr, cam.height / cam.dpr)
    return frame.flowers.filter((f) => f.x * T > tl.x - 8 && f.x * T < br.x + 8 && f.y * T > tl.y - 16 && f.y * T < br.y + 16)
  }

  _drawFlower(f, time) {
    const { ctx, camera: cam } = this
    const s = cam.scale
    const px = f.x * T
    const py = f.y * T
    if (f.selected || f.hovered) {
      ctx.fillStyle = f.selected ? rgba(P.windowLit, 0.55) : rgba(P.highlight, 0.28)
      ctx.fillRect(cam.offX + Math.round(px - 4) * s, cam.offY + Math.round(py - 7) * s, 8 * s, 8 * s)
    }
    const color = f.white ? P.petalWhite : PETALS[f.color % PETALS.length]
    const stage = f.open ? 1 : this._flowerStage(f, time)
    const img = sprites.get(`flower.${f.kind}.${stage}`, 0, { color })
    // The stem's base pixel (4, 11) sits on the flower's spot.
    this._blit(img, px - 4, py - 11)
  }

  /**
   * Open PRs glitter: a few sparkles twinkling round each bud, each on its own clock so a bed of
   * them shimmers rather than blinks. Drawn after the night tint so they shine in the dark.
   */
  _drawGlitter(frame) {
    const { ctx, camera: cam } = this
    const s = cam.scale
    // A soft golden pulse under each bud, so an open PR is findable even zoomed right out.
    ctx.globalCompositeOperation = 'lighter'
    for (const f of frame.flowers) {
      if (!f.open) continue
      const cx = cam.offX + f.x * T * s
      const cy = cam.offY + (f.y * T - 5) * s
      const rad = 11 * s
      const pulse = 0.22 + 0.14 * Math.sin(frame.time * 2.4 + (hashString(f.id) % 100) / 16)
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad)
      g.addColorStop(0, rgba(P.glitterGlow, pulse))
      g.addColorStop(1, rgba(P.glitterGlow, 0))
      ctx.fillStyle = g
      ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2)
    }
    ctx.globalCompositeOperation = 'source-over'
    for (const f of frame.flowers) {
      if (!f.open) continue
      const seed = hashString(f.id)
      for (let k = 0; k < 4; k++) {
        const phase = ((seed >>> (k * 7)) % 100) / 100
        const t = (frame.time * 0.9 + phase + k * 0.25) % 1
        const a = Math.sin(t * Math.PI) // fade in, then out
        if (a < 0.15) continue
        // Each sparkle moves to a new spot every time it twinkles.
        const cycle = Math.floor(frame.time * 0.9 + phase + k * 0.25)
        const r = mulberry32(seed + k * 131 + cycle * 977)
        const wx = Math.round(f.x * T - 5 + r() * 10)
        const wy = Math.round(f.y * T - 12 + r() * 11)
        const x = cam.offX + wx * s
        const y = cam.offY + wy * s
        ctx.globalAlpha = a
        ctx.fillStyle = P.glitter
        ctx.fillRect(x, y, s, s)
        if (a > 0.6) {
          // Brightest moment: a four-pointed twinkle.
          ctx.fillRect(x - s, y, s, s)
          ctx.fillRect(x + s, y, s, s)
          ctx.fillRect(x, y - s, s, s)
          ctx.fillRect(x, y + s, s, s)
          ctx.fillStyle = P.white
          ctx.fillRect(x, y, s, s)
        }
      }
    }
    ctx.globalAlpha = 1
  }

  _drawEffects(frame) {
    const { ctx, camera: cam } = this
    const s = cam.scale
    for (const e of frame.effects) {
      const rand = mulberry32(e.seed)
      const t = e.age / e.life
      if (e.kind === 'z') {
        this._blit(sprites.get('fx.z'), e.x * T + Math.sin(e.age * 3) * 3, e.y * T - e.age * 10, 1 - t)
        continue
      }
      const vx = (rand() - 0.5) * (e.kind === 'confetti' ? 40 : 30)
      const vy = -(rand() * 30 + (e.kind === 'confetti' ? 25 : 10))
      const g = e.kind === 'confetti' ? 60 : 40
      const wx = e.x * T + vx * e.age
      const wy = e.y * T + vy * e.age + 0.5 * g * e.age * e.age
      ctx.globalAlpha = 1 - t * t
      ctx.fillStyle = e.kind === 'confetti' ? CONFETTI[Math.floor(rand() * CONFETTI.length)] : P.windowLit
      const size = e.kind === 'confetti' ? 2 : 1
      ctx.fillRect(cam.offX + Math.round(wx) * s, cam.offY + Math.round(wy) * s, size * s, size * s)
    }
    ctx.globalAlpha = 1
  }

  // ---------- ambient life ----------

  /** Smoke from the chimney of every finished building someone is busy in. */
  _drawSmoke(frame, view) {
    const { ctx, camera: cam } = this
    const s = cam.scale
    // A puff is a square of `n` world px with its corners off: a pale body over a grey underside.
    const puff = (x, y, n, color) => {
      ctx.fillStyle = color
      ctx.fillRect(cam.offX + x * s, cam.offY + (y + 1) * s, n * s, (n - 2) * s)
      ctx.fillRect(cam.offX + (x + 1) * s, cam.offY + y * s, (n - 2) * s, n * s)
    }
    for (const b of frame.buildings) {
      if (b.stage < 3 || !b.lit || b.alpha < 1) continue
      const style = b.style || PLAIN_STYLE
      const key = `${b.kind}:${b.variant}:${style.wall}:${style.roofs}`
      if (!this.chimneys.has(key)) this.chimneys.set(key, chimneyOf(b.kind, b.variant, style.wall, style.roofs))
      const c = this.chimneys.get(key)
      if (!c) continue
      const x = b.x * T + (b.w * T - BUILDING_W) / 2 + c.x
      const y = (b.y + b.h) * T - heightOf(b.kind, b.variant) + c.y
      if (x < view.x0 - 20 || x > view.x1 + 20 || y < view.y0 - 30 || y > view.y1 + 10) continue
      for (const p of smokePuffs(x, y, this._hash(b.id), frame.time)) {
        ctx.globalAlpha = p.alpha
        const px = Math.round(p.x - p.size / 2)
        const py = Math.round(p.y - p.size / 2)
        puff(px, py + 1, p.size + 1, P.smokeShade)
        puff(px, py, p.size + 1, P.smoke)
      }
    }
    ctx.globalAlpha = 1
  }

  /** Soft shadows of clouds drifting over, fading out as night comes. */
  _drawClouds(frame, view, night) {
    const a = CLOUD_SHADE * (1 - night)
    if (a < 0.01) return
    const { ctx, camera: cam } = this
    const s = cam.scale
    ctx.globalCompositeOperation = 'multiply'
    for (const c of cloudsIn(view, frame.time)) {
      const x = cam.offX + c.x * s
      const y = cam.offY + c.y * s
      const r = c.r * s
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, rgba(P.cloudShadow, a))
      g.addColorStop(1, rgba(P.cloudShadow, 0))
      ctx.fillStyle = g
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }
    ctx.globalCompositeOperation = 'source-over'
  }

  /** A few butterflies over the flowers on screen, garden and wild. Not after dark. */
  _drawButterflies(frame, flowers, night) {
    if (night > 0.6) return
    const sources = []
    for (const f of flowers) {
      const h = this._hash(f.id)
      if (h % BUTTERFLY_GARDEN === 0) sources.push([f.x * T, f.y * T - 6, h])
    }
    for (const chunk of this.inView) for (const [x, y, h] of chunk.flowers) if (h % BUTTERFLY_WILD === 0) sources.push([x * T + 8, y * T + 8, h])
    for (const [ax, ay, h] of sources.slice(0, MAX_BUTTERFLIES)) {
      const b = butterflyAt(ax, ay, h, frame.time)
      this._blit(sprites.get(`fx.butterfly.${h % BUTTERFLIES.length}`, b.frame), b.x - 2, b.y - 1, 1 - night)
    }
  }

  /** Now and then a few birds cross the screen, their shadows on the ground far below. */
  _drawBirds(frame, view, night) {
    if (night > 0.5) {
      this.flock = null
      return
    }
    const cycle = Math.floor(frame.time / FLOCK_EVERY)
    if (!this.flock || this.flock.cycle !== cycle) {
      this.flock = flockFor(cycle, view)
      this.flock.start = cycle * FLOCK_EVERY
    }
    for (const b of birdsAt(this.flock, frame.time - this.flock.start)) {
      this._blit(sprites.get('fx.shadow.6'), b.x - 3, b.y + BIRD_HEIGHT, 0.5 * (1 - night))
      this._blit(sprites.get('fx.bird', b.frame), b.x - 3, b.y - 1, 1 - night)
    }
  }

  // ---------- light ----------

  /**
   * Sunrise and sunset: everything warms towards orange before night's blue comes in. Soft light
   * rather than a multiply: multiplying by orange muddied the greens to olive instead of gilding them.
   */
  _drawDusk(dusk) {
    if (dusk <= 0.01) return
    const { ctx, camera: cam } = this
    ctx.globalCompositeOperation = 'soft-light'
    ctx.fillStyle = rgba(P.dusk, DUSK_STRENGTH * dusk)
    ctx.fillRect(0, 0, cam.width, cam.height)
    ctx.globalCompositeOperation = 'source-over'
  }

  _drawNight(frame, night) {
    if (night <= 0.01) return
    const { ctx, camera: cam } = this
    ctx.globalCompositeOperation = 'multiply'
    ctx.fillStyle = tint(NIGHT, 0.62 * night)
    ctx.fillRect(0, 0, cam.width, cam.height)
    ctx.globalCompositeOperation = 'lighter'
    const glow = (wx, wy, r, a) => {
      const p = { x: cam.offX + wx * cam.scale, y: cam.offY + wy * cam.scale }
      const rad = r * cam.scale
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad)
      g.addColorStop(0, rgba(P.lampGlow, a * night))
      g.addColorStop(1, rgba(P.lampGlow, 0))
      ctx.fillStyle = g
      ctx.fillRect(p.x - rad, p.y - rad, rad * 2, rad * 2)
    }
    for (const b of frame.buildings) if (b.lit && b.stage >= 2) glow((b.x + b.w / 2) * T, (b.y + b.h) * T - 12, 22, 0.33)
    for (const st of frame.statics) if (st.sprite === 'lamp') glow(st.x * T, st.y * T - 20, 28, 0.38)
    ctx.globalCompositeOperation = 'source-over'
  }

  // ---------- overlays (never dimmed by night) ----------

  _drawBadges(frame) {
    for (const v of frame.villagers) {
      if (!v.badge) continue
      const bob = v.badge === 'waiting' ? Math.round(Math.sin(v.animTime * 4) * 1.5) : 0
      const img = sprites.get(`fx.badge.${v.badge}`)
      this._blit(img, v.x * T - BADGE_W / 2, v.y * T - VILLAGER_H - BADGE_H + bob - hopOf(v), v.alpha)
    }
  }

  _drawLabels(frame, ui) {
    const { ctx, camera: cam } = this
    const dpr = cam.dpr
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `600 ${Math.round(12 * dpr)}px ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif`
    ctx.lineJoin = 'round'
    for (const p of frame.plots) {
      const show = ui.allNames || p.urgent || p.active || p.name === ui.hoverPlot || p.name === ui.selectedPlot
      if (!show) continue
      const x = cam.offX + p.labelAt.x * T * cam.scale
      const y = cam.offY + p.labelAt.y * T * cam.scale - 6 * dpr
      const w = ctx.measureText(p.name).width
      ctx.lineWidth = 4 * dpr
      ctx.strokeStyle = rgba(P.labelInk, 0.8)
      ctx.strokeText(p.name, x + 5 * dpr, y)
      ctx.fillStyle = P.white
      ctx.fillText(p.name, x + 5 * dpr, y)
      ctx.beginPath()
      ctx.arc(x - w / 2 - 3 * dpr, y, 4 * dpr, 0, Math.PI * 2)
      ctx.fillStyle = rgba(P.labelInk, 0.8)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x - w / 2 - 3 * dpr, y, 2.6 * dpr, 0, Math.PI * 2)
      ctx.fillStyle = ACCENTS[p.accent % ACCENTS.length]
      ctx.fill()
    }
  }

  /**
   * @param {import('../sim/frame.js').Frame} frame
   * @param {{ night: number, dusk?: number, hoverPlot?: string, selectedPlot?: string, allNames?: boolean }} ui
   *        `night` 0 by day to 1 at night; `dusk` how golden the light is round sunrise and sunset
   */
  render(frame, ui) {
    const { ctx, camera: cam } = this
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = P.void
    ctx.fillRect(0, 0, cam.width, cam.height)
    // Which plot's style each cell is drawn in. Only a rebuild moves plots, and a rebuild always
    // makes a new map version, so the chunks baked with the old lookup are thrown away with it.
    if (this.styleVersion !== frame.map.version) {
      this.cellStyle = cellStyles(frame.plots)
      this.styleVersion = frame.map.version
    }
    this._drawGround(frame)
    this._drawWater(frame)

    const night = ui.night
    // Everything that stands up is drawn back to front by the y of its base, so a lower flower's
    // bloom overlaps the stem behind it and a villager in the bed hides behind the row in front.
    const items = []
    const flowers = this._flowersInView(frame)
    for (const f of flowers) items.push([f.y, 3, f])
    for (const st of frame.statics) items.push([st.y, 0, st])
    for (const b of frame.buildings) items.push([b.y + b.h - 0.05, 1, b])
    for (const v of frame.villagers) items.push([v.y, 2, v])
    for (const b of frame.boards || []) items.push([b.y, 4, b])
    items.sort((a, b) => a[0] - b[0])
    for (const [, kind, it] of items) {
      if (kind === 0) this._drawStatic(it, night)
      else if (kind === 1) this._drawBuilding(it, night, frame.time)
      else if (kind === 2) this._drawVillager(it, night)
      else if (kind === 3) this._drawFlower(it, frame.time)
      else this._drawBoard(it)
    }
    const view = this._view()
    this._drawSmoke(frame, view)
    this._drawClouds(frame, view, night)
    this._drawButterflies(frame, flowers, night)
    this._drawBirds(frame, view, night)
    this._drawEffects(frame)
    this._drawDusk(ui.dusk || 0)
    this._drawNight(frame, night)
    this._drawGlitter(frame)
    this._drawBadges(frame)
    this._drawLabels(frame, ui)
  }

  /** What is under a CSS-pixel point: a villager, a notice board, a flower, a building's villager, else a plot. */
  pick(cssX, cssY, frame) {
    const w = this.camera.toWorld(cssX, cssY)
    const byY = [...frame.villagers].sort((a, b) => b.y - a.y)
    for (const v of byY) {
      const px = v.x * T
      const py = v.y * T
      const inBody = w.x >= px - 6 && w.x <= px + 6 && w.y >= py - VILLAGER_H + 2 && w.y <= py + 1
      const inBadge = v.badge && w.x >= px - BADGE_W / 2 && w.x <= px + BADGE_W / 2 && w.y >= py - VILLAGER_H - BADGE_H && w.y <= py - VILLAGER_H
      if (inBody || inBadge) return { villager: v.id }
    }
    // Before flowers: the board is drawn over the bottom row of the bed.
    for (const b of frame.boards || []) {
      const px = b.x * T
      const py = b.y * T
      if (w.x >= px - 8 && w.x < px + 8 && w.y >= py - 22 && w.y < py) return { board: b.id }
    }
    for (const f of frame.flowers) {
      const px = f.x * T
      const py = f.y * T
      if (w.x >= px - 4 && w.x < px + 4 && w.y >= py - 9 && w.y < py + 1) return { flower: f.id }
    }
    const ids = new Set(frame.villagers.map((v) => v.id))
    for (const b of [...frame.buildings].sort((a, c) => c.y - a.y)) {
      if (b.alpha < 1) continue
      const x0 = b.x * T
      const y1 = (b.y + b.h) * T
      if (w.x >= x0 && w.x <= x0 + b.w * T && w.y >= y1 - heightOf(b.kind, b.variant) + 8 && w.y <= y1 && ids.has(b.id)) return { villager: b.id }
    }
    const tx = Math.floor(w.x / T)
    const ty = Math.floor(w.y / T)
    for (const p of frame.plots) {
      for (const [cx, cy] of p.cells) {
        if (tx >= cx * CELL_TILES && tx < (cx + 1) * CELL_TILES && ty >= cy * CELL_TILES && ty < (cy + 1) * CELL_TILES) return { plot: p.name }
      }
    }
    return null
  }
}
