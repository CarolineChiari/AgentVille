// The village's weather: the season from the date, and what falls from the sky at a given moment.
// Pure, in plain numbers, so it runs under Node; the renderer only draws a `Weather`.
//
// A Weather is { kind, intensity }: kind 'clear' | 'rain' | 'snow', intensity 0..1. Where it comes
// from is no business of the renderer's: `weatherAt` makes it up from the date and a seed, and
// `fromCode` maps a real forecast's WMO code onto the same shape, so a provider of real weather
// could stand in for the made-up one without the drawing changing.
import { mulberry32 } from './rng.js'

export const SEASONS = ['spring', 'summer', 'autumn', 'winter']
export const KINDS = ['clear', 'rain', 'snow']

/** The season of a date: meteorological seasons, whole months, flipped south of the equator. */
export function seasonOf(date, south = false) {
  const m = date.getMonth() // 0 = January
  const north = m >= 2 && m <= 4 ? 'spring' : m >= 5 && m <= 7 ? 'summer' : m >= 8 && m <= 10 ? 'autumn' : 'winter'
  if (!south) return north
  return SEASONS[(SEASONS.indexOf(north) + 2) % 4]
}

/** Weather changes about this often, in hours: a few times a day, never flickering. */
export const SHOWER_HOURS = 4

/** Share of shower slots with something falling, by season, so winter is wetter than summer. */
const WET = { spring: 0.4, summer: 0.2, autumn: 0.45, winter: 0.45 }

/** A day number that is the same for the same local y/m/d wherever the clock is. */
const dayNumber = (d) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000)

/**
 * The weather over the village at `date`, whatever hour it is by `hour` (the village's own clock,
 * which may be set by hand). Seeded by the slot of the day, so it holds for hours and the same
 * moment always gets the same sky. Winter snows rather than rains; summer never snows.
 */
export function weatherAt(date, hour, south = false) {
  const season = seasonOf(date, south)
  const slot = Math.floor((((hour % 24) + 24) % 24) / SHOWER_HOURS)
  const r = mulberry32(dayNumber(date) * 131 + slot * 7919 + 17)
  const wet = r() < WET[season]
  const intensity = 0.3 + r() * 0.7
  if (!wet) return { kind: 'clear', intensity: 0 }
  return { kind: season === 'winter' ? 'snow' : 'rain', intensity }
}

/**
 * Weather from a WMO weather code, as real forecasts give them (Open-Meteo and others):
 * drizzle, rain and showers → rain, snow and snow showers → snow, thunderstorms → hard rain,
 * everything else (clear, cloud, fog) → clear. Anything unknown is clear.
 */
export function fromCode(code) {
  const c = Number(code)
  if (c >= 51 && c <= 57) return { kind: 'rain', intensity: c >= 55 ? 0.5 : 0.3 }
  if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return { kind: 'rain', intensity: c === 61 || c === 80 ? 0.5 : c === 63 || c === 81 ? 0.7 : 1 }
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return { kind: 'snow', intensity: c === 71 || c === 85 ? 0.4 : c === 73 ? 0.7 : 1 }
  if (c >= 95 && c <= 99) return { kind: 'rain', intensity: 1 }
  return { kind: 'clear', intensity: 0 }
}

/**
 * What the village is under: nothing when weather is off; a hand-set weather and season when the
 * clock is set by hand and one is picked; else the date's own.
 * `settings` is { weather, timeMode, season, sky, south }. `real` is the weather where the person
 * lives, from `fromCode`, once a place is set and it has been heard: it replaces the made-up
 * draw for the date's own season, but never a hand-set clock, which is for looking at the village.
 */
export function skyFor(settings, date, hour, real = null) {
  if (!settings.weather) return { season: seasonOf(date, settings.south), kind: 'clear', intensity: 0, off: true }
  const manual = settings.timeMode === 'manual'
  const season = manual && SEASONS.includes(settings.season) ? settings.season : seasonOf(date, settings.south)
  const forced = manual && KINDS.includes(settings.sky) && settings.sky !== 'auto'
  if (forced) return { season, kind: settings.sky, intensity: settings.sky === 'clear' ? 0 : 0.8 }
  if (real && !manual) return { season, ...real }
  const w = weatherAt(date, hour, settings.south)
  // A hand-set season brings its own sky: the date's draw is only the right shape for the date's.
  if (manual && season !== seasonOf(date, settings.south)) {
    const r = mulberry32(dayNumber(date) * 131 + 5)
    return r() < WET[season] ? { season, kind: season === 'winter' ? 'snow' : 'rain', intensity: 0.5 } : { season, kind: 'clear', intensity: 0 }
  }
  return { season, ...w }
}

/** Streaks or flakes on screen at full intensity, per 100 000 px² of view (world px). */
const DENSITY = { rain: 16, snow: 9 }
/** Fall speeds in world px a second. */
const FALL = { rain: 150, snow: 22 }
/** Rain slants with the wind, a little; snow drifts. */
const SLANT = { rain: 18, snow: 7 }

/**
 * The specks of precipitation over the world rectangle `view` at `time`: { x, y, len }.
 * They fall on a lattice that wraps, so the same speck is always in the same column and the
 * count follows the view's area, not how long it has been falling.
 */
export function fallingIn(view, weather, time) {
  if (weather.kind === 'clear' || weather.intensity <= 0) return []
  const w = view.x1 - view.x0
  const h = view.y1 - view.y0
  const n = Math.min(900, Math.round(((w * h) / 100000) * DENSITY[weather.kind] * weather.intensity))
  const out = []
  for (let i = 0; i < n; i++) {
    const r = mulberry32(i * 2654435 + 1)
    const speed = FALL[weather.kind] * (0.8 + r() * 0.4)
    const sway = weather.kind === 'snow' ? Math.sin(time * 0.9 + i) * 4 : 0
    const t = time * speed + r() * h
    const y = view.y0 + (((t % h) + h) % h)
    const x = view.x0 + ((r() * w + (y - view.y0) * (SLANT[weather.kind] / FALL[weather.kind]) + sway) % w + w) % w
    out.push({ x, y, len: weather.kind === 'rain' ? 4 + weather.intensity * 3 : 1 })
  }
  return out
}

/** Leaves drifting down in autumn: { x, y, hue } with hue an index into the pack's leaf colours. */
export function leavesIn(view, time, count = 14) {
  const w = view.x1 - view.x0
  const h = view.y1 - view.y0
  const n = Math.min(count, Math.max(3, Math.round((w * h) / 120000 * count)))
  const out = []
  for (let i = 0; i < n; i++) {
    const r = mulberry32(i * 40503 + 9)
    const speed = 12 + r() * 10
    const y = view.y0 + ((((time * speed + r() * h) % h) + h) % h)
    const x = view.x0 + ((((r() * w + Math.sin(time * 0.8 + i * 1.7) * 14 + time * 6) % w) + w) % w)
    out.push({ x, y, hue: Math.floor(r() * 3) })
  }
  return out
}
