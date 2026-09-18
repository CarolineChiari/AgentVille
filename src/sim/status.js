// The single source of truth for what a thread is doing. Strict precedence, first match wins,
// so a thread can only ever be doing one thing and the badge, card and counts always agree.
import { STALE_MS } from './constants.js'

export const STATUSES = ['blocked', 'working', 'celebrating', 'waiting', 'sleeping', 'idle']

export function statusFor(t, now = Date.now()) {
  const stale = now - (t.lastActivityAt || 0) > STALE_MS
  if (t.hasError) return 'blocked'
  if (t.running) return 'working'
  // A merge is a moment, not a state: celebrate it for as long as the thread is fresh.
  if (!stale && String(t.prState || '').toUpperCase() === 'MERGED') return 'celebrating'
  if (t.unread) return 'waiting'
  if (stale) return 'sleeping'
  return 'idle'
}

/** Only states that want something from you get a badge; forty sleeping villagers would bury the one `?`. */
export const BADGE_FOR = {
  blocked: 'blocked',
  working: 'working',
  celebrating: 'done',
  waiting: 'waiting',
  sleeping: null,
  idle: null,
}

export const STATUS_LABEL = {
  blocked: 'Stuck on an error',
  working: 'Working',
  celebrating: 'PR merged',
  waiting: 'Waiting on you',
  sleeping: 'Asleep',
  idle: 'Pottering about',
}

/** Who comes out of the gate first, and who is cut first if the village is full. */
export const STATUS_RANK = { blocked: 0, waiting: 1, working: 2, celebrating: 3, idle: 4, sleeping: 5 }

/** Transcript size on a log scale, 1 KB → 0, ~3 MB → 1. Shown on the thread card only. */
export function transcriptProgress(sizeBytes) {
  if (!(sizeBytes > 0)) return 0
  return Math.max(0.03, Math.min(1, (Math.log10(sizeBytes) - 3) / 3.5))
}

/** Hand the client's "I looked at this" back onto a thread: viewed since its last activity → not unread. */
export function applyViewed(t, viewedAt) {
  const seen = viewedAt?.[t.id]
  return seen && seen >= (t.lastActivityAt || 0) && t.unread ? { ...t, unread: false } : t
}
