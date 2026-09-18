import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FLAVOURS, INNER_HI, INNER_LO, flavourOf, paintWild } from '../src/sim/wild.js'
import { DECO, TILE } from '../src/sim/plot.js'
import { TileMap } from '../src/sim/world.js'
import { CELL_TILES } from '../src/sim/constants.js'

/** Paint one cell on its own map; returns the map and its statics. */
function paint(cx, cy) {
  const map = new TileMap(cx * CELL_TILES, cy * CELL_TILES, CELL_TILES, CELL_TILES)
  const statics = []
  paintWild(map, cx, cy, statics)
  return { map, statics }
}

const CELLS = []
for (let cy = -9; cy <= 9; cy++) for (let cx = -9; cx <= 9; cx++) CELLS.push([cx, cy])

test('a cell paints the same every time', () => {
  for (const [cx, cy] of CELLS.slice(0, 40)) {
    const a = paint(cx, cy)
    const b = paint(cx, cy)
    assert.deepEqual(a.statics, b.statics)
    assert.deepEqual([...a.map.tiles], [...b.map.tiles])
    assert.deepEqual([...a.map.deco], [...b.map.deco])
  }
})

test('every flavour of countryside turns up, meadows most', () => {
  const seen = Object.fromEntries(FLAVOURS.map((f) => [f, 0]))
  for (const [cx, cy] of CELLS) seen[flavourOf(cx, cy)]++
  for (const f of FLAVOURS) assert.ok(seen[f] > 0, `no ${f} in ${CELLS.length} cells`)
  assert.ok(FLAVOURS.every((f) => seen.meadow >= seen[f]))
})

test('nothing that blocks stands in a cell\'s outer ring, and nothing stands in water or on another thing', () => {
  const inner = (lx, ly) => lx >= INNER_LO && ly >= INNER_LO && lx <= INNER_HI && ly <= INNER_HI
  for (const [cx, cy] of CELLS) {
    const { map, statics } = paint(cx, cy)
    const x0 = cx * CELL_TILES
    const y0 = cy * CELL_TILES
    const tiles = new Set()
    for (const st of statics) {
      const tx = Math.floor(st.x)
      const ty = Math.floor(st.y) - 1
      const where = `${st.id} in cell ${cx},${cy}`
      assert.ok(inner(tx - x0, ty - y0), `${where} is in the outer ring`)
      assert.notEqual(map.tileAt(tx, ty), TILE.WATER, `${where} stands in water`)
      assert.ok(!tiles.has(`${tx},${ty}`), `${where} shares a tile`)
      tiles.add(`${tx},${ty}`)
      if (st.blocks) assert.deepEqual(st.blocks, [[tx, ty]], `${where} blocks somewhere else`)
    }
    for (let ly = 0; ly < CELL_TILES; ly++) {
      for (let lx = 0; lx < CELL_TILES; lx++) {
        const wet = map.tileAt(x0 + lx, y0 + ly) === TILE.WATER
        if (wet) assert.ok(inner(lx, ly), `water in the outer ring of ${cx},${cy}`)
        const d = map.decoAt(x0 + lx, y0 + ly)
        if (wet) assert.ok(d === DECO.NONE || d === DECO.LILYPAD, `${d} growing in water`)
        else assert.notEqual(d, DECO.LILYPAD, 'a lily pad on dry land')
      }
    }
  }
})

test('a pond is one body of water, six to ten tiles, with reeds on its bank', () => {
  let ponds = 0
  for (const [cx, cy] of CELLS) {
    if (flavourOf(cx, cy) !== 'pond') continue
    ponds++
    const { map } = paint(cx, cy)
    const x0 = cx * CELL_TILES
    const y0 = cy * CELL_TILES
    const wet = []
    for (let ly = 0; ly < CELL_TILES; ly++) for (let lx = 0; lx < CELL_TILES; lx++) if (map.tileAt(x0 + lx, y0 + ly) === TILE.WATER) wet.push(`${lx},${ly}`)
    assert.ok(wet.length >= 6 && wet.length <= 10, `a pond of ${wet.length}`)
    const all = new Set(wet)
    const seen = new Set([wet[0]])
    const queue = [wet[0]]
    while (queue.length) {
      const [x, y] = queue.pop().split(',').map(Number)
      for (const k of [`${x + 1},${y}`, `${x - 1},${y}`, `${x},${y + 1}`, `${x},${y - 1}`]) {
        if (all.has(k) && !seen.has(k)) {
          seen.add(k)
          queue.push(k)
        }
      }
    }
    assert.equal(seen.size, wet.length, `the pond in ${cx},${cy} is in pieces`)
    let reeds = 0
    for (let i = 0; i < map.deco.length; i++) if (map.deco[i] === DECO.REEDS) reeds++
    assert.ok(reeds > 0, `no reeds round the pond in ${cx},${cy}`)
  }
  assert.ok(ponds > 5)
})
