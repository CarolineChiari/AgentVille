// The village: plots, buildings and villagers, stepped by `tick` and read out by `snapshot`.
// Nothing here knows about pixels; a renderer draws the Frame this produces.
import { CELL_TILES, GATE_CELL, GATE_TILE, MAX_ENTERING } from './constants.js'
import { key, ringOf } from './grid.js'
import { allocatePlots } from './layout.js'
import { Nav } from './nav.js'
import { DECO, Plot, TILE } from './plot.js'
import { Building } from './building.js'
import { Villager } from './villager.js'
import { STATUS_RANK } from './status.js'
import { hashString, rngFor } from './rng.js'

export const ACCENT_COUNT = 10
const SEPARATION = 0.6

/** The ground: tile kinds and decorations over a rectangle of tiles. */
export class TileMap {
  constructor(ox, oy, w, h) {
    Object.assign(this, { ox, oy, w, h })
    this.tiles = new Uint8Array(w * h)
    this.deco = new Uint8Array(w * h)
    this.version = 0
  }
  idx(x, y) {
    return x >= this.ox && y >= this.oy && x < this.ox + this.w && y < this.oy + this.h ? (y - this.oy) * this.w + (x - this.ox) : -1
  }
  setTile(x, y, v) {
    const i = this.idx(x, y)
    if (i >= 0) this.tiles[i] = v
  }
  setDeco(x, y, v) {
    const i = this.idx(x, y)
    if (i >= 0) this.deco[i] = v
  }
  tileAt(x, y) {
    const i = this.idx(x, y)
    return i >= 0 ? this.tiles[i] : TILE.WILD
  }
  decoAt(x, y) {
    const i = this.idx(x, y)
    return i >= 0 ? this.deco[i] : DECO.NONE
  }
}

const BLOCKING_DECO = new Set([DECO.FENCE_H, DECO.FENCE_V, DECO.POST])

export class World {
  constructor() {
    this.plots = new Map()
    this.buildings = new Map()
    this.villagers = new Map()
    this.statics = []
    this.effects = []
    this.memory = new Map()
    this.map = new TileMap(-24, -24, 48, 48)
    this.nav = new Nav({ ox: -24, oy: -24, w: 48, h: 48 })
    this.gate = { x: GATE_CELL[0] * CELL_TILES + GATE_TILE.x, y: GATE_CELL[1] * CELL_TILES + GATE_TILE.y }
    this.first = true
    this.queue = []
    this.releaseTimer = 0
    this.releaseEvery = 0.6
    this.lastReleased = null
    this.time = 0
    this.owner = new Map() // cell key → plot name
    this.mapVersion = 0
    this._rebuild()
  }

