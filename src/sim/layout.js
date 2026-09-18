// Sticky plot layout. The map is only useful if you can learn it, so the previous arrangement
// is an input to the next one:
//   - a repo that needs as many cells as it had keeps exactly those cells;
//   - one that grew keeps them and claims neighbours;
//   - one that shrank gives back the cells it claimed most recently (so grow-then-shrink returns
//     it to precisely its old shape), and only once it has shrunk well past the line;
//   - only a repo with no memory is placed at all, on the innermost free cell.
// Cells remembered by repos that are absent right now (hidden, folded, archived away) are avoided
// while anything else is free, so a repo that comes back usually finds its own ground waiting.
import { GATE_CELL, MAX_CELLS, MAX_RING, SLOTS_PER_CELL } from './constants.js'
import { N4, chebyshev, key, ringOf, spiralCells } from './grid.js'

export const MEMORY_LIMIT = 80

export const cellsNeeded = (threads) => Math.max(1, Math.min(MAX_CELLS, Math.ceil(threads / SLOTS_PER_CELL)))

/** Shrinking waits until the repo has lost this many threads past the line, so one archive doesn't flicker a cell. */
export const SHRINK_SLACK = 3

function wantedCells(size, had) {
  const need = cellsNeeded(size)
  if (had > need) return Math.max(need, Math.min(had, cellsNeeded(size + SHRINK_SLACK)))
  return need
}

/**
 * @param {{ name: string, size: number }[]} projects
 * @param {Map<string, number[][]>} [previous]  name → cells, cells[0] is the root
 * @returns {{ cells: Map<string, number[][]>, memory: Map<string, number[][]> }}
 */
export function allocatePlots(projects, previous = new Map()) {
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

  // Hold: keep remembered cells, oldest first, up to what is wanted now.
  const fresh = []
  for (const p of order) {
    const before = previous.get(p.name)
    result.set(p.name, [])
    if (!before?.length || !isFree(...before[0])) {
      fresh.push(p)
      continue
    }
    const want = wantedCells(p.size, before.length)
    for (const c of before) {
      if (result.get(p.name).length >= want) break
      if (isFree(...c)) claim(p.name, ...c)
    }
  }

  // Seed: new repos take the innermost free cell, preferring ground nobody remembers.
  const spiral = spiralCells(MAX_RING)
  for (const p of fresh) {
    const cell = spiral.find(([x, y]) => isFree(x, y) && !soft.has(key(x, y))) || spiral.find(([x, y]) => isFree(x, y))
    if (cell) claim(p.name, ...cell)
  }

  // Grow: existing repos first (they're first in `order` too), each out from its own root.
  for (const p of order) {
    const cells = result.get(p.name)
    if (!cells.length) continue
    const want = wantedCells(p.size, previous.get(p.name)?.length ?? 0)
    const [rx, ry] = cells[0]
    while (cells.length < want) {
      let best = null
      let bestScore = Infinity
      for (const [cx, cy] of cells) {
        for (const [dx, dy] of N4) {
          const nx = cx + dx
          const ny = cy + dy
          if (!isFree(nx, ny)) continue
          const score = chebyshev(nx, ny, rx, ry) * 100 + ringOf(nx, ny) * 10 + (soft.has(key(nx, ny)) ? 1000 : 0)
          if (score < bestScore) {
            bestScore = score
            best = [nx, ny]
          }
        }
      }
      if (!best) break // hemmed in: stay smaller rather than split the plot
      claim(p.name, ...best)
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
