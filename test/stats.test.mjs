import test from 'node:test'
import assert from 'node:assert/strict'
import { almanac, WEEKS } from '../src/game/stats.js'

// A Wednesday at noon, local time.
const NOW = new Date(2026, 9, 14, 12).getTime()
const DAY = 86_400_000
const f = (id, kind, daysAgo, open = false) => ({ id, kind, open, finishedAt: NOW - daysAgo * DAY })

test('counts finished work by kind and repo, skipping open PRs', () => {
  const gardens = new Map([
    ['orchard', [f('a', 0, 1), f('b', 0, 2), f('c', 1, 3), f('pr:x#1', 1, 0, true)]],
    ['quill', [f('d', 2, 1)]],
  ])
  const s = almanac([], gardens, NOW)
  assert.equal(s.finished, 4)
  assert.deepEqual(s.byKind, [{ key: 0, n: 2 }, { key: 1, n: 1 }, { key: 2, n: 1 }])
  assert.deepEqual(s.byRepo, [{ key: 'orchard', n: 3 }, { key: 'quill', n: 1 }])
})

test('buckets finished work into weeks ending with this one', () => {
  const gardens = new Map([['r', [f('a', 0, 0), f('b', 0, 2), f('c', 0, 9), f('d', 0, 400)]]])
  const s = almanac([], gardens, NOW)
  assert.equal(s.weeks.length, WEEKS)
  assert.equal(s.weeks[WEEKS - 1].n, 2) // Mon the 12th and Wed the 14th
  assert.equal(s.weeks[WEEKS - 2].n, 1)
  assert.equal(s.weeks.reduce((n, w) => n + w.n, 0), 3) // the year-old one is off the chart
})

test('counts PRs merged this month only', () => {
  const gardens = new Map([['r', [f('pr:o/r#1', 1, 1), f('pr:o/r#2', 1, 20), f('t1', 0, 1)]]])
  assert.equal(almanac([], gardens, NOW).mergedThisMonth, 1)
})

test('histograms the hour sessions start', () => {
  const at = (h) => ({ createdAt: new Date(2026, 9, 1, h).getTime() })
  const s = almanac([at(9), at(9), at(22), { createdAt: 0 }], new Map(), NOW)
  assert.equal(s.hours[9], 2)
  assert.equal(s.hours[22], 1)
  assert.equal(s.hours.reduce((a, b) => a + b), 3)
  assert.equal(s.sessions, 4)
})
