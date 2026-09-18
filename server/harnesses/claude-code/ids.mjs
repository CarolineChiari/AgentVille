// Ids are checked with a regex AND a typeof: a one-element array holding a UUID passes
// `RegExp.test` through string coercion, and these strings end up in URLs.
export const HARNESS_ID = 'claude-code'
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const DESKTOP_ID_RE = /^local_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const isCliId = (v) => typeof v === 'string' && UUID_RE.test(v)
export const isDesktopId = (v) => typeof v === 'string' && DESKTOP_ID_RE.test(v)

/** The colony-wide id for a Claude Code thread. Prefixed so two harnesses can never collide. */
export const threadId = (sessionId) => `${HARNESS_ID}:${sessionId}`
