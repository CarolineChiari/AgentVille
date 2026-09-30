import test from 'node:test'
import assert from 'node:assert/strict'
import { SPOTLIGHT_MAX_MS, SPOTLIGHT_SPANS, cleanSpotlights, litIds, spanById, timeLeft, withSpotlight } from '../src/game/spotlight.js'
import { ARROW, ARROW_H, ARROW_W, edgePointer } from '../src/render/spotlight.js'
import { mergeState } from '../src/game/merge-state.js'
import { normalizeState } from '../server/state.mjs'

const NOW = 1_700_000_000_000
const HOUR = 3_600_000

test('a day is on offer, and every span has a distinct id with no colon', () => {
  assert.equal(spanById('1d').ms, 24 * HOUR)
  assert.equal(new Set(SPOTLIGHT_SPANS.map((s) => s.id)).size, SPOTLIGHT_SPANS.length)
  for (const s of SPOTLIGHT_SPANS) assert.ok(!s.id.includes(':') && s.ms > 0 && s.ms <= SPOTLIGHT_MAX_MS)
  assert.equal(spanById('nope'), null)
})

test('lighting a spotlight runs from now, and lighting it again starts over', () => {
  let s = withSpotlight({}, 'a', HOUR, NOW)
  assert.deepEqual(s, { a: NOW + HOUR })
  s = withSpotlight(s, 'a', 24 * HOUR, NOW + 10)
  assert.deepEqual(s, { a: NOW + 10 + 24 * HOUR })
  assert.deepEqual(withSpotlight(s, 'a', 0, NOW), {})
  assert.equal(withSpotlight({}, 'b', 99 * SPOTLIGHT_MAX_MS, NOW).b, NOW + SPOTLIGHT_MAX_MS)
})

test('spotlights that went out, or were never real, are dropped', () => {
  const raw = { a: NOW + HOUR, b: NOW - 1, c: 'x', d: NOW + 2 * SPOTLIGHT_MAX_MS, e: NaN, __proto__: NOW + HOUR }
  assert.deepEqual(cleanSpotlights(raw, NOW), { a: NOW + HOUR })
  assert.deepEqual(cleanSpotlights([NOW], NOW), {})
  assert.deepEqual(cleanSpotlights(null, NOW), {})
  assert.deepEqual([...litIds(raw, NOW)], ['a'])
})

test('the card says how long is left in the largest units that fit', () => {
  assert.equal(timeLeft(NOW + 5 * 60_000, NOW), '5m left')
  assert.equal(timeLeft(NOW + 60 * 60_000, NOW), '1h left')
  assert.equal(timeLeft(NOW + 200 * 60_000, NOW), '3h 20m left')
  assert.equal(timeLeft(NOW + 24 * HOUR, NOW), '1d left')
  assert.equal(timeLeft(NOW + 52 * HOUR, NOW), '2d 4h left')
  assert.equal(timeLeft(NOW - 1, NOW), '')
})

test('village.json keeps spotlights, and two tabs merge them key by key', () => {
  const until = Date.now() + HOUR
  assert.deepEqual(normalizeState({ spotlights: { a: until, b: 5 } }).spotlights, { a: until })
  assert.deepEqual(normalizeState({}).spotlights, {})
  const out = mergeState({ spotlights: {} }, { spotlights: { a: 1 } }, { spotlights: { b: 2 } })
  assert.deepEqual(out.spotlights, { a: 1, b: 2 })
})

test('the arrow is symmetric about its middle column and every row is its width', () => {
  assert.equal(ARROW.length, ARROW_H)
  for (const row of ARROW) {
    assert.equal(row.length, ARROW_W)
    // The light down one side is still the arrow: symmetric in outline.
    const shape = row.replace(/[+o]/g, 'o')
    assert.equal(shape, [...shape].reverse().join(''))
  }
  assert.equal(ARROW.at(-1)[(ARROW_W - 1) / 2], 'X') // it comes to a point in the middle
})

test('the edge pointer hides while its villager is in view, and aims at it from the edge otherwise', () => {
  const box = { left: 0, top: 0, right: 200, bottom: 100 }
  assert.equal(edgePointer(50, 50, box, 10), null)
  const right = edgePointer(1000, 50, box, 10)
  assert.equal(right.x, 190)
  assert.equal(right.y, 50)
  assert.equal(right.angle, 0)
  const up = edgePointer(100, -500, box, 10)
  assert.equal(up.x, 100)
  assert.equal(up.y, 10)
  assert.ok(Math.abs(up.angle + Math.PI / 2) < 1e-9)
  const corner = edgePointer(-1000, 1000, box, 10)
  assert.ok(corner.x >= 10 && corner.x <= 190 && corner.y >= 10 && corner.y <= 90)
})
