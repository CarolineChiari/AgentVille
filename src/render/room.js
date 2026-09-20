// Drawing the inside of a building. The room comes from src/sim/room.js in tile units; this puts
// it on the same canvas the village uses, centred in whatever the panels leave free, at a whole
// number of device pixels per world pixel so nothing blurs.
import { sprites } from './sprites/registry.js'
import { PALETTE as P, TILE_PX as T, rgba } from './sprites/palette.js'
import { VILLAGER_H, VILLAGER_W } from './sprites/villagers.js'
import { BADGE_FOR } from '../sim/status.js'

/** Room drawn no smaller than this and no larger, whatever the window does. */
const MIN_SCALE = 2
const MAX_SCALE = 10
/** Breathing room round the room, in device pixels. */
const MARGIN = 48

/** Where each book row's feet are inside the shelf sprite, and where the first spine starts. */
const SHELF_ROW_Y = [15, 28, 41]
const SHELF_X = 3
const SHELF_STEP = 4
/** Where the notes go on the pinboard sprite. */
const NOTE_X = 4
const NOTE_Y = [4, 15]
const NOTE_STEP = 10

/**
 * How big the room is drawn and where its top-left corner goes, in device pixels.
 * @param {object} room  a RoomFrame
 * @param {{ width: number, height: number, insetLeft?: number, insetRight?: number }} view  device pixels
 */
export function roomLayout(room, { width, height, insetLeft = 0, insetRight = 0 }) {
  const wPx = room.w * T
  const hPx = (room.h + room.wallH) * T
  const free = Math.max(1, width - insetLeft - insetRight)
  const fit = Math.min((free - MARGIN) / wPx, (height - MARGIN) / hPx)
  const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.floor(fit)))
  return {
    scale,
    ox: Math.round(insetLeft + (free - wPx * scale) / 2),
    oy: Math.round((height - hPx * scale) / 2),
    wPx,
    hPx,
  }
}

/** Tile (x, y) → the device pixel of its top-left corner. Wall tiles have a negative y. */
const at = (layout, room, x, y) => ({
  x: layout.ox + x * T * layout.scale,
  y: layout.oy + (y + room.wallH) * T * layout.scale,
})

/** A CSS-pixel point → the room tile under it, wall tiles included. */
export function roomPick(room, layout, cssX, cssY, dpr = 1) {
  const s = T * layout.scale
  const tx = (cssX * dpr - layout.ox) / s
  const ty = (cssY * dpr - layout.oy) / s - room.wallH
  if (tx < 0 || tx >= room.w || ty < -room.wallH || ty >= room.h) return null
  return { x: Math.floor(tx), y: Math.floor(ty) }
}

export class RoomRenderer {
  /** @param {CanvasRenderingContext2D} ctx  the village's own context, so both draw on one canvas */
  constructor(ctx) {
    this.ctx = ctx
    this.layout = null
  }

  /**
   * @param {object} room     a RoomFrame from src/sim/room.js
   * @param {object} view     { width, height, insetLeft, insetRight, dpr } in device pixels
   * @param {{ alpha?: number, time?: number }} [opts]  `alpha` fades the room in over the village
   */
  render(room, view, { alpha = 1, time = 0 } = {}) {
    const ctx = this.ctx
    const layout = roomLayout(room, view)
    this.layout = layout
    const { scale } = layout
    ctx.save()
    ctx.imageSmoothingEnabled = false
    ctx.globalAlpha = alpha
    // Everything outside the room is the dark the village is seen through from in here.
    ctx.fillStyle = P.interior
    ctx.fillRect(0, 0, view.width, view.height)

    const wallV = room.style?.wall ?? 0
    const draw = (img, x, y, w = img.width * scale, h = img.height * scale) => ctx.drawImage(img, Math.round(x), Math.round(y), Math.round(w), Math.round(h))

    // Wall, then floor.
    for (let y = -room.wallH; y < 0; y++) {
      for (let x = 0; x < room.w; x++) {
        const p = at(layout, room, x, y)
        draw(sprites.get(`interior.wall.${wallV}`), p.x, p.y)
      }
    }
    for (let y = 0; y < room.h; y++) {
      for (let x = 0; x < room.w; x++) {
        const p = at(layout, room, x, y)
        draw(sprites.get(`interior.floor.${wallV}`), p.x, p.y)
      }
    }
    // The skirting: without a line here the wall and the floor read as one flat field.
    const seam = at(layout, room, 0, 0)
    ctx.fillStyle = P.outline
    ctx.fillRect(layout.ox, seam.y - scale, room.w * T * scale, scale)

    for (const prop of room.props) this._prop(room, layout, prop, time)
    this._villager(room, layout, time)
    if (room.lamp) this._lamp(room, layout)
    ctx.restore()
  }

