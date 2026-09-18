// The Canvas 2D renderer. It reads a Frame and nothing else; see src/sim/frame.js.
import { CELL_TILES } from '../sim/constants.js'
import { DECO, TILE } from '../sim/plot.js'
import { hashString, mulberry32 } from '../sim/rng.js'
import { ACCENTS, CONFETTI, NIGHT, PALETTE as P, PETALS, TILE_PX as T, BADGE } from './sprites/palette.js'
import { sprites } from './sprites/registry.js'
import { TILE_VARIANTS } from './sprites/tiles.js'
import { buildingFrames, heightOf, BUILDING_W } from './sprites/buildings.js'
import { VILLAGER_H, VILLAGER_W } from './sprites/villagers.js'
import { BADGE_H, BADGE_W } from './sprites/effects.js'

const CHUNK = CELL_TILES * T
const TILE_NAME = { [TILE.WILD]: 'wild', [TILE.YARD]: 'yard', [TILE.ROAD]: 'road', [TILE.PLAZA]: 'plaza', [TILE.BED]: 'bed' }
const DECO_NAME = { [DECO.FENCE_H]: 'fenceh', [DECO.FENCE_V]: 'fencev', [DECO.POST]: 'post', [DECO.FLOWERS]: 'flowers', [DECO.PEBBLES]: 'pebbles' }
const PAVED = new Set([TILE.ROAD, TILE.PLAZA])

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
    this.chunks = new Map() // "cx,cy" → { version, canvas }
  }

  resize() {
    const r = this.canvas.getBoundingClientRect()
    this.camera.resize(r.width, r.height, window.devicePixelRatio || 1)
    this.canvas.width = this.camera.width
    this.canvas.height = this.camera.height
  }

  // ---------- ground ----------

  _chunk(map, cx, cy) {
    const k = `${cx},${cy}`
    const hit = this.chunks.get(k)
    if (hit && hit.version === map.version) return hit.canvas
    const canvas = hit?.canvas || document.createElement('canvas')
    canvas.width = CHUNK
    canvas.height = CHUNK
    const g = canvas.getContext('2d')
    g.imageSmoothingEnabled = false
    const x0 = cx * CELL_TILES
    const y0 = cy * CELL_TILES
    const tileAt = (x, y) => map.tileAt(x, y)
    const decoAt = (x, y) => map.decoAt(x, y)
    for (let ly = 0; ly < CELL_TILES; ly++) {
      for (let lx = 0; lx < CELL_TILES; lx++) {
        const x = x0 + lx
        const y = y0 + ly
        const kind = tileAt(x, y)
        const name = TILE_NAME[kind]
        // A bed tile's variant is which of the bed's rows it is, so the flower dimples line up.
        const variant = kind === TILE.BED ? (((y % CELL_TILES) + CELL_TILES) % CELL_TILES) - 5 : hashString(`${x},${y}`) % TILE_VARIANTS[name]
        g.drawImage(sprites.get(`tile.${name}.${variant}`), lx * T, ly * T)
        // Cheap autotiling: a darker lip where paving meets grass.
        if (PAVED.has(kind)) {
          g.fillStyle = kind === TILE.ROAD ? P.pathDark : P.plazaDark
          if (!PAVED.has(tileAt(x, y - 1))) g.fillRect(lx * T, ly * T, T, 1)
          if (!PAVED.has(tileAt(x, y + 1))) g.fillRect(lx * T, ly * T + T - 1, T, 1)
          if (!PAVED.has(tileAt(x - 1, y))) g.fillRect(lx * T, ly * T, 1, T)
          if (!PAVED.has(tileAt(x + 1, y))) g.fillRect(lx * T + T - 1, ly * T, 1, T)
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
        const variant = d === DECO.FLOWERS ? hashString(`f${x0 + lx},${y0 + ly}`) % 4 : 0
        g.drawImage(sprites.get(`deco.${DECO_NAME[d]}.${variant}`), lx * T, ly * T)
      }
    }
    this.chunks.set(k, { version: map.version, canvas })
    return canvas
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
    for (let cy = c0y; cy <= c1y; cy++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        ctx.drawImage(this._chunk(frame.map, cx, cy), cam.offX + cx * CHUNK * s, cam.offY + cy * CHUNK * s, CHUNK * s, CHUNK * s)
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
    const img = sprites.get(`building.${b.kind}.${b.stage}`, frame, { accent: ACCENTS[b.accent % ACCENTS.length], variant: b.variant, lit })
    const H = heightOf(b.kind)
    this._blit(img, b.x * T + (b.w * T - BUILDING_W) / 2, (b.y + b.h) * T - H, b.alpha)
  }

  _drawStatic(st, night) {
    if (st.sprite === 'tree') {
      this._blit(sprites.get('fx.shadow.16'), st.x * T - 8, st.y * T - 4)
      this._blit(sprites.get(`static.tree.${st.variant || 0}`), st.x * T - 12, st.y * T - 34)
    } else if (st.sprite === 'lamp') {
      this._blit(sprites.get('static.lamp.0', 0, { lit: night > 0.35 }), st.x * T - 4, st.y * T - 24)
    } else if (st.sprite === 'arch') {
      this._blit(sprites.get('static.arch.0'), st.x * T - 32, st.y * T - 44)
    }
  }

  /** Growth stage from age: a sprout, then a bud, then the bloom. */
  _flowerStage(f, time) {
    if (f.born === null || f.born === undefined) return 2
    const age = time - f.born
    return age < 0.6 ? 0 : age < 1.4 ? 1 : 2
  }

  _drawFlowers(frame) {
    const { ctx, camera: cam } = this
    const tl = cam.toWorld(0, 0)
    const br = cam.toWorld(cam.width / cam.dpr, cam.height / cam.dpr)
    const s = cam.scale
    // Top rows first so a lower flower's bloom overlaps the stem behind it.
    const list = frame.flowers.filter((f) => f.x * T > tl.x - 8 && f.x * T < br.x + 8 && f.y * T > tl.y - 16 && f.y * T < br.y + 16)
    list.sort((a, b) => a.y - b.y)
    for (const f of list) {
      const px = f.x * T
      const py = f.y * T
      if (f.selected || f.hovered) {
        ctx.fillStyle = f.selected ? 'rgba(255, 216, 115, 0.55)' : 'rgba(255, 255, 255, 0.28)'
        ctx.fillRect(cam.offX + Math.round(px - 4) * s, cam.offY + Math.round(py - 7) * s, 8 * s, 8 * s)
      }
      const img = sprites.get(`flower.${f.kind}.${this._flowerStage(f, frame.time)}`, 0, { color: PETALS[f.color % PETALS.length] })
      // The stem's base pixel (4, 11) sits on the flower's spot.
      this._blit(img, px - 4, py - 11)
    }
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

  // ---------- light ----------

  _drawNight(frame, night) {
    if (night <= 0.01) return
    const { ctx, camera: cam } = this
    const k = 0.62 * night
    const mix = (c) => Math.round(255 + (c - 255) * k)
    ctx.globalCompositeOperation = 'multiply'
    ctx.fillStyle = `rgb(${mix(NIGHT.r)},${mix(NIGHT.g)},${mix(NIGHT.b)})`
    ctx.fillRect(0, 0, cam.width, cam.height)
    ctx.globalCompositeOperation = 'lighter'
    const glow = (wx, wy, r, a) => {
      const p = { x: cam.offX + wx * cam.scale, y: cam.offY + wy * cam.scale }
      const rad = r * cam.scale
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad)
      g.addColorStop(0, `rgba(255, 200, 110, ${a * night})`)
      g.addColorStop(1, 'rgba(255, 200, 110, 0)')
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
      ctx.strokeStyle = 'rgba(28, 22, 36, 0.8)'
      ctx.strokeText(p.name, x + 5 * dpr, y)
      ctx.fillStyle = P.white
      ctx.fillText(p.name, x + 5 * dpr, y)
      ctx.beginPath()
      ctx.arc(x - w / 2 - 3 * dpr, y, 4 * dpr, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(28, 22, 36, 0.8)'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x - w / 2 - 3 * dpr, y, 2.6 * dpr, 0, Math.PI * 2)
      ctx.fillStyle = ACCENTS[p.accent % ACCENTS.length]
      ctx.fill()
    }
  }

  /**
   * @param {import('../sim/frame.js').Frame} frame
   * @param {{ night: number, hoverPlot?: string, selectedPlot?: string, allNames?: boolean }} ui
   */
  render(frame, ui) {
    const { ctx, camera: cam } = this
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = P.void
    ctx.fillRect(0, 0, cam.width, cam.height)
    this._drawGround(frame)
    this._drawFlowers(frame)

    const night = ui.night
    const items = []
    for (const st of frame.statics) items.push([st.y, 0, st])
    for (const b of frame.buildings) items.push([b.y + b.h - 0.05, 1, b])
    for (const v of frame.villagers) items.push([v.y, 2, v])
    items.sort((a, b) => a[0] - b[0])
    for (const [, kind, it] of items) {
      if (kind === 0) this._drawStatic(it, night)
      else if (kind === 1) this._drawBuilding(it, night, frame.time)
      else this._drawVillager(it, night)
    }
    this._drawEffects(frame)
    this._drawNight(frame, night)
    this._drawBadges(frame)
    this._drawLabels(frame, ui)
  }

  /** What is under a CSS-pixel point: a villager (or the building it owns), else a plot. */
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
      if (w.x >= x0 && w.x <= x0 + b.w * T && w.y >= y1 - heightOf(b.kind) + 8 && w.y <= y1 && ids.has(b.id)) return { villager: b.id }
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
