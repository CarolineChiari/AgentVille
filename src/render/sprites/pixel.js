// A tiny pixel buffer to draw sprites into, one pixel at a time, before it becomes a canvas.

const RGBA = new Map()
function parse(c) {
  let v = RGBA.get(c)
  if (v) return v
  const h = c.replace('#', '')
  v = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length >= 8 ? parseInt(h.slice(6, 8), 16) : 255]
  RGBA.set(c, v)
  return v
}

export class PixelCanvas {
  constructor(w, h) {
    this.w = w
    this.h = h
    this.data = new Uint8ClampedArray(w * h * 4)
  }

  px(x, y, c) {
    if (!c) return
    x |= 0
    y |= 0
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    const [r, g, b, a] = parse(c)
    const i = (y * this.w + x) * 4
    this.data[i] = r
    this.data[i + 1] = g
    this.data[i + 2] = b
    this.data[i + 3] = a
  }

  opaque(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false
    return this.data[(y * this.w + x) * 4 + 3] > 0
  }

  clearPx(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    this.data[(y * this.w + x) * 4 + 3] = 0
  }

  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c)
  }
  hline(x0, x1, y, c) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.px(x, y, c)
  }
  vline(x, y0, y1, c) {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.px(x, y, c)
  }
  line(x0, y0, x1, y1, c) {
    const dx = Math.abs(x1 - x0)
    const dy = -Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1
    const sy = y0 < y1 ? 1 : -1
    let err = dx + dy
    for (;;) {
      this.px(x0, y0, c)
      if (x0 === x1 && y0 === y1) break
      const e2 = 2 * err
      if (e2 >= dy) {
        err += dy
        x0 += sx
      }
      if (e2 <= dx) {
        err += dx
        y0 += sy
      }
    }
  }
  /** Filled ellipse centred on (cx, cy), radii in pixels. Half-pixel centres are fine. */
  ellipse(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx
        const dy = (y + 0.5 - cy) / ry
        if (dx * dx + dy * dy <= 1) this.px(x, y, c)
      }
    }
  }

  /** Every transparent pixel touching an opaque one (4-neighbour) becomes `c`. */
  outline(c) {
    const edge = []
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.opaque(x, y)) continue
        if (this.opaque(x - 1, y) || this.opaque(x + 1, y) || this.opaque(x, y - 1) || this.opaque(x, y + 1)) edge.push(x, y)
      }
    }
    for (let i = 0; i < edge.length; i += 2) this.px(edge[i], edge[i + 1], c)
    return this
  }

  flipX() {
    const out = new PixelCanvas(this.w, this.h)
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const s = (y * this.w + x) * 4
        const d = (y * this.w + (this.w - 1 - x)) * 4
        out.data[d] = this.data[s]
        out.data[d + 1] = this.data[s + 1]
        out.data[d + 2] = this.data[s + 2]
        out.data[d + 3] = this.data[s + 3]
      }
    }
    return out
  }

  toCanvas() {
    const canvas = document.createElement('canvas')
    canvas.width = this.w
    canvas.height = this.h
    canvas.getContext('2d').putImageData(new ImageData(this.data, this.w, this.h), 0, 0)
    return canvas
  }
}
