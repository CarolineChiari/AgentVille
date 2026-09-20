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

test('a folder\'s own look is kept, anything that isn\'t a pair of ids is dropped', () => {
  const s = normalizeState({
    looks: {
      app: { theme: 'halloween', sub: 'pumpkin-patch' },
      web: { theme: 'construction', sub: '../../etc' },
      api: { theme: 'Bad Theme', sub: 'x' },
      cli: 'construction/roadworks',
      ['__proto__']: { theme: 'construction', sub: 'roadworks' },
    },
  })
  assert.deepEqual(s.looks, { app: { theme: 'halloween', sub: 'pumpkin-patch' } })
  assert.equal(Object.getPrototypeOf(s.looks), Object.prototype)
  assert.deepEqual(normalizeState({ looks: ['a'] }).looks, {})
})

test("a folder's own spot for its landmark is kept, anything that isn't one of ours is dropped", () => {
  const s = normalizeState({
    spots: { app: 'bottom', web: 'middle', api: 'sideways', cli: 2, ['__proto__']: 'top' },
  })
  assert.deepEqual(s.spots, { app: 'bottom', web: 'middle' })
  assert.equal(Object.getPrototypeOf(s.spots), Object.prototype)
  assert.deepEqual(normalizeState({ spots: ['top'] }).spots, {})
})

test('picks saved per theme by v0.21 and v0.22 become looks, and never override one', () => {
  const s = normalizeState({
    subthemes: { app: { construction: 'roadworks' }, web: { construction: 'high-rise', village: 'farmstead' }, api: { construction: 'x y' } },
    looks: { web: { theme: 'village', sub: 'stone-hamlet' } },
  })
  assert.deepEqual(s.looks, { web: { theme: 'village', sub: 'stone-hamlet' }, app: { theme: 'construction', sub: 'roadworks' } })
  assert.equal(s.subthemes, undefined, 'the old field is not written back')
})

test('the server checks theme ids the way the page does', async () => {
  const { THEME_ID, THEME_IDS, THEMES } = await import('../src/sim/themes.js')
  const looks = Object.fromEntries(THEME_IDS.flatMap((t) => THEMES[t].subthemes.map((x) => [`${t}:${x.id}`, { theme: t, sub: x.id }])))
  assert.deepEqual(normalizeState({ looks }).looks, looks)
  for (const bad of ['', 'A', '1a', 'a b', 'a'.repeat(33)]) {
    assert.ok(!THEME_ID.test(bad), bad)
    assert.deepEqual(normalizeState({ looks: { r: { theme: 'construction', sub: bad } } }).looks, {}, bad)
  }
})

test('each repo\'s landmark tier is kept as a whole number in range, with when it was reached', async () => {
  const s = normalizeState({
    progress: {
      a: { tier: 3, at: 1700 }, b: { tier: 9, at: 1 }, c: { tier: 2.5 }, d: 'x', e: { tier: 0, at: 5 }, f: { tier: 1, at: 'soon' },
      ['__proto__']: { tier: 2, at: 1 },
    },
  })
  assert.deepEqual(s.progress, { a: { tier: 3, at: 1700 }, f: { tier: 1, at: 0 } })
  assert.deepEqual(normalizeState({ progress: [1, 2] }).progress, {})
  // The server's copy of the top tier is the page's.
  const { MAX_TIER } = await import('../src/sim/progress.js')
  assert.deepEqual(normalizeState({ progress: { a: { tier: MAX_TIER, at: 1 } } }).progress, { a: { tier: MAX_TIER, at: 1 } })
  assert.deepEqual(normalizeState({ progress: { a: { tier: MAX_TIER + 1, at: 1 } } }).progress, {})
})
