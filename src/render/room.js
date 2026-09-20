// Drawing the inside of a building. The room comes from src/sim/room.js in tile units; this puts
// it on the same canvas the village uses, centred in whatever the panels leave free, at a whole
// number of device pixels per world pixel so nothing blurs.
//
// The change log is part of the room: it is written on the board across the back wall, in text
// rather than in pixels — a path has to be readable — and the lines on it are what you click.
import { sprites } from './sprites/registry.js'
import { PALETTE as P, TILE_PX as T, BADGE, rgba } from './sprites/palette.js'
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
 * The board's own measurements, in room pixels, so they scale with the room like everything else.
 * A row is 4px tall: at the size a room is normally drawn that is a comfortable line of text, and
 * at any size it stays in proportion with the furniture.
 */
const BOARD = { pad: 8, head: 8, sub: 6, tabs: 8, row: 4, gutter: 3 }
/**
 * Reading one file's changes close up: smaller writing, because you are standing at the board and
 * every line of the change has to fit on it.
 */
const REVIEW = { row: 2.3, sign: 2, head: 4.5, sub: 3.2 }
/**
 * The columns of a row, in room pixels from the board's inner edge: the mark, then the path, and
 * the time right-aligned at the far end. Room pixels rather than fractions of the width, so the
 * mark stays beside what it marks however wide the board is drawn.
 */
const COL = { text: 5, tail: 14 }

/** Line colours: the same meanings the card and the village use. */
const KIND_INK = {
  created: BADGE.done,
  deleted: BADGE.blocked,
  renamed: BADGE.working,
  edited: P.mithril,
  commit: BADGE.waiting,
}
/** A diff's own colours: what arrived, what went, and what was already there. */
const DIFF_INK = { '+': BADGE.done, '-': BADGE.blocked, ' ': P.mithril, '…': P.metalDark }
const MARK = { created: '+', edited: '·', deleted: '−', renamed: '→' }

/**
 * How big the room is drawn and where its top-left corner goes, in device pixels.
 * @param {object} room  a RoomFrame
 * @param {{ width: number, height: number, insetLeft?: number, insetRight?: number }} view  device pixels
 */
export function roomLayout(room, { width, height, insetLeft = 0, insetRight = 0, insetTop = 0 }) {
  const wPx = room.w * T
  const hPx = (room.h + room.wallH) * T
  const free = Math.max(1, width - insetLeft - insetRight)
  const tall = Math.max(1, height - insetTop)
  const fit = Math.min((free - MARGIN) / wPx, (tall - MARGIN) / hPx)
  const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.floor(fit)))
  return {
    scale,
    ox: Math.round(insetLeft + (free - wPx * scale) / 2),
    oy: Math.round(insetTop + (tall - hPx * scale) / 2),
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

/** `text`, cut with an ellipsis to fit `max` device pixels. */
function clipText(ctx, text, max) {
  const s = String(text ?? '')
  if (!s || ctx.measureText(s).width <= max) return s
  let lo = 0
  let hi = s.length
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (ctx.measureText(s.slice(0, mid) + '…').width <= max) lo = mid
    else hi = mid - 1
  }
  return lo > 0 ? s.slice(0, lo) + '…' : ''
}

export class RoomRenderer {
  /** @param {CanvasRenderingContext2D} ctx  the village's own context, so both draw on one canvas */
  constructor(ctx) {
    this.ctx = ctx
    this.layout = null
    /** Device-pixel rectangles of everything on the board that can be clicked, rebuilt each frame. */
    this.hot = []
    /** What the pointer is over: one of the entries in `hot`, or null. */
    this.hover = null
  }