  /** One piece of furniture, its feet at the bottom of its own tile. */
  _prop(room, layout, prop, time) {
    const { scale } = layout
    const ctx = this.ctx
    const foot = at(layout, room, prop.x, prop.y + 1)
    const left = at(layout, room, prop.x, prop.y).x
    const put = (img, dx = 0, dy = 0) =>
      ctx.drawImage(img, Math.round(left + dx * scale), Math.round(foot.y - (img.height - dy) * scale), img.width * scale, img.height * scale)

    if (prop.kind === 'shelf') {
      const img = sprites.get('interior.shelf')
      put(img)
      const top = foot.y - img.height * scale
      for (const [i, b] of prop.books.entries()) {
        const row = Math.floor(i / prop.cols)
        if (row >= SHELF_ROW_Y.length) break
        const spine = sprites.get(`interior.book.${(b.color % 8) * 3 + b.tall}`)
        ctx.drawImage(
          spine,
          Math.round(left + (SHELF_X + (i % prop.cols) * SHELF_STEP) * scale),
          Math.round(top + (SHELF_ROW_Y[row] - spine.height) * scale),
          spine.width * scale,
          spine.height * scale,
        )
      }
      return
    }
    if (prop.kind === 'pinboard') {
      const img = sprites.get('interior.pinboard')
      put(img, 0, 4)
      const top = foot.y - (img.height - 4) * scale
      for (const [i, n] of prop.notes.entries()) {
        const note = sprites.get(`interior.note.${i % 3}`)
        ctx.drawImage(
          note,
          Math.round(left + (NOTE_X + (i % 4) * NOTE_STEP) * scale),
          Math.round(top + NOTE_Y[Math.floor(i / 4) % NOTE_Y.length] * scale),
          note.width * scale,
          note.height * scale,
        )
      }
      return
    }
    if (prop.kind === 'window') return put(sprites.get(`interior.window.${prop.night > 0.35 ? 1 : 0}`), 0, 6)
    if (prop.kind === 'door') return put(sprites.get('interior.door'), 0, 0)
    if (prop.kind === 'rug') return put(sprites.get(`interior.rug.${prop.variant % 3}`), -1)
    if (prop.kind === 'desk') return put(sprites.get(`interior.desk.${prop.on ? 1 : 0}`))
    if (prop.kind === 'chair') return put(sprites.get('interior.chair'), 1)
    if (prop.kind === 'bed') return put(sprites.get(`interior.bed.${prop.slept ? 1 : 0}`))
  }

  /** Whoever lives here, where the room says they are. */
  _villager(room, layout, time) {
    const { scale } = layout
    const v = room.villager
    const foot = at(layout, room, v.x, v.y + 1)
    const left = at(layout, room, v.x, v.y).x + Math.round(((T - VILLAGER_W) / 2) * scale)
    if (v.inBed) {
      // Under the covers: the bed shows the shape, and a `z` drifts up off it.
      const z = sprites.get('fx.z')
      const bob = Math.round(Math.sin(time * 1.4) * 2)
      this.ctx.drawImage(z, Math.round(left + 8 * scale), Math.round(foot.y - (28 + bob) * scale), z.width * scale, z.height * scale)
      return
    }
    const frame = v.anim === 'idle' ? Math.floor(time / 0.7) % 2 : 0
    const img = sprites.get(`villager.${v.anim}.${v.facing}`, frame, { look: v.look })
    this.ctx.drawImage(img, Math.round(left), Math.round(foot.y - VILLAGER_H * scale), img.width * scale, img.height * scale)
    const kind = BADGE_FOR[v.status]
    if (kind) {
      const badge = sprites.get(`fx.badge.${kind}`)
      this.ctx.drawImage(
        badge,
        Math.round(left + ((VILLAGER_W - badge.width) / 2) * scale),
        Math.round(foot.y - (VILLAGER_H + badge.height + 2) * scale),
        badge.width * scale,
        badge.height * scale,
      )
    }
  }

  /** The warm pool a working desk throws across the floor. */
  _lamp(room, layout) {
    const ctx = this.ctx
    const c = at(layout, room, 3.5, 3)
    const r = 5 * T * layout.scale
    const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r)
    // Brighter the darker it is outside, like the village's own lit windows.
    g.addColorStop(0, rgba(P.lampGlow, 0.1 + 0.22 * room.night))
    g.addColorStop(1, rgba(P.lampGlow, 0))
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = g
    ctx.fillRect(c.x - r, c.y - r, r * 2, r * 2)
    ctx.restore()
  }
}
