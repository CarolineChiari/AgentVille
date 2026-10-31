import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanFilter, cleanFilterMap, filterIssues, filterLabel, labelFilter, labelsOf } from '../src/game/boardfilter.js'
import { emptyState, normalizeState } from '../server/state.mjs'
import { mergeState } from '../src/game/merge-state.js'

const issues = [
  { number: 1, labels: ['bug'], assignees: ['Me'] },
  { number: 2, labels: ['Bug', 'ui'], assignees: [] },
  { number: 3, labels: [], assignees: ['you', 'me'] },
]
const nums = (list) => list.map((i) => i.number)

test('all shows everything, unassigned only the unowned', () => {
  assert.deepEqual(nums(filterIssues(issues, '')), [1, 2, 3])
  assert.deepEqual(nums(filterIssues(issues, 'nonsense')), [1, 2, 3])
  assert.deepEqual(nums(filterIssues(issues, 'unassigned')), [2])
})

test('assigned to me matches the login in any case, and nothing while it is unknown', () => {
  assert.deepEqual(nums(filterIssues(issues, 'mine', 'me')), [1, 3])
  assert.deepEqual(nums(filterIssues(issues, 'mine', '')), [])
  assert.deepEqual(nums(filterIssues(issues, 'mine')), [])
})

test('a label filter matches the label in any case', () => {
  assert.deepEqual(nums(filterIssues(issues, labelFilter('bug'))), [1, 2])
  assert.deepEqual(nums(filterIssues(issues, 'label:ui')), [2])
  assert.equal(filterLabel('label:ui'), 'ui')
  assert.equal(filterLabel('mine'), '')
})

test('filters are cleaned: unknown ones mean all, labels are capped', () => {
  assert.equal(cleanFilter('mine'), 'mine')
  assert.equal(cleanFilter('label:'), '')
  assert.equal(cleanFilter(7), '')
  assert.equal(cleanFilter('label:' + 'x'.repeat(80)).length, 'label:'.length + 50)
  assert.deepEqual(cleanFilterMap({ a: 'mine', b: '', c: 'bad', __proto__: 'mine' }), { a: 'mine' })
  assert.deepEqual(cleanFilterMap([1]), {})
})

test('labels come most used first', () => {
  assert.deepEqual(labelsOf([{ labels: ['b', 'a'] }, { labels: ['b'] }, {}]), ['b', 'a'])
})

test('the filter is saved per repo, and merges key by key', () => {
  assert.deepEqual(normalizeState({ boardFilters: { app: 'unassigned', x: 'zzz' } }).boardFilters, { app: 'unassigned' })
  assert.deepEqual(emptyState().boardFilters, {})
  const out = mergeState({ boardFilters: {} }, { boardFilters: { a: 'mine' } }, { boardFilters: { b: 'unassigned' } })
  assert.deepEqual(out.boardFilters, { a: 'mine', b: 'unassigned' })
})
