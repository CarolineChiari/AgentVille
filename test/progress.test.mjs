import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LINES_CAP, MAX_TIER, TIER_AT, nextFor, progressOf, tierFor } from '../src/sim/progress.js'

test('finished work counts double, sessions once, a transcript by the 250 KB and code by the thousand lines', () => {
  const p = progressOf({ sessions: 3, finished: 4, bytes: 520_000, lines: 12_345 })
  assert.deepEqual(p.breakdown, { finished: 8, sessions: 3, bytes: 2, lines: 12 })
  assert.equal(p.points, 25)
  assert.equal(p.tier, 2)
  assert.equal(p.next, TIER_AT[3] - 25)
})

test('a repo nobody has worked in has a tier-0 landmark, however it is described', () => {
  for (const g of [{}, { sessions: 0 }, { sessions: -3, finished: NaN, bytes: Infinity, lines: undefined }]) {
    const p = progressOf(g)
    assert.equal(p.points, 0)
    assert.equal(p.tier, 0)
  }
})

test('a tier starts exactly at its threshold', () => {
  for (let t = 1; t <= MAX_TIER; t++) {
    assert.equal(tierFor(TIER_AT[t] - 1), t - 1)
    assert.equal(tierFor(TIER_AT[t]), t)
  }
  assert.equal(tierFor(1e9), MAX_TIER)
  assert.equal(nextFor(1e9, MAX_TIER), null, 'nothing above the top')
})

test('the size of a repo alone can only take it so far', () => {
  const huge = progressOf({ lines: 5_000_000 })
  assert.equal(huge.breakdown.lines, LINES_CAP)
  assert.ok(huge.tier < MAX_TIER - 1, 'a big repo nobody has worked in stands a keep')
})

test('the breakdown adds up to the points', () => {
  const p = progressOf({ sessions: 17, finished: 30, bytes: 3_456_789, lines: 88_000 })
  assert.equal(Object.values(p.breakdown).reduce((a, b) => a + b, 0), p.points)
})
