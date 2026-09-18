// How worn a thread's building looks: gleaming while it works or just after, then weathering a
// step at a time the longer nobody touches it, until it is boarded up and covered in ivy. Pure, so
// the grades and the thresholds between them are tested under Node.
import { STALE_MS } from './constants.js'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

export const WEAR = ['gleaming', 'kept', 'weathered', 'shabby', 'rundown', 'derelict']
export const GLEAMING = 0
/** How a building looked before it aged: the grade a building site or an unknown one is drawn at. */
export const KEPT = 1

/**
 * How long a thread must have sat untouched to reach each grade. Roughly a step per order of
 * magnitude, because the ages that matter span one: a thread you left over lunch and one you
 * forgot in spring are both "not today", and a linear scale would call them the same. Shabby
 * starts where the villager falls asleep, so the two always agree. The last step is two months,
 * not two weeks: most of a busy machine's threads are older than that, and the scale should still
 * be telling a month-old thread from a season-old one.
 */
export const WEAR_AFTER = [0, HOUR, DAY, STALE_MS, 14 * DAY, 60 * DAY]

export const WEAR_LABEL = {
  gleaming: 'Gleaming',
  kept: 'Well kept',
  weathered: 'Weathered',
  shabby: 'Shabby',
  rundown: 'Run down',
  derelict: 'Derelict',
}

/** The grade (an index into WEAR) of a thread's building at `now`. A running thread always gleams. */
export function wearOf(t, now = Date.now()) {
  if (t.running) return GLEAMING
  const idle = now - (t.lastActivityAt || 0)
  let w = GLEAMING
  // Strictly more than, as statusFor has it, so a house turns shabby the moment its villager sleeps.
  while (w + 1 < WEAR_AFTER.length && idle > WEAR_AFTER[w + 1]) w++
  return w
}
