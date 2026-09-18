// The countryside between the plots. Each wild cell has a flavour (a meadow, a grove, rocky
// ground, a clearing, a pond, an orchard) that decides what grows in it. Seeded by the cell's
// position, so a cell looks the same on every reload and on every machine.
import { CELL_TILES } from './constants.js'
import { key } from './grid.js'
import { DECO, TILE } from './plot.js'
import { pick, rngFor } from './rng.js'

export const FLAVOURS = ['meadow', 'grove', 'rocky', 'clearing', 'pond', 'orchard']
/** Meadows are the rule; the rest are finds. */
const FLAVOUR_BAG = ['meadow', 'meadow', 'meadow', 'grove', 'grove', 'rocky', 'clearing', 'pond', 'orchard']

/**
 * Anything that blocks (a tree, a rock, water) stands in local tiles INNER_LO..INNER_HI, so every
 * wild cell keeps an open two-tile ring and the countryside can always be crossed.
 */
export const INNER_LO = 2
export const INNER_HI = 9

// Trees by index: 0 broadleaf, 1 pine, 2 fruit, 3 birch, 4 autumn, 5 willow (by water only).
const MEADOW_TREES = [0, 0, 0, 1, 2, 3, 3, 4]
const GROVE_TREES = [0, 0, 0, 1, 1, 3, 3, 4]
const MEADOW_COVER = [DECO.FLOWERS, DECO.FLOWERS, DECO.FLOWERS, DECO.FLOWERS, DECO.TALLGRASS, DECO.TALLGRASS, DECO.TALLGRASS, DECO.CLOVER, DECO.CLOVER, DECO.PEBBLES]
const GROVE_COVER = [DECO.MUSHROOMS, DECO.MUSHROOMS, DECO.CLOVER, DECO.CLOVER, DECO.TALLGRASS, DECO.FLOWERS]
const ROCKY_COVER = [DECO.PEBBLES, DECO.PEBBLES, DECO.PEBBLES, DECO.TALLGRASS, DECO.TALLGRASS, DECO.FLOWERS]
const CLEARING_COVER = [DECO.TALLGRASS, DECO.TALLGRASS, DECO.TALLGRASS, DECO.MUSHROOMS, DECO.FLOWERS, DECO.FLOWERS, DECO.CLOVER]
const BANK_COVER = [DECO.FLOWERS, DECO.TALLGRASS, DECO.CLOVER]
const ORCHARD_COVER = [DECO.FLOWERS, DECO.CLOVER, DECO.CLOVER, DECO.TALLGRASS]

export function flavourOf(cx, cy) {
  return pick(rngFor(`flavour:${cx},${cy}`), FLAVOUR_BAG)
}

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]]

/**
 * Paint one unowned cell: its ground and cover into `map`, its trees, rocks and the like onto
 * `statics`. A static that blocks carries `blocks`, the tile it stands on.
 */
