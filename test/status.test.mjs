import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyViewed, BADGE_FOR, statusFor, transcriptProgress } from '../src/sim/status.js'
import { STALE_MS } from '../src/sim/constants.js'

const NOW = 1e12

test('status precedence: first match wins', () => {
  const base = { lastActivityAt: NOW }
  assert.equal(statusFor({ ...base, hasError: true, running: true, unread: true }, NOW), 'blocked')
  assert.equal(statusFor({ ...base, running: true, unread: true, prState: 'MERGED' }, NOW), 'working')
  assert.equal(statusFor({ ...base, prState: 'merged', unread: true }, NOW), 'celebrating')
  assert.equal(statusFor({ ...base, unread: true }, NOW), 'waiting')
  assert.equal(statusFor({ lastActivityAt: NOW - STALE_MS - 1 }, NOW), 'sleeping')
  assert.equal(statusFor(base, NOW), 'idle')
})

test('only the states that want something get a badge', () => {
  assert.equal(BADGE_FOR.sleeping, null)
  assert.equal(BADGE_FOR.idle, null)
  assert.equal(BADGE_FOR.waiting, 'waiting')
})

test('viewing a thread puts its hand down until it does something newer', () => {
  const t = { id: 'x', unread: true, lastActivityAt: 100 }
  assert.equal(applyViewed(t, { x: 150 }).unread, false)
  assert.equal(applyViewed({ ...t, lastActivityAt: 200 }, { x: 150 }).unread, true)
  assert.equal(applyViewed(t, {}).unread, true)
})

test('transcript progress is a clamped log scale', () => {
  assert.equal(transcriptProgress(0), 0)
  assert.ok(transcriptProgress(10_000) < transcriptProgress(1_000_000))
  assert.equal(transcriptProgress(1e12), 1)
})
