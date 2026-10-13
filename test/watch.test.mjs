import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { createWatcher, RETRY_MS } from '../server/watch.mjs'
import { createLive, LIVE_POLL_MS, POLL_MS } from '../src/game/live.js'

/** A fake clock: timers run only when the test says so. */
function clock() {
  const timers = new Map()
  let n = 0
  return {
    setTimer: (fn, ms) => (timers.set(++n, { fn, ms }), n),
    clearTimer: (id) => timers.delete(id),
    pending: () => [...timers.values()].map((t) => t.ms),
    fire(ms) {
      const [id, t] = [...timers].find(([, t]) => ms === undefined || t.ms === ms)
      timers.delete(id)
      return t.fn()
    },
  }
}

function fakeFs() {
  const opened = []
  const watch = (dir, opts, cb) => {
    if (dir === '/missing') throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    const h = Object.assign(new EventEmitter(), { dir, opts, cb, closed: false, close() { this.closed = true } })
    opened.push(h)
    return h
  }
  return { watch, opened }
}
const settle = () => new Promise((r) => setImmediate(r))

test('a burst of writes becomes one notice per debounce window', async () => {
  const fs = fakeFs()
  const c = clock()
  const w = createWatcher({ dirs: () => ['/a', '/b'], watch: fs.watch, ...c })
  let seen = 0
  w.subscribe(() => seen++)
  await settle()
  assert.equal(fs.opened.length, 2)
  for (let i = 0; i < 20; i++) fs.opened[i % 2].cb('change', 'x.jsonl')
  assert.deepEqual(c.pending(), [300])
  assert.equal(seen, 0)
  c.fire()
  assert.equal(seen, 1)
  fs.opened[0].cb('change', 'x.jsonl')
  c.fire()
  assert.equal(seen, 2)
})

test('watches nothing until someone listens, and lets go when the last one leaves', async () => {
  const fs = fakeFs()
  const c = clock()
  const w = createWatcher({ dirs: () => ['/a'], watch: fs.watch, ...c })
  assert.equal(fs.opened.length, 0)
  const off1 = w.subscribe(() => {})
  const off2 = w.subscribe(() => {})
  await settle()
  assert.equal(fs.opened.length, 1)
  off1()
  await settle()
  assert.equal(fs.opened[0].closed, false)
  off2()
  await settle()
  assert.equal(fs.opened[0].closed, true)
})

test('a missing directory or a failing adapter does not stop the others', async () => {
  const fs = fakeFs()
  const w = createWatcher({ dirs: () => ['/missing', '/a', '/a'], watch: fs.watch, ...clock() })
  w.subscribe(() => {})
  await settle()
  assert.deepEqual(fs.opened.map((h) => h.dir), ['/a'])
  const broken = createWatcher({ dirs: () => Promise.reject(new Error('no')), watch: fs.watch, ...clock() })
  broken.subscribe(() => {})
  await settle()
  assert.equal(broken.watching, 0)
})

test('falls back to a non-recursive watch where the OS cannot recurse', async () => {
  const tried = []
  const watch = (dir, opts) => {
    tried.push(opts.recursive)
    if (opts.recursive) throw Object.assign(new Error('unsupported'), { code: 'ERR_FEATURE_UNAVAILABLE_ON_PLATFORM' })
    return Object.assign(new EventEmitter(), { close() {} })
  }
  const w = createWatcher({ dirs: () => ['/a'], watch, ...clock() })
  w.subscribe(() => {})
  await settle()
  assert.deepEqual(tried, [true, false])
  assert.equal(w.watching, 1)
})

function fakeSource() {
  const handlers = {}
  return { onopen: null, onerror: null, addEventListener: (t, f) => (handlers[t] = f), close() { this.closed = true }, emit: (t) => handlers[t]?.(), handlers }
}

test('the page polls at once on an event, slowly while connected, quickly again when the stream drops', async () => {
  const c = clock()
  const src = fakeSource()
  let polls = 0
  const live = createLive({ poll: () => polls++, open: () => src, ...c })
  live.start()
  assert.deepEqual(c.pending(), [POLL_MS])
  src.onopen()
  assert.deepEqual(c.pending(), [LIVE_POLL_MS])
  src.emit('changed')
  assert.equal(polls, 1)
  await c.fire()
  assert.equal(polls, 2)
  assert.deepEqual(c.pending(), [LIVE_POLL_MS])
  src.onerror()
  assert.deepEqual(c.pending(), [POLL_MS])
  src.onopen()
  live.stop()
  assert.deepEqual(c.pending(), [])
  assert.equal(src.closed, true)
})

test('without EventSource the page keeps the plain poll', async () => {
  const c = clock()
  let polls = 0
  const live = createLive({ poll: () => polls++, open: () => { throw new Error('no EventSource') }, ...c })
  live.start()
  assert.deepEqual(c.pending(), [POLL_MS])
  await c.fire()
  assert.equal(polls, 1)
  assert.deepEqual(c.pending(), [POLL_MS])
})

test('a directory that appears later is picked up on the retry', async () => {
  const fs = fakeFs()
  const c = clock()
  let there = false
  const watch = (dir, opts, cb) => {
    if (dir === '/late' && !there) throw new Error('ENOENT')
    return fs.watch(dir, opts, cb)
  }
  const w = createWatcher({ dirs: () => ['/a', '/late'], watch, ...c })
  w.subscribe(() => {})
  await settle()
  assert.equal(w.watching, 1)
  assert.deepEqual(c.pending(), [RETRY_MS])
  there = true
  c.fire(RETRY_MS)
  await settle()
  assert.equal(w.watching, 2)
  assert.deepEqual(c.pending(), [])
})

test('unsubscribing and resubscribing while directories are being looked up leaks no watch', async () => {
  const fs = fakeFs()
  let release
  const gate = new Promise((r) => (release = r))
  const w = createWatcher({ dirs: async () => (await gate, ['/a']), watch: fs.watch, ...clock() })
  const off = w.subscribe(() => {})
  off()
  w.subscribe(() => {})
  release()
  await settle()
  assert.equal(fs.opened.length, 1)
  assert.equal(w.watching, 1)
})
