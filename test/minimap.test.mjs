import { test } from 'node:test'
import assert from 'node:assert/strict'
import { layoutOf, toMap, fromMap, MAP_W, MAP_H } from '../src/ui/minimap.js'
import { CELL_TILES } from '../src/sim/constants.js'
import { TILE_PX } from '../src/render/sprites/palette.js'

const CELL_PX = CELL_TILES * TILE_PX

test('the layout fits every cell, and the square, inside the box', () => {
  const frame = { plots: [{ cells: [[0, 0], [3, 1]] }, { cells: [[-2, 2]] }] }
  const lay = layoutOf(frame)
  assert.ok(lay.px >= 1)
  for (const [cx, cy] of [[0, 0], [3, 1], [-2, 2]]) {
    const m = toMap(lay, cx * CELL_PX, cy * CELL_PX)
    assert.ok(m.x >= 0 && m.x + lay.px <= MAP_W && m.y >= 0 && m.y + lay.px <= MAP_H, `cell ${cx},${cy} is inside`)
  }
})

test('an empty village still has the square to show', () => {
  const lay = layoutOf({ plots: [] })
  assert.ok(lay.px >= 1)
})

test('fromMap undoes toMap', () => {
  const lay = layoutOf({ plots: [{ cells: [[1, 1], [2, 3]] }] })
  const m = toMap(lay, 500, 300)
  const w = fromMap(lay, m.x, m.y)
  assert.ok(Math.abs(w.x - 500) < 1e-6 && Math.abs(w.y - 300) < 1e-6)
})
