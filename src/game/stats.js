// The almanac: what the village already knows, added up. Pure, so it runs under node --test.
// Nothing here is stored; it is computed from the threads and gardens each time the sheet opens.

const DAY = 86_400_000
export const WEEKS = 8

/** Midnight (local) at the start of the week containing `t`, a week starting on Monday. */
function weekStart(t) {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.getTime()
}

const tally = (map, key) => map.set(key, (map.get(key) || 0) + 1)
const ranked = (map) => [...map].map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n || (a.key < b.key ? -1 : 1))

/**
 * @param {{ createdAt?: number }[]} threads  every thread the scan found
 * @param {Map<string, { id: string, kind: number, open?: boolean, finishedAt: number }[]>} gardens  each repo's flowers
 * @param {number} now
 */
export function almanac(threads, gardens, now = Date.now()) {
  const byKind = new Map()
  const byRepo = new Map()
  const thisWeek = weekStart(now)
  // Oldest first, ending with this week, so a chart reads left to right.
  // Stepped by calendar date, not by 7 × 24h: across a daylight-saving change the latter lands an hour off midnight.
  const weeks = Array.from({ length: WEEKS }, (_, i) => {
    const d = new Date(thisWeek)
    d.setDate(d.getDate() - (WEEKS - 1 - i) * 7)
    return { start: d.getTime(), n: 0 }
  })
  const month = new Date(now)
  let finished = 0
  let mergedThisMonth = 0
  for (const [repo, list] of gardens) {
    for (const f of list) {
      // An open PR's bud is not finished work, and its time is a placeholder.
      if (f.open) continue
      finished++
      tally(byKind, f.kind)
      tally(byRepo, repo)
      const at = new Date(f.finishedAt)
      if (String(f.id).startsWith('pr:') && at.getFullYear() === month.getFullYear() && at.getMonth() === month.getMonth()) mergedThisMonth++
      const slot = weeks.findIndex((w, i) => f.finishedAt >= w.start && (i === WEEKS - 1 || f.finishedAt < weeks[i + 1].start))
      if (slot >= 0 && f.finishedAt <= now) weeks[slot].n++
    }
  }
  const hours = new Array(24).fill(0)
  for (const t of threads) if (t.createdAt > 0) hours[new Date(t.createdAt).getHours()]++
  return { finished, mergedThisMonth, byKind: ranked(byKind), byRepo: ranked(byRepo), weeks, hours, sessions: threads.length }
}
