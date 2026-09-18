import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SWEEP_EVERY, SWEEP_TIME, sweepAt, sweepRow, twinklesAt } from '../src/render/shine.js'

const W = 32
const H = 48
/** Every pixel the band covers at `time`, as "x,y", clipped to the sprite. */
const covered = (seed, time) => {
  const lead = sweepAt(seed, time, W, H)
  const out = new Set()
  if (lead === null) return out
  for (let y = 0; y < H; y++) {
    for (const [x, width] of sweepRow(lead, y, H)) for (let i = x; i < x + width; i++) if (i >= 0 && i < W) out.add(`${i},${y}`)
  }
  return out
}

test('a sweep comes round every few seconds and is gone most of the time', () => {
  for (const seed of [0, 7, 123456, 4294967295]) {
    let on = 0
    const steps = 900
    for (let i = 0; i < steps; i++) if (sweepAt(seed, (i / steps) * SWEEP_EVERY, W, H) !== null) on++
    assert.ok(Math.abs(on / steps - SWEEP_TIME / SWEEP_EVERY) < 0.01, `seed ${seed} shines ${on} of ${steps}`)
  }
})

test('a sweep starts and ends off the building, so it never pops in or out', () => {
  const seed = 42
  // Find the moment a sweep begins.
  let start = 0
  while (sweepAt(seed, start, W, H) !== null) start += 0.001
  while (sweepAt(seed, start, W, H) === null) start += 0.001
  assert.equal(covered(seed, start).size, 0, 'something showed the moment it began')
  assert.equal(covered(seed, start + SWEEP_TIME - 0.002).size, 0, 'something showed as it ended')
  assert.ok(covered(seed, start + SWEEP_TIME / 2).size > 0, 'nothing showed halfway across')
})

test('buildings shine on their own beats, not all at once', () => {
  const beats = new Set()
  for (let s = 0; s < 40; s++) beats.add(sweepAt(s * 7919, 1, W, H) === null ? 'off' : Math.round(sweepAt(s * 7919, 1, W, H)))
  assert.ok(beats.size > 3)
})

test('sparkles sit on the building, and move somewhere new each time they twinkle', () => {
  const solid = (x, y) => y > 20 && x > 8 && x < 24
  const spots = new Set()
  for (let t = 0; t < 30; t += 0.05) {
    for (const s of twinklesAt(99, t, W, H, solid)) {
      assert.ok(solid(s.x, s.y), `a sparkle at ${s.x},${s.y} is off the building`)
      assert.ok(s.a > 0 && s.a <= 1)
      spots.add(`${s.x},${s.y}`)
    }
  }
  assert.ok(spots.size > 10, `only ${spots.size} different spots`)
})

test('a building with nowhere to sparkle has no sparkles', () => {
  assert.deepEqual(twinklesAt(5, 3, W, H, () => false), [])
})
