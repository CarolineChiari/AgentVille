// A minimap in the corner: one block per cell in its plot's accent, a dot for each villager who
// wants something, and a rectangle for the view. Click or drag to jump.
import { ACCENTS, BADGE, PALETTE as P, TILE_PX } from '../render/sprites/palette.js'
import { CELL_TILES, GATE_CELL } from '../sim/constants.js'

export const MAP_W = 168
export const MAP_H = 120
// Half a second is plenty for a thing you glance at, and keeps it off the per-frame path.
export const REDRAW_MS = 500
const CELL_PX = CELL_TILES * TILE_PX
// The badges that ask for you: ? ! ✓. Working and party would bury them.
const DOTS = ['waiting', 'blocked', 'done']

/**
 * Fit every plot's cells, and the square's, in a `w`×`h` box. Whole pixels per cell, so the
 * blocks stay crisp; the map is centred in the part the cells do not fill.
 * @param {{ plots: { cells: number[][] }[] }} frame
 * @returns {{ px: number, ox: number, oy: number, x0: number, y0: number }} cell (x0,y0) lands at (ox,oy)
 */
export function layoutOf(frame, w = MAP_W, h = MAP_H, pad = 1) {
  let x0 = GATE_CELL[0], y0 = GATE_CELL[1], x1 = x0, y1 = y0
  for (const p of frame.plots) {
    for (const [cx, cy] of p.cells) {
      x0 = Math.min(x0, cx); y0 = Math.min(y0, cy)
      x1 = Math.max(x1, cx); y1 = Math.max(y1, cy)
    }
  }
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad
  const cw = x1 - x0 + 1
  const ch = y1 - y0 + 1
  const px = Math.max(1, Math.floor(Math.min(w / cw, h / ch)))
  return { px, x0, y0, ox: Math.floor((w - cw * px) / 2), oy: Math.floor((h - ch * px) / 2) }
}

/** World pixels → map pixels, and back. */
export function toMap(lay, wx, wy) {
  return { x: lay.ox + (wx / CELL_PX - lay.x0) * lay.px, y: lay.oy + (wy / CELL_PX - lay.y0) * lay.px }
}
export function fromMap(lay, mx, my) {
  return { x: ((mx - lay.ox) / lay.px + lay.x0) * CELL_PX, y: ((my - lay.oy) / lay.px + lay.y0) * CELL_PX }
}

/** Mount the minimap into `root`. `update(frame)` is cheap to call every frame: it redraws on its own timer. */
export function createMinimap(root, camera) {
  const box = document.createElement('div')
  box.className = 'minimap'
  box.setAttribute('aria-hidden', 'true') // the village's summary already speaks for the canvas
  const cv = document.createElement('canvas')
  cv.width = MAP_W
  cv.height = MAP_H
  box.append(cv)
  root.append(box)
  const g = cv.getContext('2d')
  let lay = null
  let lastDraw = -Infinity
  let frame = null

  function draw() {
    lay = layoutOf(frame)
    g.clearRect(0, 0, MAP_W, MAP_H)
    const { px } = lay
    for (const p of frame.plots) {
      g.fillStyle = ACCENTS[p.accent % ACCENTS.length]
      for (const [cx, cy] of p.cells) g.fillRect(lay.ox + (cx - lay.x0) * px, lay.oy + (cy - lay.y0) * px, px - 1, px - 1)
    }
    g.fillStyle = P.ash
    g.fillRect(lay.ox + (GATE_CELL[0] - lay.x0) * px, lay.oy + (GATE_CELL[1] - lay.y0) * px, px - 1, px - 1)
    for (const v of frame.villagers) {
      // By badge, not status: a villager walking off to the gate keeps its status but has no badge.
      if (!DOTS.includes(v.badge)) continue
      const m = toMap(lay, v.x * TILE_PX, v.y * TILE_PX)
      g.fillStyle = BADGE[v.badge]
      g.fillRect(Math.round(m.x) - 1, Math.round(m.y) - 1, 3, 3)
    }
    // The part of the screen not under the panels, as the camera sees it.
    const a = camera.toWorld(camera.insetLeft / camera.dpr, 0)
    const b = camera.toWorld((camera.width - camera.insetRight) / camera.dpr, camera.height / camera.dpr)
    const p0 = toMap(lay, a.x, a.y)
    const p1 = toMap(lay, b.x, b.y)
    g.strokeStyle = P.white
    g.lineWidth = 1
    g.strokeRect(Math.round(p0.x) + 0.5, Math.round(p0.y) + 0.5, Math.round(p1.x - p0.x), Math.round(p1.y - p0.y))
  }

  function jump(e) {
    if (!lay) return
    const r = cv.getBoundingClientRect()
    const w = fromMap(lay, ((e.clientX - r.left) / r.width) * MAP_W, ((e.clientY - r.top) / r.height) * MAP_H)
    camera.target = null
    camera.x = w.x
    camera.y = w.y
    lastDraw = -Infinity // the rectangle follows the pointer, not half a second behind it
  }
  cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); jump(e) })
  cv.addEventListener('pointermove', (e) => { if (cv.hasPointerCapture(e.pointerId)) jump(e) })

  return {
    update(next, now = performance.now()) {
      frame = next
      if (box.offsetParent === null || now - lastDraw < REDRAW_MS) return
      lastDraw = now
      draw()
    },
  }
}
