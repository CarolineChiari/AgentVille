import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Plot } from '../src/sim/plot.js'
import { BED, BOARD_LOCAL, CELL_TILES, SLOT_LOCAL } from '../src/sim/constants.js'

test('the notice board stands in the root cell, clear of the garden, the buildings and the fence gaps', () => {
  const p = new Plot('a', 0)
  p.setCells([[2, -1], [3, -1]])
  assert.deepEqual(p.boardTile, { x: 2 * CELL_TILES + BOARD_LOCAL[0], y: -CELL_TILES + BOARD_LOCAL[1] })
  const [lx, ly] = BOARD_LOCAL
  assert.ok(!(lx >= BED.x && lx < BED.x + BED.w && ly >= BED.y && ly < BED.y + BED.h), 'not in the bed')
  for (const [sx, sy] of SLOT_LOCAL) assert.ok(!(lx >= sx && lx < sx + 2 && ly >= sy && ly < sy + 2), 'not in a building')
  assert.ok(![2, 4, 7, 9].includes(lx), 'not in or in front of a fence gap')
  assert.ok(lx >= 2 && lx <= 9 && ly >= 2 && ly <= 9, 'inside the yard')
})
