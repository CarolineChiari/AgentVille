// A pixel-art camera: integer zoom (device pixels per world pixel) so every sprite pixel is the
// same size, drag that keeps the grabbed ground point under the cursor, and wheel zoom that keeps
// the point under the cursor fixed.
import { TILE_PX } from './sprites/palette.js'

export const MIN_SCALE = 1
export const MAX_SCALE = 12
// Held-key movement, in CSS pixels a second: the map slides past at one pace at every zoom,
// where a pace in world pixels would crawl zoomed in and race zoomed out.
export const MOVE_SPEED = 800
export const MOVE_BOOST = 2.5 // with Shift
// How fast movement reaches full speed and comes to rest. Instant felt like a jolt; this is a
// short run-up, and letting go coasts to a stop in about a third of a second.
const MOVE_EASE = 14
const MOVE_REST = 5 // CSS px/s: slower than this with nothing held is stopped

export class Camera {
  constructor() {
    this.x = 0 // world pixels at the centre of the screen
    this.y = 0
    this.scale = 3
    this.width = 1 // device pixels
    this.height = 1
    this.dpr = 1
    this.insetRight = 0 // device pixels hidden under the sidebar
    this.insetLeft = 0 // …and under the transcript panel
    this.target = null // eased fly-to
    this.vx = 0 // CSS px/s, from held movement keys
    this.vy = 0
  }

  resize(cssW, cssH, dpr) {
    this.dpr = dpr
    this.width = Math.max(1, Math.floor(cssW * dpr))
    this.height = Math.max(1, Math.floor(cssH * dpr))
  }

  defaultScale() {
    return Math.max(2, Math.round(2 * this.dpr))
  }

  /** Screen-space origin of world (0,0), rounded once so every sprite lands on whole device pixels. */
  get offX() {
    return Math.round((this.width + this.insetLeft - this.insetRight) / 2 - this.x * this.scale)
  }
  get offY() {
    return Math.round(this.height / 2 - this.y * this.scale)
  }

  /** CSS pixels → world pixels. */
  toWorld(cssX, cssY) {
    return { x: (cssX * this.dpr - this.offX) / this.scale, y: (cssY * this.dpr - this.offY) / this.scale }
  }
  toTile(cssX, cssY) {
    const w = this.toWorld(cssX, cssY)
    return { x: w.x / TILE_PX, y: w.y / TILE_PX }
  }
  /** World pixels → CSS pixels. */
  toScreen(wx, wy) {
    return { x: (this.offX + wx * this.scale) / this.dpr, y: (this.offY + wy * this.scale) / this.dpr }
  }

  /** Keep world point `w` under CSS point (cssX, cssY). */
  pin(w, cssX, cssY) {
    this.x = w.x - (cssX * this.dpr - (this.width + this.insetLeft - this.insetRight) / 2) / this.scale
    this.y = w.y - (cssY * this.dpr - this.height / 2) / this.scale
    this.target = null
  }

  zoomAt(cssX, cssY, steps) {
    const w = this.toWorld(cssX, cssY)
    const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, this.scale + steps))
    if (next === this.scale) return
    this.scale = next
    this.pin(w, cssX, cssY)
  }

  panBy(dxCss, dyCss) {
    this.x -= (dxCss * this.dpr) / this.scale
    this.y -= (dyCss * this.dpr) / this.scale
    this.target = null
  }

  flyTo(wx, wy) {
    this.target = { x: wx, y: wy }
    // Or the last of a coast would cancel it.
    this.vx = 0
    this.vy = 0
  }

  /** Move toward unit direction `dir` (from the held keys) for `dt` seconds, easing in and out. */
  steer(dir, boost, dt) {
    const speed = MOVE_SPEED * (boost ? MOVE_BOOST : 1)
    const k = 1 - Math.exp(-dt * MOVE_EASE)
    this.vx += (dir.x * speed - this.vx) * k
    this.vy += (dir.y * speed - this.vy) * k
    // Stopped, it must not pan at all: panning drops a fly-to.
    if (!dir.x && !dir.y && Math.hypot(this.vx, this.vy) < MOVE_REST) {
      this.vx = 0
      this.vy = 0
      return
    }
    this.panBy(-this.vx * dt, -this.vy * dt)
  }

  update(dt) {
    if (!this.target) return
    const k = 1 - Math.exp(-dt * 6)
    this.x += (this.target.x - this.x) * k
    this.y += (this.target.y - this.y) * k
    if (Math.hypot(this.target.x - this.x, this.target.y - this.y) < 0.5) this.target = null
  }
}
