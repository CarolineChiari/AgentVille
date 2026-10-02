import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HOLIDAYS, activeHoliday, dayOf, isHoliday, nextHoliday, nthWeekday, themeOnDay, ticked, todayOf, ymd } from '../src/sim/calendar.js'
import { THEMES, THEME_ID } from '../src/sim/themes.js'

test('every holiday has a saveable id, and a theme that exists', () => {
  const ids = HOLIDAYS.map((h) => h.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const h of HOLIDAYS) {
    assert.match(h.id, THEME_ID)
    assert.ok(Object.hasOwn(THEMES, h.theme), `${h.id} wears a theme that is not there`)
    assert.ok(h.label && h.lead >= 0 && h.tail >= 0)
    assert.ok(isHoliday(h.id))
  }
  assert.equal(isHoliday('nope'), false)
  assert.equal(isHoliday(7), false)
})

test('day numbers round-trip and do not skip across daylight saving', () => {
  assert.equal(dayOf(2026, 3, 9) - dayOf(2026, 3, 8), 1)
  assert.equal(dayOf(2026, 11, 2) - dayOf(2026, 11, 1), 1)
  assert.deepEqual(ymd(dayOf(2028, 2, 29)), { year: 2028, month: 2, day: 29 })
  assert.equal(todayOf(new Date(2026, 9, 31, 23, 59)), dayOf(2026, 10, 31))
})

test('the nth weekday of a month: Thanksgiving is the fourth Thursday of November', () => {
  const known = { 2025: 27, 2026: 26, 2027: 25, 2028: 23, 2029: 22, 2030: 28 }
  for (const [y, d] of Object.entries(known)) assert.equal(nthWeekday(+y, 11, 4, 4), dayOf(+y, 11, d), String(y))
})

test('Halloween dresses the village from the 24th of October to the 1st of November', () => {
  const on = (m, d) => activeHoliday(dayOf(2026, m, d))?.holiday.id
  assert.equal(on(10, 23), undefined)
  assert.equal(on(10, 24), 'halloween')
  assert.equal(on(10, 31), 'halloween')
  assert.equal(on(11, 1), 'halloween')
  assert.equal(on(11, 2), undefined)
})

test("New Year's Eve reaches across the new year", () => {
  assert.equal(activeHoliday(dayOf(2026, 12, 25)), null)
  assert.equal(activeHoliday(dayOf(2026, 12, 26)).holiday.id, 'new-years-eve')
  assert.equal(activeHoliday(dayOf(2027, 1, 1)).holiday.id, 'new-years-eve')
  assert.equal(activeHoliday(dayOf(2027, 1, 2)), null)
})

test('the right theme for every day of ten years, and the base theme otherwise', () => {
  for (let y = 2026; y <= 2035; y++) {
    for (const h of HOLIDAYS) {
      const on = h.on(y)
      assert.equal(themeOnDay(on, 'village'), h.theme, `${h.id} ${y}`)
      assert.equal(themeOnDay(on - h.lead, 'village'), h.theme, `${h.id} ${y} first day`)
      assert.equal(themeOnDay(on + h.tail, 'village'), h.theme, `${h.id} ${y} last day`)
    }
    assert.equal(themeOnDay(dayOf(y, 7, 4), 'construction'), 'construction')
  }
})

test('a window that opens later wins an overlap', () => {
  const a = { id: 'a', label: 'A', theme: 'halloween', on: () => dayOf(2026, 5, 10), lead: 5, tail: 0, def: true }
  const b = { id: 'b', label: 'B', theme: 'farm', on: () => dayOf(2026, 5, 12), lead: 2, tail: 0, def: true }
  assert.equal(activeHoliday(dayOf(2026, 5, 9), [a, b]).holiday.id, 'a')
  assert.equal(activeHoliday(dayOf(2026, 5, 10), [a, b]).holiday.id, 'b')
})

test('unticked holidays are skipped, and defaults hold for what was never chosen', () => {
  assert.equal(ticked(undefined).length, HOLIDAYS.length)
  assert.equal(ticked('junk').length, HOLIDAYS.length)
  const none = Object.fromEntries(HOLIDAYS.map((h) => [h.id, false]))
  assert.equal(ticked(none).length, 0)
  assert.equal(themeOnDay(dayOf(2026, 10, 31), 'village', none), 'village')
  assert.equal(themeOnDay(dayOf(2026, 10, 31), 'village', { halloween: 'yes' }), 'halloween')
  assert.equal(themeOnDay(dayOf(2026, 10, 31), 'village', { halloween: false }), 'village')
})

test('nextHoliday names the next window to open, even in the next year', () => {
  const n = nextHoliday(dayOf(2026, 12, 28))
  assert.equal(n.holiday.id, 'halloween')
  assert.equal(n.start, dayOf(2027, 10, 24))
  assert.equal(nextHoliday(dayOf(2026, 7, 4)).holiday.id, 'halloween')
  assert.equal(nextHoliday(dayOf(2026, 7, 4), []), null)
})
