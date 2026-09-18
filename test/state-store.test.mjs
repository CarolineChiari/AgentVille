import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { ConflictError, createStateStore, emptyState, normalizeState } from '../server/state.mjs'
import { tmpHome } from './helpers/fixtures.mjs'

test('a missing file yields the empty state', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  assert.deepEqual(await createStateStore(home).read(), emptyState())
})

test('unknown fields are dropped and types coerced', () => {
  const s = normalizeState({ archived: ['a', 3, 'a'], plots: { x: [[1, 2], [1.5, 2], 'no'] }, junk: true, viewedAt: { a: 'x', b: 2 } })
  assert.deepEqual(s.archived, ['a'])
  assert.deepEqual(s.plots, { x: [[1, 2]] })
  assert.deepEqual(s.viewedAt, { b: 2 })
  assert.equal('junk' in s, false)
})

test('writes are serialised, atomic and stamped strictly increasing', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const store = createStateStore(home)
  const results = await Promise.all([1, 2, 3, 4, 5].map((n) => store.write({ archived: [`t${n}`] })))
  const stamps = results.map((r) => r.updatedAt)
  assert.deepEqual([...stamps].sort((a, b) => a - b), stamps)
  assert.equal(new Set(stamps).size, 5)
  assert.deepEqual((await store.read()).archived, ['t5'])
  assert.deepEqual(fs.readdirSync(home).filter((f) => f.endsWith('.tmp')), [])
  assert.ok(fs.existsSync(path.join(home, 'village.json')))
})

test('a stale base is refused with the current state', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const store = createStateStore(home)
  const first = await store.write({ archived: ['a'] })
  await store.write({ archived: ['b'] }, { baseUpdatedAt: first.updatedAt })
  await assert.rejects(store.write({ archived: ['c'] }, { baseUpdatedAt: first.updatedAt }), (err) => {
    assert.ok(err instanceof ConflictError)
    assert.deepEqual(err.current.archived, ['b'])
    return true
  })
})
