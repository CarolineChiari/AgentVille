import { test } from 'node:test'
import assert from 'node:assert/strict'
import { growthInputs, highWater, standing } from '../src/game/growth.js'
import { THREAD_BYTES_CAP, TIER_AT } from '../src/sim/progress.js'

const T = (project, sizeBytes = 0) => ({ project, sizeBytes })

test('every thread on a repo counts as a session, its transcript up to a cap', () => {
  const g = growthInputs([T('a', 300_000), T('a', 50_000_000), T('b', 10), T('', 999), { project: 'b' }], new Map())
  assert.deepEqual(g.get('a'), { sessions: 2, finished: 0, bytes: 300_000 + THREAD_BYTES_CAP, lines: 0 })
  assert.deepEqual(g.get('b'), { sessions: 2, finished: 0, bytes: 10, lines: 0 })
  assert.equal(g.has(''), false)
})

test('finished work is what has bloomed in the garden; an open PR\'s bud is not finished yet', () => {
  const gardens = new Map([['a', [{}, { open: false }, { open: true }]], ['gardenOnly', [{}]]])
  const g = growthInputs([T('a')], gardens)
  assert.equal(g.get('a').finished, 2)
  assert.equal(g.get('gardenOnly').finished, 1, 'a repo with only a garden still has its work')
})

test('lines come from the count, for repos that have one', () => {
  const g = growthInputs([T('a'), T('b')], new Map(), { a: { lines: 4200 }, b: { lines: 'many' }, c: { lines: 10 } })
  assert.equal(g.get('a').lines, 4200)
  assert.equal(g.get('b').lines, 0)
  assert.equal(g.has('c'), false, 'a count alone does not put a repo on the map')
})

test('a hidden repo grows nothing while it is put away', () => {
  const g = growthInputs([T('a'), T('b')], new Map([['b', [{}]]]), {}, ['b'])
  assert.deepEqual([...g.keys()], ['a'])
})

test('a landmark only ever goes up, and remembers when it did', () => {
  const saved = { a: { tier: 3, at: 100 }, gone: { tier: 2, at: 50 } }
  const { progress, changed } = highWater(saved, new Map([['a', 1], ['b', 2], ['c', 0]]), 900)
  assert.equal(changed, true)
  assert.deepEqual(progress, { a: { tier: 3, at: 100 }, gone: { tier: 2, at: 50 }, b: { tier: 2, at: 900 } })
  assert.deepEqual(saved, { a: { tier: 3, at: 100 }, gone: { tier: 2, at: 50 } }, 'the saved tiers are left as they were')
  assert.equal(highWater(progress, new Map([['a', 3], ['b', 2]]), 1000).changed, false)
  assert.deepEqual(highWater({}, new Map([['a', 99]]), 1).progress, { a: { tier: 5, at: 1 } })
})

test('a repo\'s standing: the saved tier if it is higher, and the way to the next from there', () => {
  const g = { sessions: 5, finished: 0, bytes: 0, lines: 0 } // 5 points: a tier-1 well
  assert.equal(standing(g, undefined).tier, 1)
  const s = standing(g, { tier: 3, at: 42 })
  assert.equal(s.tier, 3)
  assert.equal(s.points, 5)
  assert.equal(s.next, TIER_AT[4] - 5)
  assert.equal(s.since, 42)
})
