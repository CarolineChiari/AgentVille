// Tile-grid navigation. Two guarantees, deliberately independent:
//   - routing (A*) finds a way around buildings, fences and trees;
//   - collision (`slide`) is applied to every step whether or not a route exists, so a failed or
//     stale route can never walk anybody through a wall.

const SQRT2 = Math.SQRT2
const MAX_EXPANSIONS = 20000
const BODY = 0.22 // a villager's half-width for collision, in tiles; < 0.5 so 1-tile gaps stay walkable

class Heap {
  constructor(cap) {
    this.ids = new Int32Array(cap)
    this.keys = new Float64Array(cap)
    this.size = 0
  }
  push(id, k) {
    let i = this.size++
    if (i >= this.ids.length) {
      const ids = new Int32Array(this.ids.length * 2)
      const keys = new Float64Array(this.keys.length * 2)
      ids.set(this.ids)
      keys.set(this.keys)
      this.ids = ids
      this.keys = keys
    }
    while (i > 0) {
      const p = (i - 1) >> 1
      if (this.keys[p] <= k) break
      this.ids[i] = this.ids[p]
      this.keys[i] = this.keys[p]
      i = p
    }
    this.ids[i] = id
    this.keys[i] = k
  }
  pop() {
    const top = this.ids[0]
    const lastId = this.ids[--this.size]
    const lastK = this.keys[this.size]
    let i = 0
    for (;;) {
      let c = 2 * i + 1
      if (c >= this.size) break
      if (c + 1 < this.size && this.keys[c + 1] < this.keys[c]) c++
      if (this.keys[c] >= lastK) break
      this.ids[i] = this.ids[c]
      this.keys[i] = this.keys[c]
      i = c
    }
    this.ids[i] = lastId
    this.keys[i] = lastK
    return top
  }
}

export class Nav {
  /** @param {{ ox: number, oy: number, w: number, h: number }} bounds in tiles */
  constructor({ ox, oy, w, h }) {
    this.ox = ox
    this.oy = oy
    this.w = w
    this.h = h
    const n = w * h
    this.blocked = new Uint8Array(n)
    this.g = new Float64Array(n)
    this.parent = new Int32Array(n)
    this.stamp = new Uint32Array(n) // generation stamps instead of clearing g/parent every search
    this.closed = new Uint32Array(n)
    this.gen = 0
    this.heap = new Heap(1024)
    this.version = 0
  }