export function paintWild(map, cx, cy, statics) {
  const flavour = flavourOf(cx, cy)
  const rand = rngFor(`wild:${cx},${cy}`)
  const x0 = cx * CELL_TILES
  const y0 = cy * CELL_TILES
  const taken = new Set()
  const water = new Set()
  const count = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1))
  const innerSpot = () => [INNER_LO + Math.floor(rand() * (INNER_HI - INNER_LO + 1)), INNER_LO + Math.floor(rand() * (INNER_HI - INNER_LO + 1))]

  const place = (sprite, variant, lx, ly, blocks = true) => {
    const k = key(lx, ly)
    if (taken.has(k) || water.has(k)) return false
    if (lx < INNER_LO || ly < INNER_LO || lx > INNER_HI || ly > INNER_HI) return false
    taken.add(k)
    const x = x0 + lx
    const y = y0 + ly
    statics.push({ id: `${sprite}:${x},${y}`, sprite, variant, x: x + 0.5, y: y + 1, ...(blocks ? { blocks: [[x, y]] } : {}) })
    return true
  }
  const scatter = (sprite, n, variants, blocks = true) => {
    for (let i = 0; i < n; i++) {
      const [lx, ly] = innerSpot()
      place(sprite, typeof variants === 'number' ? Math.floor(rand() * variants) : pick(rand, variants), lx, ly, blocks)
    }
  }
  const cover = (n, kinds) => {
    for (let i = 0; i < n; i++) {
      const lx = Math.floor(rand() * CELL_TILES)
      const ly = Math.floor(rand() * CELL_TILES)
      const k = key(lx, ly)
      if (!taken.has(k) && !water.has(k)) map.setDeco(x0 + lx, y0 + ly, pick(rand, kinds))
    }
  }

  if (flavour === 'meadow') {
    scatter('tree', count(0, 2), MEADOW_TREES)
    if (rand() < 0.5) scatter('bush', 1, 2)
    cover(count(8, 13), MEADOW_COVER)
  } else if (flavour === 'grove') {
    scatter('tree', count(5, 8), GROVE_TREES)
    scatter('bush', count(1, 3), 2)
    scatter('sapling', count(1, 2), 1, false)
    cover(count(5, 9), GROVE_COVER)
  } else if (flavour === 'rocky') {
    scatter('rock', count(3, 5), 2)
    scatter('tree', count(1, 2), [1])
    if (rand() < 0.5) scatter('bush', 1, [0])
    cover(count(5, 8), ROCKY_COVER)
  } else if (flavour === 'clearing') {
    scatter('stump', count(1, 3), 1)
    scatter('log', 1, 1)
    // The wood it was cut from, round the edge of the clearing.
    const edgeTrees = count(1, 3)
    for (let i = 0; i < edgeTrees; i++) {
      const along = INNER_LO + Math.floor(rand() * (INNER_HI - INNER_LO + 1))
      const edge = rand() < 0.5 ? INNER_LO : INNER_HI
      if (rand() < 0.5) place('tree', pick(rand, GROVE_TREES), along, edge)
      else place('tree', pick(rand, GROVE_TREES), edge, along)
    }
    cover(count(6, 10), CLEARING_COVER)
  } else if (flavour === 'pond') {
    // A blob of water grown from a seed near the middle, one tile at a time, each time onto the
    // dry tile with the most water beside it: grown at random it came out in one-tile arms.
    const seed = [4 + Math.floor(rand() * 4), 4 + Math.floor(rand() * 4)]
    water.add(key(...seed))
    const size = count(6, 10)
    while (water.size < size) {
      let best = []
      let most = 0
      for (const k of water) {
        const [wx, wy] = k.split(',').map(Number)
        for (const [dx, dy] of N4) {
          const nx = wx + dx
          const ny = wy + dy
          if (nx < INNER_LO || ny < INNER_LO || nx > INNER_HI || ny > INNER_HI || water.has(key(nx, ny))) continue
          const wet = N4.filter(([ex, ey]) => water.has(key(nx + ex, ny + ey))).length
          if (wet > most) {
            most = wet
            best = []
          }
          if (wet === most) best.push(key(nx, ny))
        }
      }
      if (!best.length) break
      water.add(pick(rand, best))
    }
    for (const k of water) {
      const [lx, ly] = k.split(',').map(Number)
      map.setTile(x0 + lx, y0 + ly, TILE.WATER)
    }
    const lilies = [...water]
    const pads = count(1, 2)
    for (let i = 0; i < pads; i++) {
      const [lx, ly] = pick(rand, lilies).split(',').map(Number)
      map.setDeco(x0 + lx, y0 + ly, DECO.LILYPAD)
    }
    // Reeds on half the bank; a willow and a rock or two beside the water.
    const bank = []
    for (let ly = 1; ly < CELL_TILES - 1; ly++) {
      for (let lx = 1; lx < CELL_TILES - 1; lx++) {
        if (water.has(key(lx, ly))) continue
        if (N4.some(([dx, dy]) => water.has(key(lx + dx, ly + dy)))) bank.push([lx, ly])
      }
    }
    for (const [lx, ly] of bank) if (rand() < 0.5) map.setDeco(x0 + lx, y0 + ly, DECO.REEDS)
    const dry = bank.filter(([lx, ly]) => map.decoAt(x0 + lx, y0 + ly) !== DECO.REEDS)
    for (let i = 0; i < 6 && dry.length; i++) if (place('tree', 5, ...pick(rand, dry))) break
    const rocks = count(0, 2)
    for (let i = 0; i < rocks && dry.length; i++) place('rock', Math.floor(rand() * 2), ...pick(rand, dry))
    cover(count(3, 6), BANK_COVER)
  } else if (flavour === 'orchard') {
    // Fruit trees in loose rows, a few missing.
    for (const ly of [3, 6, 9]) for (const lx of [3, 6, 9]) if (rand() < 0.7) place('tree', 2, lx, ly)
    if (rand() < 0.5) scatter('bush', 1, [1])
    cover(count(4, 8), ORCHARD_COVER)
  }
}
