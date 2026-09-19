// A plot: one repo's rectangle of cells, the house each of its threads builds, and how its ground
// is painted. Where anything goes inside it comes from shape.js.
import { key, unkey } from './grid.js'
import { signature } from './layout.js'
import { DEFAULT_SPOT, flowerAt, isFenceGap, isTrail, landmarkSpotOf, propsOf, rectOf, shapeOf, tilledRows } from './shape.js'
import { STATUS_RANK } from './status.js'
import { plotStyle } from './style.js'

/** Ground kinds. None is saved anywhere, so the numbers are free to change. */
export const TILE = { WILD: 0, YARD: 1, ROAD: 2, PLAZA: 3, BED: 4, TRAIL: 5, WATER: 6 }
/** What lies on the ground. Fences block; the rest is underfoot. */
export const DECO = {
  NONE: 0, FENCE_H: 1, FENCE_V: 2, POST: 3, FLOWERS: 4, PEBBLES: 5, TALLGRASS: 6, CLOVER: 7, MUSHROOMS: 8, REEDS: 9,
  LILYPAD: 10,
}

const inRect = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h

export class Plot {
  /**
   * `style` is its look in the village's theme (see style.js); the plain village one if not given.
   * `spot` is where its landmark stands in its field (see shape.js).
   */
  constructor(name, accent, style = plotStyle(name), spot = DEFAULT_SPOT) {
    this.name = name
    this.accent = accent
    this.style = style
    this.spot = landmarkSpotOf(spot)
    this.cells = []
    this.sig = ''
    this.shape = null
    this.slotKeys = [] // every house position, "x,y" of its top-left tile, preferred first
    this.slotOf = new Map() // thread id → slot key
    this.planted = 0 // flowers asked for, so the soil can be worked out again if the field changes
    this.tilled = 0 // tile rows of the field ploughed so far
    this.tier = 0 // how far its landmark has risen; see progress.js
    this.props = [] // what that has brought with it, standing in its fence line; see propsOf
  }

  setCells(cells) {
    const sig = signature(cells)
    const changed = sig !== this.sig
    this.cells = cells
    this.sig = sig
    if (changed) this._reshape()
    return changed
  }

  /** Stand its landmark somewhere else in its field. True if that changes the plot. */
  setSpot(spot) {
    const next = landmarkSpotOf(spot)
    const changed = next !== this.spot
    this.spot = next
    // The field's spots are laid out round the landmark, so the soil is worked out again with them.
    if (changed && this.shape) {
      this._reshape()
      this.setPlanted(this.planted)
    }
    return changed
  }

  /** Lay the courtyard out again: after the plot's cells change, or its landmark moves. */
  _reshape() {
    this.shape = shapeOf(rectOf(this.cells), this.spot)
    this.slotKeys = this.shape.slots.map((s) => key(s.x, s.y))
    this.props = propsOf(this.shape, this.tier)
  }

  /** Dress the plot in another style: a new theme, or another sub-theme. True if its look changed. */
  restyle(style) {
    const changed = Object.keys(style).some((k) => style[k] !== this.style[k])
    this.style = style
    return changed
  }

  /** Plough enough of the field for `n` flowers. True if that changes the ground. */
  setPlanted(n) {
    this.planted = n
    const rows = tilledRows(this.shape, Math.min(n, this.flowerCapacity))
    const changed = rows !== this.tilled
    this.tilled = rows
    return changed
  }

  /** Raise (or set) its landmark's tier. True if that changes what stands on it. */
  setTier(tier) {
    const changed = tier !== this.tier
    this.tier = tier
    if (changed && this.shape) this.props = propsOf(this.shape, tier)
    return changed
  }

  get capacity() {
    return this.slotKeys.length
  }