  /**
   * @param {object} room     a RoomFrame from src/sim/room.js
   * @param {object} view     { width, height, insetLeft, insetRight } in device pixels
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
    const draw = (img, x, y) => ctx.drawImage(img, Math.round(x), Math.round(y), img.width * scale, img.height * scale)

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

    this.hot = []
    const review = Boolean(room.board.review)
    if (!review) this._board(room, this._wallRect(room, layout), layout.scale)
    else {
      // Reviewing: the board itself is drawn blank on the wall, and the one you read is the same
      // board stood in front of you, so the room is still there behind it.
      const wall = this._wallRect(room, layout)
      ctx.drawImage(sprites.get('interior.logboard'), wall.x, wall.y, wall.w, wall.h)
    }
    for (const prop of room.props) this._prop(room, layout, prop)
    this._villager(room, layout, time)
    if (room.lamp) this._lamp(room, layout)
    if (review) {
      ctx.fillStyle = rgba(P.interior, 0.72)
      ctx.fillRect(0, 0, view.width, view.height)
      const rect = this._closeRect(room, view)
      this._board(room, rect, rect.s)
    }
    ctx.restore()
  }

  /** Where the board hangs on the wall, in device pixels. */
  _wallRect(room, layout) {
    const b = room.board
    const p = at(layout, room, b.x, b.y)
    const s = layout.scale
    return { x: Math.round(p.x), y: Math.round(p.y), w: b.w * T * s, h: b.h * T * s, s }
  }

  /**
   * Where the board goes when you walk up to it: as big as the window allows, still a whole
   * number of pixels per pixel so the frame stays crisp.
   */
  _closeRect(room, view) {
    const b = room.board
    const wPx = b.w * T
    const hPx = b.h * T
    const free = Math.max(1, view.width - (view.insetLeft || 0) - (view.insetRight || 0))
    const tall = Math.max(1, view.height - (view.insetTop || 0))
    const s = Math.max(MIN_SCALE, Math.floor(Math.min((free - MARGIN) / wPx, (tall - MARGIN) / hPx)))
    return {
      x: Math.round((view.insetLeft || 0) + (free - wPx * s) / 2),
      y: Math.round((view.insetTop || 0) + (tall - hPx * s) / 2),
      w: wPx * s,
      h: hPx * s,
      s,
    }
  }

