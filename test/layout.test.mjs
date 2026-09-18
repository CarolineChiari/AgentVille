import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allocatePlots, fits, MEMORY_LIMIT } from '../src/sim/layout.js'
import { GATE_CELL, MAX_CELLS } from '../src/sim/constants.js'
import { capacityOf, isRect, rectOf } from '../src/sim/shape.js'

const P = (name, size) => ({ name, size })
const run = (projects, prev) => allocatePlots(projects, prev)
const ONE = capacityOf(1, 1)

test('a plot is as big as its threads need, and no bigger', () => {
  assert.equal(run([P('a', 1)]).cells.get('a').length, 1)
  assert.equal(run([P('a', ONE.slots)]).cells.get('a').length, 1)
  assert.equal(run([P('a', ONE.slots + 1)]).cells.get('a').length, 2)
  assert.equal(run([P('a', 10_000)]).cells.get('a').length, MAX_CELLS)
})

test('a plot grows into a square courtyard rather than a corridor', () => {
  const cells = run([P('a', capacityOf(2, 1).slots + 1)]).cells.get('a')
  assert.ok(isRect(cells))
  assert.deepEqual([rectOf(cells).w, rectOf(cells).h], [2, 2])
})

test('every plot is a whole rectangle, however crowded the village', () => {
  const projects = Array.from({ length: 30 }, (_, i) => P(`p${i}`, (i * 7) % 23))
  const first = run(projects)
  for (const [name, cells] of first.cells) assert.ok(isRect(cells), `${name} is ${JSON.stringify(cells)}`)
  const grown = run(projects.map((p, i) => ({ ...p, size: p.size + (i % 3) * 6 })), first.memory)
  for (const [name, cells] of grown.cells) assert.ok(isRect(cells), `${name} grew into ${JSON.stringify(cells)}`)
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
  const first = run([P('a', 12), P('b', 2)])
  const second = run([P('a', 12), P('b', 2), P('zzz', 20)], first.memory)
  assert.deepEqual(second.cells.get('a'), first.cells.get('a'))
  assert.deepEqual(second.cells.get('b'), first.cells.get('b'))
})

test('growth keeps the root and claims a neighbour', () => {
  const first = run([P('a', 1)])
  const second = run([P('a', ONE.slots + 1)], first.memory)
  const [root, extra] = second.cells.get('a')
  assert.deepEqual(root, first.cells.get('a')[0])
  assert.equal(Math.abs(root[0] - extra[0]) + Math.abs(root[1] - extra[1]), 1)
})

test('shrinking by one thread keeps the cell; shrinking well past the line releases the newest', () => {
  const S = ONE.slots
  const one = run([P('a', 1)]).memory
  const grown = run([P('a', S + 2)], one)
  assert.equal(grown.cells.get('a').length, 2)
  const slight = run([P('a', S)], grown.memory)
  assert.equal(slight.cells.get('a').length, 2) // hysteresis
  const big = run([P('a', 1)], slight.memory)
  assert.deepEqual(big.cells.get('a'), [grown.cells.get('a')[0]])
})

test('grow then shrink returns a plot to exactly the shape it had', () => {
  const small = run([P('a', ONE.slots + 1)])
  const large = run([P('a', capacityOf(2, 2).slots)], small.memory)
  assert.equal(large.cells.get('a').length, 4)
  const back = run([P('a', ONE.slots + 1)], large.memory)
  assert.deepEqual(back.cells.get('a'), small.cells.get('a'))
})

test('a garden-only repo keeps a plot, and a full field claims more ground', () => {
  assert.ok(fits(1, 1, 0, 1))
  assert.ok(fits(1, 1, 0, ONE.flowers))
  assert.ok(!fits(1, 1, 0, ONE.flowers + 1))
  const { cells } = run([{ name: 'done', size: 0, garden: ONE.flowers + 5 }])
  assert.equal(cells.get('done').length, 2)
})

test('a plot remembered in an older, ragged shape keeps the rectangle it started as', () => {
  const prev = new Map([['a', [[0, -1], [1, -1], [1, -2]]]])
  const { cells } = run([P('a', ONE.slots + 1)], prev)
  assert.deepEqual(cells.get('a'), [[0, -1], [1, -1]])
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