  inside(tx, ty) {
    return tx >= this.ox && ty >= this.oy && tx < this.ox + this.w && ty < this.oy + this.h
  }
  index(tx, ty) {
    return (ty - this.oy) * this.w + (tx - this.ox)
  }
  /** Integer tile; outside the map counts as blocked. */
  isBlocked(tx, ty) {
    return !this.inside(tx, ty) || this.blocked[this.index(tx, ty)] === 1
  }
  setBlocked(tx, ty, v = true) {
    if (this.inside(tx, ty)) this.blocked[this.index(tx, ty)] = v ? 1 : 0
  }
  blockRect(tx, ty, w, h) {
    for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) this.setBlocked(x, y)
  }
  clear() {
    this.blocked.fill(0)
    this.version++
  }

  /** Can a body of half-width BODY stand at this float position? */
  standable(px, py) {
    return (
      !this.isBlocked(Math.floor(px - BODY), Math.floor(py - BODY)) &&
      !this.isBlocked(Math.floor(px + BODY), Math.floor(py - BODY)) &&
      !this.isBlocked(Math.floor(px - BODY), Math.floor(py + BODY)) &&
      !this.isBlocked(Math.floor(px + BODY), Math.floor(py + BODY))
    )
  }

  /** Nearest free tile centre to a float position, by expanding rings. */
  nearestFree(px, py, maxRing = 24) {
    const cx = Math.floor(px)
    const cy = Math.floor(py)
    if (!this.isBlocked(cx, cy)) return { x: cx + 0.5, y: cy + 0.5 }
    for (let r = 1; r <= maxRing; r++) {
      let best = null
      let bestD = Infinity
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
          const tx = cx + dx
          const ty = cy + dy
          if (this.isBlocked(tx, ty)) continue
          const d = (tx + 0.5 - px) ** 2 + (ty + 0.5 - py) ** 2
          if (d < bestD) {
            bestD = d
            best = { x: tx + 0.5, y: ty + 0.5 }
          }
        }
      }
      if (best) return best
    }
    return { x: px, y: py }
  }

  /** Straight walk possible between two points? Sampled finely enough not to skip a 1-tile wall. */
  lineOfSight(ax, ay, bx, by) {
    const d = Math.hypot(bx - ax, by - ay)
    const steps = Math.max(1, Math.ceil(d / 0.2))
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      if (!this.standable(ax + (bx - ax) * t, ay + (by - ay) * t)) return false
    }
    return true
  }

  /**
   * A route from (sx,sy) to (tx,ty) as a list of waypoints, ending at the goal (or at the
   * reachable point closest to it). 8-connected, octile heuristic, no corner cutting.
   */
  findPath(sx, sy, tx, ty) {
    if (this.lineOfSight(sx, sy, tx, ty)) return [{ x: tx, y: ty }]
    const start = this.nearestFree(sx, sy)
    const goal = this.nearestFree(tx, ty)
    const s = this.index(Math.floor(start.x), Math.floor(start.y))
    const gx = Math.floor(goal.x)
    const gy = Math.floor(goal.y)
    if (!this.inside(gx, gy)) return []
    const gi = this.index(gx, gy)
    const gen = ++this.gen
    const h = (i) => {
      const dx = Math.abs((i % this.w) + this.ox - gx)
      const dy = Math.abs(Math.floor(i / this.w) + this.oy - gy)
      return Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy)
    }
    this.heap.size = 0
    this.stamp[s] = gen
    this.g[s] = 0
    this.parent[s] = -1
    this.heap.push(s, h(s))
    let best = s
    let bestH = h(s)
    let expansions = 0
    while (this.heap.size && expansions++ < MAX_EXPANSIONS) {
      const cur = this.heap.pop()
      if (this.closed[cur] === gen) continue
      this.closed[cur] = gen
      if (cur === gi) {
        best = cur
        break
      }
      const hc = h(cur)
      if (hc < bestH) {
        bestH = hc
        best = cur
      }
      const cx = (cur % this.w) + this.ox
      const cy = Math.floor(cur / this.w) + this.oy
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue
          const nx = cx + dx
          const ny = cy + dy
          if (this.isBlocked(nx, ny)) continue
          // No corner cutting: a diagonal needs both orthogonal neighbours open.
          if (dx && dy && (this.isBlocked(cx + dx, cy) || this.isBlocked(cx, cy + dy))) continue
          const ni = this.index(nx, ny)
          if (this.closed[ni] === gen) continue
          const ng = this.g[cur] + (dx && dy ? SQRT2 : 1)
          if (this.stamp[ni] !== gen || ng < this.g[ni]) {
            this.stamp[ni] = gen
            this.g[ni] = ng
            this.parent[ni] = cur
            this.heap.push(ni, ng + h(ni))
          }
        }
      }
    }
    // Walk back from the goal, or from the closest reached node when the goal is unreachable:
    // a straight line into a wall is how villagers used to jam.
    const cells = []
    for (let i = best; i !== -1; i = this.parent[i]) {
      cells.push({ x: (i % this.w) + this.ox + 0.5, y: Math.floor(i / this.w) + this.oy + 0.5 })
      if (i === s) break
    }
    cells.reverse()
    if (best === gi) cells.push({ x: tx, y: ty })
    return this.smooth(sx, sy, cells)
  }

  /** String pulling: keep only the furthest waypoint still visible from the last one kept. */
  smooth(sx, sy, pts) {
    const out = []
    let ax = sx
    let ay = sy
    let i = 0
    while (i < pts.length) {
      let j = pts.length - 1
      while (j > i && !this.lineOfSight(ax, ay, pts[j].x, pts[j].y)) j--
      out.push(pts[j])
      ax = pts[j].x
      ay = pts[j].y
      i = j + 1
    }
    return out
  }

  /**
   * Move by (dx,dy) without entering a blocked tile. Blocked head-on, slide along the obstacle
   * one axis at a time instead of stopping dead. Something built on top of you: step out.
   */
  slide(pos, dx, dy) {
    if (!this.standable(pos.x, pos.y)) {
      const out = this.nearestFree(pos.x, pos.y)
      const d = Math.hypot(out.x - pos.x, out.y - pos.y) || 1
      const step = Math.min(d, Math.hypot(dx, dy) || 0.05)
      pos.x += ((out.x - pos.x) / d) * step
      pos.y += ((out.y - pos.y) / d) * step
      return false
    }
    if (this.standable(pos.x + dx, pos.y + dy)) {
      pos.x += dx
      pos.y += dy
      return true
    }
    if (dx && this.standable(pos.x + dx, pos.y)) {
      pos.x += dx
      return false
    }
    if (dy && this.standable(pos.x, pos.y + dy)) {
      pos.y += dy
      return false
    }
    return false
  }
}
