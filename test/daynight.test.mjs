import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dayFactor, duskFactor, formatHour } from '../src/render/daynight.js'

test('it is light at noon and dark at midnight, with a ramp between', () => {
  assert.equal(dayFactor(12), 1)
  assert.equal(dayFactor(0), 0)
  assert.equal(dayFactor(24 + 12), 1)
  let prev = -1
  for (let h = 4; h <= 8; h += 0.25) {
    assert.ok(dayFactor(h) >= prev, `the morning gets darker at ${h}`)
    prev = dayFactor(h)
  }
})

test('the light turns golden round sunrise and sunset and nowhere else', () => {
  assert.equal(duskFactor(12), 0)
  assert.equal(duskFactor(0), 0)
  assert.equal(duskFactor(3), 0)
  assert.equal(duskFactor(6.5), 1)
  assert.equal(duskFactor(19), 1)
  assert.ok(duskFactor(18) > 0 && duskFactor(18) < 1)
  // Golden while there is still daylight to colour.
  for (const h of [6.5, 19]) assert.ok(dayFactor(h) > 0.5)
})

test('hours print as a 24-hour clock', () => {
  assert.equal(formatHour(7.5), '07:30')
  assert.equal(formatHour(19.25), '19:15')
})
