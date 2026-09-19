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

test('tasks added to different repos in two tabs both survive', () => {
  const t = (id) => [{ id, label: id, prompt: 'p' }]
  const out = mergeState(S({ tasks: {} }), S({ tasks: { a: t('c-a') } }), S({ tasks: { b: t('c-b') } }))
  assert.deepEqual(out.tasks, { a: t('c-a'), b: t('c-b') })
})

test('folders dressed in different tabs both keep their looks', () => {
  const a = { theme: 'construction', sub: 'roadworks' }
  const b = { theme: 'village', sub: 'farmstead' }
  const out = mergeState(S({ looks: {} }), S({ looks: { a } }), S({ looks: { b } }))
  assert.deepEqual(out.looks, { a, b })
})

test('landmarks raised in different tabs both stay raised', () => {
  const out = mergeState(S({ progress: { a: { tier: 1, at: 1 } } }), S({ progress: { a: { tier: 2, at: 5 } } }), S({ progress: { a: { tier: 1, at: 1 }, b: { tier: 3, at: 4 } } }))
  assert.deepEqual(out.progress, { a: { tier: 2, at: 5 }, b: { tier: 3, at: 4 } })
})
