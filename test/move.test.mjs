import { test } from 'node:test'
import assert from 'node:assert/strict'
import { heading, isClick, isDrag, isMoveKey, pansCamera } from '../src/ui/move.js'

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

test('a press in a room is still a press: it just doesn’t move the camera', () => {
  const press = { x: 100, y: 100, dragging: false }
  assert.equal(isClick(press), true)
  assert.equal(pansCamera(press, false), false, 'a press that never moved is no drag')
  assert.equal(isDrag(press, 103, 101), false, 'a wobble is not a drag')
  assert.equal(isDrag(press, 140, 100), true)
  press.dragging = true
  assert.equal(isClick(press), false)
  assert.equal(pansCamera(press, false), true)
  // Inside a building there is nothing behind the room to drag into view…
  assert.equal(pansCamera(press, true), false)
  // …but a click in there must still land, or nothing in the room could be clicked at all.
  assert.equal(isClick({ x: 0, y: 0, dragging: false }), true)
  assert.equal(isDrag(null, 0, 0), false)
  assert.equal(isClick(null), false)
})
