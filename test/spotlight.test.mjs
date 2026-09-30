import test from 'node:test'
import assert from 'node:assert/strict'
import { SPOTLIGHT_MAX_MS, SPOTLIGHT_SPANS, cleanSpotlights, litIds, spanById, timeLeft, withMarker, withSpotlight } from '../src/game/spotlight.js'
import { edgePointer } from '../src/render/spotlight.js'
import { THEMES, markerFor } from '../src/sim/themes.js'
import { mergeState } from '../src/game/merge-state.js'
import { normalizeState } from '../server/state.mjs'
import { World } from '../src/sim/world.js'
import { Village } from '../src/game/village.js'

const NOW = 1_700_000_000_000
const HOUR = 3_600_000

test('a day is on offer, and every span has a distinct id with no colon', () => {
  assert.equal(spanById('1d').ms, 24 * HOUR)
  assert.equal(new Set(SPOTLIGHT_SPANS.map((s) => s.id)).size, SPOTLIGHT_SPANS.length)
  for (const s of SPOTLIGHT_SPANS) assert.ok(!s.id.includes(':') && s.ms > 0 && s.ms <= SPOTLIGHT_MAX_MS)
  assert.equal(spanById('nope'), null)
})

test('lighting a spotlight runs from now, lighting it again starts over and keeps its marker', () => {
  let s = withSpotlight({}, 'a', HOUR, NOW)
  assert.deepEqual(s, { a: { theme: '', marker: '', until: NOW + HOUR } })
  s = withMarker(s, 'a', 'halloween', 'bat')
  s = withSpotlight(s, 'a', 24 * HOUR, NOW + 10)
  assert.deepEqual(s, { a: { theme: 'halloween', marker: 'bat', until: NOW + 10 + 24 * HOUR } })
  assert.deepEqual(withSpotlight(s, 'a', 0, NOW), {})
  assert.equal(withSpotlight({}, 'b', 99 * SPOTLIGHT_MAX_MS, NOW).b.until, NOW + SPOTLIGHT_MAX_MS)
})

test('a marker is only picked for a spotlight that is lit, and a bad one goes back to its own theme\'s', () => {
  const s = withSpotlight({}, 'a', HOUR, NOW)
  assert.deepEqual(withMarker(s, 'b', 'farm', 'hen'), s)
  assert.deepEqual(withMarker(s, 'a', 'farm', 'hen').a, { theme: 'farm', marker: 'hen', until: NOW + HOUR })
  assert.deepEqual(withMarker(s, 'a', 'Farm!', 'hen').a, { theme: '', marker: '', until: NOW + HOUR })
  assert.deepEqual(withMarker(withMarker(s, 'a', 'farm', 'hen'), 'a').a, { theme: '', marker: '', until: NOW + HOUR })
})

test('spotlights that went out, or were never real, are dropped, and a bare time is one with no marker', () => {
  const raw = {
    a: { until: NOW + HOUR, theme: 'seaside', marker: 'anchor' }, b: { until: NOW - 1 }, c: 'x', d: { until: NOW + 2 * SPOTLIGHT_MAX_MS },
    e: { until: NaN }, f: NOW + HOUR, g: { until: NOW + HOUR, theme: 'seaside', marker: '../x' }, __proto__: NOW + HOUR,
  }
  assert.deepEqual(cleanSpotlights(raw, NOW), {
    a: { until: NOW + HOUR, theme: 'seaside', marker: 'anchor' },
    f: { until: NOW + HOUR, theme: '', marker: '' },
    g: { until: NOW + HOUR, theme: '', marker: '' },
  })
  assert.deepEqual(cleanSpotlights([NOW], NOW), {})
  assert.deepEqual(cleanSpotlights(null, NOW), {})
  assert.deepEqual([...litIds(raw, NOW)], [['a', { theme: 'seaside', marker: 'anchor' }], ['f', { theme: '', marker: '' }], ['g', { theme: '', marker: '' }]])
})

