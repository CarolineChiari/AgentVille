// Pure: who has just started needing you, and what the notification about them says. Showing it,
// asking permission and what a click does are the page's business, in src/ui/notices.js.
import { STATUS_LABEL, needsInputLabel } from '../sim/status.js'

/** Titles listed in a notification about several villagers; the rest are counted. */
export const LISTED_MAX = 3
/**
 * A thread's title is often its whole first prompt. Clipped so that three of them still read as a
 * list in the few lines a notification shows, rather than the first one filling it.
 */
export const TITLE_MAX = 60

const needsYou = (status) => status === 'waiting' || status === 'blocked'

/**
 * The threads that have just started needing you, most recent first, and the ids that need you
 * now, to pass back in next time.
 *
 * `asking` is null on the first look, which only takes the baseline: a question that was already
 * there when the village opened is on the screen in front of you, not news. A thread missing from
 * a scan keeps its place, so one that drops out for a poll (a transcript caught mid-write, a repo
 * hidden and shown again) doesn't ring a second time for the same question. Going from waiting to
 * blocked is not new either: you were already told it needs you.
 * @param {{ id: string, status: string, lastActivityAt?: number }[]} threads
 * @param {Set<string> | null} asking
 */
export function newlyAsking(threads, asking) {
  const now = new Set(asking)
  const fresh = []
  for (const t of threads) {
    if (!needsYou(t.status)) now.delete(t.id)
    else if (!now.has(t.id)) {
      now.add(t.id)
      if (asking) fresh.push(t)
    }
  }
  fresh.sort((a, b) => (b.lastActivityAt || 0) - (a.lastActivityAt || 0))
  return { fresh, asking: now }
}

const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)
const titleOf = (t) => String(t.title || 'Untitled').replace(/\s+/g, ' ').trim()

/**
 * What the notification says: one villager by its title and what it wants, or several counted in
 * one, so a poll that finds three new questions rings once. `id` is who a click lands on: the
 * most recent of them.
 * @returns {{ id: string, title: string, body: string } | null}
 */
export function noticeFor(fresh) {
  if (!fresh?.length) return null
  if (fresh.length === 1) {
    const [t] = fresh
    const what = needsInputLabel(t.needsInput) || STATUS_LABEL[t.status] || ''
    return { id: t.id, title: clip(titleOf(t), TITLE_MAX * 2), body: [what, t.project].filter(Boolean).join(' · ') }
  }
  const listed = fresh.slice(0, LISTED_MAX).map((t) => clip(titleOf(t), TITLE_MAX))
  const more = fresh.length - listed.length
  if (more) listed.push(`and ${more} more`)
  return { id: fresh[0].id, title: `${fresh.length} villagers need you`, body: listed.join('\n') }
}

export const APP_TITLE = 'AgentVille'

/**
 * The page's title, with how many villagers need you in front, `(2) AgentVille`, so the tab strip
 * says so without opening the village. The desktop app reads the same number back out of it for
 * the dock badge (`badgeCount` in electron/env.mjs), so the format is shared by the two.
 * @param {{ waiting?: number, blocked?: number }} counts
 */
export function pageTitle(counts) {
  const n = (counts?.waiting || 0) + (counts?.blocked || 0)
  return n ? `(${n}) ${APP_TITLE}` : APP_TITLE
}
