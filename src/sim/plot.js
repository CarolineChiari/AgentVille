// A plot: one repo's rectangle of cells, the house each of its threads builds, and how its ground
// is painted. Where anything goes inside it comes from shape.js.
import { key, unkey } from './grid.js'
import { signature } from './layout.js'
import { DEFAULT_SPOT, flowerAt, isFenceGap, isTrail, landmarkSpotOf, propsOf, rectOf, shapeOf, tilledRows } from './shape.js'
import { STATUS_RANK } from './status.js'
import { SLOT_PITCH } from './constants.js'
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
    this.groupOf = new Map() // thread id → the group it was in when its house was placed; see assignSlots
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
    if (changed && this.shape) this._reshape()
    return changed
  }

  /** Lay the courtyard out again: after the plot's cells change, its landmark moves, or it grows. */
  _reshape() {
    this.shape = shapeOf(rectOf(this.cells), this.spot, this.tier)
    this.slotKeys = this.shape.slots.map((s) => key(s.x, s.y))
    this.props = propsOf(this.shape, this.tier)
    this.tilled = tilledRows(this.shape, Math.min(this.planted, this.flowerCapacity))
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

  /**
   * Raise (or set) its landmark's tier. True if that changes what stands on the plot. A taller
   * landmark needs more room above it, so a tier can move it down a shallow field, and the field
   * is laid out round it again where it now stands.
   */
  setTier(tier) {
    const changed = tier !== this.tier
    this.tier = tier
    if (changed && this.shape) this._reshape()
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
   *
   * Threads in the same group (`t.group`) live side by side. A newcomer in one takes the free slot
   * nearest the rest of its group. Anybody else, the first of a group included, takes the free slot
   * nearest the middle that isn't beside another group's house, so that every group keeps room to
   * grow, and only if there is none the one nearest the middle; and the groups move in before
   * anybody in none, a group at a time. A thread you put in another group moves only if that brings
   * it nearer the rest of that group: to a free slot, or else into the house of a thread in no
   * group, who takes its old one. That is the one time a house moves for another's sake, and only
   * because you asked. A plot with no groups is laid out exactly as it always was.
   */
  assignSlots(threads) {
    const ids = new Set(threads.map((t) => t.id))
    const exists = new Set(this.slotKeys)
    for (const id of [...this.slotOf.keys()]) if (!ids.has(id)) this.slotOf.delete(id)
    for (const id of [...this.groupOf.keys()]) if (!ids.has(id)) this.groupOf.delete(id)
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

    // Who moves in: everybody while there is room, then the most urgent in place of the quietest.
    const incoming = []
    let room = free.length
    for (const t of sorted) {
      if (this.slotOf.has(t.id)) continue
      if (room > 0) {
        room--
        incoming.push(t)
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
      free.push(this.slotOf.get(victim.id))
      this.slotOf.delete(victim.id)
      this.groupOf.delete(victim.id)
      incoming.push(t)
    }

    const apart = (a, b) => {
      const [ax, ay] = unkey(a)
      const [bx, by] = unkey(b)
      return Math.hypot(ax - bx, ay - by)
    }
    // How near a slot is to the houses of `group`, leaving out `self`'s: the nearest one's distance.
    const near = (slot, group, self) => {
      let best = Infinity
      for (const [id, s] of this.slotOf) if (id !== self && byId.get(id)?.group === group) best = Math.min(best, apart(s, slot))
      return best
    }
    // Next door to a house of any group but `own`: neighbours along a row or down a side are a pitch apart.
    const beside = (slot, own) => [...this.slotOf].some(([id, s]) => byId.get(id)?.group && byId.get(id).group !== own && apart(s, slot) <= SLOT_PITCH)
    // Of `slots`, the one nearest the rest of t's group, the earlier of two as near. For a thread in
    // no group, or the first of its group here, the first of them beside no other group, else the
    // first of them: in `slots`' order, which puts the most central first.
    const nearest = (t, slots) => {
      let best = slots[0]
      let d = t.group ? near(best, t.group, t.id) : Infinity
      if (d === Infinity) return slots.find((s) => !beside(s, t.group)) ?? best
      for (const s of slots) {
        const e = near(s, t.group, t.id)
        if (e < d) [best, d] = [s, e]
      }
      return best
    }

    // Where each moves in. Each group together, in the order their most urgent arrived, then the rest.
    const order = [...new Set(incoming.map((t) => t.group || ''))].filter(Boolean)
    const moving = [...order.flatMap((g) => incoming.filter((t) => t.group === g)), ...incoming.filter((t) => !t.group)]
    for (const t of moving) {
      const s = nearest(t, free)
      free.splice(free.indexOf(s), 1)
      this.slotOf.set(t.id, s)
      this.groupOf.set(t.id, t.group || '')
    }

    // Put in another group since it moved in: nearer the rest of it, if anywhere is. A free slot
    // first, as near as a house in no group is, so nobody moves who needn't.
    for (const t of sorted) {
      const here = this.slotOf.get(t.id)
      const was = this.groupOf.get(t.id)
      if (here === undefined || was === (t.group || '')) continue
      this.groupOf.set(t.id, t.group || '')
      if (!t.group) continue
      let best = here
      let d = near(here, t.group, t.id)
      if (d === Infinity) continue
      const homes = [...this.slotOf].filter(([id]) => id !== t.id && !byId.get(id)?.group).map(([, s]) => s)
      for (const s of [...free, ...homes]) {
        const e = near(s, t.group, t.id)
        if (e < d) [best, d] = [s, e]
      }
      if (best === here) continue
      const other = [...this.slotOf].find(([, s]) => s === best)?.[0]
      if (other) this.slotOf.set(other, here)
      else free.splice(free.indexOf(best), 1, here)
      this.slotOf.set(t.id, best)
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