  /**
   * A thread keeps its house once it has one: archiving one thread must not shuffle its siblings.
   * Slots are positions, not indices, so a plot that grows keeps every house that still fits where
   * it stood; only a house on the side that moved is rebuilt. Newcomers take the free slot nearest
   * the middle, most urgent first, then oldest.
   *
   * A plot boxed in by its neighbours can have more threads than slots. Then a thread that wants
   * something (stuck, waiting on you, done, working) takes the slot of one strictly quieter,
   * sleepiest first. Handing slots out oldest first left the newest threads homeless, and those
   * are the ones you are working in. Equal ranks never displace each other, so nothing churns.
   */
  assignSlots(threads) {
    const ids = new Set(threads.map((t) => t.id))
    const exists = new Set(this.slotKeys)
    for (const id of [...this.slotOf.keys()]) if (!ids.has(id)) this.slotOf.delete(id)
    const used = new Set()
    for (const [id, s] of this.slotOf) {
      if (exists.has(s) && !used.has(s)) used.add(s)
      else this.slotOf.delete(id)
    }
    const free = this.slotKeys.filter((s) => !used.has(s))
    const byId = new Map(threads.map((t) => [t.id, t]))
    const rank = (t) => STATUS_RANK[t.status] ?? STATUS_RANK.idle
    const older = (a, b) => (a.createdAt || 0) - (b.createdAt || 0) || (a.id < b.id ? -1 : 1)
    const sorted = [...threads].sort((a, b) => rank(a) - rank(b) || older(a, b))
    let next = 0
    for (const t of sorted) {
      if (this.slotOf.has(t.id)) continue
      if (next < free.length) {
        this.slotOf.set(t.id, free[next++])
        continue
      }
      // Full. The quietest holder, and of those the oldest, gives way if it is quieter than `t`.
      let victim = null
      for (const id of this.slotOf.keys()) {
        const h = byId.get(id)
        if (rank(h) <= rank(t)) continue
        if (!victim || rank(h) > rank(victim) || (rank(h) === rank(victim) && older(h, victim) < 0)) victim = h
      }
      // Sorted most urgent first: if this one can't displace anybody, nobody after it can.
      if (!victim) break
      this.slotOf.set(t.id, this.slotOf.get(victim.id))
      this.slotOf.delete(victim.id)
    }
  }

  /**
   * Top-left tile of the house at a slot, and whether it has open ground above it: the top row
   * does; down the sides, the house above opens its door onto the row just above.
   */
  slotTile(slot) {
    const [x, y] = unkey(slot)
    return { x, y, roomy: y === this.shape.yard.y }
  }

  get flowerCapacity() {
    return this.shape.spots.length
  }

  /**
   * Its landmark's footprint, in the field. It moves only when the plot grows, or when its spot in
   * the field changes; either way the field is laid out round it again.
   */
  get landmarkRect() {
    return { ...this.shape.landmark }
  }

  /** Where flower `i` stands (its base, in tiles): the field fills a row at a time, left to right. */
  flowerSpot(i) {
    return flowerAt(this.shape, i)
  }

  /**
   * The notice board's tile, on the bottom walkway near the left corner. It moves only when the
   * plot grows down or left, and then the fence it stands inside has moved too.
   */
  get boardTile() {
    return { ...this.shape.board }
  }

  /** Where the name plate floats: over the middle of the top road. */
  get labelAt() {
    return { ...this.shape.label }
  }

  /** Yard tiles, for pottering about: everything inside the fence, field included. */
  yardTiles() {
    const { yard } = this.shape
    const out = []
    for (let y = yard.y; y < yard.y + yard.h; y++) for (let x = yard.x; x < yard.x + yard.w; x++) out.push({ x, y })
    return out
  }

  /** Paint this plot into the map arrays: road ring, fence ring with its gaps, yard, trails, ploughed field. */
  paint(map) {
    const s = this.shape
    const { x0, y0, w: W, h: H, bed } = s
    // A prop stands in the fence line in place of the fence.
    const instead = new Set(this.props.flatMap((p) => p.tiles.map(([x, y]) => key(x, y))))
    for (let ly = 0; ly < H; ly++) {
      for (let lx = 0; lx < W; lx++) {
        const tx = x0 + lx
        const ty = y0 + ly
        const ring = Math.min(lx, ly, W - 1 - lx, H - 1 - ly)
        if (ring === 0) {
          map.setTile(tx, ty, TILE.ROAD)
          continue
        }
        // The landmark stands on grass wherever it is in the field, whatever has been ploughed round it.
        const tilled = tx >= bed.x && tx < bed.x + bed.w && ty >= bed.y && ty < bed.y + this.tilled && !inRect(s.landmark, tx, ty)
        map.setTile(tx, ty, tilled ? TILE.BED : isTrail(s, lx, ly) ? TILE.TRAIL : TILE.YARD)
        if (ring !== 1 || isFenceGap(s, lx, ly) || instead.has(key(tx, ty))) continue
        const across = ly === 1 || ly === H - 2
        const down = lx === 1 || lx === W - 2
        map.setDeco(tx, ty, across && down ? DECO.POST : across ? DECO.FENCE_H : DECO.FENCE_V)
      }
    }
  }
}