  /** The change log, written on the board — wherever the board happens to be. */
  _board(room, rect, s) {
    const ctx = this.ctx
    const b = room.board
    this.boardRect = rect
    ctx.drawImage(sprites.get('interior.logboard'), rect.x, rect.y, rect.w, rect.h)

    const x0 = rect.x + BOARD.pad * s
    const w = (b.w * T - BOARD.pad * 2) * s
    let y = rect.y + BOARD.pad * s
    const font = (px, weight = 400) => {
      ctx.font = `${weight} ${Math.max(7, Math.round(px * s * 0.78))}px ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif`
    }
    const mono = (px) => {
      ctx.font = `${Math.max(7, Math.round(px * s * 0.74))}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`
    }
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'

    // Which session's room this is — or which file you are reading — so the board says it itself.
    const headH = b.review ? REVIEW.head : BOARD.head
    const subH = b.review ? REVIEW.sub : BOARD.sub
    font(headH, 600)
    ctx.fillStyle = P.white
    ctx.fillText(clipText(ctx, b.heading, w), x0, y + (headH / 2) * s)
    y += headH * s
    font(subH)
    ctx.fillStyle = P.mithril
    ctx.fillText(clipText(ctx, b.sub, w), x0, y + (subH / 2) * s)
    y += (subH + 1) * s

    // Tabs: the two ways of reading the same log. A board being read close up has none, but it
    // still keeps the row if there is a "how far down" to put in it.
    const tabsH = b.tabs.length ? BOARD.tabs : b.total > b.rows ? subH : 0
    font(BOARD.tabs - 2, 600)
    let tx = x0
    for (const tab of b.tabs) {
      const tw = ctx.measureText(tab.label).width + 6 * s
      const rect = { x0: tx, y0: y, x1: tx + tw, y1: y + tabsH * s, act: 'tab', tab: tab.key }
      ctx.fillStyle = tab.on ? rgba(P.glitter, 0.22) : this._isHover(rect) ? rgba(P.white, 0.1) : rgba(P.outline, 0.35)
      ctx.fillRect(rect.x0, rect.y0, tw, tabsH * s)
      ctx.fillStyle = tab.on ? P.glitter : P.mithril
      ctx.fillText(tab.label, tx + 3 * s, y + (tabsH / 2) * s)
      this.hot.push(rect)
      tx += tw + 3 * s
    }
    // How far down a scrolling log you are, said plainly rather than with a bar too thin to see.
    if (b.total > b.rows) {
      font(subH)
      ctx.fillStyle = P.mithril
      ctx.textAlign = 'right'
      ctx.fillText(`${b.scroll + 1}–${Math.min(b.total, b.scroll + b.rows)} of ${b.total} · scroll`, x0 + w, y + (tabsH / 2) * s)
      ctx.textAlign = 'left'
    }
    y += (tabsH + 1) * s

    const rowH = (b.review ? REVIEW.row : BOARD.row) * s
    for (const line of b.lines) {
      const rect = { x0, y0: y, x1: x0 + w, y1: y + rowH, act: line.act || '', line }
      const mid = y + rowH / 2
      if (line.act && this._isHover(rect)) {
        ctx.fillStyle = rgba(P.white, 0.09)
        ctx.fillRect(x0 - 2 * s, y, w + 4 * s, rowH)
      }
      const indent = line.type === 'edit' || line.type === 'open' || line.type === 'review' ? BOARD.gutter * s : 0
      const textX = x0 + COL.text * s
      const textW = w - (COL.text + COL.tail) * s
      if (line.type === 'diff') {
        // A line of the change itself: its sign in the margin, the line as it is written.
        mono(REVIEW.row)
        ctx.fillStyle = DIFF_INK[line.sign] || P.mithril
        if (line.sign === '+' || line.sign === '-') {
          ctx.fillStyle = rgba(DIFF_INK[line.sign], 0.13)
          ctx.fillRect(x0 - 2 * s, y, w + 4 * s, rowH)
          ctx.fillStyle = DIFF_INK[line.sign]
        }
        ctx.fillText(line.sign === '…' ? '' : line.sign, x0, mid)
        ctx.fillStyle = line.sign === ' ' ? P.mithril : line.sign === '…' ? P.metalDark : P.white
        ctx.fillText(clipText(ctx, line.text, w - REVIEW.sign * s), x0 + REVIEW.sign * s, mid)
      } else if (line.type === 'edit-head') {
        // Which call this was, and what it came to: +n −n, the way a diff is counted.
        font(REVIEW.row + 0.4, 600)
        ctx.fillStyle = P.white
        ctx.fillText(clipText(ctx, line.text, textW), x0, mid)
        ctx.textAlign = 'right'
        ctx.fillStyle = KIND_INK.created
        const plus = `+${line.added}`
        const minus = ` −${line.removed}`
        const when = `  ${line.when}`
        const wWhen = ctx.measureText(when).width
        const wMinus = ctx.measureText(minus).width
        ctx.fillStyle = P.mithril
        ctx.fillText(when, x0 + w, mid)
        ctx.fillStyle = KIND_INK.deleted
        ctx.fillText(minus, x0 + w - wWhen, mid)
        ctx.fillStyle = KIND_INK.created
        ctx.fillText(plus, x0 + w - wWhen - wMinus, mid)
        ctx.textAlign = 'left'
      } else if (line.type === 'hunk' || line.type === 'gap') {
        ctx.fillStyle = rgba(P.white, 0.12)
        ctx.fillRect(x0, y + rowH / 2, w, Math.max(1, Math.round(s * 0.2)))
      } else if (line.type === 'back') {
        font(b.review ? REVIEW.row + 0.6 : BOARD.row, 600)
        ctx.fillStyle = P.glitter
        ctx.fillText(line.text, x0, mid)
      } else if (line.type === 'file') {
        mono(BOARD.row)
        ctx.fillStyle = KIND_INK[line.kind] || P.mithril
        ctx.fillText(line.open ? '▾' : MARK[line.kind] || '·', x0, mid)
        ctx.fillStyle = P.white
        ctx.fillText(clipText(ctx, line.path, textW), textX, mid)
        ctx.textAlign = 'right'
        ctx.fillStyle = P.mithril
        ctx.fillText(`${line.count > 1 ? `${line.count}× ` : ''}${line.when}`, x0 + w, mid)
        ctx.textAlign = 'left'
      } else if (line.type === 'entry') {
        mono(BOARD.row)
        ctx.fillStyle = KIND_INK[line.kind] || P.mithril
        ctx.fillText(MARK[line.kind] || '·', x0, mid)
        ctx.fillStyle = P.white
        const pathW = Math.min(textW * 0.55, ctx.measureText(line.path).width)
        ctx.fillText(clipText(ctx, line.path, textW * 0.55), textX, mid)
        font(BOARD.row)
        ctx.fillStyle = P.mithril
        ctx.fillText(clipText(ctx, line.text, textW - pathW - 2 * s), textX + pathW + 2 * s, mid)
        ctx.textAlign = 'right'
        ctx.fillText(line.when, x0 + w, mid)
        ctx.textAlign = 'left'
      } else if (line.type === 'commit') {
        mono(BOARD.row)
        ctx.fillStyle = KIND_INK.commit
        ctx.fillText('✦', x0, mid)
        font(BOARD.row, 600)
        ctx.fillStyle = KIND_INK.commit
        ctx.fillText(clipText(ctx, line.text, textW), textX, mid)
        ctx.textAlign = 'right'
        ctx.fillStyle = P.mithril
        ctx.fillText(line.when, x0 + w, mid)
        ctx.textAlign = 'left'
      } else if (line.type === 'edit') {
        font(BOARD.row)
        ctx.fillStyle = P.mithril
        ctx.fillText(clipText(ctx, line.text, textW - indent), textX + indent, mid)
        ctx.textAlign = 'right'
        ctx.fillText(line.when, x0 + w, mid)
        ctx.textAlign = 'left'
      } else {
        font(b.review ? REVIEW.row : BOARD.row)
        ctx.fillStyle = line.act ? P.glitter : P.mithril
        ctx.fillText(clipText(ctx, line.text, textW - indent), textX + indent, mid)
      }
      if (rect.act) this.hot.push(rect)
      y += rowH
    }
  }

