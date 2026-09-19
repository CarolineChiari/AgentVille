import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Camera, MOVE_SPEED, MOVE_BOOST } from '../src/render/camera.js'

const STEP = 1 / 60

function run(cam, dir, seconds, boost = false) {
  for (let t = 0; t < seconds; t += STEP) cam.steer(dir, boost, STEP)
}

test('held keys move the view that way, easing up to full speed', () => {
  const cam = new Camera()
  run(cam, { x: 1, y: 0 }, 0.05)
  assert.ok(cam.x > 0 && cam.y === 0)
  assert.ok(cam.vx > 0 && cam.vx < MOVE_SPEED * 0.9, 'not at full speed on the first frames')
  run(cam, { x: 1, y: 0 }, 1)
  assert.ok(Math.abs(cam.vx - MOVE_SPEED) < 1)
  run(cam, { x: 0, y: -1 }, 1)
  assert.ok(cam.vy < 0 && Math.abs(cam.vx) < 1, 'up moves the view up')
})

test('the pace on screen is the same at every zoom', () => {
  const near = new Camera()
  const far = new Camera()
  near.scale = 8
  far.scale = 2
  run(near, { x: 1, y: 0 }, 1)
  run(far, { x: 1, y: 0 }, 1)
  assert.ok(Math.abs(near.x * near.scale - far.x * far.scale) < 1e-6)
})

test('Shift hurries', () => {
  const cam = new Camera()
  run(cam, { x: 1, y: 0 }, 1, true)
  assert.ok(Math.abs(cam.vx - MOVE_SPEED * MOVE_BOOST) < 1)
})

test('letting go coasts to a stop, then stays put', () => {
  const cam = new Camera()
  run(cam, { x: 1, y: 0 }, 1)
  const letGo = cam.x
  run(cam, { x: 0, y: 0 }, 0.5)
  assert.ok(cam.x > letGo, 'it coasts')
  assert.equal(cam.vx, 0, 'and stops within half a second')
  const rest = cam.x
  run(cam, { x: 0, y: 0 }, 1)
  assert.equal(cam.x, rest)
})

test('standing still leaves a fly-to alone, and a fly-to ends a coast', () => {
  const cam = new Camera()
  cam.flyTo(100, 50)
  cam.steer({ x: 0, y: 0 }, false, STEP)
  assert.deepEqual(cam.target, { x: 100, y: 50 })

  run(cam, { x: 1, y: 0 }, 1)
  assert.equal(cam.target, null, 'moving takes over from a fly-to')
  cam.flyTo(0, 0)
  cam.steer({ x: 0, y: 0 }, false, STEP)
  assert.deepEqual(cam.target, { x: 0, y: 0 })
})
