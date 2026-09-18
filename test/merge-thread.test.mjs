import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyEntry, isBookkeepingOnly, mergeThread, NEW_SESSION_MS } from '../server/harnesses/claude-code/merge.mjs'

const rec = (over) => Object.assign(emptyEntry('claude-code:x'), over)

test('the titled record wins the canonical desktop id and both ids are kept', () => {
  const a = rec({ desktopSessionId: 'local_a', desktopSessionIds: ['local_a'], createdAt: 1 })
  const b = rec({ desktopSessionId: 'local_b', desktopSessionIds: ['local_b'], title: 'Named', createdAt: 2 })
  const m = mergeThread(a, b)
  assert.equal(m.desktopSessionId, 'local_b')
  assert.deepEqual(m.desktopSessionIds.sort(), ['local_a', 'local_b'])
  assert.equal(m.title, 'Named')
  assert.equal(m.createdAt, 1)
})

test('flags OR together and archived ANDs', () => {
  const m = mergeThread(rec({ hasError: true, archived: true }), rec({ archived: false, lastActivityAt: 9 }))
  assert.equal(m.hasError, true)
  assert.equal(m.archived, false)
  assert.equal(m.lastActivityAt, 9)
})

test('bookkeeping-only records older than ten minutes are dropped; fresh ones survive', () => {
  const now = 1e12
  assert.equal(isBookkeepingOnly(rec({ createdAt: now - NEW_SESSION_MS - 1 }), now), true)
  assert.equal(isBookkeepingOnly(rec({ createdAt: now - 1000 }), now), false)
  assert.equal(isBookkeepingOnly(rec({ createdAt: 0, title: 'x' }), now), false)
  assert.equal(isBookkeepingOnly(rec({ createdAt: 0, hasTranscript: true }), now), false)
})
