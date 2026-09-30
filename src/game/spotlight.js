// Pure: villagers you asked to keep an eye on for a while. Saved in village.json as `spotlights`,
// thread id → `{ until, theme, marker }`: when its spotlight goes out (ms), and the marker held up
// over it, one of any theme's (SPOTLIGHT_MARKERS in src/sim/themes.js). '' for both is the
// villager's own theme's first. It points from the edge of the screen when it walks out of view.
//
// Imports nothing: the desktop app ships the server with only the few files it needs from src/,
// and server/state.mjs cleans what it saves with this one.

const HOUR = 60 * 60 * 1000

/** What the card offers, shortest first. A day is the one asked for; a week covers a long job. */
export const SPOTLIGHT_SPANS = [
  { id: '1h', label: '1 hour', ms: HOUR },
  { id: '4h', label: '4 hours', ms: 4 * HOUR },
  { id: '1d', label: '1 day', ms: 24 * HOUR },
  { id: '3d', label: '3 days', ms: 72 * HOUR },
  { id: '1w', label: '1 week', ms: 168 * HOUR },
]

/**
 * Longer than any span, so a clock that jumps a little can't drop a fresh one, but short enough
 * that a hand-edited `until` far in the future doesn't keep an arrow up for good.
 */
export const SPOTLIGHT_MAX_MS = 30 * 24 * HOUR

export const spanById = (id) => SPOTLIGHT_SPANS.find((s) => s.id === id) || null

/**
 * A theme or marker id, as THEME_ID in src/sim/themes.js has it. Copied rather than imported, for
 * the reason above; which ids exist is for the page to decide, and it ignores any it doesn't know.
 */
const ID = /^[a-z][a-z0-9-]{0,31}$/
const idOr = (v) => (typeof v === 'string' && ID.test(v) ? v : '')

/**
 * Thread id → `{ until, theme, marker }`, only the ones still lit at `now` and none further off
 * than SPOTLIGHT_MAX_MS. A bare number is an `until` with no marker picked.
 */
export function cleanSpotlights(v, now = Date.now()) {
  const out = {}
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out
  for (const [k, raw] of Object.entries(v)) {
    if (k === '__proto__' || !k) continue
    const e = typeof raw === 'number' ? { until: raw } : raw && typeof raw === 'object' ? raw : null
    const until = e?.until
    if (typeof until !== 'number' || !Number.isFinite(until)) continue
    if (until <= now || until > now + SPOTLIGHT_MAX_MS) continue
    const theme = idOr(e.theme)
    const marker = theme ? idOr(e.marker) : ''
    out[k] = { until, theme: marker ? theme : '', marker }
  }
  return out
}

/**
 * The spotlights with `id`'s lit for `ms` from `now`, or put out when `ms` is 0. Lighting one
 * again keeps the marker it had.
 */
export function withSpotlight(spotlights, id, ms, now = Date.now()) {
  const out = { ...(spotlights || {}) }
  if (ms > 0) out[id] = { theme: '', marker: '', ...out[id], until: now + Math.min(ms, SPOTLIGHT_MAX_MS) }
  else delete out[id]
  return out
}

/** The spotlights with `id`'s marker changed to `theme`'s `marker`, or back to its own theme's with ''. */
export function withMarker(spotlights, id, theme = '', marker = '') {
  if (!spotlights?.[id]) return spotlights || {}
  const ok = idOr(theme) && idOr(marker)
  return { ...spotlights, [id]: { ...spotlights[id], theme: ok ? theme : '', marker: ok ? marker : '' } }
}

/** Id → the marker picked for it (`{ theme, marker }`, '' for its own), for every spotlight still lit at `now`. */
export function litIds(spotlights, now = Date.now()) {
  return new Map(Object.entries(cleanSpotlights(spotlights, now)).map(([id, e]) => [id, { theme: e.theme, marker: e.marker }]))
}

/** How long a spotlight has left, as the card says it: "3h 20m left", "2d 4h left", "5m left". */
export function timeLeft(until, now = Date.now()) {
  const ms = until - now
  if (!(ms > 0)) return ''
  const mins = Math.ceil(ms / 60000)
  if (mins < 60) return `${mins}m left`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h${mins % 60 ? ` ${mins % 60}m` : ''} left`
  const days = Math.floor(hours / 24)
  return `${days}d${hours % 24 ? ` ${hours % 24}h` : ''} left`
}
