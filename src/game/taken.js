// Pure: which open issues a villager has already been handed. Recording it and drawing it are the
// village's and the card's business.

/**
 * Whether a thread's first prompt is `issueTask`'s for issue `n`. Matches "issue #12" and not
 * "issue #123" or "issue #1", and only in the shape `issueTask` writes, so a prompt that merely
 * mentions a number elsewhere doesn't claim it.
 */
export const mentionsIssue = (prompt, n) => new RegExp(`\\bissue #${Number(n)}(?!\\d)`, 'i').test(String(prompt || ''))

/**
 * Issue id → the thread that has it. A thread on the repo whose first prompt names the issue
 * counts, which catches sessions started before anything was recorded; a recorded one counts only
 * while that thread is still alive. The newest thread wins when two have it.
 * @param {{ id: string, number: number }[]} issues  the repo's open issues, `id` as the board has it
 * @param {{ id: string, project: string, preview?: string, createdAt?: number }[]} threads  live ones
 * @param {Record<string, { threadId: string }>} record
 * @param {string} project
 * @returns {Map<string, string>}
 */
export function takenIssues(issues, threads, record, project) {
  const mine = threads.filter((t) => t.project === project).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  const alive = new Set(threads.map((t) => t.id))
  const out = new Map()
  for (const i of issues) {
    const named = mine.find((t) => mentionsIssue(t.preview, i.number))
    const kept = record?.[i.id]?.threadId
    if (named) out.set(i.id, named.id)
    else if (kept && alive.has(kept)) out.set(i.id, kept)
  }
  return out
}

/** The record without issues that have left the open list or whose thread is gone. */
export function pruneTaken(record, openIds, liveIds) {
  const out = {}
  for (const [id, r] of Object.entries(record || {})) if (openIds.has(id) && liveIds.has(r?.threadId)) out[id] = r
  return out
}
