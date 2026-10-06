// The calendar: which holiday theme the village puts on by itself, and when. Pure, so it runs
// under Node: a date goes in, a theme id comes out. Nothing here reads the clock or the network.
//
// Each holiday is a window of days around its day: a lead-in, so the village is dressed a little
// before, and a tail, so it isn't stripped the minute it ends. Fixed dates and the holidays that
// fall on "the nth weekday of a month" are computed. Easter (the computus) and the lunar and
// lunisolar holidays (Lunar New Year, Eid, Diwali, Hanukkah, Holi) join when their themes land:
// the first needs its algorithm, the rest a bundled table of dates with its source recorded, since
// nothing may be fetched from the network.
import { THEMES } from './themes.js'

const DAY_MS = 86_400_000

/**
 * A calendar day as a whole number, the same everywhere. Counted in UTC so a daylight-saving
 * change never makes a day 23 or 25 hours long; the person's own local y/m/d goes in, not an instant.
 */
export const dayOf = (year, month, day) => Math.round(Date.UTC(year, month - 1, day) / DAY_MS)

/** The local calendar day of an instant: what the person's wall calendar says right now. */
export const todayOf = (date = new Date()) => dayOf(date.getFullYear(), date.getMonth() + 1, date.getDate())

/** `{ year, month, day }` of a day number, for showing it. */
export function ymd(day) {
  const d = new Date(day * DAY_MS)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

/** The day of the nth (1-based) given weekday (0 Sunday … 6 Saturday) of a month. */
export function nthWeekday(year, month, weekday, n) {
  const first = dayOf(year, month, 1)
  const offset = (weekday - new Date(first * DAY_MS).getUTCDay() + 7) % 7
  return first + offset + (n - 1) * 7
}

/**
 * @typedef {object} Holiday
 * @property {string} id      saved in the settings, so never renamed
 * @property {string} label
 * @property {string} theme   the theme the village wears for it, an id from themes.js
 * @property {(year: number) => number} on  the day it falls on, in a year
 * @property {number} lead    days before it that the village is already dressed
 * @property {number} tail    days after it that the village stays dressed
 * @property {boolean} def    whether it is ticked until someone unticks it
 */

/** @type {Holiday[]} */
export const HOLIDAYS = [
  // From the 24th, a week of pumpkins, and the morning after for the sweets.
  { id: 'halloween', label: 'Halloween', theme: 'halloween', on: (y) => dayOf(y, 10, 31), lead: 7, tail: 1, def: true },
  // The fourth Thursday of November, with the week before it for the cooking.
  { id: 'thanksgiving', label: 'Thanksgiving', theme: 'thanksgiving', on: (y) => nthWeekday(y, 11, 4, 4), lead: 6, tail: 1, def: true },
  // The last week of the year, through New Year's Day, which is in the next year's window.
  { id: 'new-years-eve', label: "New Year's Eve", theme: 'new-years-eve', on: (y) => dayOf(y, 12, 31), lead: 5, tail: 1, def: true },
]

/** Whether a settings value names a holiday that exists. */
export const isHoliday = (id) => typeof id === 'string' && HOLIDAYS.some((h) => h.id === id)

/** The holidays ticked: what the person chose in `chosen` (id → boolean), else each one's default. */
export function ticked(chosen) {
  const own = chosen && typeof chosen === 'object' ? chosen : {}
  return HOLIDAYS.filter((h) => (Object.hasOwn(own, h.id) && typeof own[h.id] === 'boolean' ? own[h.id] : h.def))
}

/** Every window of `list` that could reach `day`: last year's, this year's and next year's of each. */
function windows(day, list) {
  const year = ymd(day).year
  const out = []
  for (const h of list) {
    for (let y = year - 1; y <= year + 1; y++) {
      const on = h.on(y)
      out.push({ holiday: h, on, start: on - h.lead, end: on + h.tail })
    }
  }
  return out
}

/**
 * The holiday the village is dressed for on `day`, `{ holiday, on, start, end }`, or null. If two
 * windows overlap, the one that started last wins: the newer occasion is the one being prepared for.
 */
export function activeHoliday(day, list = HOLIDAYS) {
  let best = null
  for (const w of windows(day, list)) {
    if (w.start <= day && day <= w.end && (!best || w.start > best.start)) best = w
  }
  return best
}

/** The next window to open after `day`, the same shape, or null if no holiday is ticked. */
export function nextHoliday(day, list = HOLIDAYS) {
  let best = null
  for (const w of windows(day, list)) if (w.start > day && (!best || w.start < best.start)) best = w
  return best
}

/**
 * The theme to wear on `day`: the holiday's if one is on and its theme exists, else `base`.
 * @param {number} day
 * @param {string} base  what the person picked as the village's theme
 * @param {Record<string, boolean>} [chosen]  the holidays ticked or unticked in the settings
 */
export function themeOnDay(day, base, chosen) {
  const w = activeHoliday(day, ticked(chosen))
  return w && Object.hasOwn(THEMES, w.holiday.theme) ? w.holiday.theme : base
}
