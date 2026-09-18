import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FENCES, ROOF_FAMILY_COUNT, WALLS, YARD_TONES, cellStyles, plotStyle } from '../src/sim/style.js'

const NAMES = Array.from({ length: 300 }, (_, i) => `repo-${i}`)

test('a repo always gets the same look', () => {
  assert.deepEqual(plotStyle('AgentVille'), plotStyle('AgentVille'))
})

test('every fence, lawn, wall and roof family turns up across repos, and nothing out of range', () => {
  const seen = { fence: new Set(), yard: new Set(), wall: new Set(), roofs: new Set() }
  for (const name of NAMES) {
    const s = plotStyle(name)
    for (const k of Object.keys(seen)) seen[k].add(s[k])
  }
  assert.equal(seen.fence.size, FENCES.length)
  assert.equal(seen.yard.size, YARD_TONES)
  assert.equal(seen.wall.size, WALLS.length)
  assert.equal(seen.roofs.size, ROOF_FAMILY_COUNT)
})

test('two repos side by side usually look different', () => {
  let same = 0
  for (let i = 1; i < NAMES.length; i++) {
    const a = plotStyle(NAMES[i - 1])
    const b = plotStyle(NAMES[i])
    if (a.fence === b.fence && a.yard === b.yard && a.wall === b.wall) same++
  }
  assert.ok(same / NAMES.length < 0.1)
})

test('each cell of a plot carries its plot\'s style, and no other cell has one', () => {
  const a = { cells: [[0, 1], [1, 1]], style: plotStyle('a') }
  const b = { cells: [[-2, 0]], style: plotStyle('b') }
  const m = cellStyles([a, b])
  assert.equal(m.size, 3)
  assert.equal(m.get('0,1'), a.style)
  assert.equal(m.get('1,1'), a.style)
  assert.equal(m.get('-2,0'), b.style)
  assert.equal(m.get('0,0'), undefined)
})
