import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LISTED_MAX, TITLE_MAX, newlyAsking, noticeFor } from '../src/game/notify.js'
import { Village } from '../src/game/village.js'
import { World } from '../src/sim/world.js'

const T = (id, status, extra = {}) => ({ id, status, title: `Thread ${id}`, project: 'orchard', lastActivityAt: 0, ...extra })

/** Feed a sequence of scans through, the way Village.apply does, and collect who rang each time. */
function run(scans) {
  let asking = null
  return scans.map((threads) => {
    const r = newlyAsking(threads, asking)
    asking = r.asking
    return r.fresh.map((t) => t.id)
  })
}

test('the first look only takes the baseline: questions already there are not news', () => {
  assert.deepEqual(run([[T('a', 'waiting'), T('b', 'blocked'), T('c', 'working')]]), [[]])
})

test('one ring for each thread that starts needing you, and none while it stays that way', () => {
  const rang = run([
    [T('a', 'working'), T('b', 'idle')],
    [T('a', 'waiting'), T('b', 'idle')],
    [T('a', 'waiting'), T('b', 'blocked')],
    [T('a', 'waiting'), T('b', 'blocked')],
  ])
  assert.deepEqual(rang, [[], ['a'], ['b'], []])
})

test('answered and asking again is a new question', () => {
  const rang = run([[T('a', 'working')], [T('a', 'waiting')], [T('a', 'working')], [T('a', 'waiting')]])
  assert.deepEqual(rang, [[], ['a'], [], ['a']])
})

test('going from a question to an error does not ring again: you already know it needs you', () => {
  assert.deepEqual(run([[T('a', 'working')], [T('a', 'waiting')], [T('a', 'blocked')]]), [[], ['a'], []])
})

test('a thread missing from one scan and back still waiting does not ring twice', () => {
  const rang = run([[T('a', 'working')], [T('a', 'waiting')], [], [T('a', 'waiting')]])
  assert.deepEqual(rang, [[], ['a'], [], []])
})

test('a new session that arrives already asking rings', () => {
  assert.deepEqual(run([[T('a', 'working')], [T('a', 'working'), T('b', 'waiting')]]), [[], ['b']])
})

test('several at once come back most recent first', () => {
  const r = newlyAsking([T('a', 'waiting', { lastActivityAt: 1 }), T('b', 'waiting', { lastActivityAt: 3 }), T('c', 'blocked', { lastActivityAt: 2 })], new Set())
  assert.deepEqual(r.fresh.map((t) => t.id), ['b', 'c', 'a'])
  assert.deepEqual([...r.asking].sort(), ['a', 'b', 'c'])
})

test('the asking set passed in is not changed', () => {
  const before = new Set(['a'])
  newlyAsking([T('a', 'working'), T('b', 'waiting')], before)
  assert.deepEqual([...before], ['a'])
})

test('one villager: its title, what it wants and its repo', () => {
  assert.deepEqual(noticeFor([T('a', 'waiting', { needsInput: 'permission prompt' })]), {
    id: 'a', title: 'Thread a', body: 'Needs your permission · orchard',
  })
  assert.equal(noticeFor([T('a', 'blocked')]).body, 'Stuck on an error · orchard')
  assert.equal(noticeFor([T('a', 'waiting', { project: '' })]).body, 'Needs you')
})

test('several villagers ring once, counted, and a click lands on the first', () => {
  const two = noticeFor([T('b', 'waiting'), T('a', 'blocked')])
  assert.equal(two.id, 'b')
  assert.equal(two.title, '2 villagers need you')
  assert.equal(two.body, 'Thread b\nThread a')
  const many = noticeFor(['a', 'b', 'c', 'd', 'e'].map((id) => T(id, 'waiting')))
  assert.equal(many.title, '5 villagers need you')
  const lines = many.body.split('\n')
  assert.equal(lines.length, LISTED_MAX + 1)
  assert.equal(lines.at(-1), `and ${5 - LISTED_MAX} more`)
})

test('a long first prompt is clipped and its line breaks folded', () => {
  const long = T('a', 'waiting', { title: `Please\n  look at ${'x'.repeat(300)}` })
  const one = noticeFor([long])
  assert.ok(one.title.startsWith('Please look at x'))
  assert.ok(one.title.endsWith('…') && one.title.length <= TITLE_MAX * 2)
  const [first] = noticeFor([long, T('b', 'waiting')]).body.split('\n')
  assert.ok(first.endsWith('…') && first.length <= TITLE_MAX)
  assert.equal(noticeFor([T('a', 'waiting', { title: '' })]).title, 'Untitled')
})

test('nothing new, nothing to say', () => {
  assert.equal(noticeFor([]), null)
  assert.equal(noticeFor(undefined), null)
})

// ---------- in the village ----------

function village() {
  const heard = []
  // Demo mode, so apply() never schedules a save to a server that isn't there.
  const v = new Village({ world: new World(), settings: { hideDormant: true }, demo: true, notify: (fresh) => heard.push(fresh.map((t) => t.id)) })
  const now = Date.now()
  const scan = (threads) => {
    v.threads = threads.map((t) => ({ project: 'orchard', projectPath: '/orchard', createdAt: now - 1000, lastActivityAt: now, title: t.id, ...t }))
    v.scanned = true
    v.apply()
  }
  return { v, heard, scan }
}

test('the village tells notify about each thread that starts needing you, after the first scan', () => {
  const { heard, scan } = village()
  scan([{ id: 'a', needsInput: 'question' }, { id: 'b', running: true }])
  scan([{ id: 'a', needsInput: 'question' }, { id: 'b', running: true, needsInput: 'permission prompt' }])
  scan([{ id: 'a', needsInput: 'question' }, { id: 'b', running: true, needsInput: 'permission prompt' }])
  assert.deepEqual(heard, [['b']])
})

test('an apply before any scan takes no baseline, so the first scan still is one', () => {
  const { v, heard, scan } = village()
  v.apply()
  scan([{ id: 'a', needsInput: 'question' }])
  assert.deepEqual(heard, [])
})

test('a repo you hid does not call you', () => {
  const { v, heard, scan } = village()
  v.state.hiddenProjects = ['quiet']
  scan([{ id: 'a', running: true, project: 'quiet' }])
  scan([{ id: 'a', needsInput: 'question', project: 'quiet' }])
  assert.deepEqual(heard, [])
})