  /**
   * @param {{ id: string, project: string, createdAt: number, status: string, known: boolean }[]} threads
   * @param {Map<string, number[][]>} [memory] saved layout; only read on the first call
   * @returns {Map<string, number[][]>} the layout memory to save
   */
  setRoster(threads, memory) {
    if (this.first && memory) this.memory = new Map(memory)
    const groups = new Map()
    for (const t of threads) {
      if (!t.project) continue
      if (!groups.has(t.project)) groups.set(t.project, [])
      groups.get(t.project).push(t)
    }
    const projects = [...groups].map(([name, list]) => ({ name, size: list.length }))
    const { cells, memory: nextMemory } = allocatePlots(projects, this.memory)
    this.memory = nextMemory

    // Plots.
    let dirty = false
    for (const name of [...this.plots.keys()]) {
      if (!cells.has(name)) {
        this.plots.delete(name)
        dirty = true
      }
    }
    for (const [name, c] of cells) {
      let plot = this.plots.get(name)
      if (!plot) {
        plot = new Plot(name, this._accentFor(name))
        this.plots.set(name, plot)
      }
      if (plot.setCells(c)) dirty = true
      plot.assignSlots(groups.get(name))
    }

    // Buildings.
    const live = new Set()
    for (const [name, list] of groups) {
      const plot = this.plots.get(name)
      if (!plot) continue
      for (const t of list) {
        const slot = plot.slotOf.get(t.id)
        if (slot === undefined) continue
        live.add(t.id)
        let b = this.buildings.get(t.id)
        if (!b || b.removing) {
          b = new Building(t.id, { built: this.first || t.known })
          this.buildings.set(t.id, b)
          dirty = true
        }
        const { x, y } = plot.slotTile(slot)
        if (b.place(x, y, name)) dirty = true
        b.lit = t.status === 'working' || t.status === 'waiting'
      }
    }
    for (const [id, b] of this.buildings) {
      if (!live.has(id) && !b.removing) {
        b.removing = true
        dirty = true
      }
    }

    if (dirty) this._rebuild()

    // Villagers.
    const byId = new Map(threads.map((t) => [t.id, t]))
    const newcomers = []
    for (const t of threads) {
      const b = this.buildings.get(t.id)
      if (!live.has(t.id) || !b) continue
      let v = this.villagers.get(t.id)
      if (v && v.loco !== 'gone') {
        v.status = t.status
        if (v.building !== b) {
          v.building = b
          v.goal = null
        }
        if (v.loco === 'leaving') {
          v.loco = 'entering' // came back before it reached the gate
          v.goal = null
        }
        continue
      }
      newcomers.push(t)
    }
    newcomers.sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status])
    let entering = [...this.villagers.values()].filter((v) => v.loco === 'entering').length
    for (const t of newcomers) {
      const b = this.buildings.get(t.id)
      if (this.first) {
        const v = new Villager(t.id, { x: this.gate.x, y: this.gate.y, status: t.status, loco: 'queued' })
        v.building = b
        this.villagers.set(t.id, v)
        this.queue.push(t.id)
      } else if (!t.known && entering < MAX_ENTERING) {
        const v = new Villager(t.id, { x: this.gate.x, y: this.gate.y, status: t.status, loco: 'entering' })
        v.building = b
        this.villagers.set(t.id, v)
        entering++
      } else {
        const f = this.nav.nearestFree(b.front.x, b.front.y)
        const v = new Villager(t.id, { x: f.x, y: f.y, status: t.status, loco: 'site' })
        v.building = b
        this.villagers.set(t.id, v)
      }
    }
    for (const [id, v] of this.villagers) {
      if ((!byId.has(id) || !live.has(id)) && v.loco !== 'leaving' && v.loco !== 'gone') {
        if (v.loco === 'queued') {
          this.villagers.delete(id)
          this.queue = this.queue.filter((q) => q !== id)
        } else {
          v.loco = 'leaving'
          v.goal = null
        }
      }
    }
    // The whole crowd is out in about twenty seconds, however many there are.
    if (this.first && this.queue.length) this.releaseEvery = Math.min(0.8, Math.max(0.2, 20 / this.queue.length))
    this.first = false
    return this.memory
  }

  /** Accent per plot: a hash of the name, stepping past colours another plot already wears. */
  _accentFor(name) {
    const used = new Set([...this.plots.values()].map((p) => p.accent))
    const start = hashString(`accent:${name}`) % ACCENT_COUNT
    for (let i = 0; i < ACCENT_COUNT; i++) {
      const a = (start + i) % ACCENT_COUNT
      if (!used.has(a)) return a
    }
    return start
  }

  /** Repaint the ground, re-scatter the countryside, and rebuild the navigation grid. */
  _rebuild() {
    this.owner = new Map()
    let R = 2
    for (const p of this.plots.values()) {
      for (const [cx, cy] of p.cells) {
        this.owner.set(key(cx, cy), p.name)
        R = Math.max(R, ringOf(cx, cy) + 1)
      }
    }
    const ox = -R * CELL_TILES
    const size = (2 * R + 1) * CELL_TILES
    const map = new TileMap(ox, ox, size, size)
    map.version = ++this.mapVersion
    const statics = []

    for (let cy = -R; cy <= R; cy++) {
      for (let cx = -R; cx <= R; cx++) {
        const k = key(cx, cy)
        if (cx === GATE_CELL[0] && cy === GATE_CELL[1]) this._paintSquare(map, cx, cy, statics)
        else if (!this.owner.has(k)) this._paintWild(map, cx, cy, statics)
      }
    }
    for (const p of this.plots.values()) p.paint(map, this.owner)

    const nav = new Nav({ ox, oy: ox, w: size, h: size })
    nav.version = this.nav.version + 1
    for (let y = map.oy; y < map.oy + map.h; y++) {
      for (let x = map.ox; x < map.ox + map.w; x++) if (BLOCKING_DECO.has(map.decoAt(x, y))) nav.setBlocked(x, y)
    }
    for (const s of statics) if (s.blocks) for (const [bx, by] of s.blocks) nav.setBlocked(bx, by)
    for (const b of this.buildings.values()) if (!b.removing) nav.blockRect(b.x, b.y, b.w, b.h)

    this.map = map
    this.nav = nav
    this.statics = statics
  }

  _paintSquare(map, cx, cy, statics) {
    const x0 = cx * CELL_TILES
    const y0 = cy * CELL_TILES
    for (let ly = 0; ly < CELL_TILES; ly++) for (let lx = 0; lx < CELL_TILES; lx++) map.setTile(x0 + lx, y0 + ly, TILE.PLAZA)
    const gy = Math.floor(this.gate.y)
    // The arch's two pillars; the villagers walk between them.
    statics.push({ id: 'arch', sprite: 'arch', x: this.gate.x, y: gy + 1, blocks: [[x0 + 4, gy], [x0 + 7, gy]] })
    const corners = [[1, 1], [10, 1], [1, 10], [10, 10]]
    for (const [lx, ly] of corners) {
      statics.push({ id: `lamp:${lx},${ly}`, sprite: 'lamp', x: x0 + lx + 0.5, y: y0 + ly + 1, blocks: [[x0 + lx, y0 + ly]] })
    }
  }

  _paintWild(map, cx, cy, statics) {
    const rand = rngFor(`wild:${cx},${cy}`)
    const x0 = cx * CELL_TILES
    const y0 = cy * CELL_TILES
    // Trees only in the middle of a cell, so every cell keeps an open ring and the countryside
    // can always be crossed.
    const trees = Math.floor(rand() * 6)
    const used = new Set()
    for (let i = 0; i < trees; i++) {
      const lx = 2 + Math.floor(rand() * 8)
      const ly = 2 + Math.floor(rand() * 8)
      if (used.has(key(lx, ly))) continue
      used.add(key(lx, ly))
      statics.push({
        id: `tree:${x0 + lx},${y0 + ly}`, sprite: 'tree', variant: Math.floor(rand() * 3),
        x: x0 + lx + 0.5, y: y0 + ly + 1, blocks: [[x0 + lx, y0 + ly]],
      })
    }
    const flowers = 3 + Math.floor(rand() * 7)
    for (let i = 0; i < flowers; i++) {
      const lx = Math.floor(rand() * CELL_TILES)
      const ly = Math.floor(rand() * CELL_TILES)
      if (!used.has(key(lx, ly))) map.setDeco(x0 + lx, y0 + ly, rand() < 0.7 ? DECO.FLOWERS : DECO.PEBBLES)
    }
  }

  /** A random walkable yard tile near this villager's own building. */
  wanderSpot(v, b) {
    const plot = this.plots.get(b.plot)
    const tiles = (plot ? plot.yardTiles() : []).filter(
      (t) => Math.abs(t.x - b.x) <= 4 && Math.abs(t.y - b.y) <= 4 && !this.nav.isBlocked(t.x, t.y),
    )
    if (!tiles.length) return b.front
    const t = tiles[Math.floor(v.rand() * tiles.length)]
    return { x: t.x + 0.3 + v.rand() * 0.4, y: t.y + 0.3 + v.rand() * 0.4 }
  }

  emit(kind, x, y, count = 1) {
    for (let i = 0; i < count; i++) {
      this.effects.push({ kind, x, y, age: 0, seed: Math.floor(Math.random() * 1e9), life: kind === 'z' ? 2.2 : kind === 'confetti' ? 1.4 : 0.35 })
    }
  }

  tick(dt) {
    dt = Math.min(dt, 0.1) // a background tab comes back with a huge dt; don't teleport everybody
    this.time += dt
    this._release(dt)
    for (const b of this.buildings.values()) b.tick(dt)
    for (const [id, b] of this.buildings) {
      if (b.removing && b.alpha <= 0) {
        this.buildings.delete(id)
        this._rebuild()
      }
    }
    for (const v of this.villagers.values()) v.tick(dt, this)
    this._separate(dt)
    for (const [id, v] of this.villagers) if (v.loco === 'gone') this.villagers.delete(id)
    for (const e of this.effects) e.age += dt
    this.effects = this.effects.filter((e) => e.age < e.life)
  }

  /** First load: one villager out of the arch at a time, the ones waiting on you first. */
  _release(dt) {
    if (!this.queue.length) return
    this.releaseTimer -= dt
    const last = this.lastReleased && this.villagers.get(this.lastReleased)
    const clear = !last || Math.hypot(last.x - this.gate.x, last.y - this.gate.y) > 0.8
    if (this.releaseTimer > 0 || !clear) return
    const id = this.queue.shift()
    const v = this.villagers.get(id)
    if (v) {
      v.loco = 'entering'
      v.x = this.gate.x
      v.y = this.gate.y
      this.lastReleased = id
    }
    this.releaseTimer = this.releaseEvery
  }

  /**
   * Keep a crowd a crowd rather than a pile. Walkers are only pushed sideways, so a stream going
   * one way never cancels itself; sitters get pushed but never push back.
   */
  _separate(dt) {
    const buckets = new Map()
    const list = [...this.villagers.values()].filter((v) => v.loco !== 'queued' && v.loco !== 'gone')
    for (const v of list) {
      const k = key(Math.floor(v.x), Math.floor(v.y))
      if (!buckets.has(k)) buckets.set(k, [])
      buckets.get(k).push(v)
    }
    for (const v of list) {
      if (v.ghost) continue
      let px = 0
      let py = 0
      const bx = Math.floor(v.x)
      const by = Math.floor(v.y)
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          for (const o of buckets.get(key(bx + dx, by + dy)) || []) {
            if (o === v || o.ghost) continue
            if (o.anim === 'sit' && v.anim !== 'sit') continue
            const ox = v.x - o.x
            const oy = v.y - o.y
            const d = Math.hypot(ox, oy)
            if (d >= SEPARATION) continue
            const nx = d > 1e-4 ? ox / d : Math.cos(hashString(v.id))
            const ny = d > 1e-4 ? oy / d : Math.sin(hashString(v.id))
            px += nx * (SEPARATION - d)
            py += ny * (SEPARATION - d)
          }
        }
      }
      if (!px && !py) continue
      if (v.moving && v.path.length) {
        const wp = v.path[0]
        const hx = wp.x - v.x
        const hy = wp.y - v.y
        const hl = Math.hypot(hx, hy) || 1
        const sx = -hy / hl
        const sy = hx / hl
        const side = px * sx + py * sy
        px = sx * side
        py = sy * side
      }
      const k = Math.min(1, dt * 4)
      this.nav.slide(v, px * k, py * k)
    }
  }

  snapshot({ selected = null, hovered = null } = {}) {
    const urgent = new Set()
    const active = new Set()
    for (const v of this.villagers.values()) {
      const b = v.building
      if (!b) continue
      if (v.status === 'waiting' || v.status === 'blocked') urgent.add(b.plot)
      if (v.status !== 'sleeping' && v.status !== 'idle') active.add(b.plot)
    }
    return {
      time: this.time,
      map: this.map,
      gate: this.gate,
      plots: [...this.plots.values()].map((p) => ({
        name: p.name, accent: p.accent, cells: p.cells, labelAt: p.labelAt, urgent: urgent.has(p.name), active: active.has(p.name),
      })),
      statics: this.statics,
      buildings: [...this.buildings.values()].map((b) => ({
        id: b.id, kind: b.kind, variant: b.variant, stage: b.stage, progress: b.progress, x: b.x, y: b.y, w: b.w, h: b.h,
        alpha: b.alpha, lit: b.lit, plot: b.plot, accent: this.plots.get(b.plot)?.accent ?? 0,
      })),
      villagers: [...this.villagers.values()]
        .filter((v) => v.loco !== 'queued' && v.loco !== 'gone')
        .map((v) => ({
          id: v.id, x: v.x, y: v.y, facing: v.facing, anim: v.anim, animTime: v.animTime, look: v.look, status: v.status,
          badge: v.badge, alpha: v.alpha, selected: v.id === selected, hovered: v.id === hovered, plot: v.building?.plot ?? '',
        })),
      effects: this.effects,
    }
  }

  plotAtTile(tx, ty) {
    return this.owner.get(key(Math.floor(tx / CELL_TILES), Math.floor(ty / CELL_TILES))) || null
  }

  villager(id) {
    return this.villagers.get(id) || null
  }
}
