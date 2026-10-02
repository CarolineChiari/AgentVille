import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SEASONS, fallingIn, fromCode, leavesIn, seasonOf, skyFor, weatherAt } from '../src/sim/weather.js'

const day = (m, d = 15) => new Date(2026, m, d)

test('seasons follow the months, and flip in the south', () => {
  assert.deepEqual([0, 3, 6, 9].map((m) => seasonOf(day(m))), ['winter', 'spring', 'summer', 'autumn'])
  assert.deepEqual([0, 3, 6, 9].map((m) => seasonOf(day(m), true)), ['summer', 'autumn', 'winter', 'spring'])
  assert.equal(new Set(SEASONS.map((s) => s)).size, 4)
})

test('the weather holds for hours and is the same for the same moment', () => {
  assert.deepEqual(weatherAt(day(3), 9), weatherAt(day(3), 9))
  assert.deepEqual(weatherAt(day(3), 8.0), weatherAt(day(3), 11.9))
})

test('weather changes a few times over the year but never snows in summer or rains in winter', () => {
  const kinds = new Set()
  for (let d = 1; d <= 28; d++) for (let h = 0; h < 24; h += 4) {
    const w = weatherAt(day(6, d), h)
    assert.notEqual(w.kind, 'snow')
    const v = weatherAt(day(0, d), h)
    assert.notEqual(v.kind, 'rain')
    assert.ok(w.intensity >= 0 && w.intensity <= 1)
    kinds.add(v.kind)
  }
  assert.deepEqual([...kinds].sort(), ['clear', 'snow'])
})

test('real WMO codes map onto rain, snow and clear', () => {
  assert.equal(fromCode(0).kind, 'clear')
  assert.equal(fromCode(3).kind, 'clear')
  assert.equal(fromCode(45).kind, 'clear')
  assert.equal(fromCode(53).kind, 'rain')
  assert.equal(fromCode(81).kind, 'rain')
  assert.equal(fromCode(75).kind, 'snow')
  assert.equal(fromCode(95).kind, 'rain')
  assert.equal(fromCode(95).intensity, 1)
  assert.equal(fromCode('nope').kind, 'clear')
  assert.ok(fromCode(61).intensity < fromCode(65).intensity)
})

test('the sky follows weather off, the real weather, and a hand-set clock', () => {
  const base = { weather: true, timeMode: 'live', season: 'auto', sky: 'auto', south: false }
  assert.equal(skyFor({ ...base, weather: false }, day(0), 12).off, true)
  assert.deepEqual(skyFor(base, day(0), 12, { kind: 'rain', intensity: 0.5 }), { season: 'winter', kind: 'rain', intensity: 0.5 })
  const manual = { ...base, timeMode: 'manual', season: 'autumn', sky: 'rain' }
  // A clock set by hand is for looking at the village: real weather does not override it.
  assert.deepEqual(skyFor(manual, day(0), 12, { kind: 'snow', intensity: 1 }), { season: 'autumn', kind: 'rain', intensity: 0.8 })
  assert.equal(skyFor({ ...manual, sky: 'clear' }, day(0), 12).kind, 'clear')
  assert.equal(skyFor({ ...manual, sky: 'auto', season: 'winter' }, day(6), 12).season, 'winter')
})

test('falling specks stay in the view, scale with intensity, and move with time', () => {
  const view = { x0: 0, y0: 0, x1: 800, y1: 500 }
  assert.deepEqual(fallingIn(view, { kind: 'clear', intensity: 0 }, 5), [])
  const light = fallingIn(view, { kind: 'rain', intensity: 0.3 }, 5)
  const heavy = fallingIn(view, { kind: 'rain', intensity: 1 }, 5)
  assert.ok(heavy.length > light.length && light.length > 0)
  for (const f of heavy) assert.ok(f.x >= 0 && f.x < 800 && f.y >= 0 && f.y < 500)
  assert.notDeepEqual(fallingIn(view, { kind: 'snow', intensity: 1 }, 1), fallingIn(view, { kind: 'snow', intensity: 1 }, 2))
  assert.deepEqual(fallingIn(view, { kind: 'snow', intensity: 1 }, 1), fallingIn(view, { kind: 'snow', intensity: 1 }, 1))
})

test('autumn leaves stay in the view with one of three colours', () => {
  const view = { x0: -100, y0: -100, x1: 600, y1: 400 }
  const leaves = leavesIn(view, 12)
  assert.ok(leaves.length >= 3)
  for (const l of leaves) assert.ok(l.x >= -100 && l.x < 600 && l.y >= -100 && l.y < 400 && [0, 1, 2].includes(l.hue))
})
