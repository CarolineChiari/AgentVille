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

test('a repo\'s own tasks are kept, cleaned, and an emptied list is dropped', () => {
  const s = normalizeState({
    tasks: {
      app: [{ id: 'c-deploy', label: ' Deploy ', prompt: 'Ship it.' }, { id: 'bad id', label: 'x', prompt: 'y' }],
      empty: [],
      junk: 'nope',
    },
  })
  assert.deepEqual(s.tasks, { app: [{ id: 'c-deploy', label: 'Deploy', prompt: 'Ship it.' }] })
  assert.deepEqual(normalizeState({ tasks: [1, 2] }).tasks, {})
})

test('a folder\'s sub-theme picks are kept by theme, and anything that isn\'t an id is dropped', () => {
  const s = normalizeState({
    subthemes: {
      app: { construction: 'roadworks', village: 'stone-hamlet', 'Bad Theme': 'x', festival: 3 },
      web: { construction: '../../etc' },
      tools: 'roadworks',
      ['__proto__']: { construction: 'roadworks' },
    },
  })
  assert.deepEqual(s.subthemes, { app: { construction: 'roadworks', village: 'stone-hamlet' } })
  assert.equal(Object.getPrototypeOf(s.subthemes), Object.prototype)
  assert.deepEqual(normalizeState({ subthemes: ['a'] }).subthemes, {})
})

test('the server checks theme ids the way the page does', async () => {
  const { THEME_ID, THEME_IDS, THEMES } = await import('../src/sim/themes.js')
  const ids = [...THEME_IDS, ...THEME_IDS.flatMap((t) => THEMES[t].subthemes.map((x) => x.id))]
  const picks = Object.fromEntries(ids.map((id, i) => [`r${i}`, { [THEME_IDS[0]]: id }]))
  assert.equal(Object.keys(normalizeState({ subthemes: picks }).subthemes).length, ids.length)
  for (const bad of ['', 'A', '1a', 'a b', 'a'.repeat(33)]) assert.ok(!THEME_ID.test(bad) && !Object.keys(normalizeState({ subthemes: { r: { [THEME_IDS[0]]: bad } } }).subthemes).length, bad)
})
