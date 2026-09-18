import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allocatePlots, cellsNeeded, MEMORY_LIMIT } from '../src/sim/layout.js'
import { FLOWERS_PER_CELL, GATE_CELL, MAX_CELLS, SLOTS_PER_CELL } from '../src/sim/constants.js'

const P = (name, size) => ({ name, size })
const run = (projects, prev) => allocatePlots(projects, prev)

test('cellsNeeded grows per slot count and caps', () => {
  assert.equal(cellsNeeded(1), 1)
  assert.equal(cellsNeeded(SLOTS_PER_CELL), 1)
  assert.equal(cellsNeeded(SLOTS_PER_CELL + 1), 2)
  assert.equal(cellsNeeded(10_000), MAX_CELLS)
})

test('the gate cell is never allocated', () => {
  const { cells } = run(Array.from({ length: 30 }, (_, i) => P(`p${i}`, 7)))
  for (const list of cells.values()) for (const c of list) assert.notDeepEqual(c, GATE_CELL)
})

test('a new plot takes the innermost free cell', () => {
  const { cells } = run([P('a', 1)])
  const [c] = cells.get('a')
  assert.equal(Math.max(Math.abs(c[0]), Math.abs(c[1])), 1)
})

test('same size keeps identical cells, even when a new repo arrives', () => {
  const first = run([P('a', 5), P('b', 2)])
  const second = run([P('a', 5), P('b', 2), P('zzz', 20)], first.memory)
  assert.deepEqual(second.cells.get('a'), first.cells.get('a'))
  assert.deepEqual(second.cells.get('b'), first.cells.get('b'))
})

test('growth keeps the root and claims a neighbour', () => {
  const first = run([P('a', 1)])
  const second = run([P('a', SLOTS_PER_CELL * 2)], first.memory)
  const [root, extra] = second.cells.get('a')
  assert.deepEqual(root, first.cells.get('a')[0])
  assert.equal(Math.abs(root[0] - extra[0]) + Math.abs(root[1] - extra[1]), 1)
})

test('shrinking by one thread keeps the cell; shrinking well past the line releases the newest', () => {
  const S = SLOTS_PER_CELL
  const one = run([P('a', 1)]).memory
  const grown = run([P('a', S + 2)], one)
  assert.equal(grown.cells.get('a').length, 2)
  const slight = run([P('a', S)], grown.memory)
  assert.equal(slight.cells.get('a').length, 2) // hysteresis
  const big = run([P('a', 1)], slight.memory)
  assert.deepEqual(big.cells.get('a'), [grown.cells.get('a')[0]])
})

test('a garden-only repo keeps a plot, and a full garden claims another cell', () => {
  assert.equal(cellsNeeded(0, 1), 1)
  assert.equal(cellsNeeded(0, FLOWERS_PER_CELL), 1)
  assert.equal(cellsNeeded(0, FLOWERS_PER_CELL + 1), 2)
  assert.equal(cellsNeeded(1, FLOWERS_PER_CELL * 3), 3)
  const { cells } = run([{ name: 'done', size: 0, garden: FLOWERS_PER_CELL + 5 }])
  assert.equal(cells.get('done').length, 2)
})

test('a repo whose root was taken is placed afresh', () => {
  const prev = new Map([['a', [[0, -1]]], ['b', [[0, -1]]]])
  const { cells } = run([P('a', 1), P('b', 1)], prev)
  assert.notDeepEqual(cells.get('a')[0], cells.get('b')[0])
})

test('ground remembered by an absent repo is avoided while other ground is free', () => {
  const first = run([P('a', 1), P('b', 1)])
  const bCell = first.cells.get('b')[0]
  const without = run([P('a', 1), P('c', 1)], first.memory)
  assert.notDeepEqual(without.cells.get('c')[0], bCell)
  const back = run([P('a', 1), P('b', 1), P('c', 1)], without.memory)
  assert.deepEqual(back.cells.get('b')[0], bCell)
})

test('memory is capped', () => {
  const prev = new Map(Array.from({ length: 200 }, (_, i) => [`old${i}`, [[i + 20, 0]]]))
  const { memory } = run([P('a', 1)], prev)
  assert.ok(memory.size <= MEMORY_LIMIT)
  assert.ok(memory.has('a'))
})
