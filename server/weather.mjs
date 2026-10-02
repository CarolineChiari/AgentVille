// The weather where the person lives, for the village's sky. Only when they have typed a place in
// Settings; with none, nothing here runs and the village makes its weather up (src/sim/weather.js).
// This is the second part of AgentVille that talks to the network, and it sends exactly one thing:
// the place name, to Open-Meteo's geocoder, then the coordinates it answers with to its forecast.
// No key, no account, nothing stored on disk; the answer is kept in memory for an hour.

/** Weather moves slowly, and the page asks hourly; this just keeps a reload from asking again. */
export const WEATHER_TTL_MS = 60 * 60 * 1000
const TIMEOUT_MS = 10_000
const GEOCODE = 'https://geocoding-api.open-meteo.com/v1/search'
const FORECAST = 'https://api.open-meteo.com/v1/forecast'
/** Long enough for "Saint-Jean-de-Luz, France"; short enough that it is never a payload. */
export const PLACE_MAX = 80
/** Letters in any script, digits, and the punctuation a place is written with. Never a URL or markup. */
const PLACE_RE = /^[\p{L}\p{M}\p{N} .,'’()-]+$/u

/** The place as typed, trimmed and single-spaced, or '' when it is not one. */
export function cleanPlace(value) {
  if (typeof value !== 'string') return ''
  const s = value.trim().replace(/\s+/g, ' ')
  return s && s.length <= PLACE_MAX && PLACE_RE.test(s) ? s : ''
}

async function getJson(fetchFn, url) {
  const res = await fetchFn(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/**
 * The store: `get(place)` → { ok: true, place, code } with a WMO weather code, or { ok: false,
 * error }. `fetch` and `now` are injected so the tests never touch the network.
 */
export function createWeatherStore({ fetch: fetchFn = globalThis.fetch, now = Date.now } = {}) {
  const cache = new Map() // lower-cased place → { at, result }
  return {
    async get(raw) {
      const place = cleanPlace(raw)
      if (!place) return { ok: false, error: 'Not a place name.' }
      const key = place.toLowerCase()
      const hit = cache.get(key)
      if (hit && now() - hit.at < WEATHER_TTL_MS) return hit.result
      let result
      try {
        // Only the part before a comma names the place to the geocoder; the rest picks among namesakes.
        const [name, ...rest] = place.split(',')
        const found = await getJson(fetchFn, `${GEOCODE}?${new URLSearchParams({ name: name.trim(), count: '10', language: 'en' })}`)
        const wanted = rest.join(' ').trim().toLowerCase()
        const matches = found.results || []
        const spot = (wanted && matches.find((r) => [r.admin1, r.country, r.country_code].some((x) => String(x || '').toLowerCase().includes(wanted)))) || matches[0]
        if (!spot) {
          result = { ok: false, error: `Couldn’t find “${place}”.` }
        } else {
          const lat = Number(spot.latitude)
          const lon = Number(spot.longitude)
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('bad coordinates')
          const w = await getJson(fetchFn, `${FORECAST}?${new URLSearchParams({ latitude: String(lat), longitude: String(lon), current: 'weather_code' })}`)
          const code = Number(w?.current?.weather_code)
          if (!Number.isFinite(code)) throw new Error('no weather in the answer')
          result = { ok: true, place: [spot.name, spot.admin1, spot.country].filter(Boolean).join(', '), code }
        }
      } catch (err) {
        // A failure is not cached, so the next hour's ask tries again; the village keeps its last sky meanwhile.
        return { ok: false, error: `Couldn’t reach the weather service (${err.message}).` }
      }
      if (result.ok) cache.set(key, { at: now(), result })
      return result
    },
  }
}
