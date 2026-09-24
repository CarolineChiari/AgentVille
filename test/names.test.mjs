import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanName, cleanNames, NAME_MAX, withNames } from '../src/game/names.js'
import { normalizeState } from '../server/state.mjs'
import { mergeState } from '../src/game/merge-state.js'

test('a name is one trimmed line, capped', () => {
  assert.equal(cleanName('  fix the\n  login   bug '), 'fix the login bug')
  assert.equal(cleanName('x'.repeat(500)).length, NAME_MAX)
  assert.equal(cleanName(42), '')
  assert.equal(cleanName('   '), '')
})

test('names that are not names are dropped', () => {
  assert.deepEqual(cleanNames({ a: 'Login', b: '  ', c: 7, d: null }), { a: 'Login' })
  assert.deepEqual(cleanNames(['a']), {})
  assert.deepEqual(cleanNames(null), {})
})

test('a named thread wears its name and keeps the harness title', () => {
  const threads = [{ id: 'a', title: 'Please add a way to rename' }, { id: 'b', title: 'Untitled' }]
  const out = withNames(threads, { a: 'Rename' })
  assert.deepEqual(out[0], { id: 'a', title: 'Rename', harnessTitle: 'Please add a way to rename' })
  assert.equal(out[1], threads[1])
})

test('names survive the store and a merge between tabs', () => {
  assert.deepEqual(normalizeState({ names: { a: ' Login ', b: 3 } }).names, { a: 'Login' })
  assert.deepEqual(normalizeState({}).names, {})
  const S = (names) => ({ archived: [], hiddenProjects: [], names, updatedAt: 1 })
  assert.deepEqual(mergeState(S({}), S({ a: 'Mine' }), S({ b: 'Theirs' })).names, { a: 'Mine', b: 'Theirs' })
  assert.deepEqual(mergeState(S({ a: 'Old' }), S({}), S({ a: 'Old' })).names, {})
})

test('renaming a thread never changes the work its flower shows', async () => {
  const { flowerFor } = await import('../src/sim/flowers.js')
  const t = { id: 'a', title: 'Fix the crash on login', preview: '' }
  const [named] = withNames([t], { a: 'Add a new theme' })
  assert.equal(flowerFor(named).work, flowerFor(t).work)
})
