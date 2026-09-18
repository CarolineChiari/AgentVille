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

const T = (id, status, createdAt) => ({ id, status, createdAt })

test('a full plot houses the threads that want something before the quiet ones', () => {
  const p = new Plot('a', 0)
  p.setCells([[1, 0]])
  p.assignSlots([T('old1', 'sleeping', 1), T('old2', 'idle', 2), T('old3', 'sleeping', 3), T('new', 'working', 9)])
  assert.ok(p.slotOf.has('new'), 'the newest thread is the one working, and it gets a house')
  assert.equal(p.slotOf.size, 3)
})

test('a thread that starts working takes the slot of the sleepiest, oldest holder', () => {
  const p = new Plot('a', 0)
  p.setCells([[1, 0]])
  p.assignSlots([T('a', 'sleeping', 1), T('b', 'idle', 2), T('c', 'sleeping', 3), T('d', 'sleeping', 4)])
  assert.deepEqual([...p.slotOf.keys()].sort(), ['a', 'b', 'c'], 'at first the oldest of equals keep their slots')
  const slotOfA = p.slotOf.get('a')
  const before = { b: p.slotOf.get('b'), c: p.slotOf.get('c') }
  p.assignSlots([T('a', 'sleeping', 1), T('b', 'idle', 2), T('c', 'sleeping', 3), T('d', 'waiting', 4)])
  assert.equal(p.slotOf.get('d'), slotOfA, 'the waiting one moves into the oldest sleeper\'s slot')
  assert.equal(p.slotOf.has('a'), false)
  assert.deepEqual({ b: p.slotOf.get('b'), c: p.slotOf.get('c') }, before, 'nobody else moves')
})

test('equals never displace each other, so a full plot settles', () => {
  const p = new Plot('a', 0)
  p.setCells([[1, 0]])
  const roster = [T('a', 'working', 1), T('b', 'working', 2), T('c', 'working', 3), T('d', 'working', 4), T('e', 'sleeping', 5)]
  p.assignSlots(roster)
  const first = [...p.slotOf].sort().join()
  p.assignSlots(roster)
  assert.equal([...p.slotOf].sort().join(), first)
  assert.equal(p.slotOf.has('e'), false, 'a sleeper never pushes out a worker')
  p.assignSlots([T('a', 'idle', 1), T('b', 'working', 2), T('c', 'working', 3), T('d', 'working', 4), T('e', 'sleeping', 5)])
  assert.ok(p.slotOf.has('d'), 'a worker without a house moves in once a holder goes quiet')
  assert.equal(p.slotOf.has('a'), false)
})
