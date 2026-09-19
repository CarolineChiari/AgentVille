// Sticky plot layout. The map is only useful if you can learn it, so the previous arrangement
// is an input to the next one:
//   - every plot is a rectangle of cells, so it can be laid out as one courtyard (shape.js);
//   - a repo that still fits the rectangle it had keeps exactly those cells;
//   - one that grew keeps them and claims a whole row or column alongside;
//   - one that shrank gives back the rows and columns it claimed most recently (so grow-then-shrink
//     returns it to precisely its old shape), and only once it has shrunk well past the line;
//   - only a repo with no memory is placed at all, on the innermost free cell.
// Cells remembered by repos that are absent right now (hidden, folded, archived away) are avoided
// while anything else is free, so a repo that comes back usually finds its own ground waiting.
import { GATE_CELL, MAX_CELLS, MAX_RING } from './constants.js'
import { key, ringOf, spiralCells } from './grid.js'
import { DEFAULT_SPOT, capacityOf, isRect, rectOf } from './shape.js'

export const MEMORY_LIMIT = 80

/**
 * Does a plot of w×h cells hold this many live threads' houses and finished threads' flowers?
 * `spot` is where the village stands its landmarks: it is in the field, so it costs a few flowers.
 */
export function fits(w, h, threads, flowers = 0, spot = DEFAULT_SPOT) {
  const c = capacityOf(w, h, spot)
  return c.slots >= threads && c.flowers >= flowers
}

/** Shrinking waits until the repo has lost this many threads past the line, so one archive doesn't flicker a cell. */
export const SHRINK_SLACK = 2

/**
 * What to keep of a remembered plot. Its cells are listed in the order they were claimed, and it
 * grew a row or column at a time, so every shape it has had is a rectangular prefix of the list.
 * Keep the smallest of those that would still fit SHRINK_SLACK more threads, or else the largest.
 * A plot remembered from before plots were rectangles keeps its largest rectangular prefix.
 */
function held(before, isFree, p, spot) {
  const shapes = []
  for (let n = 1; n <= before.length; n++) {
    if (!isFree(...before[n - 1])) break
    if (isRect(before.slice(0, n))) shapes.push(n)
  }
  const roomy = shapes.find((n) => {
    const { w, h } = rectOf(before.slice(0, n))
    return fits(w, h, p.size + SHRINK_SLACK, p.garden, spot)
  })
  return before.slice(0, roomy ?? shapes[shapes.length - 1] ?? 0)
}

/**
 * The rows and columns a rectangle could grow by, each listed in the order its cells are claimed.
 * Right and down come first: growing that way moves no house already standing.
 */
function sidesOf({ cx, cy, w, h }) {
  const col = (x) => Array.from({ length: h }, (_, i) => [x, cy + i])
  const row = (y) => Array.from({ length: w }, (_, i) => [cx + i, y])
  return [
    { cells: col(cx + w), w: w + 1, h },
    { cells: row(cy + h), w, h: h + 1 },
    { cells: col(cx - 1), w: w + 1, h },
    { cells: row(cy - 1), w, h: h + 1 },
  ]
}

/**
 * @param {{ name: string, size: number, garden?: number }[]} projects  size = live threads, garden = flowers
 * @param {Map<string, number[][]>} [previous]  name → cells, cells[0] is the root
 * @param {string} [spot]  where landmarks stand in their fields; see shape.js
 * @returns {{ cells: Map<string, number[][]>, memory: Map<string, number[][]> }}
 */
export function allocatePlots(projects, previous = new Map(), spot = DEFAULT_SPOT) {
  const order = [...projects].sort((a, b) => b.size - a.size || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  const present = new Set(order.map((p) => p.name))
  const taken = new Map() // cell key → name
  const reserved = new Set([key(...GATE_CELL)])
  const soft = new Set()
  for (const [name, cells] of previous) if (!present.has(name)) for (const c of cells) soft.add(key(...c))

  const isFree = (x, y) => ringOf(x, y) <= MAX_RING && !taken.has(key(x, y)) && !reserved.has(key(x, y))
  const result = new Map()
  const claim = (name, x, y) => {
    taken.set(key(x, y), name)
    result.get(name).push([x, y])
  }

  // Hold: keep the remembered rectangle, or as much of it as is still free and still wanted.
  const fresh = []
  for (const p of order) {
    const before = previous.get(p.name)
    result.set(p.name, [])
    if (!before?.length || !isFree(...before[0])) {
      fresh.push(p)
      continue
    }
    for (const c of held(before, isFree, p, spot)) claim(p.name, ...c)
  }

  // Seed: new repos take the innermost free cell, preferring ground nobody remembers.
  const spiral = spiralCells(MAX_RING)
  for (const p of fresh) {
    const cell = spiral.find(([x, y]) => isFree(x, y) && !soft.has(key(x, y))) || spiral.find(([x, y]) => isFree(x, y))
    if (cell) claim(p.name, ...cell)
  }

  // Grow: a whole row or column at a time, so the plot stays a rectangle. Off ground an absent
  // repo remembers first, then squarest (a courtyard, not a corridor), then nearest the square.
  for (const p of order) {
    const cells = result.get(p.name)
    if (!cells.length) continue
    for (;;) {
      const r = rectOf(cells)
      if (fits(r.w, r.h, p.size, p.garden, spot)) break
      let best = null
      let bestScore = Infinity
      sidesOf(r).forEach((side, dir) => {
        if (side.w * side.h > MAX_CELLS || !side.cells.every(([x, y]) => isFree(x, y))) return
        const score =
          Math.abs(side.w - side.h) * 1000 +
          side.cells.filter(([x, y]) => soft.has(key(x, y))).length * 10000 +
          side.cells.reduce((sum, [x, y]) => sum + ringOf(x, y), 0) * 10 +
          dir
        if (score < bestScore) {
          bestScore = score
          best = side.cells
        }
      })
      if (!best) break // hemmed in, or as big as a plot gets: stay smaller rather than split the plot
      for (const c of best) claim(p.name, ...c)
    }
  }

  // Memory: everything placed now, then what we still remember about absent repos, capped.
  const memory = new Map(result)
  for (const [name, cells] of previous) {
    if (memory.size >= MEMORY_LIMIT) break
    if (!memory.has(name)) memory.set(name, cells)
  }
  for (const [name, cells] of result) if (!cells.length) result.delete(name)
  return { cells: result, memory }
}

/** A stable string for "did this plot's footprint change". */
export const signature = (cells) => cells.map((c) => c.join(',')).join(';')
