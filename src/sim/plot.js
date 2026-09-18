// A plot: one repo's cells, the stable slot each of its threads builds on, and how its ground is
// painted (yard, road ring, fence with gaps lined up with the walkways).
import { BED, BOARD_LOCAL, CELL_TILES, FLOWER_PITCH, FLOWER_ROWS, FLOWER_TOP, FLOWERS_PER_CELL, SLOTS_PER_CELL, SLOT_LOCAL } from './constants.js'
import { key } from './grid.js'
import { signature } from './layout.js'
import { STATUS_RANK } from './status.js'

export const TILE = { WILD: 0, YARD: 1, ROAD: 2, PLAZA: 3, BED: 4 }
export const DECO = { NONE: 0, FENCE_H: 1, FENCE_V: 2, POST: 3, FLOWERS: 4, PEBBLES: 5, CROPS: 6 }

/** Fence gaps line up with the yard's walkways: columns 4 and 7, rows 4 and 9. */
const GAP_X = new Set([4, 7])
const GAP_Y = new Set([4, 9])

export class Plot {
  constructor(name, accent) {
    this.name = name
    this.accent = accent
    this.cells = []
    this.sig = ''
    this.slotOf = new Map() // thread id → slot index
  }

  setCells(cells) {
    const sig = signature(cells)
    const changed = sig !== this.sig
    this.cells = cells
    this.sig = sig
    return changed
  }

  get capacity() {
    return this.cells.length * SLOTS_PER_CELL
  }

  /**
   * A thread keeps its slot once it has one: archiving one thread must not shuffle its siblings.
   * Newcomers take the lowest free slot, most urgent first, then oldest; a slot beyond a shrunken
   * plot's capacity is reassigned.
   *
   * A plot boxed in by its neighbours can have more threads than slots. Then a thread that wants
   * something (stuck, waiting on you, done, working) takes the slot of one strictly quieter,
   * sleepiest first. Handing slots out oldest first left the newest threads homeless, and those
   * are the ones you are working in. Equal ranks never displace each other, so nothing churns.
   */
  assignSlots(threads) {
    const ids = new Set(threads.map((t) => t.id))
    for (const id of [...this.slotOf.keys()]) if (!ids.has(id)) this.slotOf.delete(id)
    const used = new Set()
    for (const [id, s] of this.slotOf) {
      if (s < this.capacity && !used.has(s)) used.add(s)
      else this.slotOf.delete(id)
    }
    const byId = new Map(threads.map((t) => [t.id, t]))
    const rank = (t) => STATUS_RANK[t.status] ?? STATUS_RANK.idle
    const older = (a, b) => (a.createdAt || 0) - (b.createdAt || 0) || (a.id < b.id ? -1 : 1)
    const sorted = [...threads].sort((a, b) => rank(a) - rank(b) || older(a, b))
    let next = 0
    for (const t of sorted) {
      if (this.slotOf.has(t.id)) continue
      while (used.has(next)) next++
      if (next < this.capacity) {
        this.slotOf.set(t.id, next)
        used.add(next)
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

  /** Top-left tile of the building footprint for a slot. */
  slotTile(slot) {
    const [cx, cy] = this.cells[Math.floor(slot / SLOTS_PER_CELL)]
    const [lx, ly] = SLOT_LOCAL[slot % SLOTS_PER_CELL]
    return { x: cx * CELL_TILES + lx, y: cy * CELL_TILES + ly }
  }

  get flowerCapacity() {
    return this.cells.length * FLOWERS_PER_CELL
  }

  /**
   * Where flower `i` stands (its base, in tiles). Like a contribution graph: each column fills top
   * to bottom, columns run left to right, and a full bed carries on in the plot's next cell.
   */
  flowerSpot(i) {
    const [cx, cy] = this.cells[Math.floor(i / FLOWERS_PER_CELL)]
    const j = i % FLOWERS_PER_CELL
    const col = Math.floor(j / FLOWER_ROWS)
    const row = j % FLOWER_ROWS
    return {
      x: cx * CELL_TILES + BED.x + (col * FLOWER_PITCH + FLOWER_PITCH / 2) / 16,
      y: cy * CELL_TILES + BED.y + (FLOWER_TOP + row * FLOWER_PITCH + FLOWER_PITCH - 1) / 16,
    }
  }

  /** The notice board's tile. The root cell never moves as a plot grows, so neither does the board. */
  get boardTile() {
    const [cx, cy] = this.cells[0]
    return { x: cx * CELL_TILES + BOARD_LOCAL[0], y: cy * CELL_TILES + BOARD_LOCAL[1] }
  }

  /** Where the name plate floats: above the root cell's top row. */
  get labelAt() {
    const [cx, cy] = this.cells[0]
    return { x: cx * CELL_TILES + CELL_TILES / 2, y: cy * CELL_TILES + 1 }
  }

  /** Yard tiles, for pottering about. */
  yardTiles() {
    const out = []
    for (const [cx, cy] of this.cells) {
      for (let ly = 2; ly <= 9; ly++) for (let lx = 2; lx <= 9; lx++) out.push({ x: cx * CELL_TILES + lx, y: cy * CELL_TILES + ly })
    }
    return out
  }

  /** Paint this plot's cells into the map arrays. */
  paint(map, owner) {
    const mine = (cx, cy) => owner.get(key(cx, cy)) === this.name
    for (const [cx, cy] of this.cells) {
      const n = mine(cx, cy - 1)
      const s = mine(cx, cy + 1)
      const w = mine(cx - 1, cy)
      const e = mine(cx + 1, cy)
      for (let ly = 0; ly < CELL_TILES; ly++) {
        for (let lx = 0; lx < CELL_TILES; lx++) {
          const tx = cx * CELL_TILES + lx
          const ty = cy * CELL_TILES + ly
          const edgeRoad = (ly === 0 && !n) || (ly === CELL_TILES - 1 && !s) || (lx === 0 && !w) || (lx === CELL_TILES - 1 && !e)
          const bed = lx >= BED.x && lx < BED.x + BED.w && ly >= BED.y && ly < BED.y + BED.h
          map.setTile(tx, ty, edgeRoad ? TILE.ROAD : bed ? TILE.BED : TILE.YARD)
          if (edgeRoad) continue
          const lo = w ? 0 : 1
          const hi = e ? CELL_TILES - 1 : CELL_TILES - 2
          const top = n ? 0 : 1
          const bottom = s ? CELL_TILES - 1 : CELL_TILES - 2
          let deco = DECO.NONE
          if ((ly === 1 && !n) || (ly === CELL_TILES - 2 && !s)) {
            if (lx >= lo && lx <= hi && !GAP_X.has(lx)) deco = DECO.FENCE_H
          }
          if ((lx === 1 && !w) || (lx === CELL_TILES - 2 && !e)) {
            if (ly >= top && ly <= bottom && !GAP_Y.has(ly)) deco = deco === DECO.FENCE_H ? DECO.POST : DECO.FENCE_V
          }
          if (deco) map.setDeco(tx, ty, deco)
        }
      }
    }
  }
}
