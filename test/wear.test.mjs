import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GLEAMING, KEPT, WEAR, WEAR_AFTER, WEAR_LABEL, wearOf } from '../src/sim/wear.js'
import { statusFor } from '../src/sim/status.js'

const NOW = Date.UTC(2026, 8, 18, 12)
const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR
const at = (ago, more = {}) => ({ lastActivityAt: NOW - ago, running: false, ...more })

test('a building ages a grade at a time the longer its thread sits untouched', () => {
  const cases = [
    [0, 'gleaming'], [HOUR, 'gleaming'], [HOUR + MIN, 'kept'], [23 * HOUR, 'kept'], [DAY + MIN, 'weathered'],
    [3 * DAY, 'weathered'], [3 * DAY + MIN, 'shabby'], [13 * DAY, 'shabby'], [20 * DAY, 'rundown'], [59 * DAY, 'rundown'],
    [61 * DAY, 'derelict'], [400 * DAY, 'derelict'],
  ]
  for (const [ago, name] of cases) assert.equal(WEAR[wearOf(at(ago), NOW)], name, `${ago / HOUR} h idle`)
})

test('a thread at work gleams however long ago it last wrote anything', () => {
  assert.equal(wearOf(at(90 * DAY, { running: true }), NOW), GLEAMING)
})

test('a thread with no activity on record is as old as it gets', () => {
  assert.equal(WEAR[wearOf({ running: false }, NOW)], 'derelict')
})

test('the grades only ever get worse with time', () => {
  let last = GLEAMING
  for (let ago = 0; ago < 120 * DAY; ago += 3 * HOUR) {
    const w = wearOf(at(ago), NOW)
    assert.ok(w >= last, `${ago / DAY} days idle went back from ${WEAR[last]} to ${WEAR[w]}`)
    last = w
  }
})

test('a sleeping villager lives in a shabby house or worse, and an awake one never does', () => {
  for (let ago = 0; ago < 30 * DAY; ago += 30 * MIN) {
    const t = at(ago)
    const asleep = statusFor(t, NOW) === 'sleeping'
    assert.equal(wearOf(t, NOW) >= WEAR.indexOf('shabby'), asleep, `${ago / HOUR} h idle`)
  }
})

test('every grade has a threshold and a label, and kept is the plain look', () => {
  assert.equal(WEAR_AFTER.length, WEAR.length)
  for (const w of WEAR) assert.ok(WEAR_LABEL[w], w)
  assert.equal(WEAR[KEPT], 'kept')
})
