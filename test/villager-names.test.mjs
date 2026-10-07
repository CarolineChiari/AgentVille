import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nameFor, NAME_POOL, VILLAGER_NAMES } from '../src/sim/names.js'

test('the same id always gets the same name', () => {
  assert.equal(nameFor('abc-123'), nameFor('abc-123'))
  assert.ok(VILLAGER_NAMES.includes(nameFor('abc-123')))
})

test('the list has no repeats and every name is short', () => {
  assert.equal(new Set(VILLAGER_NAMES).size, VILLAGER_NAMES.length)
  assert.ok(VILLAGER_NAMES.length >= 150)
  for (const n of VILLAGER_NAMES) assert.match(n, /^[A-Z][a-z]{1,9}$/)
})

test('a few hundred ids spread across the list', () => {
  const seen = new Map()
  for (let i = 0; i < 500; i++) {
    const n = nameFor(`00000000-0000-4000-8000-${String(i).padStart(12, '0')}`)
    seen.set(n, (seen.get(n) || 0) + 1)
  }
  assert.ok(seen.size > VILLAGER_NAMES.length * 0.8, `only ${seen.size} names used`)
  assert.ok(Math.max(...seen.values()) <= 12)
})

test('names do not move when the list grows', () => {
  assert.equal(NAME_POOL, 190)
  assert.ok(VILLAGER_NAMES.length >= NAME_POOL)
  // Pinned: these threads keep these names for good.
  assert.deepEqual(['a', 'b', 'c', 'thread-1'].map(nameFor), ['Aster', 'Abe', 'Juniper', 'Ursa'])
})
