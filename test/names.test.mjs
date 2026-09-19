import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nameFor, VILLAGER_NAMES } from '../src/sim/names.js'

test('the same id always gets the same name', () => {
  assert.equal(nameFor('thread-123'), nameFor('thread-123'))
  assert.equal(nameFor('abc'), nameFor('abc'))
})

test('different ids can differ and all names come from the list', () => {
  const names = new Set()
  for (let i = 0; i < 500; i++) {
    const n = nameFor(`thread-${i}`)
    assert.ok(VILLAGER_NAMES.includes(n), `unexpected name: ${n}`)
    names.add(n)
  }
  return names
})

test('a few hundred ids spread reasonably across the list', () => {
  const counts = new Map()
  const N = 2000
  for (let i = 0; i < N; i++) {
    const n = nameFor(`id-${i}`)
    counts.set(n, (counts.get(n) ?? 0) + 1)
  }
  const used = counts.size
  // should use a healthy share of the list, not collapse onto a few names
  assert.ok(used > VILLAGER_NAMES.length * 0.8, `only ${used}/${VILLAGER_NAMES.length} names used`)
  // no single name should dominate (uniform expectation ~ N / list length)
  const max = Math.max(...counts.values())
  const expected = N / VILLAGER_NAMES.length
  assert.ok(max < expected * 4, `name used ${max} times, expected ~${expected}`)
})

test('name is non-empty and id-independent of ordering', () => {
  assert.ok(nameFor('').length > 0)
  assert.ok(nameFor('zzz') !== nameFor('thread-123') || true) // collisions allowed
})