  _isHover(rect) {
    const h = this.hover
    return Boolean(h && h.y0 === rect.y0 && h.x0 === rect.x0)
  }

  /**
   * What is under a CSS-pixel point: a line or tab of the board, the door, or nothing.
   * @returns {{ act: string, tab?: string, line?: object } | { act: 'leave' } | null}
   */
  hit(room, cssX, cssY, dpr = 1) {
    const x = cssX * dpr
    const y = cssY * dpr
    for (const rect of this.hot) {
      if (x >= rect.x0 && x <= rect.x1 && y >= rect.y0 && y < rect.y1) return rect
    }
    if (!this.layout) return null
    const tile = roomPick(room, this.layout, cssX, cssY, dpr)
    if (tile && tile.x === room.door.x && tile.y === room.door.y) return { act: 'leave' }
    return null
  }

  /** Is this point over the board at all? That is what the wheel scrolls. */
  overBoard(room, cssX, cssY, dpr = 1) {
    const r = this.boardRect
    if (!r) return false
    const x = cssX * dpr
    const y = cssY * dpr
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
  }

  /** One piece of furniture, its feet at the bottom of its own tile. */
  _prop(room, layout, prop) {
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
      for (const [i] of prop.notes.entries()) {
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
    const c = at(layout, room, 4.5, 3)
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
