import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classify, hideProject, unhideProject } from '../src/game/hidden.js'
import { STALE_MS } from '../src/sim/constants.js'

const NOW = 1e12
const S = (o = {}) => ({ archived: [], hiddenProjects: [], viewedAt: {}, ...o })
const T = (id, project, extra = {}) => ({ id, project, lastActivityAt: NOW, ...extra })
const old = { lastActivityAt: NOW - STALE_MS - 1 }

test('hide and unhide are idempotent', () => {
  const a = hideProject(hideProject(S(), 'x'), 'x')
  assert.deepEqual(a.hiddenProjects, ['x'])
  assert.deepEqual(unhideProject(unhideProject(a, 'x'), 'x').hiddenProjects, [])
})

test('archived and hidden threads stay off the map', () => {
  const threads = [T('1', 'a'), T('2', 'a', { archived: true }), T('3', 'a'), T('4', 'b'), T('5', 'a', { archivedHere: true })]
  const r = classify(threads, S({ archived: ['3'], hiddenProjects: ['b'] }), { now: NOW })
  assert.deepEqual(r.live.map((t) => t.id), ['1'])
  assert.deepEqual(r.archived.map((t) => t.id).sort(), ['2', '3', '5'])
  assert.deepEqual(r.hidden.map((t) => t.id), ['4'])
})

test('an all-asleep repo folds away, but never every repo', () => {
  const r = classify([T('1', 'a', old), T('2', 'b')], S(), { now: NOW })
  assert.deepEqual(r.dormant, ['a'])
  assert.deepEqual(r.live.map((t) => t.id), ['2'])
  const all = classify([T('1', 'a', old), T('2', 'b', old)], S(), { now: NOW })
  assert.equal(all.live.length, 2)
  const off = classify([T('1', 'a', old), T('2', 'b')], S(), { now: NOW, hideDormant: false })
  assert.equal(off.live.length, 2)
})

test('a sleeping repo with work you have not reviewed stays on the map until you review it', () => {
  const unread = { ...old, unread: true }
  const r = classify([T('1', 'a', unread), T('2', 'b', old), T('3', 'c')], S(), { now: NOW })
  assert.deepEqual(r.dormant, ['b'])
  assert.ok(r.live.some((t) => t.id === '1'))
  const reviewed = classify([T('1', 'a', unread), T('2', 'b', old), T('3', 'c')], S({ viewedAt: { 1: NOW } }), { now: NOW })
  assert.deepEqual(reviewed.dormant.sort(), ['a', 'b'])
})

test('each live thread carries its status, with viewedAt applied', () => {
  const r = classify([T('1', 'a', { unread: true, lastActivityAt: 50 })], S({ viewedAt: { 1: 60 } }), { now: 100 })
  assert.equal(r.live[0].status, 'idle')
})

const DAY = 24 * 60 * 60 * 1000
const asleep = (days) => ({ lastActivityAt: NOW - days * DAY })

test('a thread asleep longer than the chosen days archives itself, and never with the setting off', () => {
  const threads = [T('1', 'a', asleep(91)), T('2', 'a', asleep(89)), T('3', 'a')]
  const r = classify(threads, S(), { now: NOW, archiveAfterDays: 90, hideDormant: false })
  assert.deepEqual(r.archived.map((t) => t.id), ['1'])
  assert.deepEqual(r.auto, ['1'])
  assert.deepEqual(r.live.map((t) => t.id), ['2', '3'])
  const off = classify(threads, S(), { now: NOW, hideDormant: false })
  assert.equal(off.archived.length, 0)
  assert.deepEqual(off.auto, [])
})

test('a thread restored by hand is not archived again, and one with no date is left alone', () => {
  const threads = [T('1', 'a', asleep(200)), T('2', 'a', { lastActivityAt: 0 }), T('3', 'a')]
  const r = classify(threads, S({ kept: ['1'] }), { now: NOW, archiveAfterDays: 30, hideDormant: false })
  assert.deepEqual(r.archived, [])
  assert.deepEqual(r.live.map((t) => t.id), ['1', '2', '3'])
})

test('a thread archived by hand is not counted as archiving itself', () => {
  const r = classify([T('1', 'a', asleep(200))], S({ archived: ['1'] }), { now: NOW, archiveAfterDays: 30 })
  assert.deepEqual(r.auto, [])
})
