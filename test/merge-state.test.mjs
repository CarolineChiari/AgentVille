import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeSet, mergeState } from '../src/game/merge-state.js'

const S = (o = {}) => ({ version: 1, archived: [], archivedAt: {}, plots: {}, seen: {}, hiddenProjects: [], viewedAt: {}, settings: null, updatedAt: 1, ...o })

test('additions from both tabs survive', () => {
  const base = S()
  const local = S({ archived: ['a'] })
  const remote = S({ archived: ['b'], updatedAt: 2 })
  assert.deepEqual(mergeState(base, local, remote).archived.sort(), ['a', 'b'])
})

test('a removal in this tab survives the other tab keeping it', () => {
  assert.deepEqual(mergeSet(['a', 'b'], ['b'], ['a', 'b', 'c']), ['b', 'c'])
})

test('a plot this tab did not touch is left as the other tab set it', () => {
  const base = S({ plots: { x: [[0, 1]], y: [[1, 1]] } })
  const local = S({ plots: { x: [[0, 1]], y: [[2, 2]] } })
  const remote = S({ plots: { x: [[5, 5]], y: [[1, 1]] } })
  assert.deepEqual(mergeState(base, local, remote).plots, { x: [[5, 5]], y: [[2, 2]] })
})

test('a hidden repo and a viewed thread from different tabs both survive', () => {
  const base = S()
  const local = S({ hiddenProjects: ['repo'] })
  const remote = S({ viewedAt: { t1: 99 } })
  const m = mergeState(base, local, remote)
  assert.deepEqual(m.hiddenProjects, ['repo'])
  assert.deepEqual(m.viewedAt, { t1: 99 })
})

test('settings are taken whole, never merged field by field', () => {
  const m = mergeState(S(), S({ settings: { a: 1 } }), S({ settings: { b: 2 } }))
  assert.deepEqual(m.settings, { a: 1 })
})

test('updatedAt comes from the server copy', () => {
  assert.equal(mergeState(S(), S({ updatedAt: 1 }), S({ updatedAt: 7 })).updatedAt, 7)
})
