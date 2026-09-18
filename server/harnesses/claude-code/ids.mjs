// Ids are checked with a regex AND a typeof: a one-element array holding a UUID passes
// `RegExp.test` through string coercion, and these strings end up in URLs.
export const HARNESS_ID = 'claude-code'
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const DESKTOP_ID_RE = /^local_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const isCliId = (v) => typeof v === 'string' && UUID_RE.test(v)
export const isDesktopId = (v) => typeof v === 'string' && DESKTOP_ID_RE.test(v)

/** The colony-wide id for a Claude Code thread. Prefixed so two harnesses can never collide. */
export const threadId = (sessionId) => `${HARNESS_ID}:${sessionId}`

/**
 * Models a new session may be started with: the CLI's aliases (optionally with the 1M-context
 * suffix) or a full model id. Anything else is refused before it reaches a command line.
 */
export const MODEL_RE = /^(fable|opus|sonnet|haiku|opusplan|claude-[a-z0-9.-]{2,60})(\[1m\])?$/
export const isModel = (v) => typeof v === 'string' && MODEL_RE.test(v)

/** Effort levels the CLI's --effort flag accepts. */
export const EFFORTS = new Set(['low', 'medium', 'high', 'xhigh', 'max'])
export const isEffort = (v) => typeof v === 'string' && EFFORTS.has(v)

/** The model menu for a terminal session. '' leaves it to your Claude Code default (settings.json). */
export const MODEL_CHOICES = [
  ['', 'Your default'],
  ['fable', 'Fable'],
  ['opus', 'Opus'],
  ['opus[1m]', 'Opus, 1M context'],
  ['sonnet', 'Sonnet'],
  ['haiku', 'Haiku'],
]

/** The effort menu for a terminal session. '' leaves it to your default. */
export const EFFORT_CHOICES = [
  ['', 'Your default'],
  ['low', 'Low'],
  ['medium', 'Medium'],
  ['high', 'High'],
  ['xhigh', 'Extra high'],
  ['max', 'Max'],
]