test('a spotlight shows the marker picked from any theme, else its own plot\'s theme\'s first', () => {
  assert.deepEqual(markerFor({ theme: 'halloween', marker: 'ghost' }, 'farm'), { theme: 'halloween', id: 'ghost' })
  assert.deepEqual(markerFor({ theme: '', marker: '' }, 'farm'), { theme: 'farm', id: THEMES.farm.spotlights[0].id })
  assert.deepEqual(markerFor(null, 'seaside'), { theme: 'seaside', id: THEMES.seaside.spotlights[0].id })
  // A marker that went away, or one of another theme's names, falls back rather than drawing nothing.
  assert.deepEqual(markerFor({ theme: 'farm', marker: 'ghost' }, 'village'), { theme: 'village', id: 'arrow' })
  assert.deepEqual(markerFor({ theme: 'gone', marker: 'x' }, 'nowhere'), { theme: 'village', id: 'arrow' })
})

test('the card says how long is left in the largest units that fit', () => {
  assert.equal(timeLeft(NOW + 5 * 60_000, NOW), '5m left')
  assert.equal(timeLeft(NOW + 60 * 60_000, NOW), '1h left')
  assert.equal(timeLeft(NOW + 200 * 60_000, NOW), '3h 20m left')
  assert.equal(timeLeft(NOW + 24 * HOUR, NOW), '1d left')
  assert.equal(timeLeft(NOW + 52 * HOUR, NOW), '2d 4h left')
  assert.equal(timeLeft(NOW - 1, NOW), '')
})

test('village.json keeps spotlights and their markers, and two tabs merge them key by key', () => {
  const until = Date.now() + HOUR
  assert.deepEqual(normalizeState({ spotlights: { a: { until, theme: 'elvish', marker: 'moon' }, b: 5 } }).spotlights, { a: { until, theme: 'elvish', marker: 'moon' } })
  assert.deepEqual(normalizeState({}).spotlights, {})
  const out = mergeState({ spotlights: {} }, { spotlights: { a: { until: 1 } } }, { spotlights: { b: { until: 2 } } })
  assert.deepEqual(out.spotlights, { a: { until: 1 }, b: { until: 2 } })
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

/** A demo village of `ids`, driven the way the page drives it. */
function village(ids) {
  const v = new Village({ world: new World(), settings: { hideDormant: false }, demo: true })
  const now = Date.now()
  v.scannedThreads = ids.map((id) => ({ id, project: 'orchard', projectPath: '/demo/orchard', createdAt: now - 1000, lastActivityAt: now, title: id }))
  v._name()
  v.scanned = true
  v.apply()
  return v
}

test('a spotlight that went out is left for the server, so a merge keeps another tab lighting it again', () => {
  const v = village(['a'])
  const gone = { until: Date.now() - 1, theme: '', marker: '' }
  v.state.spotlights = { a: gone }
  v.apply()
  assert.deepEqual(v.state.spotlights, { a: gone }, 'applying took it out as if someone had')
  assert.equal(v.spotlightOf('a'), 0)
  const renewed = { until: Date.now() + HOUR, theme: '', marker: '' }
  const merged = mergeState({ spotlights: { a: gone } }, v.state, { spotlights: { a: renewed } })
  assert.deepEqual(merged.spotlights, { a: renewed })
})

test('a picked marker that no longer exists shows its own theme\'s, and the card says so', () => {
  const v = village(['a'])
  const until = Date.now() + HOUR
  v.state.spotlights = { a: { until, theme: 'farm', marker: 'hen' } }
  assert.equal(v.spotlightPicked('a'), true)
  v.state.spotlights = { a: { until, theme: 'farm', marker: 'long-gone' } }
  assert.equal(v.spotlightPicked('a'), false)
  assert.equal(v.spotlightMarker('a').id, THEMES.village.spotlights[0].id)
})

test('F goes on from the last spotlit villager flown to, even after one before it goes out', () => {
  const v = village(['a', 'b', 'c'])
  const at = Date.now()
  v.state.spotlights = { a: { until: at + HOUR }, b: { until: at + 2 * HOUR }, c: { until: at + 3 * HOUR } }
  assert.equal(v.nextSpotlit(), 'a')
  assert.equal(v.nextSpotlit(), 'b')
  delete v.state.spotlights.a
  assert.equal(v.nextSpotlit(), 'c')
  assert.equal(v.nextSpotlit(), 'b')
})
