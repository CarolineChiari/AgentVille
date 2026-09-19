import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CHEER_SECONDS, Landmark } from '../src/sim/landmark.js'

test('a landmark is fixed per repo, and one present at load is already standing', () => {
  const a = new Landmark('orchard')
  assert.equal(a.variant, new Landmark('orchard').variant)
  assert.equal(a.id, 'landmark:orchard')
  assert.equal(a.stage, 3)
  assert.equal(new Landmark('orchard', { built: false }).stage, 0)
})

test('a higher tier is built again from the ground, and the plot celebrates while it goes up', () => {
  const l = new Landmark('orchard', { tier: 1 })
  assert.equal(l.raise(1, 10), false, 'the same tier again changes nothing')
  assert.equal(l.raise(3, 10), true)
  assert.equal(l.tier, 3)
  assert.equal(l.stage, 0)
  assert.ok(l.cheering(10) && l.cheering(10 + CHEER_SECONDS - 0.1) && !l.cheering(10 + CHEER_SECONDS))
  for (let t = 0; t < 7; t += 0.1) l.tick(0.1)
  assert.equal(l.stage, 3)
})

test('a lower tier is shown as it is, without a celebration', () => {
  const l = new Landmark('orchard', { tier: 4 })
  assert.equal(l.raise(2, 5), false)
  assert.equal(l.tier, 2)
  assert.equal(l.stage, 3)
  assert.ok(!l.cheering(5))
})
