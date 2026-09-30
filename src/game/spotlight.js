// Pure: villagers you asked to keep an eye on for a while. Saved in village.json as `spotlights`,
// thread id → the time (ms) its spotlight goes out. A big arrow stands over each one until then,
// and points from the edge of the screen when it walks out of view.
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

/** Thread id → until, only the ones still lit at `now` and none further off than SPOTLIGHT_MAX_MS. */
export function cleanSpotlights(v, now = Date.now()) {
  const out = {}
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out
  for (const [k, until] of Object.entries(v)) {
    if (k === '__proto__' || !k) continue
    if (typeof until !== 'number' || !Number.isFinite(until)) continue
    if (until <= now || until > now + SPOTLIGHT_MAX_MS) continue
    out[k] = until
  }
  return out
}

/** The spotlights with `id`'s lit for `ms` from `now`, or put out when `ms` is 0. */
export function withSpotlight(spotlights, id, ms, now = Date.now()) {
  const out = { ...(spotlights || {}) }
  if (ms > 0) out[id] = now + Math.min(ms, SPOTLIGHT_MAX_MS)
  else delete out[id]
  return out
}

/** Ids whose spotlight is still lit at `now`. */
export function litIds(spotlights, now = Date.now()) {
  return new Set(Object.keys(cleanSpotlights(spotlights, now)))
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
