import { test } from 'node:test'
import assert from 'node:assert/strict'
import { heading, isMoveKey } from '../src/ui/move.js'

test('WASD and the arrows are movement keys, by physical key', () => {
  for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']) {
    assert.ok(isMoveKey(code), code)
  }
  for (const code of ['KeyN', 'KeyQ', 'Space', 'toString', '__proto__', '', undefined, 42]) {
    assert.equal(isMoveKey(code), false, String(code))
  }
})

test('one key heads one way', () => {
  assert.deepEqual(heading(new Set(['KeyW'])), { x: 0, y: -1 })
  assert.deepEqual(heading(new Set(['KeyS'])), { x: 0, y: 1 })
  assert.deepEqual(heading(new Set(['KeyA'])), { x: -1, y: 0 })
  assert.deepEqual(heading(new Set(['ArrowRight'])), { x: 1, y: 0 })
})

test('nothing held, or opposites held, goes nowhere', () => {
  assert.deepEqual(heading(new Set()), { x: 0, y: 0 })
  assert.deepEqual(heading(new Set(['KeyW', 'KeyS'])), { x: 0, y: 0 })
  assert.deepEqual(heading(new Set(['KeyA', 'ArrowRight'])), { x: 0, y: 0 })
  assert.deepEqual(heading(new Set(['KeyN', 'Space'])), { x: 0, y: 0 })
})

test('a diagonal is no faster than a straight line', () => {
  const d = heading(new Set(['KeyW', 'KeyD']))
  assert.ok(d.x > 0 && d.y < 0)
  assert.ok(Math.abs(Math.hypot(d.x, d.y) - 1) < 1e-9)
})

test('W and the up arrow together are still just up', () => {
  assert.deepEqual(heading(new Set(['KeyW', 'ArrowUp'])), { x: 0, y: -1 })
  const d = heading(new Set(['KeyW', 'ArrowUp', 'KeyD']))
  assert.ok(Math.abs(Math.hypot(d.x, d.y) - 1) < 1e-9)
})
