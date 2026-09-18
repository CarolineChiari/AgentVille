import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Nav } from '../src/sim/nav.js'

const grid = () => new Nav({ ox: 0, oy: 0, w: 20, h: 20 })

function walk(nav, path, from) {
  // Every leg of a returned path must be walkable in a straight line.
  let a = from
  for (const p of path) {
    assert.ok(nav.lineOfSight(a.x, a.y, p.x, p.y), `leg ${JSON.stringify(a)} → ${JSON.stringify(p)} crosses a wall`)
    a = p
  }
}

test('a path routes around a wall', () => {
  const nav = grid()
  for (let y = 0; y < 15; y++) nav.setBlocked(10, y)
  const from = { x: 5.5, y: 5.5 }
  const path = nav.findPath(from.x, from.y, 15.5, 5.5)
  assert.ok(path.length >= 2)
  walk(nav, path, from)
  assert.deepEqual(path.at(-1), { x: 15.5, y: 5.5 })
})

test('no corner cutting between two diagonal blocks', () => {
  const nav = grid()
  nav.setBlocked(6, 5)
  nav.setBlocked(5, 6)
  const from = { x: 5.5, y: 5.5 }
  const path = nav.findPath(from.x, from.y, 6.5, 6.5)
  walk(nav, path, from)
  assert.ok(path.length > 1, 'must go round, not squeeze diagonally')
})

test('an unreachable goal returns a path to the nearest reachable point', () => {
  const nav = grid()
  for (let i = 8; i <= 12; i++) {
    nav.setBlocked(i, 8)
    nav.setBlocked(i, 12)
    nav.setBlocked(8, i)
    nav.setBlocked(12, i)
  }
  const path = nav.findPath(2.5, 2.5, 10.5, 10.5)
  assert.ok(path.length)
  const end = path.at(-1)
  assert.equal(nav.isBlocked(Math.floor(end.x), Math.floor(end.y)), false)
})

test('slide never enters a blocked tile', () => {
  const nav = grid()
  nav.blockRect(10, 0, 1, 20)
  const pos = { x: 9.5, y: 5.5 }
  for (let i = 0; i < 50; i++) nav.slide(pos, 0.1, 0.03)
  assert.ok(nav.standable(pos.x, pos.y))
  assert.ok(pos.x < 10)
  assert.ok(pos.y > 5.5, 'slides along the wall instead of stopping dead')
})

test('nearestFree escapes a spot something was built on', () => {
  const nav = grid()
  nav.blockRect(4, 4, 3, 3)
  const p = nav.nearestFree(5.5, 5.5)
  assert.equal(nav.isBlocked(Math.floor(p.x), Math.floor(p.y)), false)
  const pos = { x: 5.5, y: 5.5 }
  for (let i = 0; i < 40; i++) nav.slide(pos, 0.1, 0)
  assert.ok(nav.standable(pos.x, pos.y))
})
