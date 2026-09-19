// How far a repo has come: the work done in it, as points, and the tier of landmark those points
// have raised in the middle of its plot. Pure numbers; what a tier is called and how it looks is
// up to the theme (`landmark` in themes.js, and each pack's `landmark.*` sprites).

/** Points each tier of landmark needs: a campfire for nothing, then a well, and so on to a keep. */
export const TIER_AT = [0, 5, 15, 40, 100, 250]
export const MAX_TIER = TIER_AT.length - 1

/**
 * How much of one thread's transcript counts. A session left running for a week writes megabytes
 * of tool output without doing a week's work; past this it is the same session, not more of them.
 */
export const THREAD_BYTES_CAP = 1_000_000
/**
 * Transcript bytes per point. A solid session's transcript runs to a megabyte or more, mostly tool
 * output; at 100 KB a point, transcripts outweighed everything else ten to one, and a repo's
 * finished work barely moved its landmark. At this rate a session is worth up to four points for
 * what it did, two more if it finished, and one for being there.
 */
export const BYTES_PER_POINT = 250_000
/** Lines of code in the repo per point. */
export const LINES_PER_POINT = 1_000
/**
 * The most points a repo's size alone can earn. A two-million-line monorepo you have never worked
 * in must not stand a keep on day one; working there still earns everything else.
 */
export const LINES_CAP = 50

/**
 * @typedef {object} Growth
 * @property {number} sessions  threads ever seen on the repo, live or archived
 * @property {number} finished  finished work in its garden: archived threads and merged PRs, not open ones
 * @property {number} bytes     its threads' transcript bytes, each already capped at THREAD_BYTES_CAP
 * @property {number} [lines]   lines of code in the repo, if they have been counted
 */

const count = (n) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0)

/** The points each kind of work is worth, so a panel can say where a repo's points came from. */
export function breakdownOf({ sessions = 0, finished = 0, bytes = 0, lines = 0 } = {}) {
  return {
    finished: count(finished) * 2,
    sessions: count(sessions),
    bytes: Math.floor(count(bytes) / BYTES_PER_POINT),
    lines: Math.min(LINES_CAP, Math.floor(count(lines) / LINES_PER_POINT)),
  }
}

/** The highest tier `points` reach. */
export function tierFor(points) {
  let tier = 0
  while (tier < MAX_TIER && points >= TIER_AT[tier + 1]) tier++
  return tier
}

/** Points still needed to go up from `tier`, or null at the top. */
export function nextFor(points, tier) {
  return tier >= MAX_TIER ? null : Math.max(0, TIER_AT[tier + 1] - points)
}

/**
 * A repo's points and tier.
 * @param {Growth} g
 * @returns {{ points: number, tier: number, next: number|null, breakdown: ReturnType<typeof breakdownOf> }}
 */
export function progressOf(g) {
  const breakdown = breakdownOf(g)
  const points = breakdown.finished + breakdown.sessions + breakdown.bytes + breakdown.lines
  const tier = tierFor(points)
  return { points, tier, next: nextFor(points, tier), breakdown }
}
